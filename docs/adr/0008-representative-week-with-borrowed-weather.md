# A representative week with borrowed weather stands for each season

**Status:** accepted, pending the evaluation in #1197
**Date:** 2026-10-14
**Supersedes:** the representative day (#1003): the middle day of the season, scaled ×91.
**Decided in:** #1164. **Applied by:** #1197 (evaluation), #1198 (engine), #1199 (review page),
#1200 (Recap), with #1201 (demand curve) and #1202 (battery) alongside.

## Context

In representative-day mode, the middle day of a season stands for its whole Trading period, and its
money and energy are scaled ×91. Demand repeats closely from day to day, but the weather does not. The
season's average wind and solar output vary by only 4–9% from one season to the next, while a single
day's vary by 50–80%. Scaling one day ×91 makes a renewable investment a bet on one day's weather.

Max's evaluation on the `feat-1164-matched-days` branch measured this against simulating every day of
the season (64 seeds × 4 seasons, five players): the middle day is out by 51–64% per season, and gets
87% of pairs of players in the right order. It also showed that one "average" day is biased: profit is
not linear in the weather, so a day with average wind loses the calm hours gas plants earn in and the
windy hours that push prices down. Three matched days fixed the bias.

## Decision

A Trading period is simulated as one week of the season, scaled ×13.

1. **The week is the middle week of the season, every Round.** Its demand, the sun's position and the
   seasonal and daily wind factors are its own.
2. **Wind and solar borrow only their weather** from a 7-day run elsewhere in the season: the noise term
   for wind, the clear-sky index (cloud cover) for solar. Each picks its own run, independently, among
   the season's 7-day runs, starting on any day.
3. **Each picks the run whose weather, placed on the middle week, gives the average output closest to the
   season's real average output.** Matching on output, not on the raw weather, accounts for the
   nonlinear power curves.
4. **Demand is not rescaled.** The middle week's demand is off the season's by up to 7%, the same every
   Round, which is accepted.
5. **Storage uses a cyclic start.** The week is cleared once, then again from the charge the first pass
   ended with, and the second pass is kept. Nothing carries over between periods, and the jump in charge
   between periods is not priced.
6. **Each Round has its own weather**, so a season's weather differs from one Round to the next.
7. The `trading_format` lever offers `representative_week` (the default) and `full_season`. The middle
   day and the matched-day formats are dropped.
8. The period review shows a week on one chart per series, with zoom linked across the charts.
   Full-season mode uses the same weekly charts with a week selector. The Recap tells how each season's
   wind and sunshine compared with normal.

The season's own weather still sets its total, so luck from one season to the next stays, at about its
real size.

## Considered options

- **Keep the middle day.** Rejected: its weather is a coin flip, scaled ×91.
- **One matched day**, the day of the season closest to its average. Rejected: biased by up to 21%,
  since an average day has none of the calm and windy hours that set prices.
- **Three matched days**, one calm, one middling and one windy, and one dull, one middling and one
  sunny (Max's recommendation). It removed the bias and ranked players right, but the choice of three
  days felt arbitrary. Separate days also lose weekends and multi-day weather spells.
- **Copy the output of the best-matching 7-day run, whole.** Rejected: within one season, a week's
  clear-sky solar energy ranges from about 0.5× to 1.9× the middle week's, and the seasonal wind factor
  from about 0.7× to 1.3×. Copying output would confuse "sunny weather" with "late in the season".
- **Choose the Monday-to-Sunday week nearest to the solar run, and use its demand.** Rejected: a single
  week's demand ranges from 0.81× to 1.15× the season's, so moving the week would add demand luck
  scaled ×13.
- **Sort solar days into seven groups by cloudiness and take one from each.** Rejected as more complex
  than this use needs.
- **The seven single days closest to the average.** Rejected for the same bias as one matched day.
- **Rescale the week's demand to the season's.** Rejected: the error is small and the same every Round.
- **Carry storage charge from the last period, scaled ×13.** Rejected: a battery bought empty would
  appear to buy a full charge 13 times. Pricing the jump between periods once was rejected as an extra
  balance-sheet line for an error of about 1%.

## Consequences

- A week gives 168 clearings at 24 a day, 672 at 96 and 2,016 at 288. All three stay allowed. Choosing
  the borrowed weather means sampling all 91 days, a fraction of a second per season, independent of
  the players.
- Weekends show up once the demand curve is regenerated with its weekly pattern over a 364-day year
  starting on a Monday (#1201). Until then the week has no weekends.
- The cyclic start assumes batteries fill or empty within the week. The lithium-ion battery today holds
  37 hours at full power, and is cut to 2–4 hours in the balance pass (#1202). A battery that never
  fills or empties keeps a small mismatch between its start and end charge.
- The borrowed wind and solar of a week come from different parts of the season, so they never happened
  at the same time. The weather generator has no link between wind and clouds, so nothing real is lost.
- The rule that the "every storage type" availability needs the full-season format is unchanged by
  this decision.
- If the evaluation in #1197 shows the representative week missing the agreed bar (bias within ±5%,
  error per season no worse than three matched days, at least 99% of pairs ranked right), this decision
  is reopened before any implementation.
