# The game engine and the model store belong to the persistent world

**Status:** accepted
**Date:** 2026-11-15
**Decided in:** #1049, carried out in #1055. **Related:** the persistence effort #924 and its
sign-off #936, which this record does not rule on.

## Context

#1049 split the backend into layers that any app may use (`kernel`, `identity`, `sim`) and three
apps above them that never import one another (`freeplay`, `workshop`, `lobby`). The import
contracts in `pyproject.toml` enforce that split.

Two pieces of the persistent world look like shared infrastructure:

- **The game engine** (`freeplay/game_engine.py`, with the process's one engine in
  `freeplay/globals.py`): a clock that ticks the simulation, a lock that requests and ticks share,
  and the machinery that pickles the whole game to a save and to checkpoints and writes the action
  log.
- **The model store** (`freeplay/database/`): the `DBModel` base class and the id-keyed store that
  holds every entity in memory for the life of the process.

Neither names a facility or a player in its signature, so a reader expects them in a shared
layer. Workshop Mode (#992) is a second kind of Run, written from scratch, and it needs state that
survives a restart. If the engine and the store sat in a shared layer, Workshop would pick them up
as the obvious way to store its state.

## Decision

The game engine and the model store live in `energetica.freeplay`, the persistent world's
package, and not in a shared layer. Workshop may not import `freeplay`, so it cannot use them by
accident. If a mode other than the persistent world needs persistence, it chooses it deliberately,
once its state is designed.

Each argument for the engine and the store is about the persistent world specifically:

- **Large player counts.** Keeping every entity in memory is cheap per request when many players
  share one long-running game. A Workshop session is a few teams in one room for a few hours.
- **The per-tick scan.** The #961 audit found that free in-memory reads are what make the
  persistent world's tick loop viable: each tick reads the whole game graph. Workshop has no tick
  loop. Its session waits at each phase until the facilitator advances it, and it simulates a
  Trading period once, in one batch, when the period's price-setting window closes.
- **Existing data.** The risk that dominates #924 is converting years of existing pickled saves.
  Workshop starts with no saved data.

Domain-neutral helpers stay shared. Writing a file atomically is in `kernel/atomic_file.py`, and
both modes use it. The line is between a helper that knows nothing about how a mode keeps its
state and a store whose shape is one mode's state.

## What this decides, and what it does not

It decides:

- where the engine and the model store live;
- that no other mode gets them by default;
- that anything Workshop shares with the persistent world must live in `sim`, `identity` or
  `kernel`.

It does not decide:

- **How the persistent world stores its state.** Whether it keeps its pickled model store or
  moves to a database is the open question of #924, pending sign-off in #936. The three
  arguments above explain why the store fits the persistent world better than it would fit
  Workshop. They are not evidence that pickle beats a database for the persistent world, nor the
  reverse. A choice made for a mode with no existing data and no tick loop is not a ruling on the
  persistent world's.
- **How Workshop stores its state.** That was left to Workshop's state-machine design. It was
  later decided in #994: one `WorkshopSession` per Run, saved to a JSON file after every change,
  in the shape of the session. That choice is #994's, not a consequence of this record.
- **The layering itself.** The order of `kernel`, `identity` and `sim` and the independence of
  the three apps get no decision record. They are not surprising to a reader, and the import
  contracts in `pyproject.toml` document and enforce them.

## Considered options

- **Put the engine and the store in a shared layer, so both modes can use them.** Workshop would
  inherit a tick clock, a process-wide lock and whole-game pickling by where the files happen to
  sit. The persistent world's persistence decision (#924) would then bind Workshop too, or the
  other way round.
- **Split out the parts that look generic (the id-keyed store, the lock, the save) into `kernel`
  and keep the entity models in `freeplay`.** The parts that are really generic are small, and the
  atomic file write is already in `kernel`. The rest is shaped by the persistent world: the whole
  graph always in memory and pickled in one piece. Moving it down would share that shape under a
  neutral name.

## Consequences

- **Workshop builds its own persistence.** It did, in #994, and that persistence shares nothing
  with the persistent world's.
- **A change to the persistent world's persistence stays inside `freeplay`.** Nothing outside it
  imports the engine or the store; `energetica.entry` imports only the persistent world's app.
  If #924 moves the persistent world to a database, no other package changes.
- **Sharing the engine later is a deliberate change.** A mode that wants it must move it down a
  layer, and that move should be argued against this record.
