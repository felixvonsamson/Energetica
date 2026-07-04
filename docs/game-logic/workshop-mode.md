# Design: Workshop Mode — moderated, market-focused game format

**Status:** Proposed (design agreed via discussion; not yet implemented)
**Part of:** #338 (original timeframe discussion), #834 (dedicated discussion issue)
**Related:** `docs/architecture/lobby.md` (Run/Instance terminology, multi-instance infra this
mode builds on), `docs/game-logic/electricity-markets.md` (market clearing vocabulary this
mode reuses), `docs/backend/game-loop.md` (tick execution this mode's phase timer sits on
top of)

---

## Problem

The persistent world (`docs/backend/game-loop.md`) is tuned for long-term play: brief daily
check-ins, construction that takes real wall-clock hours/days, and progression through a
research tree. That fits a university course run over a semester, but #338 observed that
newcomers often abandon the game right after their first construction because of the wait,
and separately noted a plan for "a variant of the game with a faster clock and shorter
timeframe, intended for workshops."

This design goes further than a faster clock: it's a **moderated 2-4 hour session** for
teaching electricity-market mechanisms and game-theoretic bidding behavior to a non-technical
audience (e.g. a corporate workshop), structured as a sequence of facilitator-controlled
phases rather than a continuously-ticking world players dip into.

## Goals

- A self-contained **Run type** ("Workshop Mode") a moderator can spin up for a single
  session, distinct from persistent-world Runs.
- Session structure a moderator can reliably facilitate: predictable phases, visible
  timers, and override controls, without needing to babysit game engine internals.
- Market mechanics that surface strategic bidding behavior (merit order, capacity
  withholding, price-setting) as the central lesson, not incidental to industry/construction
  management.
- A scenario system expressive enough to script a full narrative arc (climate risk,
  technology change, geopolitical shocks, demand shifts, policy votes) across a handful of
  rounds.

## Non-goals (v1)

- Map/tile placement, spatial climate-event targeting.
- Research/technology tree or facility upgrades.
- Extraction facilities, resource peer-to-peer trading.
- Functional facilities: industry, warehouse, laboratory, carbon capture (carbon capture
  explicitly deferred to a later version, not ruled out).
- Multiple parallel sub-markets within one session (group size is capped instead).
- Player-driven rate-setting for votes (moderator sets the proposed rate; players only vote
  yes/no).

---

## Terminology

Builds on the Run/Instance vocabulary in `docs/architecture/static-serving-and-deployment.md`
and `CONTEXT.md` § Accounts & users (**Instance**, player-facing **Run**). This design adds:

| Term | Definition |
|------|------------|
| **Workshop Run** | A Run configured for Workshop Mode: fixed round count, phase timers, and a scenario script, instead of continuous free play. |
| **Round** | One investment phase + one trading round + one recap/discussion phase. A Workshop Run has N rounds (default 3, moderator-configurable 2-5). |
| **Trading round** | The live market phase within a round: 4 in-game "days" (one per season), each with one or more market clearings. |
| **Scenario script** | The pre-authored timeline of events (price shocks, unlocks, demand shifts, votes) that fire at round boundaries. |
| **Demand block** | The exogenous, per-settlement-period electricity demand the market must try to serve — see § Demand model. |
| **Facility catalog (workshop)** | The reduced, workshop-specific set of purchasable facility types (power generation + storage only), each carrying construction lag, lifetime, and O&M cost — see § Facility model. |

---

## Session structure

```
Intro (moderator-led)
  │
  ▼
┌─────────────────────────────────────────────┐
│ Round 1..N                                   │
│  Investment phase   (timer, longer round 1)  │
│  Trading round: 4 days × season              │
│  Recap / discussion (timer, longer round 1)  │
└─────────────────────────────────────────────┘
  │
  ▼
Residual value payout → Final leaderboard
```

