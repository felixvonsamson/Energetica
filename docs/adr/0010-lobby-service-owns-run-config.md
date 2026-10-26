# The lobby service owns run config

**Status:** accepted
**Date:** 2026-10-26
**Decided in:** #1313, part of the map #1336. **Supersedes:** ADR-0009's "Run state is not its
concern" line.

## Context

Each run's config lives in its own `instance.json`, under `/etc/energetica/{slug}/`: its name,
whether the lobby advertises it, its access policy and join link, its mode and its schedule
(`starts_at`, `freeze_at`, `ended_at`). The run publishes a public copy of most of it as a
fragment in the landing directory, and an aggregate `instances.json` from all the fragments.

Every one of those fields is read by something other than the run: the lobby and the landing read
the fragments, the reaper reads the schedule, and the access fields decide who may join, next to
the memberships the lobby service already owns (ADR-0007). The run also writes its join token and
`join_open` into a file that admins own. And `instance.json` has no migrations, so its shape can
only ever grow.

ADR-0009 made the lobby service the one owner of `lobby.db`, but left run state out of it: "A
run's access policy stays in the run's `instance.json`."

## Decision

Every field of `instance.json` moves into a `runs` table in `lobby.db`, keyed by slug, behind the
lobby service. The file, the fragments and `instances.json` are retired.

- **Reads.** `GET runs` and `GET runs/{slug}` answer each run's config with its `phase`, derived
  from the three timestamps. A run reads its config through the session call it already makes on
  every request, and through `GET runs/{slug}` where there is no session. Nothing caches it, as in
  ADR-0009: an edit takes effect on the next read.
- **Writes.** `PUT runs/{slug}` creates a run, `PATCH runs/{slug}` changes some of its fields,
  `POST runs/{slug}/join-token` creates the join token on first use, and `DELETE runs/{slug}`
  deletes a run (refused while it has members, unless they are deleted with it).
- **Validation.** The service refuses an invalid write with a message: timestamps out of order, a
  join link on a public run, a change to `slug` or `mode`. Nothing invalid is stored, so readers
  no longer need to fail closed on a broken config.
- **History.** There is no history table. Every write logs one structured line naming its caller,
  the account it was made for if any, and each changed field, old and new. The join token's value
  is never logged.
- **Operators** use `scripts/lobby/run.py`, a thin client of the API. Instance scripts only read
  runs: a run is created first, and its instance is set up for it.
- **Mode.** An instance's mode is also fixed in its `instance.env`, because the backend needs it
  before it can reach the service. At start-up the run checks that the two agree.

A **run** is the game, which the lobby keeps and which outlives its **instance**, the deployment
it is played on (`CONTEXT.md` § Accounts & users).

## Considered options

- **Keep `instance.json` and add migrations to it.** It would still be a file that the run, the
  admins and the scripts all write, read through a published copy, with the access fields away
  from the memberships they gate.
- **One row per schedule boundary instead of three timestamp columns.** SQLite cannot check the
  order of rows, and every phase read would need a pivot.
- **A history table for config changes.** Left until something needs to read it. The journal line
  answers "who changed what, when" for an operator.
- **Publish a static manifest from the service, in place of the fragments.** It is a second copy
  to keep fresh. The lobby backend serves the picker's list from the API instead.

## Consequences

- **Config changes become schema migrations**, in one place, like every other change to
  `lobby.db`. `instance.json`'s "only add fields" rule ends with the file.
- **Runs depend on the service for their schedule.** A run already cannot serve requests while the
  service is down. Its tick loop now skips a tick it cannot place in a phase, rather than running a
  frozen game past `freeze_at`, and catches up when the service is back.
- **The service knows about runs that no instance plays.** A run with a recap stays in the lobby
  after its instance is torn down, and a run is created before its instance exists.
- **The cut-over runs in steps:** the service side first, then a backfill of production's runs,
  then every reader, then the clean-up of the files, then the foreign key from memberships to
  runs. See #1313's resolution.
