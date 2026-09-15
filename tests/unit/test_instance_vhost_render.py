"""Drift guards for the instance Apache vhost and the script that renders it (issue #1071).

`scripts/infra/apache-instance.conf` is a placeholder template, and
`scripts/infra/update-instance-vhost.sh` is the only thing in the repo that renders it —
`setup-instance.sh` calls that script rather than carrying a second copy of the `sed`. A
placeholder added to the template and not to the renderer ships a vhost with a literal
`@PORT@` in it, which Apache rejects at `configtest`; a renderer that substitutes a token the
template no longer has is a silent no-op. Neither is visible from either file alone.

These tests read the files as text and check the seams between them. They deliberately do not
run the shell script: it needs root, Apache and a provisioned instance.
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

_INFRA = Path(__file__).resolve().parents[2] / "scripts" / "infra"
_VHOST_TEMPLATE = _INFRA / "apache-instance.conf"
_RENDER_SCRIPT = _INFRA / "update-instance-vhost.sh"
_SETUP_SCRIPT = _INFRA / "setup-instance.sh"

_PLACEHOLDER = re.compile(r"@([A-Z_]+)@")

# The shell expression the renderer uses, not a real path — the sibling test module has an
# `_ENV_FILE_PATH` that IS one, so this one is named for what it is.
_ENV_FILE_EXPR = "/etc/energetica/$INSTANCE/instance.env"


def test_the_renderer_and_the_template_agree_on_placeholders() -> None:
    substituted = set(re.findall(r"s/@([A-Z_]+)@/", _RENDER_SCRIPT.read_text()))
    assert substituted == set(_PLACEHOLDER.findall(_VHOST_TEMPLATE.read_text())), (
        "update-instance-vhost.sh and apache-instance.conf disagree on placeholders"
    )


def test_the_template_names_the_script_that_renders_it() -> None:
    # The header is where an operator looks to find out what to re-run after editing.
    assert "update-instance-vhost.sh" in _VHOST_TEMPLATE.read_text()


def test_setup_instance_delegates_the_render_instead_of_repeating_it() -> None:
    """One renderer, two callers — the whole point of #1071.

    `setup-instance.sh` refuses to run twice on a provisioned instance, so a `sed` inlined here
    would again be reachable only at provisioning time and every vhost change would again be a
    hand edit on every server.
    """
    setup = _SETUP_SCRIPT.read_text()
    # The render, not the name: a comment mentioning the template is fine, reading it is not.
    assert '"$SCRIPT_DIR/apache-instance.conf"' not in setup, "setup-instance.sh renders the vhost itself again"
    assert '"$SCRIPT_DIR/update-instance-vhost.sh" "$INSTANCE" --domain "$DOMAIN"' in setup


def test_the_renderer_reads_the_port_from_the_env_file() -> None:
    """The port is discovered, not typed.

    A hand-passed `--port` that disagrees with the running service renders a vhost that passes
    `configtest` and proxies to nothing, so the only source is the instance's own EnvironmentFile
    (#1072), which is what the service itself runs from.
    """
    script = _RENDER_SCRIPT.read_text()
    assert _ENV_FILE_EXPR in script
    assert "ENERGETICA_PORT" in script
    # The argument parser, not the prose: the header explains why there is no port flag, and
    # saying so must not fail the test that enforces it.
    assert "--port)" not in script, "the port must come from instance.env, never from an argument"


def test_the_renderer_configtests_before_it_reloads() -> None:
    script = _RENDER_SCRIPT.read_text()
    assert script.index("apache2ctl configtest") < script.index("systemctl reload apache2")


def test_the_renderer_puts_the_previous_vhost_back_when_configtest_fails() -> None:
    """A failed render must not leave a broken file behind.

    Apache's configuration is server-wide: a vhost that fails `configtest` fails every later
    reload too, including the certbot renewal hook's, so a bad render for one instance would take
    TLS renewal down for all of them.
    """
    script = _RENDER_SCRIPT.read_text()
    assert "restore_previous_vhost() {" in script
    failure_branch = script.split("if ! apache2ctl configtest", 1)[1].split("\nfi", 1)[0]
    assert "exit 1" in failure_branch


def test_the_rollback_covers_every_exit_from_the_window_it_guards() -> None:
    """The rollback must hang off a trap, not off the `configtest` branch alone.

    Between installing the rendered vhost and Apache accepting it, the `configtest` branch is not
    the only way out: `a2ensite` can fail under `set -e`, and an operator can interrupt the test.
    A rollback reachable only from that one branch leaves the untested render installed in either
    case — and deletes the backup on the way out, which is worse than not taking one.
    """
    script = _RENDER_SCRIPT.read_text()
    cleanup = script.split("cleanup() {", 1)[1].split("\n}", 1)[0]
    assert "restore_previous_vhost" in cleanup, "the trap handler does not roll anything back"
    assert "trap cleanup EXIT" in script
    for signal in ("INT", "TERM"):
        # The signal traps exit rather than clean up themselves, so cleanup runs once, via EXIT.
        assert re.search(rf"trap 'exit \d+' {signal}\b", script), f"no {signal} trap"
    # The flags are what tell the handler whether there is anything to undo.
    assert "INSTALLED=true" in script and "COMMITTED=true" in script


def test_the_renderer_is_syntactically_valid_bash() -> None:
    subprocess.run(["bash", "-n", str(_RENDER_SCRIPT)], check=True)
