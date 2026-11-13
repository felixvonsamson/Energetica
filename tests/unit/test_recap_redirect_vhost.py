"""Drift guards for the recap redirect that teardown leaves behind (issue #1378).

When a run with a recap is torn down, `scripts/infra/teardown-instance.sh` replaces its vhost
with `scripts/infra/apache-instance-redirect.conf`, which sends every request to the run's recap
on the lobby. These tests read the files as text and check the seams between them: the script
needs root, Apache and certbot, so it is not run here.
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

_INFRA = Path(__file__).resolve().parents[2] / "scripts" / "infra"
_TEMPLATE = _INFRA / "apache-instance-redirect.conf"
_TEARDOWN = _INFRA / "teardown-instance.sh"

_PLACEHOLDER = re.compile(r"@([A-Z_]+)@")


def _render(instance: str = "demo", domain: str = "example.org") -> str:
    return _TEMPLATE.read_text().replace("@INSTANCE@", instance).replace("@DOMAIN@", domain)


def test_teardown_and_the_template_agree_on_placeholders() -> None:
    # A placeholder the script does not substitute ships a literal `@PORT@`, which Apache rejects
    # at configtest.
    substituted = set(re.findall(r"s/@([A-Z_]+)@/", _TEARDOWN.read_text()))
    assert substituted == set(_PLACEHOLDER.findall(_TEMPLATE.read_text()))


def test_both_ports_redirect_to_the_recap_with_a_302() -> None:
    rendered = _render()
    target = "https://lobby.example.org/runs/demo/recap"
    http, https = rendered.split("<VirtualHost *:443>", 1)
    assert f"{target} [R=302,L]" in http
    assert f"RedirectMatch 302 ^ {target}" in https
    # A 301 is cached by browsers indefinitely; the recap is not meant to live there forever.
    assert "301" not in rendered.split("ServerName", 1)[1]


def test_acme_challenges_are_served_from_the_runs_web_folder() -> None:
    """The certificate's renewal config names the run's web folder as its webroot.

    If the redirect vhost redirected the challenge or served it from anywhere else, certbot could
    not renew the certificate, and the warning #1378 fixes would come back within 90 days.
    """
    http = _render().split("<VirtualHost *:443>", 1)[0]
    assert "DocumentRoot /var/www/energetica-demo\n" in http
    assert '<Directory "/var/www/energetica-demo/.well-known/acme-challenge">' in http
    assert r"RewriteCond %{REQUEST_URI} !^/\.well-known/acme-challenge/" in http


def test_the_https_vhost_uses_the_runs_own_certificate() -> None:
    https = _render().split("<VirtualHost *:443>", 1)[1]
    assert "SSLCertificateFile /etc/letsencrypt/live/demo.example.org/fullchain.pem" in https
    assert "SSLCertificateKeyFile /etc/letsencrypt/live/demo.example.org/privkey.pem" in https


def test_teardown_keeps_the_web_folder_and_the_certificate_for_the_redirect() -> None:
    script = _TEARDOWN.read_text()
    directories = script.split("# --- 5. Directories", 1)[1].split("# --- 6.", 1)[0]
    assert 'install -d -m 0755 -o root -g root "$APP_DIR"' in directories
    certificate = script.split("# --- 6. Certificate", 1)[1]
    # The redirect check comes first, so --keep-cert or its absence cannot release a certificate
    # the redirect still serves with.
    assert certificate.index('"$LEAVE_REDIRECT" = true') < certificate.index("certbot delete")


def test_teardown_configtests_the_redirect_before_it_reloads() -> None:
    script = _TEARDOWN.read_text()
    vhost = script.split("# --- 4. Apache vhost", 1)[1].split("# --- 5.", 1)[0]
    redirect = vhost.split('if [ "$LEAVE_REDIRECT" = true ]', 1)[1].split("elif", 1)[0]
    assert redirect.index("apache2ctl configtest") < redirect.index("systemctl reload apache2")
    failure = redirect.split("if ! apache2ctl configtest", 1)[1].split("\n    fi", 1)[0]
    # Disabled before removed: Debian's a2dissite refuses once the file is gone.
    assert failure.index("a2dissite") < failure.index('rm -f "$VHOST"')
    assert "exit 1" in failure


def test_teardown_is_syntactically_valid_bash() -> None:
    subprocess.run(["bash", "-n", str(_TEARDOWN)], check=True)
