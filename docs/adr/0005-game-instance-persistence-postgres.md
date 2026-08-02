# Move game-instance entity persistence off pickle onto Postgres

**Status:** proposed

## Context

Game-instance state — `Player`, `Network`, `ActiveFacility`, `OngoingProject`,
`OngoingShipment`, `HexTile`, `Chat`, `Notification`, `User`, `ResourceOnSale`,
`ClimateEventRecovery`, and their nested value objects — lives entirely as
in-process Python objects (`energetica/database/__init__.py`'s `DBModel` base
class) and is durable only via `GameEngine.save()`/`load()`
(`energetica/game_engine.py:225-270`), which pickles/unpickles the *entire*
object graph as one blob into `instance/engine_data.pck`. This subsumes issue
#627, which separately asked how time-series data (production/consumption
history, rolling buffers) should be stored, and had already concluded Postgres
+ TimescaleDB for that piece; this ADR treats both as one combined decision
(see Decision).

`accounts/db.py` — the separate, server-wide SQLite store for login accounts —
is explicitly out of scope; it is a future SSO/lobby concern (issues #810,
#816), not this effort's.

**The codebase treats the entity graph as one always-resident, always-consistent
in-memory blob, not as independently-persisted rows.** Cross-entity links
(`Player.tile`/`HexTile.player`, `Player.network`/`Network.members`,
`Player.user`/`User.player`) are plain Python object references with no FK
enforcement. Helpers like `join_network`/`leave_network`
(`energetica/utils/network_helpers.py:25-26, 65-67`) perform two separate,
un-transacted writes to keep both sides in sync — "atomic enough" only because
nothing else runs between the two statements today. `ActiveFacility` also
maintains a hand-rolled `ClassVar` secondary index (`_player_type_index`,
`energetica/database/active_facility.py:24-75`) that must be manually rebuilt
on load. None of this survives a DB-roundtrip/transaction model, where a write
is not instantly visible everywhere — independent of ORM choice, this is the
central problem this ADR's Consequences section names rather than solves. Full
inventory of `DBModel` subclasses and mutation sites:
`docs/research/dbmodel-postgres-survey.md` (branch
`research/932-dbmodel-postgres-survey`).

**A prior attempt at this exists and was reverted.** A SQLAlchemy-backed hybrid
(the `mixed_db` class decorator, `website/database/mixed_database.py`, added
2024-11-16) routed a whitelisted set of fields through dynamic
`__getattr__`/`__setattr__` instead of the object's own `__dict__`. It
accumulated real feature commits for five to six weeks before being reverted
(`8a0b7ad8`, then fully via `852211fe`) for one explicit, stated reason: the
dynamic attribute routing made every attribute access on `Player`/`Network`
untypeable by static tools. `energetica/database/__init__.py`'s `DBModel` is
the surviving in-memory-only base class from that reversion (renamed in
`1f8be53b`). No trace of this era survives in current comments or docs — this
ADR is the first record of it. The reason for the revert does not indict an
ORM as such, only *dynamic attribute magic*; both SQLAlchemy 2.0's
`Mapped[]`-annotation style and SQLModel avoid that specific failure mode, and
FastAPI/Pydantic/`bun run generate-types` did not exist yet in 2024 to make the
stakes of static typing as visible as they are today.

The game runs in fixed ~1-month seasons, not indefinite persistence, giving a
natural migration cutover point (see Decision, Migration).

## Decision

**Move game-instance entities and time-series data onto one shared Postgres
server, adopting an ORM, for new instances only, while the Action log stays
authoritative and Save/Checkpoint is replaced.**

- **One combined store, not two independent tech choices.** Entities and
  time-series data (subsuming #627) move together: entities as regular
  relational tables, time-series as TimescaleDB hypertables, in the *same*
  Postgres instance. There is no enforced foreign key across two separate DB
  engines/processes, so co-locating buys real FK integrity (no orphaned
  time-series rows on player/network deletion) at near-zero marginal cost once
  entities are moving to Postgres anyway.
- **One shared Postgres server process, one database per game instance**
  (`CREATE DATABASE game_<slug>`, `DROP DATABASE` on teardown/`--rm_instance`).
  Not a separate server process per instance (too heavy — replicates today's
  per-`instance/`-directory model at the DB layer for no benefit) and not one
  shared database/schema for everything (loses isolation). Dropping the
  database at instance end-of-life also bounds per-instance DB growth
  automatically, with no separate retention/pruning policy needed.
- **Action log / Save / Checkpoint / Replay coexist with Postgres; they are
  not replaced wholesale.** The Action log remains the append-only,
  authoritative event source (it also doubles as the audit trail for
  arbitrary user-controlled `request` payloads, independent of persistence
  tech). Postgres becomes the new home for what `engine_data.pck` (Save) held
  — the tick engine's current entity state — continuously, not written every
  10 minutes. Replay logic changes shape (apply actions to DB rows/transactions
  instead of in-memory Python objects) but the concept survives unchanged.
  Checkpoint (the 6h disaster-recovery tarball) needs a new mechanism
  (`pg_dump` or similar instead of tarring `instance/`) — deferred as
  implementation/spec-level detail, not decided here.
- **Adopt an ORM.** The 2024 failure does not block a retry: it died from
  dynamic attribute routing, not from ORMs generally, and that specific
  failure mode is avoidable with either modern SQLAlchemy 2.0 or SQLModel.
  **SQLModel is the leaning, not formally pinned** — final selection is
  deferred to a follow-on spec map. SQLModel's appeal is specific to this
  codebase: entity models could double as the Pydantic schemas already living
  in `energetica/schemas/`, collapsing "DB row shape" and "API response shape"
  in a way that compounds with the existing `schemas/` → `api.generated.ts`
  pipeline.
- **Migration: new instances only.** No backfill path for already-running or
  completed instances' pickled state. The fixed ~1-month season structure
  gives a natural cutover: launch the next season on the new persistence
  model; existing/completed instances finish or stay on pickle untouched. A
  one-time backfill tool for historical time-series data, if past instances
  need to be queryable in the new store, is a smaller separate follow-up, not
  this ADR's problem.
- **Local dev ergonomics: the constraint is named and a low-friction dev story
  is committed to, but its concrete mechanism is deferred.** Postgres-as-server-
  process is real onboarding friction versus today's zero-config pickle/SQLite
  setup, and *some* solution (e.g. Docker Compose, or an ephemeral/embedded
  Postgres for tests) must exist — designing which one is a follow-on spec's
  job, not this ADR's. Workshop Mode (#880, "local frontend + remote
  backend/DB on a disposable server instance") may reduce how much this
  matters; the concrete mechanism is deferred until that direction is clearer.

**Out of scope for this ADR**, ruled on explicitly rather than left ambiguous:

- `player.py:80`'s pre-existing `# TODO (Felix): add @dataclass(eq=False) on
  all classes` — identity vs. structural equality on the *current* pickled
  dataclasses is orthogonal to storage backend. Moving to SQLModel/Postgres
  rows likely resolves the underlying tension for free (rows get identity via
  primary key naturally), but that is a side-effect for the spec/implementation
  stage to note, not something this ADR rules on.
- Concrete schemas, migration scripts, or the local-dev mechanism — all
  deferred to a follow-on spec map, informed by the prototype below.

## Considered Options

- **Two independently-resolvable tech decisions (entities and time-series
  chosen separately).** Rejected: an enforced foreign key across two separate
  DB engines/processes is not possible, so splitting them means unenforced
  integer references between entities and their time-series rows — no better
  than today's in-memory `AutoIDDict` lookups.
- **A separate Postgres server process per game instance.** Rejected: too
  heavy, and replicates the per-`instance/`-directory isolation model at the
  DB layer with no added benefit over one shared server with per-instance
  databases.
- **One shared Postgres database/schema for every instance.** Rejected: loses
  isolation between instances.
- **Postgres becomes fully authoritative; Action log becomes secondary or is
  removed.** Rejected: bigger blast radius for no clear win at this ADR's
  scope — it re-invents "replay" as "Postgres backup/restore + point-in-time
  recovery," and the Action log's value as an audit trail for arbitrary
  user-controlled payloads is independent of persistence tech.
- **A migration/backfill path for existing or completed instances.** Rejected
  for now: the game's fixed ~1-month season structure already gives a natural,
  staged cutover point without one; matches #627's own incremental approach
  rather than a big-bang migration.
- **No ORM; hand-rolled SQL/query layer.** Not chosen: an ORM (SQLModel
  leaning) is judged to fit better given the existing `schemas/` →
  `api.generated.ts` type-safety pipeline, and the 2024 revert's actual cause
  (dynamic attribute magic) does not apply to modern SQLAlchemy 2.0 or
  SQLModel.

## Prototype

A throwaway SQLModel rewrite of `ActiveFacility` (branch
`prototype/933-active-facility-sqlmodel`, file
`scratch/prototype_933_active_facility_sqlmodel.py`, not wired into the app)
was built to sanity-check the ORM shape before locking in the SQLModel
leaning. Findings:

- All ~20 `@property` methods (`total_cost`, `max_power_generation`,
  `display_name`, etc.) survive completely unchanged — SQLModel classes are
  still plain Python classes. This is the most reassuring finding: the
  computed-property surface needs zero rewriting.
- The hand-rolled `_player_type_index` (flagged in the codebase survey as a
  landmine) is replaced by a query, not translated 1:1 — no separate
  structure to keep in sync, nothing to rebuild after load. A net
  simplification.
- An FK relationship replaces an object reference: `player: Player` becomes
  `player_id: int` (FK) + `player: Player` (`Relationship`) — two fields
  where the dataclass had one, because "which row" and "the loaded object"
  split apart once a row can be absent from memory.
- `facility_type` (a union of four `StrEnum` classes with overlapping domains)
  has no native column type; the column stores a plain `str`, and
  reconstructing the specific enum member back requires a new lookup shim
  (`FACILITY_TYPE_LOOKUP`) that the current object-identity-based dataclass
  never needed. A concrete cost, not a blocker.
- A round-trip identity check — mutate and commit an object in one session,
  re-read in a fresh session — returns a *different* Python object. This is
  the concrete face of the codebase survey's "everything assumes synchronous,
  always-visible in-memory mutation" landmine: it is the one thing every
  current mutation call site currently assumes away, and is not fixed by any
  ORM choice.

Verdict: the ORM shape feels right — properties port cleanly, index
elimination is a net simplification — with the enum-reconstruction shim and
the cross-session identity break as the two concrete costs to carry forward
rather than gloss over.

## Consequences

- **The central landmine this ADR does not solve:** the codebase assumes the
  entity graph is one always-resident, always-consistent in-memory blob with
  synchronous, always-visible mutation (`docs/research/dbmodel-postgres-survey.md`).
  Manually-paired dual writes (`join_network`/`leave_network`), the
  `ActiveFacility` secondary index, and `functools.cached_property`
  memoization on mutable entities (`OngoingProject._prerequisites_and_level`)
  all rely on this assumption. A DB-roundtrip/transaction model breaks it
  regardless of ORM choice; a follow-on spec map must design the actual
  consistency model (transactions, session lifecycle, cache invalidation)
  call site by call site.
- **`id: int | None` is a real type-level cost, not annotation noise.**
  Postgres autogenerates ids; a freshly-constructed, not-yet-committed object
  holds `id = None` until commit + refresh, a behavioral change from today's
  `DBModel.__post_init__`, which assigns `id` synchronously and it is never
  `None`. Any code path touching `.id` on such an object needs an explicit
  guard at that boundary.
- **`Relationship` fields are lazy by default and session-bound.** First
  access issues an implicit `SELECT` if the related row is not already
  loaded — an N+1 risk given the tick engine iterates all active facilities
  every tick — and accessing one after its session has closed raises
  `DetachedInstanceError` unless already loaded. Collections the tick loop
  iterates must be eager-loaded explicitly; this is an implementation-stage
  concern this ADR flags rather than resolves.
- **JSON-shaped fields need care in the follow-on spec:** prefer
  `sqlalchemy.dialects.postgresql.JSONB` (binary, indexable) over plain `JSON`
  for dict-shaped fields like `multipliers`; prefer two plain columns
  (`position_x`, `position_y`) composed back into a tuple over JSON or a
  native Postgres composite type for simple fixed-shape fields like
  `position`.
- **Test suite impact:** there is no dedicated fixture/factory layer for
  entities today — tests rebuild the process-global engine from scratch via
  `create_app(rm_instance=True, ...)` per test. A real Postgres
  session/connection needs an equivalent "wipe and reseed" story or a
  transactional-fixture rewrite; this is the single largest test-suite-shaped
  cost of the migration and belongs in the follow-on spec.
- **Checkpoint needs a new mechanism** (`pg_dump` or equivalent, replacing
  tarring `instance/`) before Postgres can fully replace Save/Checkpoint in
  practice — implementation-level detail, deferred.
- **Onboarding friction increases:** Postgres-as-server-process replaces
  today's zero-config pickle/SQLite dev setup. A low-friction local dev story
  must exist before this ships to developers day-to-day, though its concrete
  mechanism is deferred and may be shaped by how Workshop Mode (#880) lands.
- **No migration path exists for already-running or completed instances.**
  This is acceptable given the ~1-month season cadence, but means pickle and
  Postgres coexist across the codebase for at least one full season
  transition, and any shared utility code must not assume one persistence
  model exclusively during that window.
- **Final ORM selection, concrete schemas, and the local-dev mechanism are
  explicitly deferred** to a follow-on spec map, to be informed by this ADR
  and the prototype above.

## References

- Codebase impact survey: `docs/research/dbmodel-postgres-survey.md`
  (branch `research/932-dbmodel-postgres-survey`)
- Prototype: `scratch/prototype_933_active_facility_sqlmodel.py`
  (branch `prototype/933-active-facility-sqlmodel`)
- Wayfinder map: [Game-instance persistence: ADR on moving off pickle onto
  Postgres (subsumes #627)](https://github.com/felixvonsamson/Energetica/issues/924)
