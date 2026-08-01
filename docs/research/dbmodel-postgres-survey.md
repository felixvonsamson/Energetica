# DBModel to Postgres: codebase impact survey

Research for issue #932 (child of the wayfinder map, #924). Feeds the "Context"
section of an ADR about moving `DBModel` entities to Postgres. This file is
inventory only: it does not choose an ORM (#928, out of scope) and does not
propose a migration plan or schema.

Convention note: saved at `docs/research/dbmodel-postgres-survey.md`, following
the path used by the prior wayfinder research file
`docs/research/admin-capability-census.md` (added in commit `80a19c46`,
`research(#894): admin capability census`).

## 1. Inventory of `DBModel` subclasses

The base class lives at `energetica/database/__init__.py:46`. It is a plain
`@dataclass` with no persistence of its own: `__init_subclass__`
(`energetica/database/__init__.py:51-53`) registers an `AutoIDDict` per
subclass name on the global `engine.db_model_instances` dict, and
`__post_init__` (`energetica/database/__init__.py:60-62`) assigns the object an
id and adds it to that dict. There is no relational structure, no query
planner, and no foreign-key enforcement — cross-entity references are plain
Python object references (see §4).

Subclasses found (via `grep -rln "DBModel" energetica/`):

| Class | File | Fields (rough) | Notes |
|---|---|---|---|
| `Player` | `energetica/database/player.py:81` | ~30 top-level fields (lines 81-183): `user`, `tile`, `network`, `projects_by_priority`, `network_prices`, `rolling_history`, `capacities`, `cumul_emissions`, `renewable_statuses`, `production_statuses`, `consumption_statuses`, `achievements` (dict of 12 keys), `progression_metrics` (dict of 13 keys), `push_subscriptions`, `notification_feed_subscriptions`, `dispatched_tutorials`, `socketio_clients`, etc. | Largest and most complex entity by far. Several fields are themselves nested stateful objects (`CircularBufferPlayer`, `CapacityData`, `CumulativeEmissionsData`, `NetworkPrices`) rather than scalars. |
| `Network` | `energetica/database/network.py:19` | 5 fields: `name`, `members` (`list[Player]`), `created_tick`, `rolling_history`, `capacities` | `__post_init__` (line 29) does filesystem I/O (`mkdir`) as a side effect of construction; `delete()` (line 45) does `shutil.rmtree`. |
| `ActiveFacility` | `energetica/database/active_facility.py:21` | 7 instance fields (`facility_type`, `player`, `position`, `end_of_life`, `multipliers`, `usage`, `cut_out_speed_exceeded`) plus a `ClassVar` secondary index `_player_type_index` (line 24) | Many derived `@property`s (cost, power, efficiency — lines 78-176) computed from `multipliers` + `const_config`, not stored. |
| `OngoingProject` | `energetica/database/ongoing_project.py:19` | 9 fields (`project_type`, `player`, `duration`, `project_power`, `project_pollution`, `status`, `end_tick_or_ticks_passed`, `multipliers`, `speed`, `previous_speed`) | Business logic-heavy: `pause`/`unpause`/`set_ongoing`/`delay_by` mutate status + timing fields (lines 68-113); `_prerequisites_and_level` is a `functools.cached_property` recomputed on demand (lines 161-176, 191-212) — a memoization landmine, see §4. |
| `OngoingShipment` | `energetica/database/ongoing_shipment.py:17` | 7 fields (`resource`, `quantity`, `arrival_tick`, `duration`, `power_demand`, `player`, `speed`, `previous_speed`) | Simple. |
| `HexTile` | `energetica/database/map/hex_tile.py:16` | 5 fields (`coordinates`, `climate_risk`, `fuel_reserves` dict, `potentials` dict, `player`) | `get_neighbors`/`get_downstream_tiles` (lines 32-68) do full-table scans via `HexTile.filter_by` — O(map size) per call, currently cheap only because everything is in-process. |
| `Chat` | `energetica/database/messages.py:85` | 4 fields (`name`, `participants: set[Player]`, `messages: list[Message]`, `player_last_read_index: dict[int,int]`) | `Message` itself (line 65) is a plain (non-`DBModel`) dataclass nested inside `Chat.messages`, with its own hand-rolled `id` field — it does *not* get an `AutoIDDict` entry or `DBModel.get()`/`filter_by()` support. |
| `Notification` | `energetica/database/messages.py:142` | 7 fields (`type`, `payload: dict`, `player`, `time`, `read`, `flagged`, `archived`) | `payload` is an untyped dict — whatever shape the specific `NotificationType` produced (see the payload-class comment block at `energetica/database/messages.py:14-40`). |
| `User` | `energetica/database/user.py:19` | 5 fields (`username`, `pwhash`, `role`, `account_id`, `player: Player | None`) | Auth-adjacent; `account_id` links to the separate SQLite `accounts.db` store (see `energetica/accounts/`), so `User` already straddles two persistence mechanisms. |
| `ResourceOnSale` | `energetica/database/resource_on_sale.py:16` | 4 fields (`resource`, `quantity`, `unit_price`, `player`) | Simple. |
| `ClimateEventRecovery` | `energetica/database/climate_event_recovery.py:15` | 4 fields (`name`, `end_tick`, `duration`, `recovery_cost`, `player`) | Simple. |

Not `DBModel` subclasses, but nested value objects owned by the above (not
separately queryable, so likely embedded columns/JSON rather than tables under
Postgres): `NetworkPrices` (`energetica/database/network_prices.py:28`),
`CapacityData`, `CircularBufferPlayer`, `CircularBufferNetwork`,
`CumulativeEmissionsData`, `EmissionData` (all under
`energetica/database/engine_data/`), and `Message`
(`energetica/database/messages.py:65`, confirmed above).

## 2. Runtime mutation sites

**Tick engine** — `energetica/utils/tick_execution.py`:
- `tick()` (line 80, wrapped in `@engine.with_lock`) is the single entry point for one simulated tick; it calls `check_events_completion()` (line 120) and `production_update.update_electricity()` (line 99).
- `check_events_completion()` (`energetica/utils/tick_execution.py:120-167`) directly mutates/deletes entities: completes `OngoingProject`s via `projects.complete_project(fc)` (line 130), deletes arrived `OngoingShipment`s and calls `store_import` (lines 133-138), dismantles `ActiveFacility`s past end-of-life (lines 141-151), removes decommissioned-and-empty storage facilities (lines 154-162), and deletes finished `ClimateEventRecovery`s (lines 165-167).

**Production/market update** — `energetica/production_update.py` (1000+ lines, ~28 top-level functions per `grep -n "^def "`): this is the densest mutation surface in the codebase. It sets `player.overdraft_warning_sent` (lines 149, 157), `ActiveFacility.usage` in four separate call sites (lines 180, 188, 195, 621), `facility.usage` for solar/wind generation (lines 646, 680), and touches player money/emissions/statuses across `update_player_progress_values`, `update_storage_lvls`, `resources_and_pollution`, `money_balance`, `add_emissions`, `update_production_and_renewable_statuses`, etc. All of this runs synchronously, in-process, inside the single per-tick call and under `engine.lock`.

**Market clearing** — `energetica/market.py`: `place_ask`/`place_bid` (lines 43, 50) and `clear_market`/`market_optimum` (lines 94, 126) operate on plain dict-based order books (`market: dict`), not directly on `DBModel` instances — the dicts are populated from and applied back to `ActiveFacility`/`Player` state by `production_update.market_logic` (`energetica/production_update.py:492`).

**Routers / API mutation** (each of these is a plain field assignment reached from a FastAPI request handler, i.e. concurrent web requests, not the tick loop):
- `energetica/routers/players.py:57` — `player.show_chat_disclaimer = request_data.show_disclaimer`.
- `energetica/routers/notifications.py:66-70` — `notification.read/.flagged/.archived = body.*`.
- `energetica/utils/network_helpers.py:25,51,65-66` — `join_network`/`create_network`/`leave_network` set `player.network` and mutate `network.members` (a plain list) as two separate, manually-kept-in-sync writes (§4).
- `energetica/utils/projects.py` — `queue_project`, `cancel_project`, `resume_project`, `pause_project`, `toggle_pause_project`, `decrease_project_priority`, `increase_project_priority`, `complete_project` (lines 34, 85, 113, 152, 205, 216, 265, 297) all mutate `OngoingProject`/`Player.projects_by_priority` from request handlers.
- `energetica/utils/facilities.py` — `upgrade_facility`, `remove_facility`, `destroy_facility`, `dismantle_facility` (lines 24, 78, 94, 114) mutate/delete `ActiveFacility` instances, reachable both from the tick loop (§ above) and from routers.

**WebSocket / push side**: entities don't get mutated from socket handlers directly in the code surveyed, but `Player.emit(...)` (`energetica/database/player.py:378` area, also lines 397, 403, 523, 540, 931) pushes live state to connected clients right after mutation — i.e. the current design assumes "mutate in-process, then immediately emit," with no notion of read-after-write across a transaction boundary.

## 3. How tests construct/depend on these entities

There is **no dedicated fixture/factory layer** for `DBModel` entities. `tests/conftest.py` only provides one autouse fixture, `_isolated_accounts_db` (`tests/conftest.py:19-26`), which redirects the *separate* SQLite accounts store to a per-test temp path — it does not touch `DBModel`/`engine` state at all.

Instead, the dominant pattern across ~19 test files (`grep -rln "create_app(" tests/`) is:
1. Call `create_app(rm_instance=True, skip_adding_handlers=True, env="prod")` (e.g. `tests/unit/test_player.py:12`) at the top of the test. This rebuilds the process-global `energetica.globals.engine` singleton from scratch, including `engine.clear_db()` (`energetica/game_engine.py:206-211`), which resets every `DBModel` subclass's `AutoIDDict` and rebuilds `ActiveFacility._player_type_index`.
2. Directly instantiate entities against that freshly-cleared global store — e.g. `User(username=..., pwhash=..., role="player", account_id=1)` then `HexTile.getitem(1)` then `confirm_location(user, hex_tile)` (`tests/unit/test_player.py:12-15`).
3. Some tests instead go through `energetica.init_test_players.init_test_players()` (`energetica/init_test_players.py:44` `create_player`, `energetica/init_test_players.py:63` `setup_network`), a hand-written seeding routine that itself calls `queue_project`/`complete_project`/`create_network`/`join_network` — i.e. it exercises the same mutation helpers as production code rather than being a lightweight factory.
4. `tests/unit/test_network_prices.py:43` and `tests/policy_runner.py:15` call `engine.init_instance(...)` directly instead of going through `create_app`.

Net effect: tests depend on a single global mutable in-process store being torn down and rebuilt per test via `rm_instance=True`, not on any isolated session/transaction/fixture scoping. A Postgres migration that introduces a real session/connection would need an equivalent "wipe and reseed" per-test story (or an explicit transactional-fixture rewrite of this entire pattern) — this is the single largest test-suite-shaped landmine for the migration.

## 4. Landmines

- **Circular references are plain Python object references, not IDs.** `Player.tile: HexTile` / `HexTile.player: Player | None` (`energetica/database/player.py:85`, `energetica/database/map/hex_tile.py:26`); `Player.user: User` / `User.player: Player | None` (`energetica/database/player.py:84`, `energetica/database/user.py:26`); `Player.network: Network | None` / `Network.members: list[Player]` (`energetica/database/player.py:100`, `energetica/database/network.py:22`). Nothing enforces that these back-references stay consistent except hand-written call sites (see `join_network`/`leave_network` below) — under an ORM with real FKs, these become either bidirectional `relationship()`s (with their own consistency/cascade rules) or one-directional FK+join lookups, and any code that currently assumes `player.tile.player is player` needs re-auditing.

- **Manually-paired dual writes with no atomicity.** `energetica/utils/network_helpers.py:25-26` sets `player.network = network` and separately appends to `network.members` as two statements; `leave_network` (lines 65-67) sets `player.network = None` and separately calls `network.members.remove(player)`. In-process this is "atomic enough" because nothing else runs between the two statements (single-threaded tick + `engine.lock` for the tick path — but router-triggered calls are not lock-protected the same way). Under a DB-roundtrip model these two writes could straddle a transaction boundary or a partial failure, leaving `player.network` and `network.members` inconsistent.

- **`ActiveFacility` maintains a second, non-persisted, ClassVar in-memory index** (`_player_type_index`, `energetica/database/active_facility.py:24`) that duplicates what's derivable from `player_id` + `facility_type` alone. It's populated in `__post_init__` (line 40-42), kept in sync manually in `delete()` (lines 44-56), and only fully reconstructed via `rebuild_index()` (line 72-75), which is called from `engine.clear_db()` and `engine.load()` (`energetica/game_engine.py:210-211`, `264`). Any direct attribute mutation of `.player` or `.facility_type` on a live `ActiveFacility` (none currently exists, but nothing prevents it) would silently desync this index — this is exactly the kind of manually-maintained materialized index that an ORM/DB layer would normally replace with a query, and is worth flagging as a pattern to eliminate rather than translate 1:1.

- **`functools.cached_property` used as a per-instance memoization cache on a mutable entity.** `OngoingProject._prerequisites_and_level` (`energetica/database/ongoing_project.py:161-163`) caches a computed value in the instance `__dict__`, manually invalidated by `recompute_prerequisites_and_level()` deleting the dict key (`energetica/database/ongoing_project.py:117-119`). This assumes the object is one single long-lived Python object whose `__dict__` is the source of truth for "is my cache still valid" — a query-per-request or reconstructed-from-DB-row model breaks the cache-invalidation contract silently (stale cache never explicitly invalidated would just look wrong, not error).

- **Non-trivial `__setstate__` backward-compat / pickle-migration logic exists on three classes**, and encodes real product history that Postgres would need an equivalent "migration" story for:
  - `Player.__setstate__` (`energetica/database/player.py:190-217`): back-fills ~9 fields that didn't exist on old pickled `Player` objects (`last_connection`, `renewable_statuses`, `production_statuses`, `consumption_statuses`, `notification_feed_subscriptions`, `push_subscriptions`, `overdraft_warning_sent`, `created_at`, `dispatched_tutorials`), plus one explicit field rename/removal (`notification_opt_ins` deleted at line 216-217 in favor of a newer field).
  - `Network.__setstate__` (`energetica/database/network.py:36-42`): back-fills `created_tick` for pre-existing pickles.
  - `User.__setstate__` (`energetica/database/user.py:32-47`): **hard-fails** (`RuntimeError`) if a pickled `User` is missing `account_id`, unless `ENERGETICA_ALLOW_UNMIGRATED_USERS=1` is set — this is the one spot where a real one-time migration script already exists (`scripts/migrate-to-server-accounts.py`, referenced at line 38-40) and is the closest existing precedent in this codebase for "how do we migrate persisted entity shape."
  - Additionally, `GameEngine.load()` (`energetica/game_engine.py:257-270`) does its own ad hoc post-load migration outside any single class's `__setstate__` — e.g. backfilling `player.muted_chat_ids` — specifically because `engine.general_chat_id` isn't available yet inside `Player.__setstate__` (comment at `energetica/game_engine.py:267-269`). This shows migration logic is currently split across at least two different mechanisms (per-class `__setstate__`, and ad hoc post-`load()` patching) depending on what data the migration needs access to.

- **Whole-graph, whole-process pickle as the persistence boundary.** `GameEngine.save()` (`energetica/game_engine.py:225-249`) pickles `self.db_model_instances` — i.e. every `DBModel` instance of every subclass, for every player and network on the server — into one file, `instance/engine_data.pck`, and `GameEngine.load()` (`energetica/game_engine.py:251-270`) loads it back whole. There is currently no notion of loading/saving a subset (e.g. one player). Anything that assumes "the whole graph is resident in memory and any object is reachable via `SomeClass.get(id)` in O(1) with no I/O" — which is essentially all of §2 — will behave differently once individual entities require a query/round-trip to materialize.

- **Everything assumes synchronous, always-visible in-memory mutation with no I/O in between.** The single `@engine.with_lock` decorator around `tick()` (`energetica/utils/tick_execution.py:79-80`) is the *only* concurrency guard for the entire ~1000-line `production_update.py` mutation surface; router-triggered mutations (§2) run without that lock. The whole design assumes a mutation is instantly visible to every other piece of code in the same process (no cache, no stale read, no partial commit). A DB-roundtrip/transaction model — where a write isn't visible to a concurrent reader until commit, and where a read might need to re-fetch rather than dereference a live object — is a different consistency model than anything currently in this codebase, including its own lock discipline.

## 5. Lessons from the reverted 2024 SQLAlchemy attempt

The relevant history (all on `main`, in the old `website/` tree that predates the `energetica/` rename):

- `34b293d7` ("database can store non table columns into engine", 2024-11-16) introduced the original design: `Player`/`Network` were real `db.Model` (SQLAlchemy) classes with relational columns, and a `mixed_db(cls, fields={})` class decorator (`website/database/mixed_database.py`, added whole in this commit) routed a whitelisted set of "heavy"/non-relational fields (`current_data`, `capacities`, `cumul_emissions`) through a dynamic `__getattr__`/`__setattr__` pair that read/wrote `current_app.config["engine"].data[cls.__name__][self.id][field]` instead of the object's own `__dict__`. So `Player` was applied as `@partial(mixed_db, fields={"current_data", "capacities", "cumul_emissions"})` directly above the `class Player(db.Model, UserMixin):` line.
- A string of follow-up commits (`e45363ed`, `cfa8a99b`, `68adaab2`, `3667469f`, `c52e9062`, `ec8d89cf`, `5c7c865e`, `7fea5046`) kept extending the decorator — adding "buffered fields", partial application, TypeVar-based defaults, cache-attribute deletion for prerequisites — i.e. real engineering effort went into making the hybrid work, not a quick abandoned spike.
- `8a0b7ad8` ("back to property and setter for type inference, mixed_db decorator deleted", 2024-11-24) is the commit that actually killed the pattern, **eight days after it was introduced** — and its message states the reason directly: *type inference*. The dynamic `__getattr__`/`__setattr__` on `mixed_db`-decorated classes made every attribute access on `Player`/`Network` untypeable by static tools, so it was replaced with hand-written `@property`/`@x.setter` pairs per field (`git show 8a0b7ad8 -- website/database/player.py`, e.g. `current_data`, `capacities`, `cumul_emissions` each becoming an explicit property that reads `current_app.config["engine"].data[...]`). This is the direct causal chain the task description points at (dynamic attribute magic breaking static type inference), confirmed in the commit's own diff, not just its message.
- `1e403a6f` ("remove mixed_db from OngoingConstruction class") shows the decorator wasn't confined to `Player`/`Network` — it had also been applied to what's now `OngoingProject` before being pulled out.
- `852211fe` ("refactor: removed all remaining databases (did not adapt all the rest of the code)", 2024-12-28) is the full revert: it deletes the SQLAlchemy `db.Model` classes across `energetica/database/{active_facility,climate_event_recovery,engine_data,map,messages,network,ongoing_construction,player,resource_on_sale,shipment}.py` and rewrites them as plain in-memory classes, plus touches `energetica/__init__.py`, `api/http.py`, `api/websocket.py`, `auth.py`, `production_update.py`, `simulate.py`, static JS templates, and test files — i.e. the revert touched roughly the entire application, not just the database layer, which is itself evidence of how deeply the ORM had been threaded through by the time it was pulled out five weeks after being introduced.
- `1f8be53b` ("refactor: rename DB class to DBModel and update filter_by typo", 2024-12-29), the commit right after the revert, renamed the surviving in-memory base class from `DB` to `DBModel` — the name in use today (`energetica/database/__init__.py:46`).
- `734530ff` ("deps: remove unused SQLAlchemy dependency from requirements") is the final cleanup dropping the now-unused SQLAlchemy dependency, confirming the revert was total (no partial SQLAlchemy usage was kept anywhere).
- No trace of this era survives in current comments, docs, or ADRs: `grep -rn "SQLAlchemy\|sqlalchemy\|mixed_db\|db.Model" energetica/ docs/` returns nothing. The only record is git history. An honest ADR "Context" section should say this explicitly, so the lesson doesn't get re-learned from scratch: **a prior hybrid attempt existed, worked well enough to accumulate real feature commits over ~5-6 weeks, and was reverted specifically because dynamic attribute-routing (`__getattr__`/`__setattr__`) is incompatible with static type checking** — which matters directly for this project given `energetica/`'s current mypy/type-checking discipline and the `frontend`'s full-stack type-safety pipeline (`bun run generate-types`, per root `CLAUDE.md`). Any future hybrid or partial-ORM design that reintroduces dynamic attribute magic to paper over "some fields are relational, some aren't" should be treated as a known-bad shape, not a novel idea to re-evaluate from first principles.
