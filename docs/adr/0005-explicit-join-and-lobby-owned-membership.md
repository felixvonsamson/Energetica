# Explicit join step for public runs; membership means joined, not settled

## Context

Private-run admission (#1019-#1022) already has an explicit, deliberate step: a facilitator
adds an account to the roster, or a visitor follows a join link and confirms "Join *Instance
Name*?". A public run had no equivalent — clicking it in the picker (or following a deep
link) landed straight on the settle page (tile picking) via the entry gate's silent
auto-provision, with no confirmation in between.

That silence is also why `instance_membership` (ADR-0002/CONTEXT.md, "membership = settled")
originally excluded a merely-provisioned account from "your runs": a public run's entry gate
auto-provisions on every authenticated visit, including an idle click that goes nowhere, so
counting provisioning as membership would have cluttered "your runs" with runs never actually
played. Settling was the only deliberate act available to key off.

This asymmetry meant the private-run allowlist (who may access a run at all) and the public
"your runs" set (which runs an account is part of) lived in two different, incompatible
places — a per-run on-disk allowlist (`instance.json`) for the former, `instance_membership`
in the shared `accounts.db` for the latter — for no principled reason, and the lobby had no
visibility into a private run's pending invites at all.

## Decision

**Public runs get an explicit join step too.** The picker's "open run" card is now two clicks
for a logged-in account: select the run, then a distinct "Join run" button. This closes the
asymmetry with private-run admission (both are now a deliberate, explicit act) and gives
public and private runs a shared "joined" event to key membership on.

**Membership means joined, not settled.** `instance_membership` gains `settled_at`, separate
from the existing `created_at` (now `joined_at` for a player row): a row is written at *join*
time, and `settled_at` is filled in later, at settle. The lobby's "your runs" is keyed on
having a row at all, unsettled included; `settled_at` is display-only (a "Settle" vs
"Continue" affordance, and a future settled-player count). This reverses the prior
"membership = settled" resolution now that a run can write the row at a deliberate join
moment — the silent-auto-provision concern that motivated settled-only no longer applies,
because nothing writes a row on a bare, unclicked visit.

**Scope of this PR: the public-run picker join only.** The write described above
(`accounts.record_join`) is wired up here for the public-run two-click join
(`POST /api/v1/lobby/runs/{slug}/join`). A private run's roster add and join-link confirm are
*conceptually* the same deliberate "join" act — the reasoning above is why they belong on this
same table — but as of this PR they still write to `instance.json`'s `allowed_usernames`, the
pre-existing mechanism, unchanged. Wiring those two paths onto `accounts.record_join` too is the
explicit follow-up in Consequences below (done in ADR-0006/#1031) — until that lands, a joined
row exists only for a public-run join or an actual settlement, never yet for a private-run
invite.

**The lobby owns the public-run join write.** `POST /api/v1/lobby/runs/{slug}/join` is a lobby
endpoint, not an instance one: it writes straight to `accounts.db`, which the lobby already
reads/writes directly for `my-runs` (`energetica.my_runs`, ADR-0002 Phase B) and already reads
`instance_config` fragments from for run metadata. No new cross-service coupling — this reuses
the exact substrate ADR-0004 established for facilitator grants, just for player joins on
public runs. A private run's admission stays entirely instance-owned (the allowlist itself
isn't visible to the lobby, only whether one applies — see Consequences); this endpoint 403s
on one.

**A returning `?return=slug` deep link only bounces straight into an *already-joined* run.**
Previously it bounced into any known run, joined or not — silently joining by side effect of a
login redirect. Now an unjoined run's `?return=` stops on the picker like any other unjoined
run, so "joined" means one consistent thing everywhere: the explicit click, never a redirect.

## Considered options

- **Keep membership = settled; add a separate "invited" concept for private runs only.**
  Rejected: perpetuates the two-different-places split this decision closes, and gives public
  and private runs no shared vocabulary for "part of this run."
- **Route the public join through the instance (a cross-origin call, or navigate-then-confirm
  like the private join-link page).** Rejected: the picker's two-click join is meant to be
  in-lobby, no navigation — a cross-origin fetch from the lobby frontend to an instance backend
  is exactly the CORS-shaped call this codebase otherwise avoids (`my_runs.py`'s docstring),
  and the lobby already has everything it needs (`accounts.db`, fragments) to answer this
  itself.

## Consequences

- `InstanceFragment` (the public projection published per instance) gains `private: bool`, so
  the lobby can keep a private run out of the freely-joinable "Open runs" list without ever
  seeing its allowlist — only whether one applies survives publication, same boundary as before
  (`access` block stripped).
  `accounts.record_settlement` becomes an upsert (fills in `settled_at` on an existing joined
  row, or inserts an already-settled row when there wasn't one — private runs and dev/legacy
  instances with no lobby take this path unchanged).
- A new `accounts.record_join` / `GameExceptionType.RUN_NOT_FOUND`. `MembershipRoleConflictError`
  now also guards joining (a facilitator can't join their own run as a player, same rule as
  settling).
- The private-run allowlist (`instance.json`'s `allowed_usernames`) is untouched by this
  decision — moving it onto `instance_membership` alongside the public-run join model it now
  shares a schema with is a follow-up, not part of this change. **Done in ADR-0006.**
- `docs/architecture/lobby.md`'s `instance_membership` schema and flows, and
  `CONTEXT.md`'s "Joined a run" / membership-ambiguity entries, are updated alongside this ADR.
