# Design: Lobby — server-wide SSO & instance picker

**Status:** Accepted — Phases A/B live in production; Phase C (cutover) implemented (#817)
**Part of:** #603 (sustainable gameplay / replay-ability)
**Supersedes the deferred items:** RFC `static-serving-and-deployment.md` → "Instance-picker UI" and the apex-CTA zero-state work tracked in #810
**Decisions:** ADR-0002 (session model), ADR-0003 (signup decoupling)
**Related:** #809 (`ends_at`, out of scope here), #813 (A2 hardening)

---

## Problem

Players have no in-app way to move between runs, and no single place to sign in.
Authentication is per-instance: credentials are server-wide (`accounts.db`) but a player
re-enters their password on every instance's first visit, each instance carries its own
login/signup UI, and the apex is a pure-static landing that cannot show "the runs _you_
are playing." The landing's global CTAs (`primaryInstanceAppHref`) point at the latest
advertised instance and dead-end (404) when nothing is advertised.

We want a **lobby**: one server-wide front door where a player signs up once, logs in
once, sees the runs they've joined, and jumps between runs — and from inside a run, a
quick switcher to hop laterally without returning to the lobby.

---

## Goals

- **One identity, one session.** Sign up / log in once at the lobby; roam between runs
  with no re-auth (single-sign-on across instance subdomains).
- **Personalised "your runs."** The lobby shows the runs an account has _started_
  (settled on), plus other runs to join — including the account's own _unadvertised_ runs.
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

| Term                    | Definition                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lobby**               | The server-wide front door (`lobby.{apex}`): sign up, log in, pick a run. A small backend + frontend bundle on its own subdomain, separate from any run and outliving runs. Owns the server-wide session.                                                                                                                                                                                                                                                  |
| **Server-wide session** | The single authenticated session minted by the lobby, carried to every run on the server via a parent-domain cookie.                                                                                                                                                                                                                                                                                                                                       |
| **Membership**          | An account's relationship to a run: a `role` (`player` or `facilitator`) on a row keyed `(account_id, slug)` in `instance_membership` (ADR-0004). A player's row is written at **join** time — the lobby's explicit two-click join for a public run, or a private run's roster add / join-link confirm (#1030), or at settle if it is not there yet; a facilitator's is written only by the sysadmin grant script. The two are mutually exclusive per run. |
| **Entry gate**          | The point at which an authenticated account touches a run: the run hands the session cookie to the lobby service, which validates it, and the run enforces the run's access policy (bypassed for a facilitator grant covering it). There is nothing to auto-provision — role is read straight from `instance_membership`, and a `Player` exists only once an account has actually settled. Where per-instance access control now lives.                    |

---

## Architecture

### The lobby backend and the lobby service

The lobby is an instance-independent part of the server, on `lobby.{apex}`. It ships from one
checkout in one deploy (`deploy-lobby.sh`), as two processes plus a frontend:

- **Lobby backend** (`src/lobby/`, `main_lobby.py`; uvicorn + Apache vhost + the
  `energetica-lobby` unit): the public web app. It serves `signup`, `login`,
  `change-password`, `logout`, `my-runs` and the public-run join, and reads the on-disk
  instance fragments for run metadata. It holds no database and no signing secret: every
  account, session and membership operation is a call to the lobby service.
- **Lobby service** (`src/lobby_service/`, `main_lobby_service.py`; the
  `energetica-lobby-service` unit, socket-activated): the one process that opens the
  server-wide database (`lobby.db`) and holds the signing secret and the password hashes
  (ADR-0009). It runs as its own Unix user, `energetica-lobby-service`, the only one that can
  read `/var/lib/energetica-lobby-service/`, where the database and the secret live (#1284). It
  has no network port: it serves a versioned internal API (`/internal/v1`) on
  `/run/energetica/lobby-service.sock`, which only the `energetica` group may connect to. Its clients use `energetica.identity.lobby_service_client`, which
  times out after about 5 seconds and answers a failure with a 503. Runs are clients too
  (#1283): they hold no database access and no signing secret, and resolve each request's session
  with one call to the service.
- **Frontend bundle** (sibling to the landing bundle): login, signup, and the picker
  page with all logged-in/out states.

The lobby service runs its schema migrations when it starts, before it serves
(`src/lobby_service/schema.py`). The state version is SQLite's `PRAGMA user_version`; steps live
in `src/lobby_service/migrations/` as `NNNN_<slug>.py`, each with one `migrate(conn)`; all pending
steps and the version bump share one transaction; and a database newer than the code stops the
service from starting. Before migrating, it keeps one copy of the database at
`<name>.pre-migration`.

The apex landing stays **pure-static** marketing; its CTAs link to the lobby.

### Session model — A1 (ADR-0002)

Single-sign-on via a **server-wide shared signing secret** + a **parent-domain session
cookie** (`domain=.{apex}`). On login, the lobby service mints the token and the lobby
backend sets it as the cookie; every instance hands the cookie to the lobby service, which
checks it and answers with the account and its role and membership in that run (`GET
session?run=<slug>`). The session payload is the immutable **`account_id`** (ADR-0002
amendment), which a settled `Player` references.

The SSO cookie is named **`energetica_session`**, deliberately _not_ `session`: pre-cutover
instances minted a host-only `session` cookie that lingers in browsers for the cookie's whole
`max_age`, and RFC 6265 leaves undefined which of two same-named cookies wins on a request. A
distinct name lets the post-cutover instance read only the shared `.{apex}` cookie and ignore
the stale one, avoiding a redirect loop for returning players (resolves the #816 B→C wrinkle).

This deliberately gives up the RFC's per-subdomain cookie isolation. The isolation-
preserving alternative (A2, token-handoff) is deferred to #813; its only live defence today
is that all UGC renders as escaped text — guarded by a CI tripwire (see Security).

- **Signing secret:** `/var/lib/energetica-lobby-service/secret_key.txt` (next to `lobby.db`),
  created by `setup-base.sh` and readable by the lobby service's user only. Replaces per-instance
  `instance/secret_key.txt`.

### Endpoint ownership after cutover

| Concern                                                           | Owner                                                                                                                                                                                                                        |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signup, login, change-password, logout                            | **Lobby**                                                                                                                                                                                                                    |
| `my-runs` (read `instance_membership` for the authed account)     | **Both** — the lobby (for the picker) _and_ every instance (for the in-run switcher). Identical read logic, deployed in each service and served from its own origin so neither frontend makes a cross-origin call (no CORS). |
| Join a public run (`instance_membership` write, unsettled, #1030) | **Lobby**                                                                                                                                                                                                                    |
| Session-cookie _validation_ (shared secret)                       | Every instance                                                                                                                                                                                                               |
| Entry gate: auto-provision local `User` (access-policy-gated)     | Instance                                                                                                                                                                                                                     |
| Settle (`Player` creation) + `instance_membership` write          | Instance                                                                                                                                                                                                                     |
| `/auth/me`, all game state, `/api/*`, `/socket.io`                | Instance                                                                                                                                                                                                                     |

Instances **lose** their login/signup pages and credential endpoints; unauthenticated
access redirects to the lobby.

### Request routing (lobby vhost)

```
lobby.energetica-game.org
├── /api/auth/*    → ProxyPass → uvicorn (lobby)
├── /api/lobby/*   → ProxyPass → uvicorn (lobby)   (my-runs)
├── /logout        → ProxyPass → uvicorn (lobby)
├── /healthz       → ProxyPass → uvicorn (lobby)   (version/status; see docs/backend/deployment.md)
├── /instances.json → Alias → the shared landing dir  (the picker's manifest)
├── /recaps/*.json → Alias → the shared landing dir  (published recaps)
├── /static/*      → Apache serves the lobby bundle
└── /*             → FallbackResource → index.html  (SPA: /login, /signup, picker)
```

Both aliases point at `/var/www/energetica-landing/`, which the instance backends write into —
so the lobby always serves the live artifacts with no CORS and no second copy to keep fresh.
Serving recaps here rather than from the instance's own vhost is what lets a recap outlive its
run: the instance can be reaped, and torn down entirely, without taking its recap with it.
`FallbackResource` is disabled under `/recaps/` so a run that has not frozen yet still 404s
instead of being answered with `index.html` as a 200.

---

## Data model

### `accounts` (table in `lobby.db`)

```sql
CREATE TABLE accounts (
    account_id INTEGER PRIMARY KEY AUTOINCREMENT,  -- never reused, even after a delete (#1382)
    username   TEXT    NOT NULL UNIQUE,
    email      TEXT             UNIQUE,
    pwhash     TEXT    NOT NULL,
    created_at TEXT    NOT NULL,
    expires_at TEXT                                -- NULL = permanent; else deleted after this time
);
```

- An account with an `expires_at` is a **temporary account** (#1383). Only operator tooling
  makes one, by passing `expires_at` to the lobby service's `POST accounts`; signup never does.
  The lobby service deletes each expired account, with its memberships and grants, once when it
  starts, before it serves, and then once a day. That frees the username for a new account. Ids are never reused,
  so a deleted account's session cookie cannot reach the new one.
- Runs keep each player's `account_id` and username in their own state, so a run's scoreboard
  and recap still work after its accounts are gone.

### `instance_membership` (table in `lobby.db`)

```sql
CREATE TABLE instance_membership (
    account_id  INTEGER NOT NULL,
    slug        TEXT,                        -- NULL = server-wide (facilitator only)
    role        TEXT    NOT NULL DEFAULT 'player',
    created_at  TEXT    NOT NULL,             -- ISO-8601 UTC; joined_at for a player,
                                               -- granted_at for a facilitator
    PRIMARY KEY (account_id, slug)
);
```

- A player row is written at **join** time (the lobby service's idempotent
  `PUT runs/{slug}/members/{account_id}`) — the lobby's explicit two-click join for a public run, a
  private run's roster add / join-link confirm (#1030), or settling, which joins an account that
  never went through a join step. The row does not record settling: migration 2 dropped the
  vestigial `settled_at` column (#1284). Whether an account has settled is a fact of the run: a
  `Player` with its `account_id`. A facilitator row is written only by the sysadmin grant script
  (ADR-0004).
- The lobby's "your runs" = player membership rows joined against the on-disk
  fragments (`/var/www/energetica-landing/instances/{slug}.json`) for name / `starts_at`. This
  surfaces an account's **unadvertised** runs to that account (the public manifest can't).
- Stale rows (run later deleted) are tolerated and filtered against existing fragments,
  matching the RFC's stale-fragment stance.

### `runs` (table in `lobby.db`, ADR-0010)

Each run's config, moving here from its `instance.json` (#1313). Migration 3 added the table. Until
the readers switch over, it is written by `scripts/lobby/run.py` and read by nothing else.

```sql
CREATE TABLE runs (
    slug          TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    mode          TEXT NOT NULL CHECK (mode IN ('freeplay', 'workshop')),
    advertised    INTEGER NOT NULL,
    access_policy TEXT NOT NULL CHECK (access_policy IN ('public', 'private')),
    join_token    TEXT UNIQUE,              -- only on a private run
    join_open     INTEGER NOT NULL DEFAULT 0,
    starts_at     TEXT NOT NULL,
    freeze_at     TEXT,
    ended_at      TEXT,
    created_at    TEXT NOT NULL,
    CHECK (freeze_at IS NULL OR freeze_at >= starts_at),
    CHECK (ended_at IS NULL OR ended_at >= COALESCE(freeze_at, starts_at))
);
```

- The service writes every timestamp in one format, UTC to the second with a `+00:00` offset, so
  the `CHECK`s can compare them as text.
- `slug` and `mode` cannot change once the run exists.
- The service's endpoints are `GET runs`, `GET runs/{slug}` (each with the run's derived
  `phase`), `PUT runs/{slug}` (create), `PATCH runs/{slug}` (change some fields; `null` clears
  one), `POST runs/{slug}/join-token` (create on first use) and `DELETE runs/{slug}` (refused
  while the run has memberships or grants, unless `with_members=true` deletes them too).
- Every write is checked whole, and an invalid one is refused with `INVALID_RUN` and a message
  saying what is wrong.
- Every write logs one line on the `lobby_service.runs` logger: the caller, the acting account
  (`X-Energetica-Acting-Account`, if sent) and each changed field, old and new. The join token's
  value is logged as `(redacted)`.

---

## Flows

**Signup (lobby, account-only — ADR-0003).** Creates one `accounts` row. No instance, no
`User`, no `Player`. An account may exist with zero memberships. Gated by a **server-wide
signup toggle** — a `signups_enabled` flag in a new `/etc/energetica/server.json`, read
fresh by the lobby, never by a per-instance allowlist. This is the only switch governing
account creation. A closed-enrollment deployment turns the toggle on while its players sign
up, then turns it off again; neither flip needs a restart. See ADR-0003.

**Temporary accounts and freeplay (#1383).** A temporary account cannot join a freeplay run,
where it would leave a player behind with no account once it is deleted. The run's entry gate
(`/auth/me` and the Socket.IO connect) and settle refuse it with `TEMPORARY_ACCOUNT_IN_FREEPLAY`,
and so do the ways onto a freeplay run's roster: the lobby's public-run join, the join link and
the facilitator's roster add. The lobby's `my-runs` reports the account's
`expires_at`, so the picker never offers a temporary account a freeplay run. Workshop runs admit
temporary accounts like any other.

**Login (lobby).** The lobby service verifies the credentials and mints the token; the lobby
backend sets it as the `domain=.{apex}` session cookie. Redirect to the picker, or to `?return=` if present.

**Enter a run.** The player clicks a run (or follows a deep link). The cookie is already
present on `{slug}.{apex}`. The **entry gate** validates it and, if the run's access policy
admits the account, auto-provisions a local `User(role=player, player=None)`. If denied →
clean 403 ("no access to this run"). Provisioning moves out of the old `/login` POST into
this authenticated-entry path.

**Deep link while logged out.** `{slug}.{apex}/app` with no session → redirect to
`lobby.{apex}/login?return={slug}` → after login, bounce back to the run → entry gate. The
`return` value is **validated against the live instance list** (never an arbitrary URL) to
prevent an open-redirect.

**Join a public run (#1030).** The picker's explicit two-click action — select a run, then
"Join run" — calls the lobby's own `POST /api/v1/lobby/runs/{slug}/join`, which writes an
unsettled `instance_membership` row straight from the lobby (no instance round-trip). This is
what makes a run appear under "your runs," _before_ the account has settled. A private run is
excluded from this endpoint (403) — its admission stays instance-owned (roster / join-link).

**Settle.** Unchanged game-side, plus the lobby service's idempotent join, so the account has a
membership row even if it never went through a join step.

**In-run switcher.** Top-right dropdown next to Logout. Lists your settled runs (current
one marked) as cross-origin `<a href>` to `{slug}.{apex}/app` (`instanceAppHref`), plus an
"Open lobby" item. Data from the **instance's own backend** (`my-runs`, read through the
lobby service) — same origin, no CORS; serves only the cookie-authenticated account.

**Logout (global).** Clears the single `domain=.{apex}` cookie → logged out of every run.
Per-run logout is not expressible with a shared cookie and is not offered.

**Password change.** At the lobby, through the lobby service. (Existing sessions on other
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

- `setup-base.sh` — also create the lobby service's user, its private
  `/var/lib/energetica-lobby-service/` with the signing secret, and an initial
  `/etc/energetica/server.json` (`{"signups_enabled": true}`).
- `infra/setup-lobby.sh`, `infra/apache-lobby.conf`, `infra/energetica-lobby.service`,
  `deploy-lobby.sh` — mirror the landing/instance scripts; DNS for `lobby.{apex}`.
- `setup-instance.sh` / `docs/backend/deployment.md` — repoint the instance-local `/sign-up` redirect at
  the lobby; document the cutover.

---

## Security

- **Cookie isolation given up (A1).** A session is valid on every instance subdomain;
  `SameSite=Lax` does not help (same registrable site). Mitigation: A2 (#813) is the
  committed hardening path; meanwhile a **CI guard** — a repo-wide frontend lint forbidding
  `dangerouslySetInnerHTML` / `rehype-raw`, with a small explicit allowlist for
  developer-authored game content (the technology/facility description renders) — ensures no
  _user-controlled_ string (chat, player/team/tile names, any future rich field) can render
  as raw HTML. This is the sole live defence, so it ships _with_ A1. See ADR-0002 for the
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
backfill migration must have run on the box _before_ the lobby serves "your runs" —
otherwise existing players (who settled before `instance_membership` existed) have no rows
and the lobby shows them **zero runs with no error**, silently breaking the core feature.
**C is a coordinated flag-day deploy** (like the Phase-5 cutover).

- **Phase A — backend foundations (invisible).** `instance_membership` table + write-on-
  settle; the `my-runs` read; a backfill migration for existing `Player`s; shared-secret
  _support_ (read shared if present, else per-instance) without flipping the cookie.
- **Phase B — lobby stands up alongside untouched instances.** Lobby backend + frontend
  bundle + infra + DNS. No instance behaviour changes yet. **Deploy precondition:** Phase A
  (incl. the backfill migration) is live on the box first — `deploy-lobby.sh` should refuse
  to run, or the lobby should log loudly, if the `instance_membership` table is absent.
- **Phase C — cutover (flag day).** Flip instances to shared secret + parent-domain
  cookie + entry-gate auto-provision; retire instance login/signup → redirect to lobby;
  in-run switcher; landing CTAs → lobby + remove `AdvertisedRuns`; land the #813 CI guard.
  **One-time forced global re-login** (old per-instance-signed sessions invalidate).

---

## Deferred / out of scope

- **`ends_at` + active/ended picker** (#809) — needs run end-of-life mechanics.
- **Email / password reset** — lobby is the eventual home.
- **A2 session isolation** (#813) — see Security.
- **Membership cleanup on run teardown** — `teardown-instance.sh` leaves the rows behind. They
  are inert: `build_my_runs` drops any membership whose fragment is gone. Purging them is a
  chore, not a blocker.
- **Cross-server identity** — accounts stay per-VPS (RFC).
- **Personalized / invited run visibility** ("advertise a run to _specific accounts_ only")
  — distinct from `advertised` (all-or-nothing picker visibility) and from private+allowlist
  (which gates _entry_, not visibility). A new invitation feature; deferred. ("Advertise or
  not" itself is just the existing `advertised` flag — nothing to build.)