- **Phase control is hybrid**: every phase has a visible countdown timer with a preset
  default duration; the moderator can end a phase early or extend it. Nothing is ever purely
  automatic (a live room needs slack for discussion running long or a technical hiccup) and
  nothing purely manual (the moderator shouldn't have to watch a clock while facilitating).
- **Durations decay across rounds.** Investment and discussion phases default to longer
  timers in round 1 (players are still learning the interface) and shorter in later rounds.
  Trading-round tick speed may also accelerate in later rounds. These are per-round
  overrides on top of a sensible default schedule, not a single fixed duration for the whole
  session.
- **Round count is moderator-configurable** at Run creation (default 3, hard cap 5), so the
  same tooling supports a 2-hour lunch-and-learn and a 4-hour deep session.

---

## Market model

Reuses the existing uniform-price clearing mechanism and vocabulary from
`docs/game-logic/electricity-markets.md` (supply/demand orders, settlement periods, clearing
price, marginal unit) — the mechanism doesn't change, but who submits which orders does.

### Supply side

Players submit supply asks from their power generation and storage facilities, exactly as
today. This is the only investment side players act on (see § Facility model).

### Demand side — generic demand block

Player-run industry is removed entirely; there is no player-side consumption to manage.
Instead, each settlement period has an NPC **demand block**: a bid to buy a fixed quantity at
a capped willingness-to-pay.

- **Price cap: €1000/MWh.** This stands in for "infinite" willingness to pay (true value of
  lost load isn't finite in the classic economic sense, but a hard number is needed for the
  clearing mechanism and for players to reason about). If total available supply can't cover
  the block at any price ≤ the cap, the market clears at the cap and the shortfall is
  unserved ("blackout" for that settlement period) — a deliberate, teachable failure mode
  rather than a state the moderator must avoid by careful sizing.
- **Quantity varies** by season (reusing the existing seasonal-factor shape from
  `production_update.py`), time of day (existing intra-day demand factor shape), and active
  scenario events (e.g. an EV-adoption event permanently raising the block; an AC-adoption
  event raising summer daytime demand; a heat-pump event raising winter demand).
- **Quantity scales per-capita** with the number of players in the session. The scenario
  author sets a per-player base curve once; actual session headcount multiplies it. This
  keeps a 6-person and a 15-person workshop comparably competitive without manual re-tuning,
  and lets the initial investment budget be reasoned about in the same per-player terms.

### Storage

Storage facilities participate as both supply (discharge) and demand (charge), same as the
persistent world's mechanic — unchanged by this design.

---

## Facility model

### Reduced catalog

Only **power generation and storage** facility types are purchasable. Everything else from
the persistent world's asset list is out of scope for v1:

| Removed | Why |
|---|---|
| Extraction facilities | Fuel comes from an NPC market instead (see § Fuel model) |
| Functional facilities (industry, warehouse, laboratory) | Industry is replaced by the generic demand block; warehouse/lab have no role without a resource/research system |
| Carbon capture | Deferred to a later version, not ruled out |

### Construction lag, lifetime, and O&M

Every facility type in the workshop catalog needs three new attributes that don't exist in
the persistent world's asset model today (`energetica/config/assets.py` has no per-facility
lifetime/lag concept — the persistent world uses continuous `end_of_life` and upgrade levels
instead):

- **Construction lag** — rounds of investment-only before the facility produces anything.
- **Lifetime** — rounds it remains operational once online, after which it must be replaced.
- **O&M cost** — per-round maintenance cost while operational, roughly inverse to
  lag/lifetime (near-zero for instant/short-life assets, small-but-nonzero for high-capex
  long-life assets).

Illustrative values (not final numbers, just the intended shape):

| Facility type | Construction lag | Lifetime | O&M |
|---|---|---|---|
| PV | 0 rounds | 1 round | ~0 |
| Wind | 0 rounds | 2 rounds | low |
| Conventional (gas/coal) | 0 rounds | 2 rounds | low |
| Nuclear | 1 round | 4 rounds | small, ongoing |

A nuclear investment made at the start of round N is idle (no production, no revenue) during
round N's trading, then produces through rounds N+1..N+4, then must be replaced. Payment
schedule (full cost upfront in round N vs. split across round N and N+1) is left as an
implementation choice — no strong preference either way.

### Residual value

At the end of the session (after the final round, before the leaderboard is revealed),
players are paid the depreciated remaining value of any facility that hasn't reached the end
of its lifetime yet — so an expensive long-life asset bought near the end of the session
isn't simply a sunk loss relative to one bought earlier.

---

## Fuel model

