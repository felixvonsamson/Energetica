# Wildcard certificate for energetica-game.org with DNS at Namecheap

Research for [#1377](https://github.com/felixvonsamson/Energetica/issues/1377), on the map
[#1373](https://github.com/felixvonsamson/Energetica/issues/1373). Researched 2026-10-27.

## Answer

Yes, we can, but the simplest reliable path is to move DNS hosting (not the domain
registration) from Namecheap to Cloudflare's free plan and issue the wildcard with certbot's
official `dns-cloudflare` plugin. Staying on Namecheap DNS works with acme.sh's
`dns_namecheap`, but it needs a $50 account top-up or spend, puts an unscoped, account-wide
API key on the web server, and rewrites the whole zone on every renewal.

Whichever path we take, the catch-all vhost must be the **last** `*.energetica-game.org`
vhost Apache loads. The issue's assumption that exact `ServerName` matches beat
`ServerAlias *.<domain>` is wrong: Apache takes the first match in config order and gives
wildcards no lower precedence.

## What we have today

Observed with `dig` on 2026-10-27 and read from `scripts/infra/`:

- Nameservers are `dns1.registrar-servers.com` and `dns2.registrar-servers.com`
  (Namecheap BasicDNS). The registrar is Namecheap, and the registration expires 2027-10-10.
- The zone is small. The apex has `A 82.165.217.62`, and `*.energetica-game.org` is a
  `CNAME` to the apex (so `www`, `lobby` and every run resolve through it). `_dmarc` has a
  TXT record. There are no MX records, no AAAA records and no DNSSEC (no DS record at the
  parent).
- `_acme-challenge.energetica-game.org` currently resolves through the wildcard CNAME to the
  apex. That does not get in the way: a wildcard only answers for names that do not exist
  (RFC 4592), so an explicit `_acme-challenge` TXT or CNAME record takes over.
- The apex, the lobby and each run get their own certificate from
  `certbot certonly --webroot` (http-01) in `setup-landing.sh`, `setup-lobby.sh` and
  `setup-instance.sh`. `setup-base.sh` installs a certbot deploy hook,
  `/etc/letsencrypt/renewal-hooks/deploy/reload-apache.sh`, that reloads Apache after any
  renewal. `teardown-instance.sh` runs `certbot delete` for the run's certificate.
- Vhost files are `sites-available/energetica-landing.conf`, `energetica-lobby.conf` and
  `energetica-<slug>.conf`.

## 1. What Namecheap requires to enable its API, and whether we meet it

From Namecheap's [API FAQ](https://www.namecheap.com/support/knowledgebase/article.aspx/9739/63/api-faq/):

- The account must meet **one** of these: at least 20 domains, at least $50 in account
  balance, or at least $50 spent in the last 2 years. The sandbox is exempt.
- At least one client IP must be whitelisted before the API works, and "only IPv4 addresses
  can be used". Our server has a fixed IPv4, 82.165.217.62, and `api.namecheap.com` has no
  AAAA record, so outbound calls go over IPv4 anyway.
- Rate limits are 50 calls per minute, 700 per hour and 8,000 per day per key. One
  issuance or renewal makes a handful of calls.

**Whether our account meets it:** this cannot be checked from outside the account. The
domain was registered on 2025-10-10. If it is the account's only purchase, the spend is well
under $50, so we would need to add $50 of balance (it stays usable as credit for renewals).
The account owner should check under Profile, Tools, Namecheap API Access.

Two more properties of the API matter for safety:

- **The key is not scoped.** Namecheap has one API key per account, with access to every API
  method, including registering domains paid from the account balance
  ([`domains.create`](https://www.namecheap.com/support/api/methods/domains/create/)). Let's
  Encrypt's own guidance is that "keeping API credentials on your web server is risky" and
  that narrowly scoped credentials are the mitigation
  ([challenge types](https://letsencrypt.org/docs/challenge-types/#dns-01-challenge)).
  Namecheap offers no such scoping. Meeting the eligibility rule by keeping a $50 balance
  makes that worse.
- **There is no "add one record" call.** `domains.dns.setHosts` replaces every host record
  in the zone. Clients must read the zone with `getHosts`, append the TXT record and write
  the whole list back. acme.sh's wiki says so plainly: "Due to Namecheap's API limitation all
  the records of your domain will be read and re applied", and advises backing up records
  first ([acme.sh dnsapi wiki](https://github.com/acmesh-official/acme.sh/wiki/dnsapi#dns_namecheap)).

## 2. Which ACME client handles Namecheap DNS-01, and how renewal runs

**Certbot has no Namecheap plugin.** Its docs list the official DNS plugins (cloudflare,
digitalocean, dnsimple, dnsmadeeasy, gehirn, google, linode, luadns, nsone, ovh, rfc2136,
route53, sakuracloud) and Namecheap is in neither that list nor the third-party table
([certbot user guide](https://eff-certbot.readthedocs.io/en/stable/using.html#dns-plugins)).
The third-party `certbot-dns-namecheap` package (knoxell) was last pushed in October 2022.
Certbot's `--manual` mode with a `--manual-auth-hook` script would work, but we would be
writing and maintaining the Namecheap client ourselves.

**acme.sh's `dns_namecheap` is the maintained option.** It reads `NAMECHEAP_USERNAME`,
`NAMECHEAP_API_KEY` and `NAMECHEAP_SOURCEIP`, and saves them to `~/.acme.sh/account.conf`
([wiki](https://github.com/acmesh-official/acme.sh/wiki/dnsapi#dns_namecheap)). Its
[source](https://github.com/acmesh-official/acme.sh/blob/master/dnsapi/dns_namecheap.sh)
does the `getHosts`, append, `setHosts` round trip described above, for both adding and
removing the TXT record. It is actively maintained, and its two most recent fixes show where
the risk is:

- July 2026 ([#6963](https://github.com/acmesh-official/acme.sh/issues/6963)): a guard
  so that an unparsed `getHosts` reply is no longer treated as an empty zone. The code
  comment says proceeding "would wipe the whole zone".
- August 2026 ([#7178](https://github.com/acmesh-official/acme.sh/issues/7178)): picking
  the wrong root zone when a domain is not on Namecheap's own DNS.

Each renewal therefore rewrites our whole zone twice. The zone is tiny and the client is
now defensive, but a bug or a concurrent edit in the dashboard can lose records, and
those records carry the whole site.

**Renewal with acme.sh:** `acme.sh --install` adds a daily cron job that renews certificates
nearing expiry. Issue once with
`acme.sh --issue --dns dns_namecheap -d '*.energetica-game.org'`, then
`acme.sh --install-cert -d '*.energetica-game.org' --fullchain-file ... --key-file ... --reloadcmd "systemctl reload apache2"`,
which records where to copy the files and what to run after each renewal. That would be a
second ACME client and a second renewal schedule next to certbot, which still renews the
apex, lobby and per-run certificates.

Renewal must be automatic in any case. Let's Encrypt is shortening certificate lifetimes
from 90 days to 64 days on 2027-02-10 and to 45 days on 2028-02-16
([announcement](https://letsencrypt.org/2025/12/02/from-90-to-45)).

## 3. Is moving DNS to Cloudflare simpler, and what does it cost?

Yes. Only the DNS hosting moves. The domain stays registered at Namecheap; we change its
nameservers to the two Cloudflare assigns.

- **Cost: $0.** A full setup (Cloudflare as authoritative DNS) is available on the Free plan
  ([Cloudflare full setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/)).
- **Steps:** add the zone, let Cloudflare scan the records and check them by hand against
  Namecheap's list (the scan can miss some), then change the nameservers at Namecheap.
  Cloudflare says the switch can take up to 24 hours. We have no DNSSEC to turn off first,
  which is the main thing that makes this switch risky. With the records copied before the
  switch, both providers give the same answers during propagation, so there is no outage.
- **Keep every record "DNS only" (grey cloud).** Proxying would put Cloudflare's HTTP proxy
  in front of Apache, Socket.IO and the certificates. That is a separate decision and out of
  scope.
- **Certbot support is official:** `certbot-dns-cloudflare` (Ubuntu package
  `python3-certbot-dns-cloudflare`) with an API token that has only `Zone:DNS:Edit` on this
  one zone. The token sits in a one-line INI file
  ([plugin docs](https://certbot-dns-cloudflare.readthedocs.io/en/stable/)). Cloudflare's API
  edits single records, so the rest of the zone is never rewritten.
- **Renewal** runs on the certbot timer we already have, and the existing
  `renewal-hooks/deploy/reload-apache.sh` hook reloads Apache for this certificate too. So
  there is one ACME client and one renewal schedule.
- **What we give up:** DNS edits move from the Namecheap dashboard to Cloudflare's, and we
  depend on a second provider. Both are routine.

### Other options considered

- **Delegate only `_acme-challenge` with a CNAME.** Let's Encrypt follows CNAMEs for DNS-01
  ([challenge types](https://letsencrypt.org/docs/challenge-types/#dns-01-challenge)), so we
  could add one static CNAME at Namecheap by hand and answer challenges elsewhere, for
  example with [acme-dns](https://github.com/acme-dns/acme-dns). Its README asks you to run
  your own instance, because whoever controls it can get certificates for your domain.
  Running our own means a DNS server on port 53 and an NS delegation. That is more moving
  parts than moving the zone.
- **Wait for `dns-persist-01`.** This new challenge type uses one permanent TXT record at
  `_validation-persist.<domain>`, with `policy=wildcard` for wildcards, so no DNS API would
  be needed ([announcement](https://letsencrypt.org/2026/02/18/dns-persist-01)). The
  production target was Q2 2026, but on 2026-06-25 Let's Encrypt staff wrote that they "will
  not be deploying dns-persist-01 until" an open issue in the IETF draft is resolved
  ([status thread](https://community.letsencrypt.org/t/dns-persist-01-deployment-status-and-timeline/246468)).
  I found no sign that it is in production as of this research, and certbot support is
  unconfirmed. Worth revisiting later, but not something to plan on.

## 4. How a `*.energetica-game.org` vhost interacts with the others in Apache

From Apache's docs ([name-based vhosts](https://httpd.apache.org/docs/2.4/vhosts/name-based.html),
[`ServerAlias`](https://httpd.apache.org/docs/2.4/mod/core.html#serveralias)):

> Name-based virtual hosts for the best-matching set of `<virtualhost>`s are processed in
> the order they appear in the configuration. The first matching ServerName or ServerAlias
> is used, with no different precedence for wildcards (nor for ServerName vs. ServerAlias).

> If no matching ServerName or ServerAlias is found in the set of virtual hosts containing
> the most specific matching IP address and port combination, then the first listed virtual
> host that matches that will be used.

So:

- **Exact names do not win automatically.** If the catch-all loads before
  `energetica-lobby.conf` or any `energetica-<slug>.conf`, it takes their traffic. It must
  load after all of them.
- **Load order is file-name order.** Ubuntu's `apache2.conf` uses
  `IncludeOptional sites-enabled/*.conf`, and wildcard includes are read "in alphabetical
  order" ([`Include`](https://httpd.apache.org/docs/2.4/mod/core.html#include)). Run slugs
  are arbitrary kebab-case, so a name like `energetica-catchall.conf` would sort in among
  them. Use a prefix that sorts after `energetica-`, for example
  `zz-energetica-catchall.conf`, and say why in the file's header.
- **The default for unknown names is the first `*:443` vhost loaded**, which today is the
  fluxcontrol.eu site. The catch-all does not change that for other domains, and it should
  not: it only claims `*.energetica-game.org`. With SNI (the TLS extension where the client
  sends the hostname), mod_ssl picks the vhost by the same name rules, so a dead run's
  subdomain gets the catch-all's wildcard certificate instead of fluxcontrol's.
- **A wildcard covers exactly one label.** `*.energetica-game.org` matches
  `old-run.energetica-game.org` but not the apex and not `a.b.energetica-game.org`. The apex
  keeps its own certificate.

A sketch of the catch-all:

```apache
<VirtualHost *:443>
    ServerName catchall.energetica-game.org
    ServerAlias *.energetica-game.org
    SSLEngine on
    SSLCertificateFile    /etc/letsencrypt/live/energetica-game.org-wildcard/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/energetica-game.org-wildcard/privkey.pem
    Redirect 302 / https://lobby.energetica-game.org/
</VirtualHost>
```

`Redirect` keeps the path, so `/app/foo` would go to `lobby.../app/foo`. If the lobby should
always land on its home page, use `RedirectMatch 302 ^ https://lobby.energetica-game.org/`
instead.

**Port 80 needs care.** A plain-HTTP catch-all helps `http://old-run...` too, but it must
never catch an http-01 challenge for a run that is being set up. `setup-instance.sh` enables
the run's temporary port-80 vhost before calling certbot, and that vhost sorts before the
`zz-` file, so it wins. The port-80 catch-all can simply redirect to `https://` on the same
host and let the port-443 catch-all send the request on to the lobby.

## Follow-up worth considering

Once a wildcard certificate exists, every run vhost could use it instead of issuing its own.
That would remove certbot from `setup-instance.sh` and `teardown-instance.sh`, take run
provisioning off the per-domain rate limit of 50 new certificates per 7 days
([rate limits](https://letsencrypt.org/docs/rate-limits/)), and stop publishing each run's
name in the public Certificate Transparency logs (the public record of every issued
certificate). The lobby and apex could share it too. This is out of scope for #1377, but
the Cloudflare path makes it a small change.

## Recommendation

1. Move the `energetica-game.org` zone to Cloudflare Free, with every record DNS only and the
   domain still registered at Namecheap.
2. Issue `*.energetica-game.org` with certbot and `python3-certbot-dns-cloudflare`, using a
   token limited to `Zone:DNS:Edit` on this zone. Renewal uses the existing certbot timer
   and reload hook.
3. Add the catch-all vhost as `zz-energetica-catchall.conf`, redirecting with 302 to the
   lobby.

If moving DNS is unacceptable, use acme.sh with `dns_namecheap` instead. It works, but it
needs the $50 eligibility, an account-wide key on the server, a DNS backup before the first
run, and a second ACME client.
