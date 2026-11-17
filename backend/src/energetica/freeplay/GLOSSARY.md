# Persistence & Replay

How the persistent world saves its state and rebuilds it when the server restarts. Three different things here all sound like "saving", so the terms below are pinned. See the [glossary map](../../../../GLOSSARY-MAP.md) for the other contexts.

## Language

### Persistence artifacts

**Action log**:
The append-only record of every game event since the run began. It is the authoritative event source: any game state can be rebuilt from it by **replay**.
_Avoid_: history file, log (ambiguous with the console log)

**Save**:
A snapshot of the engine's in-memory state, taken every 10 minutes. It holds only the engine's state, not the rest of the instance's files, so it is not a full backup.
_Avoid_: dump, snapshot (reserve "snapshot" for informal use)

**Checkpoint**:
An archive of all of the instance's game files, including a fresh **save**, taken every 6 hours. The unit of disaster recovery.
_Avoid_: backup, save (a checkpoint contains a save but is not one)

### Replay

**Replay**:
Re-running the **actions** in the **action log** that come after a known tick, to bring restored state up to the present. On every restart, replay runs the actions since the **loaded tick** through the current code, so a logged action that now fails with a server error stops the instance from resuming.

**Loaded tick**:
The tick the restored state is current as of: the engine's tick count right after a **save** or **checkpoint** is loaded. Replay starts with the first action after it.
_Avoid_: checkpoint tick (the loaded tick usually comes from a 10-minute save, not a 6-hour checkpoint)

**Action**:
One event in the **action log**, of one of four types: `init_engine` (always the first), `tick`, `create_user` and `request`. A `request` action carries the request the player sent.

### Upgrading

**Migration**:
A step that converts stored data from the shape an older version of the code wrote into the shape the newer version expects, so the newer code can read it. A **schema migration** changes the tables of a SQL database, such as `lobby.db`. A **state migration** changes a run's saved state, such as a persistent-world **save** or a Workshop session. A code change that reads the same data but simulates differently is not a migration: nothing needs converting.

**State version**:
The number stored with a piece of persisted data that says which **migrations** it has had. Data with no state version is at version 0.
_Avoid_: schema version (use it only for a SQL database's state version)

## Relationships

- A **checkpoint** contains exactly one **save** plus the rest of the instance's game files.
- Disaster recovery restores a **checkpoint** (or a **save**) and **replays** the **action log** from the **loaded tick** on. So the action log must stay complete from its first action: cutting it below a tick makes every earlier loaded tick unrecoverable.

## Flagged ambiguities

- **"Checkpoint tick" vs "loaded tick".** On a normal restart the **loaded tick** comes from the 10-minute **save**, not the 6-hour **checkpoint**, so replay usually covers about 10 minutes of actions, not 6 hours. Resolved: use **loaded tick** for the replay boundary.
- **"The log".** It meant both the **action log** and the console logger. Resolved: **action log** is always the persisted event source.