Fuel is bought from an **infinite external NPC market** during the investment phase, priced
per unit, with the price varying round to round (itself a scenario-script lever — e.g. "gas
prices +40% next round" is a geopolitical-shock event, see § Scenario events). There is no
player-run extraction and no peer-to-peer resource market (unlike the persistent world's
`energetica/schemas/resource_market.py`) — sourcing strategy isn't part of what this mode
teaches; market bidding strategy is.

---

## Budget model

- **Cumulative across rounds.** A round's investment budget is last round's trading P&L
  (cash + revenue - costs) carried forward, not a fresh fixed allowance. A floor guarantees
  a badly-losing player still has enough to participate in the next round.
- This is deliberate: if investment capacity were disconnected from trading performance,
  trading would have no consequences and the bidding-strategy lesson would be lost.

---

## Scoring

Competitive: final money (cash + residual facility value, § Facility model) ranked on a
leaderboard shown at session end. A visible ranking is what makes strategic/game-theoretic
behavior (price-setting, capacity withholding, reading opponents) actually emerge during
trading rather than flattening into passive cost-covering.

---

## Session sizing

One shared market per Workshop Run, capped at the existing 15-player limit
(`NETWORK_MEMBER_LIMIT`, `energetica/config/constants.py`, enforced per #826). Multiple
parallel sub-markets within a single session (for larger groups) is plausible future scope —
it would need synchronized phase timers and an aggregated debrief across sub-markets — but is
not needed to define this mode and isn't v1 scope.

---

## Scenario / event system

Replaces the persistent world's climate-event code (`energetica/config/climate_events.py`)
for this mode entirely — not reused, not extended, because the effects it needs to model
(portfolio-wide, non-spatial, round-boundary-scoped) don't fit the existing tile-radius model,
and because workshop events need to be authorable/scriptable rather than purely random.

### One unified event model

A single data-driven event system covers everything that changes between rounds:

- **Climate events** — physical/cost events (flood, heat wave, etc.), cost split **equally**
  across all players (not proportional to capacity or emissions — climate events affect
  everyone regardless of how "dirty" their portfolio is).
- **Technology/price shocks** — e.g. "PV manufacturing breakthrough: -50% cost next round,"
  "public-acceptance backlash: wind construction cost +30%."
- **New-facility unlocks** — introduces a previously-unavailable facility type. Hidden by
  default; an event can optionally carry a "foreshadow N rounds ahead" field so a scenario
  author can telegraph it ("gen4 nuclear funded, available in 2 rounds") when the pedagogical
  goal is forward planning rather than surprise.
- **Demand-curve shifts** — EV adoption (raises the demand block generally), AC adoption
  (raises summer daytime demand), heat-pump adoption (raises winter demand), etc.
- **Geopolitical shocks** — fuel price changes via the NPC fuel market (§ Fuel model).

### Authoring: script + live override

A **pre-built scenario script** is the default authoring path: a moderator (or workshop
template author) defines the full event timeline ahead of time, and it plays back
automatically at each round's recap. A **live override panel** lets an experienced moderator
adjust severity, trigger an unscripted event, or skip a scripted one in the moment — a thin
layer over the same event data model, not a separate system.

Each round ends with a **recap page** revealing what's changing next round, before the
optional open-discussion window.

### Vote events

A generalized event subtype: the moderator proposes a policy (subject + rate), players vote
binary yes/no, and the outcome applies if it passes. Not hardcoded to one policy — the same
mechanism could carry a renewables subsidy, a price cap change, or other market-rule votes in
future scenario scripts.

**First planned instance: carbon tax.** Proportional to each player's emissions (reusing the
persistent world's existing per-fuel emissions accounting —
`energetica/database/engine_data/emission_data.py`,
`energetica/database/engine_data/cumulative_emissions_data.py` — no new emissions model
needed), collected into a pool and redistributed **equally** per player. Revenue-neutral by
design: below-average emitters net a gain, above-average emitters net a cost, without the
moderator picking winners directly.

Rate-setting-by-vote (players collectively choosing the rate rather than the moderator
proposing a fixed one) is deferred — it needs a real preference-aggregation mechanism and is
its own design problem.

---

## Open questions

These are flagged, not resolved, in #834 for broader input before implementation:

1. **Trading-day granularity.** Continuous fine-grained ticks (e.g. ~5s clock, mirroring the
   persistent world's continuous clearing) vs. discrete blocks (e.g. 4-6 clearings/day,
   easier to narrate live, more classic-auction-like). Trade-off: realism/continuity of the
   existing market mechanic vs. how legible the live session is for a room full of people
   half-watching a moderator.
2. **Nuclear payment schedule.** Full cost upfront in the construction round vs. split across
   the construction round and the first operating round. No strong preference; pick whichever
   is simpler to implement.

## Future extensions (explicitly out of scope for v1)

- Carbon capture as a purchasable facility.
- Multiple parallel sub-markets within one session, for groups larger than 15.
- Rate-setting-by-vote instead of moderator-proposed rates.
- Map/spatial mechanics, if a future variant wants to reintroduce geography-driven strategy.
