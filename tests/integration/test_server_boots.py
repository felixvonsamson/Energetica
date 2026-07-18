"""Smoke test that `python main.py` boots a live HTTP server.

This is the only test that exercises the real startup path end to end: argument
parsing in main.py, the ENERGETICA_APP_CONFIG handoff to the uvicorn subprocess, and
uvicorn actually binding a port and serving requests. Every other test uses an
in-process TestClient (see test_health_route.py), which builds the app object but
never boots uvicorn, so a broken boot path would otherwise slip through.

It lives in integration/ (not unit/) because it launches a real subprocess and binds
a real TCP port.
"""

from __future__ import annotations

import os
import signal
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import requests

# main.py sits at the repo root, two levels up from tests/integration/.
REPO_ROOT = Path(__file__).resolve().parents[2]

# Booting uvicorn plus create_app (which loads the game engine) is slow in CI, so allow
# a generous window before declaring the server dead.
BOOT_DEADLINE_S = 60.0
POLL_INTERVAL_S = 0.5


def _free_port() -> int:
    """Ask the OS for an unused localhost TCP port, then release it for the server."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def _terminate_process_group(proc: "subprocess.Popen[bytes]") -> None:
    """Kill the whole process group so the uvicorn child main.py spawned dies too.

    main.py runs uvicorn as its own subprocess, so signalling only main.py's pid would
    orphan the server. start_new_session=True puts both in one group we can signal at once.
    """
    if proc.poll() is not None:
        return
    pgid = os.getpgid(proc.pid)
    try:
        os.killpg(pgid, signal.SIGTERM)
        proc.wait(timeout=10)
    except ProcessLookupError:
        return
    except subprocess.TimeoutExpired:
        os.killpg(pgid, signal.SIGKILL)
        proc.wait(timeout=10)


def test_server_boots_and_serves() -> None:
    port = _free_port()
    # Capture server output to a temp file (not a PIPE we never drain, which could
    # deadlock if the buffer filled) so we can surface it when boot fails.
    with tempfile.TemporaryFile() as server_log:
        proc = subprocess.Popen(
            [
                sys.executable,
                "main.py",
                "--port",
                str(port),
                "--rm_instance",
                "--env",
                "prod",
                "--no-reload",  # the reloader would fork yet another process, complicating teardown
            ],
            cwd=REPO_ROOT,
            stdout=server_log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )

        def read_log() -> str:
            server_log.seek(0)
            return server_log.read().decode(errors="replace")

        try:
            url = f"http://127.0.0.1:{port}/healthz"
            deadline = time.monotonic() + BOOT_DEADLINE_S
            last_error: Exception | None = None

            while time.monotonic() < deadline:
                if proc.poll() is not None:
                    raise AssertionError(
                        f"Server exited before serving (code {proc.returncode}).\n"
                        f"--- server output ---\n{read_log()}"
                    )
                try:
                    response = requests.get(url, timeout=2)
                except requests.RequestException as error:
                    last_error = error
                    time.sleep(POLL_INTERVAL_S)
                    continue

                assert response.status_code == 200, f"{url} returned {response.status_code}"
                assert response.json()["status"] in {"ok", "degraded", "resimulating"}
                return

            raise AssertionError(
                f"Server did not become reachable within {BOOT_DEADLINE_S}s "
                f"(last error: {last_error!r}).\n--- server output ---\n{read_log()}"
            )
        finally:
            _terminate_process_group(proc)
