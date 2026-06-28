# Design: Lobby — server-wide SSO & instance picker

**Status:** Proposed (design agreed; not yet implemented)
**Part of:** #603 (sustainable gameplay / replay-ability)
**Supersedes the deferred items:** RFC `static-serving-and-deployment.md` → "Instance-picker UI" and the apex-CTA zero-state work tracked in #810
**Decisions:** ADR-0002 (session model), ADR-0003 (signup decoupling)
**Related:** #809 (`ends_at`, out of scope here), #813 (A2 hardening)

---

## Problem

Players have no in-app way to move between runs, and no single place to sign in.
Authentication is per-instance: credentials are server-wide (`accounts.db`) but a player
re-enters their password on every instance's first visit, each instance carries its own
login/signup UI, and the apex is a pure-static landing that cannot show "the runs *you*
are playing." The landing's global CTAs (`primaryInstanceAppHref`) point at the latest
advertised instance and dead-end (404) when nothing is advertised.

We want a **lobby**: one server-wide front door where a player signs up once, logs in
once, sees the runs they've joined, and jumps between runs — and from inside a run, a
quick switcher to hop laterally without returning to the lobby.

---

## Goals

- **One identity, one session.** Sign up / log in once at the lobby; roam between runs
  with no re-auth (single-sign-on across instance subdomains).
- **Personalised "your runs."** The lobby shows the runs an account has *started*
  (settled on), plus other runs to join — including the account's own *unadvertised* runs.
- **In-run lateral navigation.** A quick-switcher inside each run (top-right, next to
  Logout) to jump to your other runs or open the lobby.
- **No CTA dead-ends.** Every "Play / Log in" path resolves to the lobby, which always
  exists and always has a sensible state.
