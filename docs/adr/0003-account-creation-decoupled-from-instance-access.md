# Account creation decoupled from instance access; lobby signup is open

**Status:** accepted

## Context

With the lobby (ADR-0002) becoming the single server-wide front door, signup moves there.
Previously signup was **per-instance**: `misc.signup_playing_user` created the server-wide
**Account** *and* a pickle `User` on that instance in one act, and Phase 3 of
`docs/architecture/static-serving-and-deployment.md` deliberately gated signup behind each
instance's access policy, justified as: *"Gating signup too closes the hole where a
private/unadvertised instance reachable by URL would otherwise let anyone create a
server-wide account."*

A single lobby cannot be gated by any one instance's allowlist — it is instance-independent
by design. So the bundling has to break.

## Decision

**Lobby signup creates an Account only** — one row in the server-wide accounts store, no
`User`, no `Player`, no instance. An account may exist with zero run memberships. Account
creation is gated by a **server-wide signup toggle**, **not** by any per-instance access
policy.

The existing `disable_signups` flag and `players.txt` are **per-instance** (an engine flag
set at instance init and checked in `routers/auth.py`; a file under that instance's
`instance/` read at startup), so the lobby — which has no engine, no slug, no `instance/` —
cannot reuse them. They are replaced server-wide: a `signups_enabled` flag in a new
`/etc/energetica/server.json` (read fresh by the lobby, mirroring how each instance reads
its `instance.json`) gates open signup, and closed-enrollment deployments seed accounts
directly into `accounts.db` via an admin bootstrap (`accounts.get_or_create_account_id`)
instead of `players.txt`. The per-instance `disable_signups` no longer governs account
creation (signup is no longer per-instance).

**Joining a run is a separate, later act:** pick a run → enter it → settle. The per-instance
access policy (`_enforce_instance_access`) is enforced at **entry** (User auto-provision)
and settle, exactly where it was — not at signup.

## Considered Options

- **Keep per-instance, access-gated signup.** Rejected: structurally incompatible with a
  single server-wide front door, and it conflates two different things — having an identity
  vs. being allowed into a particular run.

## Consequences

- The Phase-3 protection is intentionally dissolved. It is no longer needed: signup no
  longer implies access to any instance, so "anyone can create an account" grants access to
  nothing. An account with no membership can enter only runs whose access policy admits it.
- Private/unadvertised runs are protected **entirely at the entry gate** (the instance, on
  auto-provision/settle), not at signup. This is the same enforcement point and code path
  (`_enforce_instance_access`) as before; only the signup-time check is dropped.
- `misc.signup_playing_user` splits: lobby-side account creation vs. instance-side
  join/settle. Settling is what writes `instance_membership` (see ADR-0002 / CONTEXT.md).
- A new server-wide config surface (`/etc/energetica/server.json`) is introduced for the
  signup toggle; `players.txt`'s closed-enrollment role becomes a direct-to-`accounts.db`
  admin bootstrap. Designing and landing these belongs to the lobby's Phase B (#816).
