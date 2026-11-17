# Run modes

A **Run**'s mode says what kind of game it is. Each mode has its own backend package and its own frontend, and the mode is fixed when the Run is created (ADR-0010). See the [glossary map](../../../GLOSSARY-MAP.md) for the other contexts.

## Language

**The persistent world**:
The long-running mode of play: players settle a tile on a shared map and build up their power network over weeks of real time, while the simulation advances one tick at a time whether or not anyone is playing. Its state is saved and replayed as [Persistence & Replay](./freeplay/GLOSSARY.md) describes. Write `freeplay` in code, configuration and file paths, such as the Run mode tag `"freeplay"`, the package `energetica.freeplay` and the frontend app `@energetica/freeplay`. Write "the persistent world" in prose: docs, docstrings, comments, issues and commit messages.
_Avoid_: free play, free-play, and Freeplay as a word in prose; "the game" or "the main game" for this mode alone

**Workshop**:
The moderated, Round-based mode for a live session, whose terms are pinned in [Workshop Mode](./workshop/GLOSSARY.md). Write `workshop` in code and "Workshop" or "Workshop Mode" in prose.

## Flagged ambiguities

- **`freeplay` vs "the persistent world".** One mode had three names: "free play", `freeplay` and "the persistent world". Resolved (#1049) as pinned above: the code and the prose differ on purpose. A name in backticks, such as the package `freeplay`, is code and keeps its code spelling in prose too.
