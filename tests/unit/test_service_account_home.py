"""Drift guards for the `energetica` service account's home directory (issue #1067).

The account's home used to be `/var/www`, which is root-owned. `sudo -u energetica` sets
`HOME` to it, so pip could not create `~/.cache/pip` and silently ran with its cache disabled.
Nothing fails when this regresses: every install still works, it just re-downloads everything.

`scripts/infra/setup-base.sh` must therefore point the account at a directory it owns, create
that directory, and move an account created before the fix onto it. Most of these tests read
the script as text. The script as a whole is not run, because it needs root; the exception is
the block that creates the home and migrates an existing account, which is lifted out and run
with stubbed commands, so its branching and ordering are observed rather than inferred.
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

_SETUP_BASE = Path(__file__).resolve().parents[2] / "scripts" / "infra" / "setup-base.sh"


def _setup_base_text() -> str:
    return _SETUP_BASE.read_text()


def _service_home() -> str:
    match = re.search(r"^readonly SERVICE_HOME=(\S+)$", _setup_base_text(), re.MULTILINE)
    assert match, "setup-base.sh no longer declares SERVICE_HOME"
    return match.group(1)


def test_service_home_is_outside_the_root_owned_web_root() -> None:
    home = _service_home()
    assert home.startswith("/"), f"SERVICE_HOME is not absolute: {home!r}"
    assert not home.startswith("/var/www"), f"the service home is under the root-owned web root: {home!r}"


def test_new_accounts_are_created_with_the_service_home() -> None:
    useradd = re.search(r"^\s*useradd .*$", _setup_base_text(), re.MULTILINE)
    assert useradd, "setup-base.sh no longer creates the service user"
    assert '--home-dir "$SERVICE_HOME"' in useradd.group(0)


def test_the_service_home_is_created_owned_by_the_service_user() -> None:
    # useradd runs with --no-create-home, so this is the only thing that makes the home exist.
    # Owned by the account itself, not just its group: it is a HOME, and pip writes into it.
    assert 'install -d -o energetica -g energetica -m 0700 "$SERVICE_HOME"' in _setup_base_text(), (
        "setup-base.sh no longer creates the service home as 0700 energetica:energetica"
    )


def _home_setup_source() -> str:
    """The script's create-the-home-and-migrate block, lifted out to be run on its own.

    The script as a whole needs root, so it is not runnable here. This block depends on nothing
    but `SERVICE_HOME`, the two log helpers and three commands, which the harness stubs.
    """
    text = _setup_base_text()
    start = text.index('install -d -o energetica -g energetica -m 0700 "$SERVICE_HOME"')
    migration = text.index('current_home="$(getent passwd energetica', start)
    return text[start : text.index("\nfi\n", migration) + 4]


def _run_home_setup(tmp_path: Path, *, current_home: str, usermod_exit: int = 0) -> tuple[int, list[str], str]:
    """Run the block with stubbed commands. Returns its status, the commands it ran, and its output.

    Every stub appends its own command line to one log, so the order of the calls is observed
    rather than inferred from the text.
    """
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls = tmp_path / "calls.log"
    stubs = {
        "install": "exit 0",
        "usermod": f"exit {usermod_exit}",
        # getent's passwd line, with the home in the sixth field as on a real server.
        "getent": f'echo "energetica:x:999:988::{current_home}:/usr/sbin/nologin"',
    }
    for name, body in stubs.items():
        stub = bin_dir / name
        stub.write_text(f'#!/bin/bash\necho "{name} $*" >> "{calls}"\n{body}\n')
        stub.chmod(0o755)

    harness = tmp_path / "harness.sh"
    harness.write_text(
        # The real script's shell options, so a failing command aborts here exactly as it would there.
        f'set -euo pipefail\nexport PATH="{bin_dir}:$PATH"\nreadonly SERVICE_HOME={_service_home()}\n'
        'log_success() { echo "ok: $1"; }\nlog_error() { echo "error: $1"; }\n'
        f"{_home_setup_source()}\n"
    )
    result = subprocess.run(["bash", str(harness)], capture_output=True, text=True)
    logged = calls.read_text().splitlines() if calls.exists() else []
    return result.returncode, logged, result.stdout


def test_an_existing_account_is_moved_onto_the_home_after_it_is_created(tmp_path: Path) -> None:
    # Re-running setup-base.sh is how an already-provisioned server picks up the fix. The home
    # has to exist before the account points at it, or the service would briefly have no HOME.
    status, calls, _ = _run_home_setup(tmp_path, current_home="/var/www")
    assert status == 0
    commands = [call.split()[0] for call in calls]
    assert commands == ["install", "getent", "usermod"]
    assert calls[-1] == f"usermod --home {_service_home()} energetica"


def test_an_account_already_on_the_home_is_left_alone(tmp_path: Path) -> None:
    # usermod fails while the services run, so calling it when nothing needs changing would turn
    # every re-run on a live server into an error.
    status, calls, _ = _run_home_setup(tmp_path, current_home=_service_home())
    assert status == 0
    assert not any(call.startswith("usermod") for call in calls)


def test_a_refused_move_is_reported_without_aborting_the_script(tmp_path: Path) -> None:
    """usermod refuses while the account has running processes, which is every live server.

    The rest of setup-base.sh is still worth running, so the failure must not trip `set -e`, and
    the message must give the operator the exact command to finish the move.
    """
    status, _, output = _run_home_setup(tmp_path, current_home="/var/www", usermod_exit=8)
    assert status == 0
    assert "error: Could not move the service user's home" in output
    assert f"sudo usermod --home {_service_home()} energetica" in output
    # The lifecycle sweep's timer is also named energetica-*, but runs as root: stopping it would
    # interrupt the sweep for nothing, and it is easy to forget to start again.
    assert "--type=service" in output
    assert "energetica-reaper" in output
