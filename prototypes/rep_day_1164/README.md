# Representative days and weeks that stand for a season (#1164, #1197)

This folder holds the offline evaluation behind #1164 and its gate, #1197. It compares ways of letting a
few simulated days stand for a 91-day season against simulating every day of the season, which is the
ground truth.

**Result.** The representative week chosen in ADR-0008 clears the bar set in #1197, once its demand is
scaled to the season's average. Its profit bias is within ±2.1% for every fleet except gas and coal. Each
season's estimate lands within 4–14% of its true profit, which is better than three matched days for every
fleet, and 99% of pairs of players finish in the same order as in the full season.

With the middle week's own demand, as #1197 first specified, the representative week missed the bar. The
middle week's demand is up to 6% off its season's, and profit is very sensitive to it: in winter, the
wind-and-peakers fleet came out 27% too high. ADR-0008 now scales the week's demand.

The first round of this evaluation, on the `feat-1164-matched-days` branch, recommended three matched days.
Its write-up is summarised under [Earlier findings](#earlier-findings-three-matched-days).

## The problem, stated precisely

Let $X_d$ be what a facility earns on day $d$ of the season. Full-season mode pays
$\Pi = \sum_{d=1}^{91} X_d$. Representative-day mode pays $\hat\Pi = 91\,X_m$, where $m$ is the middle day.
The mean is about right, but the variance is not:

$$\operatorname{Var}(\hat\Pi) = 91^2\sigma^2 \qquad\text{vs}\qquad \operatorname{Var}(\Pi) \approx 91\,\tau\,\sigma^2$$

Here $\sigma^2$ is the variance of a single day and $\tau$ is how many days the weather "remembers" (its
integrated autocorrelation time). The standard deviation is therefore inflated by about $\sqrt{91/\tau}$.

The weather generator gives $\tau \approx 2.5$–$3.5$ days for wind and 1.5–8 days for solar. Measured over
256 seeds:

| | Season-to-season CV of the season's average | CV of the middle day |
| --- | --- | --- |
| Wind capacity factor | 4–9% | 61–82% |
| Solar capacity factor | 5–6% | 48–52% |

(CV, the coefficient of variation, is the standard deviation divided by the mean.)

So the season's own weather already varies by a realistic amount from one season to the next. The noise
comes only from letting one day stand for 91.

## Why a single "average day" is not enough

Profit is not linear in the weather. Prices rise steeply when supply is short, gas plants earn on calm
days, and windy days push prices down for every wind farm at once. An average day has none of these
extremes, so by Jensen's inequality, $f(\text{average day}) \neq \text{average of } f(\text{day})$.

The results confirm this. A day matched to the season's average overstates the wind-and-peakers fleet's
profit by 21%, most likely because it pairs moderate wind with moderate prices, while over a real season
wind produces most on the days its own output pushes prices down. (This explanation is not yet checked
facility by facility.) It also removes most of what gas plants earn in scarce hours.
Several days that span calm and windy are needed to keep the variety, not only the average.

One way to think about it is in frequency bands of the weather:

| Band | What it decides in the game | Captured by one real day? |
| --- | --- | --- |
| Minutes to hours | Ramping (when #1151 turns it on), price spikes | Yes |
| The daily cycle | Solar shape, timing against demand, daily storage | Yes |
| Weather systems, 2–10 days | Calm spells: when peakers and storage earn | One sample only |
| The season's average | Season-to-season luck | Mixed up with the band above |

Today's coin flip is the weather-systems band leaking into the season's total, ×91. Picking only the
average day would delete that band entirely. Three days spanning calm to windy keep a sample of it.

## What was compared

Every method gives its days equal weight, each standing for 91/k days. *Matching* means minimising the
sum of squared *relative* misses on the average wind capacity factor, solar capacity factor and demand.

| Method | Days | What is simulated |
| --- | --- | --- |
| `middle_day` | 1 | Today's representative day: the middle day of the season |
| `latin_3_pool1` | 3 | Three matched days: one calm, one middling and one windy, and also one dull, one middling and one sunny (a Latin square on the 3×3 grid), the trio closest to the season's average |
| `best_week` | 7 | The 7-day run of the season closest to the season's average, taken whole |
| `representative_week_own_demand` | 7 | The middle week with borrowed weather, keeping its own demand (#1197 as first specified) |
| `representative_week` | 7 | The same, with demand scaled to the season's average (ADR-0008) |

The representative week is the middle week of the season, days 42–48 of 0–90, centred on the middle day.
Its demand and its calendar (the sun's position, and the seasonal and daily wind factors) are its own.
Wind and solar borrow only their *weather* from other 7-day runs of the season:

- wind borrows the noise term of `calculate_wind_speed`, and solar the clear-sky index (cloud cover) of
  `calculate_solar_irradiance`;
- wind and solar each pick their own run, independently, among the season's 85 runs (any start day);
- each picks the run whose weather, placed on the middle week, gives the average output closest to the
  season's real average output.

With demand scaling, every clearing's demand is multiplied by the season's average demand divided by the
week's. The week keeps its shape from hour to hour and day to day.

The market has five players on one market, all using the same prices:

| Player | Fleet |
| --- | --- |
| Wind and peakers | 6 onshore wind turbines, 4 gas burners |
| Wind and battery | 1 offshore wind turbine, 1 lithium-ion battery |
| Solar and CCGT | 2 solar plants, 1 combined-cycle gas plant |
| Nuclear | 1 reactor |
| Gas and coal | 2 combined-cycle gas plants, 1 coal burner |

Prices sit near marginal fuel cost: renewables at 0, nuclear 50, combined-cycle gas 200, gas burner 270
and coal 300. The battery buys at 60 and sells at 190. Demand is the default 50 MW per player, on today's
demand curve, which has no weekends yet (#1201). Each method runs on 64 weather seeds × 4 seasons, at 24
clearings a day.

The lithium-ion battery holds **4 hours** at full power (344 MWh at 86 MW), to match the balance round
(#1202), instead of the catalog's 37. `BATTERY_HOURS` changes this.

Storage uses a cyclic start: each plan is cleared once, then again from the charge the first pass ended
with, and the second pass is kept. Profit is revenue, minus dump and purchase costs, minus fuel at catalog
prices. O&M is left out because it is the same in every method.

## Results

The full output is in `results.txt`. In the tables below, ranges cover the four players other than gas
and coal. Gas and coal's true profit is close to zero (it bids at its fuel cost and earns only in scarce
hours), so its percentages are large, though their direction still matters.

| Method | Bias | Tracking error per season | Spread vs truth | Pairs ranked right |
| --- | --- | --- | --- | --- |
| Middle day (today) | −2 to +7% | 52–62% | 10–14× | 86% |
| Three matched days | −1 to +6% | 6–14% | 2–3× | 99% |
| Best 7-day run, whole | −2 to +4% | 10–16% | 3× | 98% |
| Representative week, own demand | +3 to +5% | 12–19% | 1.5–2.7× | 99% |
| **Representative week, scaled demand** | **−0.3 to +2.1%** | **4–14%** | **1.5–3×** | **99%** |

- *Bias* is the mean of (method − truth), as a share of the player's typical season profit.
- *Tracking error* is how far each season's estimate lands from that season's true profit (root mean
  square).
- *Spread vs truth* is the season-to-season standard deviation across seeds, as a ratio to the truth's.

The bar from #1197, for the representative week:

| Criterion | Own demand | Scaled demand |
| --- | --- | --- |
| Bias within ±5% for every fleet except gas and coal | Misses: solar and CCGT +5.2% | Passes: at most +2.1% |
| Tracking error no worse than three matched days (6–14% in this run, 6–13% on the first run) | Misses: 18–19% for the wind fleets | Passes: lower for every fleet |
| At least 99% of pairs ranked right | Passes | Passes |

Gas and coal is also closer with scaled demand: a tracking error of 39%, against 69% with the week's own
demand and 72% with three matched days.

### Why demand has to be scaled

The middle week's demand is off its season's average by a fixed amount: −1% in spring, +3% in summer, −6%
in autumn and +5.5% in winter. Extra demand is met by more expensive plants, which raises the price in
every hour for everyone, so a few percent more demand moves profit by much more. Per season, the bias of the representative week is:

| Season | Week's demand vs season | Wind and peakers, own demand | Wind and peakers, scaled |
| --- | --- | --- | --- |
| Spring | 0.988 | −2.0% | −0.2% |
| Summer | 1.030 | +7.3% | +4.6% |
| Autumn | 0.939 | −13.9% | −4.8% |
| Winter | 1.055 | +27.4% | −0.6% |

Across the four seasons these offsets partly cancel, so the overall bias looked small, but every season's
estimate is pushed the same way in every Round. Scaling removes the offset and keeps the week's shape.

### Other observations

- **Borrowed weather matches the season's energy closely.** The week's average wind output is within 0.8%
  of the season's, and solar within 0.3%. The best 7-day run taken whole misses by 3–4%.
- **The representative week adds less luck than three matched days.** Its seasons vary 1.5–3 times more
  than they really would, against 2–3 times for the matched days and 10–14 times for the middle day.
- **The shorter battery moves the matched days' bias.** With the 4-hour battery, three matched days
  overstate the wind-and-battery fleet by 6.2%. With the 37-hour battery they were within +5%.
- **No blackouts** happened in any run, as the market has spare capacity.

## Found along the way

- **The weather repeated every Round.** It depended only on the day of the year and the Run's seed, so
  Round 3's autumn had exactly Round 1's weather. The `feat-1164-matched-days` branch fixes this in `representative_weather`:
  each Round is now a year of its own. The noise behind the wind repeats after about eleven years.
- **The lithium-ion battery holds 37 hours** at full power (3.2 GWh at 86 MW). Real ones hold 2–4 hours,
  so in practice it is multi-day storage. Part of what it earns comes from moving energy from windy days
  to calm ones, which no set of separate days can capture. Even simulating all 91 days separately
  understates its profit by about 19%. This weakens the reason long-duration storage is full-season only,
  since the battery already behaves like long-duration storage.
- **The battery's starting charge is multiplied ×91.** With an arbitrary starting charge, a day's buying
  and selling to reach its usual level is counted 91 times. The evaluation uses a cyclic start. The game
  starts each period from the charge the last one ended with, which is close but not the same. This is
  worth checking before shipping.
- **Daily wind is nearly all or nothing.** About a fifth of days have a capacity factor near 0 or near 1.
  A real regional wind fleet, spread over many sites, is much smoother.
- **The slowest wind noise layer has a 4-day lattice**, and Perlin noise is 0 on lattice points. Wind is
  therefore least variable every fourth day. Today's representative days happen to fall on the most
  variable phase in autumn (day 286) and the least variable in spring (day 104). Matched days make this
  irrelevant.


## Earlier findings: three matched days

The first round of this evaluation, with the 37-hour battery and six cyclic passes, compared more methods
on the `feat-1164-matched-days` branch. Its main results:

| Method | Bias | Tracking error per season | Spread vs truth | Pairs ranked right |
| --- | --- | --- | --- | --- |
| Middle day (today) | −13 to +11% | 51–64% | 10–14× | 87% |
| One matched day | −8 to +21% | 25–34% | 5–7× | 99% |
| Three matched days | −1 to +5% | 6–13% | 2–3× | 99% |
| Three matched days from a 10× pool | 0 to +5% | 6–13% | 2–3× | 100% |
| A day stitched from three 8-hour segments | +1 to +5% | 11–30% | 3–6× | 99% |

One matched day was biased by the Jensen gap described above, mostly against gas plants and in favour of
the wind-heavy fleet. A bigger pool of candidate days did not help, and stitching segments was worse than
whole days. `methods.py` still holds `closest_day` and `stitched_day` for reruns.

## Not tested

- **Blackouts**, as above.
- **Ramping** (#1151), which is off for now. The borrowed weather comes from a real 7-day run of the
  season, so its ramps within the week are real ones.
- **96 and 288 clearings a day.** Weather is matched on hourly samples here.
- **Weekends** (#1201). Scaling demand to the season's average keeps the week's daily pattern, so it
  should carry over, but this needs a rerun once the new curve lands.
- **Other fleets and prices.** Results depend on the merit order. A sweep over price sets would make
  them more robust.

## Reproducing

```sh
.venv/bin/python -B prototypes/rep_day_1164/evaluate.py --seeds 64 --out /tmp/rep_day.json
.venv/bin/python -B prototypes/rep_day_1164/analyse.py /tmp/rep_day.json
```

This takes about two minutes on a laptop. `evaluate.py` imports the game code from this checkout's `src/`.
It patches the engine's `simulated_days` and `build_demand_block`, so that any plan of days can be cleared
through the real engine, and the catalog's lithium-ion battery to `BATTERY_HOURS` at full power.
`conditions.py` precomputes hourly weather and demand, along with the parts of the weather the
representative week recombines. `methods.py` holds the methods, and `analyse.py` prints the tables.
