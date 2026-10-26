# An accounts service owns accounts.db behind an internal Unix-socket API

**Status:** accepted
**Date:** 2026-10-18
**Decided in:** #1239, part of the automated-deployment map #889. **Amends:** ADR-0002.
**Partly superseded by:** ADR-0010 (run config).

## Context

Every run and the lobby open the shared `accounts.db` directly. Each process runs the schema
migrations lazily on its first connection, so whichever process starts first on new code migrates
the file under all the others. Runs pinned on old code then keep issuing SQL against a schema they
do not know. Automating deploys (#889) needs schema changes to happen in one place, at a known time.

Each run also holds the server-wide session-signing secret, because it checks the session cookie
itself (ADR-0002, A1). Anyone who can read that secret can forge a session for any account on any
run.

## Decision

A new process, the **accounts service**, is the only process that opens `accounts.db`. It also holds
the signing secret and the password hashes. It has no network port. It listens on a Unix socket
(`/run/energetica/accounts.sock`) that only processes on the same machine can reach, and access to
the socket file is the only check. Callers name themselves in a header, for logs and for counting
which API versions are still in use, never for trust.

The lobby and every run are clients of its versioned HTTP API (`/internal/v1/...`):

- **A run hands the raw session cookie to the service** and gets back, in one call per request, the
  account, its role in the run, and whether it has joined. Runs no longer check cookies or hold the
  secret.
- **The lobby passes login credentials to the service**, which checks them and mints the session token.
  The lobby becomes the public web front door and nothing more.
- **Operator scripts** (`grant-facilitator`, `whitelist-run`) become thin clients of the same API.
- **The service knows about membership only.** Settling is a freeplay engine act. When a player
  settles, the run calls the idempotent "join" endpoint to make sure their membership row exists.
- **Schema migrations run once, in the service, at startup**, before it accepts connections.
- ~~**Run state is not its concern.** A run's access policy stays in the run's `instance.json`. The
  service reports facts (joined or not) and the run decides.~~
  _Superseded by ADR-0010:_ the service owns each run's config, access policy included, in a `runs`
  table. The run still decides who it lets in.

The API only grows by additions. A breaking change gets a new version path, and the service keeps
serving the old one until the deployed-versions table shows no caller left.

The service is socket-activated by systemd: systemd holds the socket open across a restart, so
callers wait instead of failing while a new version starts. Callers use a short timeout and turn
it into a 503. Runs do not cache answers, and they stop working while the service is down.

The service ships from the same checkout and in the same deploy as the lobby. It is a separate
process, not a separate component.

## Considered options

- **Move `accounts.db` to Postgres.** This is the usual answer to several processes sharing one
  database, and it fixes concurrent access. It does not fix ownership: every run would still send its
  own SQL against the schema, so a run pinned on old code would still constrain every schema change,
  and every run would still need the signing secret.
- **Let the lobby process own the database.** Fewer processes, but the lobby is the most exposed
  process on the server, and it would hold the database, the password hashes and the secret. Serving
  a public port and a Unix socket from one process also needs custom server start-up code.
- **Runs keep checking the cookie themselves** (as with a JWT, a signed token anyone holding the key
  can check without asking a server). This avoids a call per request, but keeps the secret in every
  run. With runs already calling the service on every request, it saves nothing.
- **Runs cache answers and keep serving players while the service is down.** Rejected as complexity
  without a need: the service is a small local process, and socket activation hides its restarts.

## Consequences

- **The secret leaves the runs.** ADR-0002's A1 cookie still reaches every subdomain, but only the
  accounts service can validate it (the cookie is signed, not encrypted). A2 (#813) reduces to the redirect handshake plus one endpoint to
  redeem a ticket. The run keeps forwarding a cookie; the service checks that it was issued for that
  run.
- **Each run's request path now depends on the service.** If the service is down, runs are down.
- **The guarantee is only as strong as Unix permissions.** Every service runs as the same Unix user,
  so a compromised run can call any endpoint, including the admin ones. Separating them needs a Unix
  user per run, which is separate hardening work.
  _Update (#1284):_ the service itself now runs as its own Unix user, the only one that can read the
  database and the secret, so a compromised run or lobby backend can no longer read them off disk.
  It can still call every endpoint.
- **Cutover needs a freeze.** Runs on old code keep opening the database until they are upgraded or
  torn down. Schema changes are frozen until the deployed-versions table shows none left.
- **Vestigial fields go.** `settled_at` (no reader since #1138) and the freeplay `Player.pwhash` copy
  (never read) are removed, by a schema migration and a state migration respectively.
