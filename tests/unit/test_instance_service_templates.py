"""Drift guards for the instance systemd unit and its EnvironmentFile (issue #1072).

An instance's runtime configuration is split across three files that no single program reads:
`scripts/infra/energetica.service` declares `${VAR}` expansions, `scripts/infra/instance.env.tmpl`
supplies them, and `scripts/infra/setup-instance.sh` renders both with `sed`.
systemd expands an undefined variable to the empty string and starts the service
anyway, so a variable renamed in one file and not the other produces a unit that launches the
server with `--port` and no value — a failure that only ever surfaces on a server.

These tests read the files as text and check the seams between them. They deliberately do not
run the shell scripts: those need root, systemd and Apache.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

_INFRA = Path(__file__).resolve().parents[2] / "scripts" / "infra"
_UNIT_TEMPLATE = _INFRA / "energetica.service"
_ENV_TEMPLATE = _INFRA / "instance.env.tmpl"
_SETUP_SCRIPT = _INFRA / "setup-instance.sh"

_PLACEHOLDER = re.compile(r"@([A-Z_]+)@")
_EXPANSION = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")

_ENV_FILE_PATH = "/etc/energetica/@INSTANCE@/instance.env"


def _placeholders(template: Path) -> set[str]:
    """The `@NAME@` tokens a template expects `sed` to fill in."""
    return set(_PLACEHOLDER.findall(template.read_text()))


def _sed_substitutions(script: Path, template_name: str) -> set[str]:
    """The `@NAME@` tokens `script`'s sed call for `template_name` replaces.

    The call spans several backslash-continued lines and ends with the template path, so find
    that line and walk back to the `sed` that opened the command. A script may name the same
    template earlier, in a preflight existence check, so take the last mention.
    """
    lines = script.read_text().splitlines()
    mentions = [i for i, line in enumerate(lines) if f'"$SCRIPT_DIR/{template_name}"' in line]
    assert mentions, f"{script.name} never renders {template_name}"
    end = mentions[-1]
    start = next(i for i in range(end, -1, -1) if lines[i].lstrip().startswith("sed "))
    return set(re.findall(r"s/@([A-Z_]+)@/", "\n".join(lines[start : end + 1])))


def _env_entries() -> list[tuple[str, str]]:
    """The `KEY=value` pairs of the env template, comments and blank lines dropped."""
    entries = []
    for line in _ENV_TEMPLATE.read_text().splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        key, _, value = line.partition("=")
        entries.append((key, value))
    return entries


def test_unit_expands_only_variables_the_env_template_defines() -> None:
    defined = {key for key, _ in _env_entries()}
    expanded = set(_EXPANSION.findall(_UNIT_TEMPLATE.read_text()))
    assert expanded, "the unit expands no variables at all — did ExecStart lose them?"
    assert expanded <= defined, f"unit expands undefined variables: {sorted(expanded - defined)}"


def test_env_template_lines_are_plain_key_value_pairs() -> None:
    entries = _env_entries()
    keys = [key for key, _ in entries]
    assert len(keys) == len(set(keys)), f"duplicate keys in the env template: {keys}"
    for key, value in entries:
        # systemd's EnvironmentFile parser is not a shell. Keep every line to the boring subset
        # that means the same thing to systemd, to `sed -n "s/^KEY=//p"` (list-instances.sh) and
        # to a human reading it: no quoting, no spaces, no expansion.
        assert re.fullmatch(r"[A-Z][A-Z0-9_]*", key), f"unexpected key: {key!r}"
        assert re.fullmatch(r"[^\s\"'$]+", value), f"value needs quoting: {key}={value!r}"


def test_the_unit_reads_the_env_file_setup_instance_writes() -> None:
    assert f"\nEnvironmentFile={_ENV_FILE_PATH}\n" in _UNIT_TEMPLATE.read_text()
    setup = _SETUP_SCRIPT.read_text()
    assert 'CONFIG_DIR="/etc/energetica/$INSTANCE"' in setup
    # Named mechanism, not just the path: install_rendered is what keeps the write from
    # following a symlink planted in the group-writable config dir, so a future edit that goes
    # back to a plain `>` redirect should fail here rather than pass quietly.
    assert 'install_rendered "$CONFIG_DIR/instance.env"' in setup


def test_the_unit_refuses_to_start_without_its_env_file() -> None:
    # No `-` prefix, by design: a unit that starts without ENERGETICA_INSTANCE_SLUG treats the
    # instance as public and skips its own instance.json, which is worse than not starting.
    assert "EnvironmentFile=-" not in _UNIT_TEMPLATE.read_text()


def test_the_unit_carries_no_inline_environment() -> None:
    # Every per-instance value lives in the env file; an `Environment=` line here would be a
    # second, invisible source of truth that overrides it.
    assert not re.search(r"^Environment=", _UNIT_TEMPLATE.read_text(), re.MULTILINE)


@pytest.mark.parametrize("template", [_UNIT_TEMPLATE, _ENV_TEMPLATE], ids=lambda p: p.name)
def test_every_placeholder_is_substituted_when_rendered(template: Path) -> None:
    assert _sed_substitutions(_SETUP_SCRIPT, template.name) == _placeholders(template), (
        f"setup-instance.sh and {template.name} disagree on placeholders"
    )


def test_the_unit_is_per_instance_only_by_name() -> None:
    # The point of the env file: two instances differ in the unit by their slug and nothing else.
    assert _placeholders(_UNIT_TEMPLATE) == {"INSTANCE"}
