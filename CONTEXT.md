# Energetica — Context Glossary

Project-wide glossary of domain terms. Energetica spans several distinct contexts;
this file indexes them and defines the vocabulary for each as it gets documented.
Terms are pinned per-context to keep overloaded words (e.g. three different things
that all sound like "saving") unambiguous.

## Contexts

- **Persistence & Replay** — how the backend persists game state and reconstructs it
  on startup. _Documented below._
- **Electricity-market simulation** — production, markets, climate events, the tick
  loop. _Not yet documented._
- **Accounts & users** — players, server-wide accounts, auth. _Not yet documented._
- **Real-time sync** — socket.io state propagation to the frontend. _Not yet documented._
- **Frontend** — TSX/Tailwind app and the generated API type bridge. _Not yet documented._

When a new context's terms get pinned, add a `## <Context>` section below (or split
into a `CONTEXT-MAP.md` + per-context files if this grows unwieldy).

---

## Persistence & Replay

Overloaded in the code — three different operations all sound like "saving" — so the
terms below are pinned.

### Language

#### Persistence artifacts

**Action log**:
The append-only, line-delimited JSON record of every game event since `init_engine`,
written to `instance/actions_history.log`. The authoritative event source; the ground
truth from which any game state can be reconstructed by replay.
_Avoid_: history file, log (ambiguous with console log).

**Save**:
A pickle of in-memory engine state to `instance/engine_data.pck`, taken every 10 min.
A point-in-time snapshot, not a full backup — it does not include the rest of `instance/`.
_Avoid_: dump, snapshot (reserve "snapshot" for informal use).

**Checkpoint**:
A gzipped tarball of the entire `instance/` directory (which includes a fresh **save**),
taken every 6 h, written to `checkpoints/last_checkpoint.tar.gz`. The unit of disaster
recovery.
_Avoid_: backup, save (a checkpoint contains a save but is not one).

#### Replay

**Replay**:
Re-executing **action log** entries that occur strictly after a known tick to bring
restored state up to the present. Performed by `simulate.py`.

**Loaded tick**:
`engine.total_t` immediately after a **save**/**checkpoint** is loaded — the tick the
restored state is current as of. Replay starts from the action immediately after the
log entry whose `total_t` equals the loaded tick.
_Avoid_: checkpoint tick (the loaded tick usually comes from a 10-min **save**, not a
6-h **checkpoint**).

**Action**:
A single logged event. One of four discriminated types (`action_type`): `init_engine`
(always log line 0), `tick`, `create_user`, `request`. The `request` type carries
arbitrary user-controlled JSON payloads.

### Relationships

- A **checkpoint** contains exactly one **save** plus the rest of `instance/`.
- Disaster recovery = restore a **checkpoint** (or **save**) + **replay** the **action
  log** from the **loaded tick** forward. This requires the **action log** to be
  complete from `init_engine`; truncating it below a tick destroys the ability to
  replay from any earlier **loaded tick**.
- Only **actions** after the **loaded tick** are needed at startup; everything before
  is read solely to locate the **loaded tick**'s log line.

### Flagged ambiguities

- "checkpoint tick" vs "loaded tick": on a normal restart the **loaded tick** comes
  from the 10-min **save**, not the 6-h **checkpoint** — so replay typically covers
  ~10 min of actions, not ~6 h. Resolved: use **loaded tick** for the replay boundary.
- "the log" meant both the **action log** (file) and the console logger in code.
  Resolved: **action log** is always the persisted event source.