- **Identity outlives runs.** Runs are created and deleted (#603); the lobby and its data
  do not depend on any single run's lifecycle.

## Non-goals (this design)

- Active-vs-ended run distinction and run end dates — needs `ends_at` (#809) and run
  end-of-life mechanics that don't exist yet.
- Email collection / password reset (the lobby is its eventual home; deferred).
- A2 token-handoff session isolation (#813) — see Security.
- Cross-server identity (accounts remain scoped to one VPS, per the RFC).

---

## Terminology

Core identity terms — **Server**, **Instance** (player-facing: **Run**), **Account**,
**User**, **Player** — are defined in `static-serving-and-deployment.md` § Terminology and
`CONTEXT.md` § Accounts & users. This design adds:

| Term | Definition |
|------|------------|
| **Lobby** | The server-wide front door (`lobby.{apex}`): sign up, log in, pick a run. A small backend + frontend bundle on its own subdomain, separate from any run and outliving runs. Owns the server-wide session. |
| **Server-wide session** | The single authenticated session minted by the lobby, carried to every run on the server via a parent-domain cookie. |
| **Membership** | An account that has **settled** in a run (has a `Player` there). The "your runs" set. A merely auto-provisioned `User` is *not* membership. |
| **Entry gate** | The point at which an authenticated account first touches a run: the run validates the session cookie and, if the run's access policy allows, auto-provisions a local `User`. Where per-instance access control now lives. |

---

## Architecture

### The lobby service

A new, instance-independent service on `lobby.{apex}`:

- **Backend** (uvicorn + Apache vhost + systemd unit): owns credential and session
  endpoints — `signup`, `login`, `change-password`, `logout`, and `my-runs`. Reads/writes
  the server-wide `accounts.db`; reads the on-disk instance fragments for run metadata.
- **Frontend bundle** (sibling to the landing bundle): login, signup, and the picker
  page with all logged-in/out states.

The apex landing stays **pure-static** marketing; its CTAs link to the lobby.

### Session model — A1 (ADR-0002)

Single-sign-on via a **server-wide shared signing secret** + a **parent-domain session
cookie** (`domain=.{apex}`). The lobby mints the cookie on login; every instance validates
it with the shared secret. The session payload remains the (server-wide-unique) username,
so each instance resolves it against its own local `User`.

This deliberately gives up the RFC's per-subdomain cookie isolation. The isolation-
preserving alternative (A2, token-handoff) is deferred to #813; its only live defence today
is that all UGC renders as escaped text — guarded by a CI tripwire (see Security).

- **Shared secret:** `/var/lib/energetica/secret_key.txt` (next to `accounts.db`), created
  by `setup-base.sh`, group-readable by `energetica`. Replaces per-instance
  `instance/secret_key.txt`.

### Endpoint ownership after cutover

| Concern | Owner |
|---------|-------|
| Signup, login, change-password, logout | **Lobby** |
| `my-runs` (read `instance_membership` for the authed account) | **Both** — the lobby (for the picker) *and* every instance (for the in-run switcher). Identical read logic, deployed in each service and served from its own origin so neither frontend makes a cross-origin call (no CORS). |
| Session-cookie *validation* (shared secret) | Every instance |
| Entry gate: auto-provision local `User` (access-policy-gated) | Instance |
| Settle (`Player` creation) + `instance_membership` write | Instance |
| `/auth/me`, all game state, `/api/*`, `/socket.io` | Instance |

Instances **lose** their login/signup pages and credential endpoints; unauthenticated
access redirects to the lobby.

### Request routing (lobby vhost)

```
lobby.energetica-game.org
├── /api/auth/*    → ProxyPass → uvicorn (lobby)
├── /api/lobby/*   → ProxyPass → uvicorn (lobby)   (my-runs)
├── /logout        → ProxyPass → uvicorn (lobby)
├── /static/*      → Apache serves the lobby bundle
└── /*             → FallbackResource → index.html  (SPA: /login, /signup, picker)
```

---

## Data model

### `instance_membership` (new table in `accounts.db`)

```sql
CREATE TABLE IF NOT EXISTS instance_membership (
    account_id  INTEGER NOT NULL,
    slug        TEXT    NOT NULL,
    settled_at  TEXT    NOT NULL,            -- ISO-8601 UTC
    PRIMARY KEY (account_id, slug)
);
```

- Written by the **instance** when a `Player` is created (settle). Idempotent
  (`INSERT OR IGNORE`).
- The lobby's "your runs" = membership rows joined against the on-disk fragments
  (`/var/www/energetica-landing/instances/{slug}.json`) for name / `starts_at`. This
  surfaces an account's **unadvertised** runs to that account (the public manifest can't).
- Stale rows (run later deleted) are tolerated and filtered against existing fragments,
  matching the RFC's stale-fragment stance.

---

## Flows

**Signup (lobby, account-only — ADR-0003).** Creates one `accounts` row. No instance, no
`User`, no `Player`. An account may exist with zero memberships. Gated by a **server-wide
signup toggle** — a `signups_enabled` flag in a new `/etc/energetica/server.json`, read
fresh by the lobby (the server-wide analog of the per-instance `disable_signups`), never by
a per-instance allowlist. Closed-enrollment deployments seed accounts directly into
`accounts.db` via an admin bootstrap (`accounts.get_or_create_account_id`), replacing the
per-instance `players.txt` for account creation. See ADR-0003.

**Login (lobby).** Verify credentials against `accounts.db`; set the `domain=.{apex}`
session cookie (shared secret). Redirect to the picker, or to `?return=` if present.

**Enter a run.** The player clicks a run (or follows a deep link). The cookie is already
present on `{slug}.{apex}`. The **entry gate** validates it and, if the run's access policy
admits the account, auto-provisions a local `User(role=player, player=None)`. If denied →
clean 403 ("no access to this run"). Provisioning moves out of the old `/login` POST into
this authenticated-entry path.

**Deep link while logged out.** `{slug}.{apex}/app` with no session → redirect to
`lobby.{apex}/login?return={slug}` → after login, bounce back to the run → entry gate. The
`return` value is **validated against the live instance list** (never an arbitrary URL) to
prevent an open-redirect.

**Settle.** Unchanged game-side, plus a write to `instance_membership`. This is what makes
a run appear under "your runs."

**In-run switcher.** Top-right dropdown next to Logout. Lists your settled runs (current
one marked) as cross-origin `<a href>` to `{slug}.{apex}/app` (`instanceAppHref`), plus an
"Open lobby" item. Data from the **instance's own backend** (`my-runs` read of
`accounts.db`) — same origin, no CORS; serves only the cookie-authenticated account.

**Logout (global).** Clears the single `domain=.{apex}` cookie → logged out of every run.
Per-run logout is not expressible with a shared cookie and is not offered.

**Password change.** At the lobby; writes `accounts.db`. (Existing sessions on other
subdomains are not invalidated — see RFC limitation; unchanged.)

---

## Frontend

- **Lobby bundle (new):** `/login`, `/signup`, and the picker. Picker states:
  logged-out (+runs / no runs open), logged-in with runs ("your runs" + "other runs to
  join"), logged-in no runs ("nothing joined yet"). Light providers, like the landing.
- **Landing (apex):** remove `AdvertisedRuns` / `useAdvertisedInstances`; "Play now" /
  "Log In" → lobby. `primaryInstanceAppHref` and `instanceSignupHref` retire.
- **App (instance):** remove login/signup routes; unauth → redirect to lobby; add the
  in-run switcher. `instanceAppHref` lives on for run-to-run hops.
- The instance manifest (`/instances.json`) now has exactly one consumer: the lobby.

---

## Infrastructure

- `setup-base.sh` — also create the shared `/var/lib/energetica/secret_key.txt` and an
  initial `/etc/energetica/server.json` (`{"signups_enabled": true}`).
- `infra/setup-lobby.sh`, `infra/apache-lobby.conf`, `infra/energetica-lobby.service`,
  `deploy-lobby.sh` — mirror the landing/instance scripts; DNS for `lobby.{apex}`.
- `setup-instance.sh` / `DEPLOYMENT.md` — repoint the instance-local `/sign-up` redirect at
  the lobby; document the cutover.

---

## Security

- **Cookie isolation given up (A1).** A session is valid on every instance subdomain;
  `SameSite=Lax` does not help (same registrable site). Mitigation: A2 (#813) is the
  committed hardening path; meanwhile a **CI guard** — a repo-wide frontend lint forbidding
  `dangerouslySetInnerHTML` / `rehype-raw`, with a small explicit allowlist for
  developer-authored game content (the technology/facility description renders) — ensures no
  *user-controlled* string (chat, player/team/tile names, any future rich field) can render
  as raw HTML. This is the sole live defence, so it ships *with* A1. See ADR-0002 for the
  exact rule scope.
- **Open-redirect prevention.** The lobby `?return=` must resolve to a known
  `{slug}.{apex}` from the live instance list.
- **my-runs scoping.** The endpoint serves only the cookie-authenticated account's
  membership, never an arbitrary `account_id`.
- **Access control at entry, not signup (ADR-0003).** Private/unadvertised runs are gated
  at the entry gate; open account creation grants access to nothing on its own.

---

## Phasing

**Code** can be developed A‖B in parallel. **Deploy order is strict: A before B.** Phase A's
backfill migration must have run on the box *before* the lobby serves "your runs" —
otherwise existing players (who settled before `instance_membership` existed) have no rows
and the lobby shows them **zero runs with no error**, silently breaking the core feature.
**C is a coordinated flag-day deploy** (like the Phase-5 cutover).

- **Phase A — backend foundations (invisible).** `instance_membership` table + write-on-
  settle; the `my-runs` read; a backfill migration for existing `Player`s; shared-secret
  *support* (read shared if present, else per-instance) without flipping the cookie.
- **Phase B — lobby stands up alongside untouched instances.** Lobby backend + frontend
  bundle + infra + DNS. No instance behaviour changes yet. **Deploy precondition:** Phase A
  (incl. the backfill migration) is live on the box first — `deploy-lobby.sh` should refuse
  to run, or the lobby should log loudly, if the `instance_membership` table is absent.
- **Phase C — cutover (flag day).** Flip instances to shared secret + parent-domain cookie
  + entry-gate auto-provision; retire instance login/signup → redirect to lobby; in-run
  switcher; landing CTAs → lobby + remove `AdvertisedRuns`; land the #813 CI guard.
  **One-time forced global re-login** (old per-instance-signed sessions invalidate).

---

## Deferred / out of scope

- **`ends_at` + active/ended picker** (#809) — needs run end-of-life mechanics.
- **Email / password reset** — lobby is the eventual home.
- **A2 session isolation** (#813) — see Security.
- **Membership cleanup on run teardown** — stale rows tolerated until `teardown-instance.sh`
  exists.
- **Cross-server identity** — accounts stay per-VPS (RFC).
