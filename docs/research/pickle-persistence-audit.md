# The current persistence system, audited on its own terms

Resolves [#961](https://github.com/felixvonsamson/Energetica/issues/961), part of the
game-instance persistence map ([#924](https://github.com/felixvonsamson/Energetica/issues/924)).

Every artifact this map produced before this one looked at the current system through the
lens of migrating away from it. `docs/research/dbmodel-postgres-survey.md`
([#932](https://github.com/felixvonsamson/Energetica/issues/932)) surveyed it as an
obstacle. ADR-0005 describes it only as context for its replacement. This document asks a
different question: what *is* this system, what does it do well, where does it actually
fall short, and what can it not be made to do?

It takes no position on whether to migrate. That is
[#957](https://github.com/felixvonsamson/Energetica/issues/957)'s job, and
[#957](https://github.com/felixvonsamson/Energetica/issues/957) depends on this document
being accurate rather than useful to either side.

Line numbers are from `main` at the time of writing.

---

## 1. What the system is

Five mechanisms, not one. They are usually discussed as "the pickle", which obscures that
the durability story rests mostly on the fifth.

### 1.1 The in-memory entity graph

Eleven `DBModel` subclasses (`energetica/database/`), about 90 declared fields between
them, all plain dataclasses:

| Class | File | Fields |
|---|---|---|
| `Player` | `player.py:81` | 30 |
| `OngoingProject` | `ongoing_project.py:19` | 10 |
| `OngoingShipment` | `ongoing_shipment.py:17` | 8 |
| `ActiveFacility` | `active_facility.py:21` | 7 (+1 `ClassVar` index) |
| `Notification` | `messages.py:142` | 7 |
| `HexTile` | `hex_tile.py:16` | 5 |
| `User` | `user.py:19` | 5 |
| `ClimateEventRecovery` | `climate_event_recovery.py:15` | 5 |
| `Network` | `network.py:19` | 5 |
| `Chat` | `messages.py:85` | 4 |
| `ResourceOnSale` | `resource_on_sale.py:16` | 4 |

`DBModel` (`energetica/database/__init__.py:45-135`) provides a query surface over an
in-memory registry and nothing else: `get`, `getitem`, `all`, `count`, `count_when`,
`filter`, `filter_by`, `delete`. No transactions, no unit of work, no dirty tracking, no
persistence method of its own, no referential integrity, no cascade on delete, and no
indices beyond one hand-rolled `ClassVar` on `ActiveFacility`. `filter_by` is a linear
scan that materialises `cls.all()` on every call — every query is O(n) in that class's
instance count.

`AutoIDDict` (`__init__.py:27-42`) assigns ids from an `itertools.count(1)`.
`__init_subclass__` (`__init__.py:51-53`) registers one `AutoIDDict` per subclass into
`engine.db_model_instances`, keyed by `cls.__name__`, at import time. `__post_init__`
(`__init__.py:60-62`) puts every constructed instance into that registry immediately —
there is no detached or unsaved state, and no way to build a throwaway instance.

Cross-entity references are direct Python object references, not ids, and the graph is
densely cyclic: `Player.user ↔ User.player`, `Player.network ↔ Network.members`,
`ActiveFacility.player → Player`, `Chat.messages[i].chat → Chat`. Ids are used in only a
handful of places (`Player.last_opened_chat_id`, `Player.muted_chat_ids`,
`Chat.player_last_read_index`, `engine.general_chat_id`,
`ActiveFacility._player_type_index`).

### 1.2 The pickle

`GameEngine.save()` (`game_engine.py:229-251`) copies an explicit allow-list of 16 engine
attributes into a fresh dict and pickles it to `instance/engine_data.pck`. One of those
keys, `db_model_instances`, reaches the entire domain graph transitively. There is no root
domain object; the engine itself is never pickled. Cycles are handled by pickle's memo
table, which is a de facto reason the format is pickle.

Three properties of the write matter later:

- **It is not atomic.** `open(..., "wb")` truncates in place. No temp file, no
  `os.replace`, no `os.fsync`, no directory fsync. A crash between the truncate and the
  end of `pickle.dump` leaves a partial pickle *and the previous good copy is already
  gone*. Searching the whole repo for `fsync`, `flock`, `fcntl`, or `FileLock` returns
  nothing: there is no durability barrier and no file locking anywhere.
- **There is no schema version in the file.** No version stamp, no checksum, no
  compression.
- **There is no save on shutdown.** The lifespan's save is commented out
  (`energetica/__init__.py:330-333`, referencing #302).

Mutual exclusion is by convention at the call sites, not inside `save()`: `tick()` is
decorated `@engine.with_lock` (`tick_execution.py:79`, decorator at
`game_engine.py:284-291`), and mutating HTTP requests run under the same `RLock` in
middleware (`routers/__init__.py:139`). GETs and `/auth/` paths bypass it
(`routers/__init__.py:102-114`).

`GameEngine.load()` (`game_engine.py:253-276`) checks mtimes (§1.4), unpickles, `setattr`s
the 16 members back, then rebuilds derived state (§1.5). It has **no `try`/`except`**, and
its only caller is unguarded (`energetica/__init__.py:159-160`) — so a torn pickle, a
removed class, or the mtime check all propagate out of `create_app` and kill startup.
Recovery is manual: re-run with `--load_checkpoint`.

### 1.3 The history file tree

`save_past_data()` (`energetica/utils/misc.py:145-219`) writes long-run chart history to
`instance/data/**` — one file per player, one per network, one server-wide climate file —
plus `production_update.py:99` writing one `market_t{t}.pck` snapshot per network per
tick.

The live tail of that history is in the pickle, as `deque(maxlen=360)` rolling buffers
(`CircularBufferPlayer`, `CircularBufferNetwork`, `EmissionData`). Reads splice the two:
`charts.py:251-263` reads the file for history and layers
`rolling_history.get_data(t=current_tick % 216)` on top.

Two irreversible discards live here. `reduce_resolution` (`misc.py:75-86`) keeps five
resolution levels of 360 samples each, averaging 6× per level, and — the harder loss —
each level is a fixed 360-slot window that is *shifted*, not grown. Raw per-tick history
older than 360 ticks exists nowhere on disk after the next `save_past_data()`, and it is
not in the pickle either. Separately, `misc.py:189-194` deletes every `market_t{t}.pck`
older than 1440 ticks.

`reduce_resolution` is also **read-modify-write and non-idempotent**: it drops the oldest
samples off the front and appends the new batch, so applying the same 216-tick batch twice
permanently misaligns the series against tick indices. That fact is the entire reason §1.4
exists.

### 1.4 The consistency check between them

`load()` compares `instance/engine_data.pck`'s mtime against the newest file under
`instance/data/**`, excluding the per-tick chart files, and refuses to start if the tree
is newer (`game_engine.py:255-262`):

```python
if instance_data_last_modified > engine_data_last_modified:
    raise RuntimeError("The data has not been saved correctly, please restart form the last checkpoint.")
```

The desynchronisation it catches is specific. `save_past_data()` writes the tree, then
calls `engine.save()` (`misc.py:219`). A kill in that window leaves the tree at tick T
while the pickle says T−k. Startup would load T−k, replay forward through T, and
`save_past_data()` would apply the same 216-tick batch a second time — silently corrupting
all five resolution levels of every series. The check converts that silent corruption into
a loud startup abort. The chart files are excluded because they are tick-addressed and
therefore idempotent on replay, and because they are newer than the pickle almost always.

`tick_execution.py:90-95` adds `Path("instance/engine_data.pck").touch()` after
`save_past_data()`, because the comparison is a strict `>` and on coarse-mtime filesystems
the pickle could share a timestamp with the last data file written.

What the check does not catch is a longer list than what it does: a torn or truncated
pickle (the mtime is newest, so it passes and `pickle.load` raises instead), equal mtimes,
everything under `instance/` but outside `instance/data/` — including
`actions_history.log` and the accounts database that `User.account_id` points into — any
content-level disagreement (no tick number is recorded in any data file, so a pickle whose
`total_t` doesn't match the sample count passes cleanly), and anything that perturbs
mtimes such as a `cp -p` restore or a backwards clock step.

### 1.5 The action log and replay

This is the part usually left out of the summary, and it is the part that carries the
durability story.

`log_action` (`game_engine.py:225-227`) appends one line of Pydantic JSON to
`instance/actions_history.log` for each of four record types
(`energetica/schemas/simulate.py:11-65`): `init_engine` once at genesis, then
`create_user`, `tick`, and `request` — the last capturing endpoint, method, payload, and
response for every mutating HTTP call (`routers/__init__.py:172-193`).

Replay is implemented and wired into the normal startup path. `action_log.py` finds the
`tick` line matching the loaded state's `total_t` and streams everything after it;
`energetica/__init__.py:218-263` schedules `simulate` as a one-shot job and only starts the
recurring tick clock once it succeeds, keeping `engine.serve_local = True` until then so
the middleware 503s non-local mutating traffic (`routers/__init__.py:91-100`). If the
boundary tick is missing it refuses rather than guessing:

```
"the action log and the loaded state are out of sync — refusing to replay."
```

Reconstruction from genesis is a real code path, not a theoretical one
(`action_log.py:47-55`, `energetica/__init__.py:163-170`), with `random_seed` and
`start_date` preserved from line 0.

The log is append-only by mode and by policy — ADR-0001 makes its completeness an accepted
invariant, and the recovery runbook states the rule in bold. It is flushed but **not
fsync'd**, so a kernel-level crash can lose the tail; a plain process kill cannot.

### 1.6 Cadence

At the default `clock_time = 30` s:

| Event | Interval | Worst-case window |
|---|---|---|
| `engine.save()` | 20 ticks | ~9 min 30 s of engine state |
| `save_checkpoint()` | 720 ticks | ~5 h 59 min |
| `save_past_data()` | 216 ticks | 108 min of chart history |

`save_checkpoint()` (`game_engine.py:278-282`) calls `save()`, gzip-tars the whole
`instance/` tree, and `os.replace`s it into place — the one atomic publish in the
persistence layer. In production the accounts database is outside `instance/`
(`accounts/db.py:19-21`), so it is **not** in the checkpoint.

Those windows are pickle windows, not data-loss windows. The action log is appended
continuously and replay is expected to re-derive what the pickle lost. §3 and §4 examine
how well that holds.

---

## 2. What it does well

### 2.1 It has never lost a player's play

This is the finding that most changes the shape of the argument, so it goes first.

Searching the whole tracker — roughly 960 issues, at least three production servers
(`energetica-game`, `energetica-edu`, `energetica-ethz`) — for a player losing progress,
money, facilities, or research to a persistence failure returns **zero results**. No
commit in the entire history describes an `engine_data.pck` that could not be recovered.
`git log --grep` for `desync` and `data loss` returns nothing.

That is not luck, and it is not because nothing has gone wrong. Four production crash loops
are documented (§3). The reason none of them cost play is that **the durable artifact is
the action log, not the pickle.** The pickle is a cache of replay's starting point. The
runbook says so directly (`docs/backend/incident-recovery.md:15`), ADR-0001 makes log
completeness an accepted invariant, and the code refuses to guess when the two disagree
(`energetica/utils/action_log.py:66-70`: *"the action log and the loaded state are out of
sync — refusing to replay"*).

So the honest characterisation of this system's failure mode is: **it fails availability,
not durability.** A corrupt save costs downtime and operator time. It has not cost data.

One caveat, stated because it weakens the claim: replay cannot *detect* divergence.
`verify()` is `assert True` (`energetica/simulate.py:36-37`) and only HTTP status codes are
compared (`simulate.py:117-123`). "Replay has worked every time" is therefore accurate as
*replay never reported a failure*, which is a weaker statement than it sounds. See §3.7.

### 2.2 Replay is real, wired in, and better than the system it serves

It is easy to read "action log plus replay" as aspirational architecture. It is not.

Replay runs on **every normal startup**. `energetica/__init__.py:218-263` schedules
`simulate` as a one-shot job and starts the recurring tick clock only once it succeeds,
holding `engine.serve_local = True` until then so the middleware 503s non-local mutating
traffic (`routers/__init__.py:91-100`). Reconstruction from genesis is a real code path
(`action_log.py:47-55`, `energetica/__init__.py:163-170`) with `random_seed` and
`start_date` preserved from line 0. Determinism is deliberately engineered:
`np.random.default_rng(engine.random_seed)` for `delta_t` (`game_engine.py:140-141`),
seeded emission data (`emission_data.py:17-24`), `stable_hash` for climate
(`utils/climate_helpers.py:83-84`).

This is a genuinely good design and it is worth being explicit that **it is independent of
pickle.** Event sourcing plus a periodic snapshot is a well-regarded pattern; the argument
about storage engines is an argument about the snapshot layer, which is exactly what #927
already concluded. Whatever happens to the pickle, this should survive.

### 2.3 It buys the domain code an enormous amount of simplicity

Not "convenience" — the current code shape is only viable because reads are free.

The tick loop does, per player per tick, at least six to eight **unindexed full scans** of
an entity class, because `DBModel.filter_by` is `filter(condition, cls.all())`
(`database/__init__.py:129-131`):

| Site | Scans |
|---|---|
| `production_update.py:312`, `:871` | all `OngoingProject` |
| `production_update.py:345`, `:938` | all `OngoingShipment` |
| `production_update.py:365` | all `ClimateEventRecovery` |
| `player.py:422` | all `OngoingProject` |
| `player.py:442` | all `OngoingShipment` |
| `player.py:309` | all `OngoingProject` |

For ~50 players with ~10 projects each that is on the order of 10⁴–10⁵ pointer
dereferences per tick, every 30 seconds. Nobody had to design an index, reason about N+1
queries, or tune a query planner, and the code is legible as a result. Authentication is
likewise a full scan of every `User` on every request and every socket connect
(`utils/auth.py:94`, `socketio.py:38`) — and it is free.

The same holds for the API layer: there is no repository, no query layer, no session.
`get_settled_player` (`utils/auth.py:111-124`) hands a live `Player` to the handler, which
traverses `player.network.members[...]`, `player.tile.fuel_reserves`,
`facility.player.capacities` at arbitrary depth with no declared fetch set.

`filter_by` also queries **derived properties that exist as data nowhere**, whitelisted by
design in `DBModel.WhitelistedConditions` (`database/__init__.py:93-116`):
`remaining_lifespan` is `end_of_life - engine.total_t` (`active_facility.py:159`),
`decommissioning` is `end_of_life == 0` (`:78`), `OngoingProject.worker_type` derives from
`project_type` (`ongoing_project.py:52`), `Player.username` reaches through to
`self.user.username` (`player.py:88`). Some depend on mutable global engine state. No
relational store can query these without reifying or recomputing them.

### 2.4 Test setup is close to free, and the number is knowable

There is **no fixture**. `tests/conftest.py` has one autouse fixture (`:19-26`) and it only
redirects the separate SQLite accounts store to `tmp_path`. It never touches `engine` or
`DBModel`. Tests call `create_app(rm_instance=True, ...)` in the body — 37 call sites
across 19 files, covering roughly 75-80 of the suite's 212 test functions.

What that call costs: `shutil.rmtree("instance")`, three `mkdir`s, `clear_db()`, a parse of
`static/data/map.csv` constructing 331 `HexTile` objects, and one small climate pickle
(`energetica/__init__.py:102-105`, `game_engine.py:99-201`). No server, no container, no
port, no connection string, no migrations, no factories, no transaction, no rollback. There
is no database driver in `pyproject.toml` at all.

Teardown is deleting a directory. `AutoIDDict.reset()` restarts ids at 1, which is why
`HexTile.getitem(1)` is a stable hardcoded handle in six test files. Tests mutate private
state freely — `player.rolling_history._data["storage"][...][-1] = capacity * 1.5`
(`test_storage_decommissioning.py:67`), `del project._prerequisites_and_level`
(`test_projects.py:96`) — and assert on identity: `assert user.player is player`
(`test_instance_membership.py:133`).

And `tick()` is directly callable in a unit test
(`test_storage_decommissioning.py:46`): a full simulation step, exercised with zero
infrastructure.

This is a real asset and it is the one that a migration most reliably destroys. It comes
with a matching liability, stated in §3.6: the suite is cheap partly because it does not
test the hard part.

### 2.5 The whole state is one file an operator can open

Three tools depend on this, and all three are recovery or analysis tools:

- `scripts/migrate-to-server-accounts.py:66-72` — loads the pickle, back-fills
  `User.account_id`, re-saves.
- `scripts/backfill-instance-membership.py:84-88` — loads the pickle to reconstruct
  membership rows. This is the documented recovery path for a failure
  `tests/unit/test_instance_membership.py:110-133` deliberately tolerates.
- `scripts/export_instance_to_csv.py:238-248` — loads the pickle into pandas, indexing
  `eng["db_model_instances"]["Player"]` by hand.

`scp` the file off the box, open it in a REPL, see everything. That capability is not
nothing, and no equivalent exists for a live database without extra tooling.

### 2.6 A write-transaction boundary already exists

The system is more disciplined than "no transactions" implies. Every non-GET,
non-`/auth/*` request is wrapped in `with engine.lock:` (`routers/__init__.py:139`) — the
same `RLock` that `tick()` holds for its whole duration (`tick_execution.py:79`).
`routers/auth.py:74` takes it manually because that mutating path is a GET and bypasses
the middleware, with a comment naming the race. `docs/backend/game-loop.md` documents the
scheme.

So writes are globally serialised at request granularity, against the tick, in one place.
What is missing is **rollback**, not a boundary: a `GameError` raised halfway through
leaves the partial mutations standing.

### 2.7 A caveat on "consistent by construction"

That phrase appears in the framing around this effort and it needs qualifying, because the
guarantee is airtight for writes and leaky for reads.

GET handlers bypass the lock (`routers/__init__.py:102-114`). On 2026-05-07 this produced
`RuntimeError: dictionary changed size during iteration` **twice in production on
energetica-edu, at 12:41 and 15:17** (commit `610a60e1`), because GET handlers iterate
`cls.instances().values()` lazily while the tick thread mutates it. The runbook lists it
under "Common causes" (`incident-recovery.md:79-85`).

Hand-maintained aggregates can also drift. `player.resources_on_sale[fuel]` is supposed to
equal the sum of that player's open `ResourceOnSale` quantities and is read back at
`production_update.py:723`, `:984`, `:1003` — but `patch_ask`
(`utils/resource_market.py:108-116`) mutates `sale.quantity` without adjusting it. **That
invariant is broken in `main` today.** It is good evidence the invariant is real and
unenforced.

---

## 3. Where it falls short

Ordered by demonstrated harm, not by how bad they sound.

### 3.1 The save is not atomic, and mid-save kills produce corrupt saves

`GameEngine.save()` truncates `instance/engine_data.pck` in place
(`game_engine.py:246-251`). No temp file, no `os.replace`, no `os.fsync`. The whole repo
contains no `fsync`, `flock`, `fcntl`, or `FileLock`. A kill between the truncate and the
end of `pickle.dump` leaves a partial pickle **and the previous good copy is already
gone.** The same pattern applies to every history file, each of which is fully rewritten on
each `save_past_data()` (`misc.py:148-216`), so a torn write there destroys one entity's
entire history rather than the latest batch.

Evidence and frequency. Issue #766 (2026-05-07): *"On a 1.8GB server with no swap, this has
caused two OOM kills today (t=26249 and t=27000), both leading to corrupt saves and crash
loops."* Two in one day. Issue #467 (2025-09-12) is a production crash loop terminating in
the same `RuntimeError`, open five months, **root cause never established** — closed as
stale after the question "was this OOM or a separate crash?" went unanswered.

The one atomic write in the persistence layer is the checkpoint publish
(`game_engine.py:282`, temp name plus `os.replace`). The live path does not use the
technique its own neighbour demonstrates.

### 3.2 A save can fail silently, and did, for about two weeks

Issue #476 (2025-09-24 → 2025-10-10) is the worst incident in the record. An unhandled
exception in old-notification deletion inside `save_past_data()`. The reporter's own words:

> This is critical because the engine data is not saved !!! This was detected only now
> because notifications start to be deleted only after 2 weeks or so. Error has been
> patched on the ent server, but not in dev.

Roughly two weeks of production saves silently failing, discovered by accident, hot-patched
on the box out of band. Issue #463 (2025-09-10) is the same shape: a production traceback
firing immediately after the `"last 216 data points have been saved to files"` log line
(`misc.py:218`) — i.e. after the history files were written and **before** `engine.save()`
on the next line — swallowed by the ASGI middleware so the server kept ticking with a
failed save.

The defect is not the exception. It is that **nothing detects a failed save.** `save()`,
`load()`, and `save_checkpoint()` log nothing at all, and there is no timing or success
instrumentation anywhere in the persistence layer. `/healthz` does expose `pickle_mtime`
(`routers/health.py:84-90`), which is a freshness signal, but nothing alerts on it.

An open question I could not resolve: the mtime check should have fired on the next restart
during #476, since the history tree would have been left ahead of the pickle. Either no
restart occurred in those two weeks, or the exception fired before any file was written.
The record does not say.

### 3.3 Any persistence failure becomes a crash loop needing a human

`load()` has no `try`/`except` and its caller is unguarded
(`game_engine.py:253-276`, `energetica/__init__.py:159-160`). A torn pickle, a renamed
class, or the mtime check all propagate out of `create_app`. The systemd unit is
`Restart=always` with `RestartSec=10` (`scripts/infra/energetica.service:20-34`), so the
failure re-raises every ten seconds until someone intervenes. That is the mechanism behind
#467 and #766, and it is why four documented incidents are all *crash loops*.

Recovery is manual and destructive-by-design: `--load_checkpoint` renames the live log
aside, `shutil.rmtree("instance")`, extracts the tarball, restores the log
(`energetica/__init__.py:143-151`).

### 3.4 The recovery runbook was wrong, in the direction that causes a second outage

`docs/backend/incident-recovery.md` has six commits in its life, and **four of them are
corrections to the runbook rather than to the system.** Two landed in the last 48 hours.
From #947 (closed 2026-08-03):

> So following the runbook produces exactly the `PermissionError` crash-loop the warning
> exists to prevent, at the worst possible moment.

It said `www-data` where the service runs as `energetica`, `ssh root@`, `/var/www/energetica`
where the real path is slug-suffixed, and `systemctl start energetica` where the unit is
`energetica-{slug}` — all stale since the multi-instance migration of June-July 2026. About
two months in which the runbook was unusable as written, and nobody noticed. That is
itself evidence that no recovery was performed in that window.

The doc still cites `game_engine.py:238` for the mtime check, which now lives at
`game_engine.py:255-262`. The description is right; the line number is stale.

### 3.5 Schema evolution is hand-rolled — but the accretion rate has plateaued

This is the pain point most often cited, and the evidence is more equivocal than the
citation suggests. Current live totals:

| Class | Site | Clauses |
|---|---|---|
| `Player` | `player.py:190-221` | 9 `hasattr` back-fills, 2 field removals, 1 `setdefault` |
| `Network` | `network.py:36-43` | 1 |
| `User` | `user.py:32-47` | 1, and it is a **hard fail**, not a back-fill |
| `GameEngine.load()` | `game_engine.py:269-276` | 1 ad-hoc post-load migration |

`Player.__setstate__` was born 2025-12-30 (`bef39a40`). Over the 7.2 months since, that is
about 1.8 clauses per month averaged — but the distribution is what matters:

- **A burst**: 2026-03-16 → 2026-05-03, seven weeks, eight clauses. It coincides exactly
  with the notifications rework and the tutorial/quiz features. That is feature velocity on
  `Player`, not a property of pickle.
- **Then nothing**: zero new `Player` shims in the three months since 2026-05-03.
- **Only 2 of ~13 shims were reactive** to a real failure, and both of those failures were
  *in the shim mechanism itself*, not in pickle: `b59861d5` (2026-05-02) fixed a guard that
  was writing `{None}` because `engine.general_chat_id` is not yet restored when
  `Player.__setstate__` runs; `782bf82e` (2026-06-26) fixed a guard that blocked its own
  migration script.

So "the shims accumulate forever" is true in principle and currently costs 2-3 lines per
field addition, which is cheap. Two things about it are genuinely expensive:

**Migration logic is split across two mechanisms with different capabilities.**
`__setstate__` runs mid-graph-deserialisation, so no shim may depend on any other part of
the loaded state — not sibling objects, not engine scalars. `muted_chat_ids` is where that
bit: its dataclass default reads `engine.general_chat_id` (`player.py:98`), which is still
`None` during `pickle.load()`, because `db_model_instances` and `general_chat_id` are
sibling keys in the same dict with no ordering guarantee. The fix was to move that one
migration into `load()` itself (`game_engine.py:273-275`). Every other shim is safe only
because it happens to depend on nothing.

**The one real migration this system has ever needed broke on first contact with
production data.** `782bf82e`: *"The Phase-2 accounts migration could never run against a
real pickle — both bugs surfaced while preparing the energetica-game production cutover."*
Two independent defects: `User.__setstate__`'s own hard-fail blocked the script meant to
read the un-migrated pickle, and the script used attribute access on what `save()` pickles
as a plain dict. Fixed and verified against a copy of the live pickle: 117 users migrate.

### 3.6 The persistence layer has no tests at all

No test calls `engine.save()`, `engine.load()`, `save_checkpoint()`, `load_checkpoint`, or
`simulate_file`. Grep across `tests/` returns nothing. The only pickle tests are two narrow
object-level round-trips: `User.account_id` survival plus its legacy-state raise
(`tests/unit/test_user_account_id.py:22-50`) and a `ProjectStatus` enum
(`test_project_type.py:69-76`). `tests/policy_runner.py` — the ticks-forward harness — is
entirely commented out.

So the mtime check, the `touch()`, checkpoint round-tripping, whole-graph save/load, and
**the replay path the runbook designates as the recovery procedure** have no automated
coverage. `action_log.py`'s readers do have unit coverage
(`tests/unit/test_action_log.py`, 6 tests), which is the exception.

This cuts in two directions and both are worth stating. The current model's persistence is
not proven by tests. And the suite's cheapness (§2.4) is partly the cheapness of not
testing the hard part.

### 3.7 Replay cannot tell you whether it worked

`verify()` is `assert True` (`simulate.py:36-37`). Replayed requests compare **status codes
only** (`simulate.py:117-123`); response payloads are logged and never asserted against. A
replay that silently produces different money, facilities, or research reports success.

The log is also not quite the complete source of truth `CONTEXT.md:31-35` describes:

- GETs and any path containing `/auth/` return early **before** the `log_action` call
  (`routers/__init__.py:106-114` vs `:193`). `/auth/me` performs a find-or-create mutation
  under the engine lock (`routers/auth.py:69-74`) — **a state mutation that is not in the
  log.**
- Requests with no resolvable user are also unlogged (`routers/__init__.py:168-170`).
- `game_engine.py:316` calls the *global* `random.shuffle(self.question_order)`, unseeded,
  so daily-question order after a genesis replay differs from the original run.
- The log is flushed but **not fsync'd**, so a kernel-level crash can lose the tail. A
  plain process kill cannot.
- If replay fails, the action logger stays muted at CRITICAL for the life of the process
  (`energetica/__init__.py:230` sets it, `:260` restores it only on success).

Replay is also **not idempotent**, which is why there is no save on shutdown. Issue #302
(2025-07-30 → 2025-08-14): Ctrl-C after a `create_user` but before a tick leaves `total_t`
unchanged, so the already-applied `create_user` replays and throws `409 username is taken`.
mglst at the time: *"using just `total_t` from the instance is not sufficient to determine
which actions have been run."* The resolution was a revert (`52f5ab81`), and
`engine.save()` remains commented out in the lifespan teardown to this day
(`energetica/__init__.py:329-332`).

The consequence is that **every restart, including every deploy, discards up to ten
minutes of engine state and reconstructs it by replay.** Merge cadence to `main` runs 13-52
per month, deploys are manual `rsync` plus `systemctl restart`
(`scripts/deploy-instance.sh:139`) with no CD (#889 is open), so the ten-minute window is
exercised on the order of tens of times per year per instance. Every time, replay covers
it. The cost is startup replay time — *"Replay can take minutes. Don't interrupt it"*
(`incident-recovery.md:75`) — not lost play. The one time replay itself became the problem
was #766, where reading the log OOM-killed the box: a 270 MB / 365K-line log inflating to
~1.3 GB RSS that pymalloc never returned, on a 1.8 GB box, in a crash loop. Fixed by
streaming (`ba018f92`, ADR-0001).

### 3.8 High-resolution history is destroyed, on purpose, by two mechanisms

`reduce_resolution` (`misc.py:75-86`) keeps five levels of 360 samples, averaging 6× per
level. The averaging is the visible loss. The **windowing** is the larger one: every level
is a fixed 360-slot window that is shifted, not grown. Level 0 keeps only the last 360 raw
ticks, so raw per-tick history older than that exists nowhere on disk after the next
`save_past_data()` — and not in the pickle either, since the rolling buffers are
`deque(maxlen=360)`. Separately, `misc.py:189-194` deletes every `market_t{t}.pck` older
than 1440 ticks.

This is #627's entire ask, and it is worth being precise about what kind of shortfall it
is. See §4.1.

### 3.9 The mtime check works, but it is a hand-rolled stand-in

Introduced 2025-01-17 by `aa483f8b` ("Done with new saving procedure"), including the typo
`"restart form the last checkpoint"` that has survived 19 months and been faithfully copied
into the runbook.

Its firing record: **two spurious, two genuine.** Spurious — #398 (2025-08-23), reproducible
by a *clean* Ctrl-C in dev, because entity construction wrote `time_series.pck` newer than
the pickle; fixed at root by moving initialisation into `save_past_data()` (`b188121b`,
`57003887`). And `9f4c00fc` (2025-10-14, Yassir), which had to exclude
`instance/data/networks/*/charts/*` because per-tick chart writes made the check
structurally guaranteed to fire on any restart. Genuine — #467 (probably) and #766
(certainly).

Both spurious firings were fixed by relocating writes, not by weakening the check, which is
a point in its favour. But note what it does: it converts a corrupt-state start into a loud
crash loop. It has never *prevented* silent corruption that some other mechanism would not
have surfaced, and the action log is what actually saves the data.

What it does not catch is a longer list than what it does (§1.4). Most notably, a torn
pickle passes it — the pickle is newest, so `pickle.load` raises instead — and nothing under
`instance/` outside `instance/data/` participates at all, including the action log and the
accounts database that `User.account_id` points into.

**The `touch()` guards something never observed.** `tick_execution.py:95` was added
2026-05-07 at 22:06 (`8237be51`), ninety minutes after the incident commit, with this
rationale:

> `save_past_data()` writes to `instance/data/**/*` but `engine_data.pck` is only updated
> later in the same tick by `engine.save()`.

That is factually wrong — `save_past_data()`'s last statement *is* `engine.save()`
(`misc.py:219`, and it was line 209 at that commit). Thirteen days later `ec3a4a6e`
silently replaced the reasoning with the correct one, now at `tick_execution.py:92-94`: it
guards an mtime *tie* on coarse-granularity filesystems, since the comparison is a strict
`>`. There is no issue, traceback, or log excerpt anywhere showing a tie ever occurred. It
was written during an incident, for a reason its author misdescribed, and its real
justification was retrofitted two weeks later.

### 3.10 Performance characteristics are unmeasured and quietly quadratic

There is **no measurement of how long a save, a load, or a six-hourly gzip-tar of the whole
`instance/` tree takes.** `TickAction.elapsed` (`tick_execution.py:106`) is logged at line
108, *before* `engine.save()` and `save_checkpoint()` at lines 111-115, so the two most
expensive persistence operations are outside the only timing window that exists.

Two quadratics worth naming. `engine.load()` calls `player.capacities.update(player, None)`
for every player (`game_engine.py:276`), and for networked players that cascades into
`update_network`, which resets and re-sums over all members
(`engine_data/capacity_data.py:120-132`) — giving O(members² × types) per network across
the load loop. And `Chat` has no back-reference on `Player`, so finding a player's chats is
`Chat.filter(lambda chat: self in chat.participants)` (`player.py:343`), a scan of all chats
× participants per call.

Neither is a problem at ~117 users. Both are unmeasured.

---

## 4. What it cannot be made to do

This is the section that matters most, so it needs the sharpest discipline: several
shortfalls that get cited as inherent limits are not inherent at all. Sorting them is the
point.

### 4.1 Not inherent, despite appearances

**High-resolution history retention.** The loss in §3.8 comes from `reduce_resolution`'s
shifting windows and the 1440-tick chart sweep. Both are policy in about twenty lines of
`misc.py`. Writing raw series somewhere durable does not require touching entity storage.
#627 does not need an entity migration to be satisfied, and the map's own Notes already
record that #627's thread concluded TimescaleDB *for time series specifically*.

**Schema versioning.** Nothing prevents stamping a version into the pickle and writing
real migration functions. Note the team has never actually decided whether pickle
back-compatibility should exist. PR #640 (2026-04-05) was four `hotfix:` commits fixing a
real production `storage_soc` `KeyError` — and was **closed unmerged** five days later after
this exchange:

> **felixvonsamson:** But do we even want to allow old instance compatibility? I feel like
> an instance should work only for one game version.
> **mglst:** Yeah unclear? I don't really mind.
> **felixvonsamson:** …what I would have done is add an error message when the instance
> version (that is saved in the instance) is different than the running one. Then we don't
> need to worry about any version compatibility.

That guard exists — but only on the cold-start path (`energetica/__init__.py:165-167`), not
when a pickle is present. **Deciding this question is cheap and has never been done.**

**Atomic writes and a shorter durability window.** Temp file plus `os.replace` plus
`fsync` is a handful of lines, and the checkpoint path already demonstrates it. The save
interval is one modulus.

**A transaction boundary.** It already exists (§2.6). Rollback is what is missing.

**Indexing.** `ActiveFacility._player_type_index` is exactly `WHERE player_id = ? AND
facility_type = ?`, hand-maintained, not pickled, and rebuilt from scratch on every load
(`active_facility.py:71-75`). It carries no authority. More of the same is possible; it is
also the clearest example of building a database by hand.

**Detection and instrumentation.** Logging save success, duration, and size is trivial and
absent.

Everything in this list belongs to #962, and the fact that the list is this long is the
most important input this audit gives that ticket.

### 4.2 Genuinely inherent to "one pickled blob, whole graph, always resident"

**A single writer, in a single process.** The concurrency model *is* the global `RLock`
(`game_engine.py:49`). No second process can hold it, no read replica can exist, no
horizontal scaling is possible. This has already constrained unrelated design decisions:
`player.py:487-495` reasons explicitly that a per-instance `Lock` on `push_subscriptions`
"is not an option" **because `push_subscriptions` is part of the pickled `Player` state** —
locks are not picklable. The persistence mechanism is dictating the concurrency design.

**Instance size is capped by RAM, permanently.** The whole graph must be resident, and the
whole action log must be streamable. #766 shows a 1.8 GB box already hitting the wall on
the *log* at 270 MB. Whether that cap binds at target scale is #957's question; that it is
a hard cap is not arguable.

**No partial anything.** You cannot load one player, inspect state without deserialising
everything, repair one corrupted entity, or restore one player's history. All operations
are whole-graph. This is also why a torn write is catastrophic rather than local.

**No query without a full load.** Analytical queries over history are the standard example
and they are real, but the precise limit is broader: any question about the data — from a
cross-instance leaderboard to "how many players reached level 3" — requires deserialising
an entire instance in a Python process. Each instance is a separate file in a separate
directory, so cross-instance and cross-server analysis has no mechanism at all.

**No point-in-time query.** You can *restore* to a point (checkpoint plus replay); you
cannot *ask* what a value was at tick T without performing that restore. Given §3.8's
windowing, for raw per-tick detail older than 360 ticks you cannot answer it at all.

**Every field addition is a permanent decision.** Because there is no version stamp and no
recorded floor for the oldest pickle in the wild, no shim can ever safely be deleted. This
one is *semi*-inherent: version stamping (§4.1) converts it from permanent to bounded.

---

## 5. Where it is load-bearing

Ranked by how hidden the dependency is, because the obvious ones are already in #932's
survey and the hidden ones are what a migration would actually trip over.

### 5.1 Generated field-wise `__eq__` plus id-only `__hash__` — used for authorization

**This is the single most load-bearing and least visible thing in the codebase, and it
contradicts a decision this map already made.**

First, a correction. `energetica/database/player.py:80` is not `eq=False` — it is a
*comment*: `# TODO (Felix): add @dataclass(eq=False) on all classes`. Every `DBModel`
subclass is a bare `@dataclass`, so `eq=True` and **Python generates field-by-field
`__eq__` on all of them.** `Player` then overrides `__hash__` to `hash(self.id)`
(`player.py:223-225`).

That combination violates the hash/equality contract: two objects can hash equal and
compare unequal. It is invisible today only because there is never more than one Python
object per entity.

Every ownership check in the API is an object comparison: `routers/facilities.py:37,65`,
`routers/projects.py:57,74,91,108,125`, `routers/resource_market.py:86,103`,
`routers/notifications.py:63,80`, `utils/projects.py:87,115,154`, `player.py:348`. Set
membership too: `self in chat.participants` (`player.py:329,343`),
`chat.participants == participants` as the "does this chat exist" test (`utils/chat.py:19`),
`player not in chat.participants` as the authorization check for posting
(`utils/chat.py:52`). The sharpest case is `utils/resource_market.py:49` —
`if buyer == sale.player:` chooses between "buying your own resource, no money moves" and
"buying from another player, money plus resources plus a shipment." A semantic branch on
dataclass equality.

Both directions out of here are hazardous. Execute the TODO and these all become identity
comparisons — correct today, instantly wrong under any model that materialises entities per
request, where every request would 403. Leave it and they remain deep recursive field
comparisons across `Player ↔ User ↔ HexTile ↔ Network ↔ members`, terminating early today
only because the first differing field short-circuits.

**#931 closed this as "orthogonal, out of scope for this ADR."** On the evidence above that
was wrong, and #931 should be reopened or the finding carried explicitly into whatever
replaces ADR-0005. Recorded as a correction in §7.

### 5.2 Reading an entity after `delete()`

`DBModel.delete()` removes the id from the dict and nothing else
(`database/__init__.py:133-135`). **The Python object stays fully alive and readable, and
six call sites depend on that:**

- `tick_execution.py:144-151` — `dismantle_facility(facility)` (which may delete it), then
  reads `facility.facility_type`, `dismantle_cost`, `display_name` to log.
- `tick_execution.py:137-138` — `a_s.delete()`, then `player.emit(...)` on the `player`
  captured off the deleted shipment.
- `utils/facilities.py:85-91` and `:103-111` — delete, then read `facility.facility_type`,
  `total_cost` for the notification.
- `utils/projects.py:349-358` — `project.delete()`, then `project.project_type.worker_type`,
  then remove it from the priority list.
- `utils/resource_market.py:55-58` and `:101-105` — `sale.delete()`, then
  `return None if sale.quantity == 0 else sale`.

Any store with real delete-then-expire semantics breaks all six. Nothing in the code
signals the dependency; it reads as ordinary sequential code.

### 5.3 Caches keyed on list position, invalidated by hand

`OngoingProject._prerequisites_and_level` is a `@cached_property`
(`ongoing_project.py:153`) whose value depends on **the object's position in a mutable
list**, invalidated by `del self.__dict__[...]` (`:114-115`, `utils/projects.py:124-125`,
`utils/workers.py:29`). `Player` has five more page-data caches on the same contract
(`player.py:275-299`, invalidated at `:909-917`). Tests reach in directly:
`del project._prerequisites_and_level` (`test_projects.py:96`).

The contract is "this object is the one and only long-lived instance." Under a
per-request-materialised model, a cache that is never invalidated because the object was
thrown away and rebuilt does not error — it silently reads correctly, until the day it
doesn't. That is the worst available failure mode.

Related and already latently broken: `ongoing_project.py:177,190` use
`priority_list.index(self)`, which stops at the first **value-equal** element, not the
identical one. Two projects with the same type, player, duration, and status are value-equal
today. It works only because CPython's `PyObject_RichCompareBool` tries identity first.

### 5.4 Hand-maintained denormalised aggregates

Three, all read back as if authoritative:

- `player.resources_on_sale[fuel]` — already broken in `main` (§2.7).
- `CapacityData._data` (`engine_data/capacity_data.py:41-121`) — a per-facility-type
  aggregate cache, pickled as part of `Player` and `Network`, then recomputed on every load
  anyway (`game_engine.py:276`). Note that with `facility_type=None` it does **not** clear
  first, so entries for types the player no longer owns survive untouched.
- `Network.capacities` — one player's facility change eagerly rewrites a network-wide
  derived object (`capacity_data.py:120-132`).

The fact that `load()` recomputes two of these proves they are caches, not authority.

### 5.5 Entities in two collections at once

`Network.members` ↔ `Player.network` (`network_helpers.py:25-26,50-51,65-67`),
`Player.projects_by_priority` ↔ the `OngoingProject` registry (`utils/projects.py:70,100,
134,141-149,259,354`), `User.player` ↔ `Player.user`, `HexTile.player` ↔ `Player.tile`.

Known from #932's survey. Worth adding that **the test suite encodes these invariants
explicitly** — `tests/integration/test_projects.py:40-52`'s `validate_rule_1`: "all projects
in the database should appear exactly once in the priority list." Those rules exist because
the same entity lives in two hand-maintained collections.

### 5.6 Multi-step mutations with no rollback

Twelve sites where an invariant spans several statements. The two most expensive:

`purchase_resource` (`utils/resource_market.py:60-101`) — about ten mutations across three
entities, including **money conservation between two players** (`buyer.money -= total_price`
then `sale.player.money += total_price`), resource conservation, four progression-metric
writes, an `OngoingShipment` creation, and `sale.delete()`.

`complete_project` (`utils/projects.py:297-380`) — level increments, achievement checks,
`rolling_history.add_subcategory` (mutating the ring buffer's *schema*), `project.delete()`,
list removal, and `deploy_available_workers`. The "rule 1-7" invariants in
`test_projects.py:40-136` hold only at the end.

Two of these have **unrollbackable filesystem side effects inside the window**:
`network.delete()` does `shutil.rmtree` (`network.py:45-47`) and `Network.__post_init__`
does `mkdir` (`network.py:29-34`).

And one runs inside the tick while iterating: bankruptcy expulsion at
`production_update.py:140-157` calls `leave_network`, mutating `Network.members` mid-tick.

### 5.7 Construction requires a fully initialised global engine

`player.py:97-98` — `last_opened_chat_id` and `muted_chat_ids` default factories read
`engine.general_chat`. `ongoing_project.py:45` reads `technology_effects.current_multipliers`
in `__post_init__`. `network.py:29-34` does a `mkdir` and a `capacities.update_network`.
`active_facility.py:42` writes the ClassVar index. And `DBModel.__init_subclass__`
(`database/__init__.py:51-53`) registers a table on the global engine **at class-definition
time**, so importing a model module has a side effect on the singleton.

There is no detached or transient object state. You cannot construct any entity without a
live engine.

One consequence nobody has written down: `load()` replaces `engine.db_model_instances`
wholesale (`game_engine.py:265-266`), and `__init_subclass__` keys entries by
`cls.__name__`. Any `DBModel` subclass whose module is first imported *after* `load()` runs
would install a fresh empty registry and discard the loaded instances. All eleven subclasses
happen to be imported before `energetica/__init__.py:160` via `setup_routes`. **Nothing
asserts this**, and renaming a model class silently orphans its pickled data.

### 5.8 Websockets hold both ids and object references into the graph

`Player.socketio_clients: list[str]` (`player.py:183`) is **pickled player state holding
transient session ids**, appended at `socketio.py:47`. After a restart it contains stale
sids from the previous process, and `Player.emit` iterates them (`player.py:371-379`).
`socketio.py:25` keeps a parallel dict of live object references that is *not* pickled.

The pervasive shape is mutate-then-emit (`production_update.py:161`,
`tick_execution.py:117,138`, `map_helpers.py:24-44`): the code assumes the write is already
globally visible when the emit fires, and the client then refetches
(`game_engine.py:365`). With a commit boundary, the emit could precede the commit and the
refetch would read pre-write state — a race that does not exist today.

### 5.9 A background thread mutates pickled state without a lock

`player.py:481-497` — `_deliver_push` runs on a 16-worker pool (`player.py:69`) and calls
`self.push_subscriptions.remove(subscription)` on HTTP 410. The comment reasons explicitly
that this is safe only because each mutation is a single GIL-atomic list operation, and that
a per-instance `Lock` is unavailable because the field is pickled. Already cited in §4.2;
listed here because it is a live cross-thread dependency on the current model, not a
hypothetical.

### 5.10 Where the dependency is weaker than it looks

Stated because the point of this audit is accuracy, not advocacy:

- **`ActiveFacility._player_type_index` is not an asset.** Re-derivable, rebuilt on every
  load, duplicating one `WHERE` clause. A real index replaces it outright.
- **`CapacityData` and `Network.capacities` are caches, not guarantees** — `load()`
  recomputes them. The eager cascade on every mutation is a liability.
- **The write-transaction seam already exists** at the right granularity, in one place
  (§2.6).
- **Synchronous visibility is already leaky** — GETs bypass the lock, `dictionary changed
  size during iteration` fired twice in production, `utils/auth.py:55-81` documents an
  accepted non-atomicity at the freeze boundary.
- **The Jinja layer is gone.** `energetica/templates/` no longer exists; the only HTML left
  is `energetica/static/app/index.html`. One less consumer to worry about than the project
  docs imply.

---

## 6. Summary

**What the system is.** Five mechanisms, not one: an in-memory dataclass graph, a
whole-graph pickle every ten minutes, a downsampled history file tree, an mtime heuristic
guarding the two against each other, and an append-only action log with replay. The
durability story rests on the fifth. The pickle is a cache of replay's starting point.

**What it does well.** It has never demonstrably lost a player's play — zero such reports
across ~960 issues and three production servers. Replay is real, wired into every startup,
and independent of the storage choice. Reads being free is what makes an O(P × N) tick loop
viable at 30-second cadence and lets the domain code stay legible. Test setup costs one
function call, 331 object constructions, and a `rmtree` teardown, with no database driver in
the project at all. The whole state is one file an operator can `scp` and open, and three
real recovery and analysis tools depend on that.

**Where it falls short.** The save is not atomic and has produced corrupt saves (#766, two
in one day). A failed save is undetectable and went unnoticed in production for about two
weeks (#476). Every persistence failure becomes a `Restart=always` crash loop needing a
human (four documented). The recovery runbook was wrong for two months in exactly the way
that causes a second outage (#947). Replay cannot tell you whether it worked, and the log it
replays omits GETs and `/auth/*`, one of which mutates. The persistence layer has no tests.
Schema shims are real but cheap, concentrated in one seven-week feature burst, and have
plateaued for three months — while the one real migration the system has needed broke on
first contact with production data.

**The line.** Most of what gets cited as motivation for replacing this system is fixable
in place: atomic writes, fsync, a shorter interval, a version stamp with real migration
functions, raw time-series retention, rollback on the boundary that already exists,
detection and instrumentation, more indexes. That list is long, and handing it to #962 is
the most useful thing this audit does.

What is genuinely inherent to "one pickled blob, whole graph, always resident" is a shorter
list: a single writer in a single process (already dictating unrelated design decisions),
instance size permanently capped by RAM, no partial load or partial repair, no query without
deserialising an entire instance, and no point-in-time query. Whether those limits bind at
this project's scale is #957's question, not this document's.

**The uncomfortable finding.** The most consequential dependency in the codebase is one
nobody has written down: authorization across seven routers is implemented as dataclass
equality on entities, and it works only because there is exactly one Python object per
entity. #931 ruled that orthogonal and out of scope. It is neither.

---

## 7. Corrections to the record

Three things this audit found wrong in artifacts the map depends on.

**1. There is no `eq=False`.** `player.py:80` is a TODO comment, not applied code. All
`DBModel` subclasses have Python-generated field-wise `__eq__`, and `Player` has an
id-only `__hash__`. #931 closed this as orthogonal on the strength of the opposite reading.
See §5.1.

**2. The 2024 episode ran the other way.** The map's Notes describe "a prior
SQLAlchemy-backed entity migration [that] existed Nov-Dec 2024 … and was fully reverted."
The direction of travel was the opposite: **Flask-SQLAlchemy was the incumbent**, dating to
`96ad2b86` (2023-02-09) — `git show 34b293d7^:website/database/player.py` shows
`class Player(db.Model, UserMixin)` with `db.Column`/`db.relationship` throughout. What was
attempted and abandoned was a *hybrid*, the `mixed_db` decorator, and it lived **eight
days** (`34b293d7`, 2024-11-16 → `8a0b7ad8`, 2024-11-24). What won was pickle: `852211fe`
(2024-12-28, "removed all remaining databases (did not adapt all the rest of the code)")
removed SQLAlchemy entirely, and `1f8be53b` renamed the surviving base class to `DBModel`.

The entire recorded rationale for killing the hybrid is one commit subject: *"back to
property and setter for type inference, mixed_db decorator deleted."* No design doc, no
issue, no PR discussion. The code makes it self-evident — `mixed_db` installed dynamic
`__getattr__`/`__setattr__`, opaque to every static analyser, and the fix replaced them with
explicit `@property`/`@setter` pairs. There is no evidence `mixed_db` was ever deployed: no
release was cut in its eight-day window. The move *to* pickle then took about five more
weeks of "wip"/"tbc" commits to stabilise, and introduced the mtime check two weeks after
that.

This matters for #928 and for anything citing 2024 as a cautionary tale. The cautionary
tale is not "we tried a database and it failed." It is "we had a database, replaced it with
pickle over six weeks, and the only written reason concerns a type-inference problem in an
eight-day hybrid that predates FastAPI and generated types."

**3. `docs/backend/incident-recovery.md:5` cites a stale line number** —
`game_engine.py:238` for the mtime check, which now lives at `game_engine.py:255-262`. The
description is correct.

---

## 8. Method and confidence

Assembled from three parallel read-only investigations — the machinery, the empirical
failure record, and the load-bearing dependencies — then synthesised. Every claim is cited
to a file and line, a commit, or an issue.

**No code was executed.** Constructing a `GameEngine` creates `instance/`
(`game_engine.py:41`), so all mechanical claims are from static reading. In particular
there is **no measured pickle size, save duration, or graph node count**: the local tree has
no `engine_data.pck` at all and no `checkpoints/` directory. The one real size datapoint in
the record is #766's action log, 102 MB / 154K lines in May 2026 growing to 270 MB / 365K
lines by June, and `782bf82e`'s 117 users on the live `energetica-game` pickle.

Known gaps, stated so #957 does not treat them as settled:

- **Restart frequency is an estimate, not a measurement.** There is no deploy log, no
  `journalctl` excerpt, and no uptime record in the repo. The proxy used is merge cadence to
  `main` (13-52 per month through 2026), which bounds deploys from above, not below.
- **No incident log or postmortems exist anywhere.** The issue tracker is the only record,
  and #467 proves it is incomplete — a five-month-old production crash loop closed as stale
  with its root cause never established.
- **The #476 timeline has an unresolved tension** (§3.2): the mtime check should have fired
  on a restart during those two weeks.
- The import-order invariant in §5.7 is read from the transitive import graph, not verified
  at runtime.
- `functools.cached_property` values are pickled and not recomputed on load; §5.3 covers the
  two known families, but the full set of cached properties was not enumerated.
- `NetworkPrices.init_prices_with_randomness` (`player.py:188`) was not traced to
  `engine.random_seed`, so whether a genesis replay reproduces it is unverified.

**Next.** #957 ranks these problems and decides which require Postgres specifically. #962
builds out the in-place option, for which §4.1 is the input. Both should treat §7's
corrections as superseding the map's Notes.
