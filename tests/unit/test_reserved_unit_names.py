"""Drift guard for the server-wide units that share the instance units' name prefix (issue #1356).

A game run's unit is `energetica-<slug>.service`, and the server scripts find runs by listing
`energetica-*.service`. The server-wide units (the lobby backend, the lobby service and the reaper)
match that pattern too, so each script names them to skip them, and setup and teardown refuse them
as slugs. A unit added without updating every script is taken for a run: `deployed-versions.sh`
probes a subdomain that does not exist, and a run created with that slug collides with the unit.

These tests read the scripts as text. They do not run them: those need SSH, root and systemd.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

_SCRIPTS = Path(__file__).resolve().parents[2] / "scripts"
_INFRA = _SCRIPTS / "infra"


def _server_wide_unit_names() -> list[str]:
    """`<name>` of each `energetica-<name>.service` in infra. `energetica.service` is the run template."""
    return sorted(
        match.group(1)
        for path in _INFRA.glob("energetica-*.service")
        if (match := re.fullmatch(r"energetica-(.+)\.service", path.name))
    )


def test_the_server_wide_units_are_found() -> None:
    """Guards the glob above: if it found nothing, every test below would pass vacuously."""
    assert {"lobby", "lobby-service", "reaper"} <= set(_server_wide_unit_names())


@pytest.mark.parametrize("name", _server_wide_unit_names())
def test_list_instances_skips_the_unit(name: str) -> None:
    text = (_SCRIPTS / "list-instances.sh").read_text()
    match = re.search(r'case "\$slug" in ([^)]+)\) continue', text)
    assert match, "list-instances.sh no longer skips units with a case statement"
    assert name in match.group(1).split("|")


@pytest.mark.parametrize("name", _server_wide_unit_names())
def test_deployed_versions_skips_the_unit(name: str) -> None:
    text = (_SCRIPTS / "deployed-versions.sh").read_text()
    match = re.search(r'grep -vE "\^\(([^)]+)\)\$"', text)
    assert match, "deployed-versions.sh no longer skips units with grep -vE"
    assert name in match.group(1).split("|")


@pytest.mark.parametrize("script", ["setup-instance.sh", "teardown-instance.sh"])
@pytest.mark.parametrize("name", [*_server_wide_unit_names(), "landing"])
def test_the_name_is_a_reserved_slug(script: str, name: str) -> None:
    assert f'"$INSTANCE" = "{name}"' in (_INFRA / script).read_text()
