# Representative days that stand for a season (#1164)

This folder holds the offline evaluation behind #1164. It compares ways of letting a few simulated days
stand for a 91-day season against simulating every day of the season, which is the ground truth.

**Result.** Three *matched days* fix the coin flip. To pick them, the season's days are sorted into three
equal groups by wind (calm, middling, windy) and, separately, three by sunshine (dull, middling, sunny).
Among the trios of days with one day from each wind group and one from each sunshine group, the trio whose
average weather and demand is closest to the season's is chosen.
Profit is unbiased to within a few percent for every kind of fleet. Each season's estimate lands within
6–13% of its true profit, and 99% of pairs of players finish in the same order as in the full season.
Today's middle day is out by 51–64% per season and gets 87% of pairs in order. A single matched day is not
enough: it overstates the wind-and-peakers fleet by 21% and wipes out most of what gas plants earn in
scarce hours.

The branch adds both matched formats as round formats, so they can be played next to the current ones.

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

Every method uses days with equal weight, each standing for 91/k days. Matching means minimising the
sum of squared *relative* misses on the average wind capacity factor, solar capacity factor and demand.

| Method | Days | Where days come from |
| --- | --- | --- |
| `middle_day` | 1 | Today: the middle day of the season |
| `closest_1_pool1` | 1 | The season's day closest to its average (shipped as **matched day**) |
| `latin_3_pool1` | 3 | Three days: one calm, one middling and one windy, and also one dull, one middling and one sunny (a Latin square), the trio closest to the season's average (shipped as **matched days**) |
| `closest_1_pool11`, `latin_3_pool11` | 1, 3 | The same, choosing from the season plus 10 more years of the same weather, to see whether a bigger pool helps |
| `stitched_1_seg3` | 1 | A synthetic day of three 8-hour segments from different days of the season |
| `shipped_*` | | The game's own `energetica.workshop.day_matching`, to check it matches the prototype |

The season itself is always the target. Only the candidate days differ.

The market has five players on one market, all using the same prices:

| Player | Fleet |
| --- | --- |
| Wind and peakers | 6 onshore wind turbines, 4 gas burners |
| Wind and battery | 1 offshore wind turbine, 1 lithium-ion battery |
| Solar and CCGT | 2 solar plants, 1 combined-cycle gas plant |
| Nuclear | 1 reactor |
| Gas and coal | 2 combined-cycle gas plants, 1 coal burner |

Prices sit near marginal fuel cost: renewables at 0, nuclear 50, combined-cycle gas 200, gas burner 270
and coal 300. The battery buys at 60 and sells at 190. Demand is the default 50 MW per player. Each method
runs on 64 weather seeds × 4 seasons, at 24 clearings a day.

Storage starts each simulation at the charge it reaches after repeating the same days six times. This is a
"cyclic" start, so a simulation does not gain from starting with an empty battery. Profit is revenue,
minus dump and purchase costs, minus fuel at catalog prices. O&M is left out because it is the same in
every method.

## Results

The full output is in `results.txt`. In the tables below, ranges cover the four players other than gas
and coal. Gas and coal's true profit is close to zero (it bids at its fuel cost and earns only in scarce
hours), so its percentages are large, though their direction still matters.

| Method | Bias | Tracking error per season | Spread vs truth | Pairs ranked right |
| --- | --- | --- | --- | --- |
| Middle day (today) | −13 to +11% | 51–64% | 10–14× | 87% |
| Matched day | −8 to +21% | 25–34% | 5–7× | 99% |
| **Matched days** | **−1 to +5%** | **6–13%** | **2–3×** | **99%** |
| Matched days from a 10× pool | 0 to +5% | 6–13% | 2–3× | 100% |
| Stitched day | +1 to +5% | 11–30% | 3–6× | 99% |

- *Bias* is the mean of (method − truth), as a share of the player's typical season profit.
- *Tracking error* is how far each season's estimate lands from that season's true profit (root mean
  square).
- *Spread vs truth* is the season-to-season standard deviation across seeds, as a ratio to the truth's.

How much a season's profit varies from one season to the next, as a CV across seeds:

| | Truth | Matched days | Middle day |
| --- | --- | --- | --- |
| Wind and peakers | 3–6% | 11–15% | 40–53% |
| Wind and battery | 3–6% | 7–9% | 29–52% |
| Solar and CCGT | 3–6% | 9–16% | 45–88% |
| Nuclear | 3–4% | 6–9% | 27–91% |

What this shows:

1. **Three matched days remove the bias** and get rankings right. Seasons still vary 2–3 times more than
   they really would. Whether that is a problem is a design choice: a bit more seasonal luck than reality
   may even be welcome in a short workshop. More days would bring it closer to the truth (see below).
2. **One matched day is biased** by the Jensen gap described above, mostly against gas plants and in
   favour of the wind-heavy fleet.
3. **A bigger pool of candidate days does not help.** Three days from the season itself already match its
   energy to within 0.4%. The remaining error comes from timing within days, not from energy.
4. **Stitching days from segments is worse** than three whole days, especially for solar, and it shows
   joins in the review chart.

## Found along the way

- **The weather repeated every Round.** It depended only on the day of the year and the Run's seed, so
  Round 3's autumn had exactly Round 1's weather. The branch fixes this in `representative_weather`:
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

## Not tested

- **Blackouts.** None of the runs had one, as the market has spare capacity.
- **Ramping** (#1151), which is off for now. Matched days are real days, so their ramps are real. Rescaling
  a day's output would have distorted them, which is one reason no method rescales.
- **96 and 288 clearings a day.** Days are matched on hourly samples whatever the clearing frequency.
- **More than three days.** Generalising the Latin square to k days, e.g. 5 or 7, would show how spread
  and tracking error fall as days are added.
- **Other fleets and prices.** Results depend on the merit order. A sweep over price sets would make
  them more robust.

## Reproducing

```sh
.venv/bin/python -B prototypes/rep_day_1164/evaluate.py --seeds 64 --out /tmp/rep_day.json
.venv/bin/python -B prototypes/rep_day_1164/analyse.py /tmp/rep_day.json
```

This takes a few minutes on a laptop. `evaluate.py` imports the game code from this checkout's `src/`.
It patches the engine's `simulated_days` and `build_demand_block`, so that any plan of days, or of
segments of days, can be cleared through the real engine. `conditions.py` precomputes hourly weather and
demand, `methods.py` holds the methods, and `analyse.py` prints the tables.

## Trying it in the game

The branch adds two values for the Round format's `trading_format` lever: `matched_day` and `matched_days`.
The facilitator sets it with `PUT /levers` (for example, from the API docs page), and it applies from the
next Round. The period review already lets players step through several simulated days.
