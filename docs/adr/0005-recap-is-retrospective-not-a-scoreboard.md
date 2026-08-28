# Recap is a retrospective, not a scoreboard

**Status:** accepted
**Date:** 2026-07-22 (decided out-of-band and applied by `cd33e164`; recorded here late — see #944)
**Supersedes:** the *competitive* framing of G1 (#859) — the `rank` field, income-as-"who
won", captured-CO2-as-brag-stat. The rest of G1 stands: tombstone model, frozen-photograph
semantics, map snapshot, phase-derived visibility, static publication.
**Decided in:** #906. **Applied by:** #907.

## Context

The recap is a write-once JSON tombstone minted at the `active → freeze` transition and
published to `recaps/{slug}.json`, where it outlives the instance process
(`energetica/utils/recap.py`, `mint_recap_if_needed`). The mint-once guard is a *readable*
recap on disk — `instance_config.load_recap` returning non-`None`, not bare file existence —
so a corrupt artifact re-mints on the next freeze tick instead of stranding the lobby.

G1 specified it as an income-ranked leaderboard that crowns a winner. Energetica is a
systems-education game about the trade-offs of running a grid. A podium answers a question
the simulation is not asking, and — worse — it tells the player which of the many things
they can read off the table is *the* thing that mattered.

## Decision

The recap presents information matter-of-factly and lets the reader draw the conclusions.

1. **No overall winner is crowned.** Having per-category winners and rankings is fine.
2. **CO2 is laid bare as two un-netted columns** — gross `produced_co2` and `captured_co2` —
   so a heavy emitter who also captures heavily reads as exactly that, with the
   produce-versus-capture relationship visible rather than collapsed.
3. **Default row order stays `operating_income` descending**, reframed as "most consequential
   first", not "winner on top". The table is sortable, so the default is a soft editorial
   choice rather than a verdict.
4. **Notability is per-column and client-derived.** Top-3 cells *within each column* get
   visual emphasis, computed from the rows at render time, never minted into the payload.
5. **Ties break on the immutable `account_id` ascending**, so a re-mint is a reproducible
   photograph rather than a reshuffle.

## Considered options

- **Keep G1's ranked leaderboard with a winner.** Rejected: it manufactures a contest the
  simulation is not running, and collapses a multi-dimensional retrospective into one verdict.
- **Report net CO2 only, as the single collapsed figure.** Rejected as **gameable** — capture
  a pile, go net-negative, and the number flatters a large emitter — and because netting hides
  the produce-versus-capture relationship that is the whole point of retrospecting.
- **A normalised efficiency ratio** (CO2 per unit revenue, or per unit energy). Rejected: it
  manufactures a single "winner" metric by another route.
- **Mint notability into the payload.** Rejected: it freezes an editorial judgement into an
  immutable artifact. Deriving it client-side keeps the tombstone descriptive.

## Consequences

- `RecapRow` carries no `rank`. A consumer wanting an ordinal derives it from position; the
  schema does not bless one.
- Two CO2 columns plus a `total_produced_co2` header total, all summed from the rows already
  built, so the header and the column cannot drift.
- **No new simulation metric was needed.** Gross produced is the sum of the *positive*
  categories of `cumul_emissions` — capture is recorded as a *negative* `carbon_capture`
  entry — exposed as `Player.calculate_produced_co2` in `energetica/database/player.py`,
  mirroring the existing `calculate_net_emissions`. This is the subtlety a future reader will
  trip on, and the reason `tests/unit/test_player_emissions.py` exists.
- `total_net_emissions` is retained in the header, sourced from the players rather than from a
  row column. The netted figure is still *available*; it is simply not the presentation.
- **The recap page must not reintroduce a podium.** The page (#864) is not yet on `main`, and
  this ADR is the constraint it inherits.
