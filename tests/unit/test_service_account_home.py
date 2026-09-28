"""Drift guards for the `energetica` service account's home directory (issue #1067).

The account's home used to be `/var/www`, which is root-owned. `sudo -u energetica` sets
`HOME` to it, so pip could not create `~/.cache/pip` and silently ran with its cache disabled.
Nothing fails when this regresses: every install still works, it just re-downloads everything.

`scripts/infra/setup-base.sh` must therefore point the account at a directory it owns, create
that directory, and move an account created before the fix onto it. These tests read the
script as text and check that those three places name the same directory. They do not run it,
because it needs root.
"""

from __future__ import annotations

import re
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


def test_an_existing_account_is_moved_onto_the_service_home() -> None:
    # Re-running setup-base.sh is how an already-provisioned server picks up the fix, so the
    # `id energetica` branch has to repoint the home as well, not just report that the user exists.
    assert 'usermod --home "$SERVICE_HOME" energetica' in _setup_base_text()
