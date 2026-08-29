# Private-run allowlist moves from instance.json to accounts.db

## Context

ADR-0005 unified public and private runs on one "joined" concept in `accounts.db`'s
`instance_membership` table, but only for public runs — the private-run allowlist itself
(`instance.json`'s `access.allowed_usernames`, predating the facilitator work entirely, still
edited out-of-band today via `scripts/infra/whitelist-instance.sh`) stayed where it was,
explicitly flagged there as a follow-up.

That left two different stores answering the same question — "does this account have access to
this run?" — depending on the run's policy: a lobby-visible `accounts.db` row for a public run,
an instance-local JSON file the lobby never reads for a private one. Concretely, this meant:

- The lobby could not show "you've been invited to *this* private run" anywhere, because it had
  no visibility into any instance's `allowed_usernames` — only the instance process serving that
  one run could answer that question, and only for itself.
- The facilitator roster page's own "joined vs invited" split (`GET /facilitator/roster`) had to
  reconstruct "has this account touched the run" by checking for a settled `Player` directly
  (`Player.filter_by(username=...)`), duplicating logic that `instance_membership` already
  exists to answer for public runs.
- `accounts.record_join`/`is_facilitator`'s mutual-exclusion guard (ADR-0004) had no way to see a
  private run's allowlist at all, so a facilitator and a private-run invitee could theoretically
  collide with no cross-check between the two mechanisms.

## Decision

**The private-run allowlist moves to `instance_membership`, using exactly the join/settle model
ADR-0005 introduced.** A private run's admission is *itself* a "join" — a facilitator's roster
add, or a visitor confirming a join link — so it writes through `accounts.record_join` the same
way the public-run picker's two-click join does. The entry gate's access check
(`_enforce_instance_access`) reads `accounts.has_joined` instead of a per-instance allowlist.
Removing a roster entry (`accounts.remove_membership`) is a plain delete — it denies the
account's next entry attempt without touching any `Player` already created in that run's engine,
matching the roster page's already-documented "revocation is eventual" behaviour.

**`instance.json` keeps deciding *whether* a run is gated at all, not *who* passes the gate.**
`access.policy` (`public`/`private`) and the join-link settings (`join_token`/`join_open`) stay
exactly where they are — they're properties of the run, set by a sysadmin (policy) or a
facilitator (the toggle), not of any one account's relationship to it. Only the per-account
allowlist itself (`allowed_usernames`) moves.

**`allowed_usernames` is removed outright, not deprecated in place.** The field predates the
in-app facilitator surfaces by a wide margin (`scripts/infra/whitelist-instance.sh` is a real
out-of-band tool that shipped with it), but no instance has actually been run with a `private`
policy yet — there is no deployment with real, populated allowlist data this change could break.
With nothing to preserve, keeping the field around inert (parsing but never read) would only
have been confusing dead weight; `extra: forbid` on `PrivateAccess` means an `instance.json` that
still carries the key now fails closed instead, which is the correct behaviour for a key that no
longer does anything. (Had a private instance existed, the right move would have been a one-time
backfill script reading the old allowlist into `accounts.db` before cutover — worth remembering
if this class of migration comes up again once a real deployment exists.)

**`scripts/infra/whitelist-instance.sh` is retired, replaced by `scripts/whitelist-run.py`.**
Same shape (`list` / `add` / `remove`, sysadmin-run over SSH), same reasoning as
`scripts/grant-facilitator.py` replacing the old `admin_accounts.txt` bootstrap (ADR-0004): a
shell script that edits a JSON file by hand no longer has anything to edit, once the data it
edited moved to `accounts.db`.

## Considered options

- **Keep `instance.json` as the source of truth; have the lobby read every instance's
  `instance.json` for "your pending invites."** Rejected: this is exactly the "more
  cross-instance coupling" ADR-0002 already flagged as a cost of the shared `accounts.db`, but
  paid for a second time on top of it — reading N instances' private config files from a
  service that doesn't otherwise touch any instance's on-disk state, for data that already has a
  perfectly good shared home.
- **Keep both, syncing one into the other.** Rejected: two sources of truth that must be kept in
  lockstep is strictly worse than one, and defeats the entire point of this migration — the
  problem being solved is exactly "the whitelist and the lobby's join-tracking live in two
  different places for no reason."

## Consequences

- `energetica.accounts.db` gains `has_joined`, `remove_membership`, `get_run_roster` — the
  private-run entry-gate check and the roster page's read/write, alongside the existing
  `record_join`/`record_settlement`/`is_facilitator`.
- `instance_config.is_access_allowed`, `add_allowed_username`, `remove_allowed_username` are
  removed — `_enforce_instance_access` (routers/auth.py) now branches on `isinstance(config.access,
  PrivateAccess)` for *whether* to check, and `accounts.has_joined` for *who* passes.
- The facilitator roster page's API contract (`FacilitatorRosterOut`, `RosterAddIn`, the
  `GET`/`POST`/`DELETE /facilitator/roster*` routes) is unchanged — this is a storage migration
  behind an existing interface, not a product change, so the frontend needed no changes.
- `docs/architecture/roles.md`'s "Manage instance whitelist" capability row flips from
  `aspirational` to `built`.
- A plain-delete ban interacts with the join/settle model: re-adding a previously-settled,
  then-banned account through a bare `record_join` would come back with `settled_at` null even
  though its `Player` (tile, resources, facilities — none of it lives in `instance_membership`)
  never went anywhere. `energetica.utils.misc.record_join_reconciling_settlement` — used by both
  the roster's add and the join-link's confirm, the only two paths that can re-add an
  already-settled account — closes this by backfilling `settled_at` from the engine's `Player`
  right after the join write. The entry gate itself was never actually broken by the gap (its
  `is_settled` reads the `Player` directly, never `settled_at`); this only fixes the lobby
  display, which does read `settled_at`.
