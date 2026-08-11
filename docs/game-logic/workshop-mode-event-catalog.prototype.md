# Workshop Mode — Event & headline catalog (PROTOTYPE, throwaway)

Prototype for [Event content catalog (#978)](https://github.com/felixvonsamson/Energetica/issues/978), updating the
first-pass draft from [Event headline library (#919)](https://github.com/felixvonsamson/Energetica/issues/919) to
the event data shape #919 actually landed on, part of the
[Workshop Mode map (#880)](https://github.com/felixvonsamson/Energetica/issues/880). Not production content — still
a draft to react to further before implementation. Lives on branch `prototype/919-event-headlines`; nothing here is
wired to code.

## Resolution log (this pass, ticket #978)

Content questions carried over from the first draft, resolved with Felix:

1. **Drought** now carries a real mechanical effect — `revenue_tax`, same as the other disaster vignettes.
   Considered a dedicated hydro-output-derate effect instead, but that's the "renewable-output weather variability"
   lever [Round-config levers (#917)](https://github.com/felixvonsamson/Energetica/issues/917) already considered
   and parked — reopening it wasn't this ticket's call to make.
2. **Enhanced geothermal** tech-unlock idea — dropped (no prerequisite base tech, and judged too complex to
   introduce one).
3. **Green hydrogen / hydrogen storage** — kept, but reframed. Hydrogen storage is already a real facility category
   ([facility catalog #975](https://github.com/felixvonsamson/Energetica/issues/975)) with **no base tier to invest
   in** — it's one of the two full-season-only storage types, gated by the Advanced trading-round-format lever, not
   by cumulative investment. So this is now one combined "new storage technologies available" announcement covering
   **both** full-season-only types (Hydrogen storage + Pumped hydro), firing when the Advanced/full-season format
   lever activates — see [D7](#d7-full-season-storage-availability-techfull_season_storage) and the implementer
   note below.
4. **Shipping-lane blockade** — narrowed from "all facility types" to a two-target effect on **battery storage +
   PV panel capex**, the same multi-target pattern already used by the rare-earth-magnet vignette.
5. **Floating offshore wind / sodium-ion battery / grid-scale flow battery** tech-unlock ideas — dropped. The final
   tech-unlock catalog is the original six from Felix's list, plus the new storage-availability announcement (#3).
6. **Demand-shift `boundary_type`** — all demand-shift vignettes are **round-scoped**, matching `amplitude`'s
   framing as a per-Round scalar ([#911](https://github.com/felixvonsamson/Energetica/issues/911)). The map's
   #919 decision allows this to be mixed per-event; this catalog simply doesn't use that flexibility.
7. **Tone** — confirmed: keep the concise financial-news-wire style from the first draft.
8. **Magnitude numbers** — confirmed placeholders throughout. Real numeric tuning is a separate future
   game-balance-tuning ticket, out of scope here.

### Implementer notes flagged by this pass

- **`effect.target` can be a short list**, not just a single slug, when a vignette genuinely spans multiple
  commodities (rare-earth magnets; shipping-lane blockade). `magnitude` applies uniformly to every listed target.
- **`magnitude` convention**: always the multiplier the target quantity gets multiplied by (`>1` raises it, `<1`
  lowers it) — a "3% tax" is written `0.97`, not `0.03`. This wasn't pinned down by #919 at the field-type level;
  fixing it here so every vignette in the catalog is internally consistent.
- **Severity range varies per vignette family**, not fixed to one ladder — #919's `{minor, moderate, major}` example
  isn't an exhaustive enum. `catastrophic` is reserved for disaster vignettes that can plausibly reach
  region-devastating scale (hurricane, wildfire, flood); temperature vignettes (heatwave, cold snap) top out at
  `major` since their effect is demand-only; drought stays `moderate`/`major` — slow-onset, doesn't read as
  "catastrophic" the way a storm does. Per Felix: "it's ok to have some events... in the range major-catastrophic
  and some in the range minor-major, and any combination."
- **The full-season-storage announcement (D7) doesn't fit the investment-threshold trigger** every other tech-unlock
  vignette uses — it fires off the Advanced/full-season trading-round-format lever
  ([#917](https://github.com/felixvonsamson/Energetica/issues/917)) being active instead. The event shape doesn't
  currently have a field for "trigger condition" beyond the implicit investment-threshold one; this needs a real
  trigger-type field (or a documented special case) when this catalog gets implemented.
- **Diplomatic-resolution's target is dynamic** ("whichever fuel is currently elevated") — not a fixed slug in the
  catalog. The moderator resolves the actual target at pick-time. Flagging since every other vignette's target is
  static.
- **The carbon-tax vote outcome doesn't use `severities`/`magnitude` in the graded sense** the rest of the catalog
  does — it's two independent bits (enacted/rejected × close/clear margin), not a minor/moderate/major ladder. Kept
  as its own small table rather than forced into the standard shape.

---

## Shape

Each event is a **named vignette**, not just an abstract severity tier. The moderator's round-config page (built in
[#918](https://github.com/felixvonsamson/Energetica/issues/918)) lists vignettes per category as a pool of tiles;
picking one adds it to the next occurrence of its category's `boundary_type`.

```yaml
event:
  id: climate.heatwave                    # stable slug: <category>.<short_name>
  category: climate                       # climate | price_shock_geopolitical | demand_shift | tech_unlock | vote
  boundary_type: trading_period           # round | trading_period — fixed per category except demand_shift
                                           #   (mixed per event per #919; this catalog sets every demand_shift
                                           #   vignette to round, see resolution #6 above)
  direction: negative                     # negative | positive | null (tech_unlock, vote — not meaningful there)
  name: "Heatwave"                        # moderator-facing tile label
  effect:
    kind: demand_amplitude_shift          # demand_amplitude_shift | revenue_tax | facility_price | facility_unlock | carbon_tax
    target: demand.amplitude              # slug, or a short list of slugs for multi-commodity vignettes
  severities: [minor, moderate, major]    # a run within {minor, moderate, major, catastrophic}, sized to how extreme
                                           #   the vignette family can plausibly get, or [base] for single-shot vignettes
  magnitude:                              # numeric multiplier applied to the target, keyed per severity
    minor: 1.03
    moderate: 1.08
    major: 1.18
  headlines:                              # exactly one fixed string per severity — no rotation pool
    minor: "A brief spell of warm weather nudges cooling demand up across the region."
    moderate: "A regional heatwave pushes cooling demand to a five-year high — expect tighter margins this quarter."
    major: "A record-breaking heatwave grips the region for weeks. Air conditioners run nonstop as cooling demand hits an all-time high."
```

No `suggested_`/`moderator_editable` fields — magnitudes are fixed at catalog-authoring time, not moderator-tunable
per pick (per #919; overall balance still gets tuned catalog-wide in a future pass, per resolution #8 above).

---

## A. Climate

Effects target **demand** (temperature vignettes) or **revenue** (disaster vignettes) — never generation output, to
avoid colliding with the parked "renewable-output weather variability" lever
([#917](https://github.com/felixvonsamson/Energetica/issues/917); see resolution #1 above). `boundary_type` is
`trading_period` for every climate vignette.

### A1. Heatwave `climate.heatwave`
Temperature · `demand_amplitude_shift` → `demand.amplitude` · direction: negative

| Severity | Magnitude | Headline |
|---|---|---|
| minor | ×1.03 | "A brief spell of warm weather nudges cooling demand up across the region." |
| moderate | ×1.08 | "A regional heatwave pushes cooling demand to a five-year high — expect tighter margins this quarter." |
| major | ×1.18 | "A record-breaking heatwave grips the region for weeks. Air conditioners run nonstop as cooling demand hits an all-time high." |

### A2. Cold snap `climate.cold_snap`
Temperature · `demand_amplitude_shift` → `demand.amplitude` · direction: negative

| Severity | Magnitude | Headline |
|---|---|---|
| minor | ×1.04 | "An early cold front sends heating demand up for a few chilly days." |
| moderate | ×1.10 | "A sharp cold snap sends heating demand climbing — heat pumps work overtime to keep up." |
| major | ×1.22 | "An arctic cold snap sends heating demand soaring — heat pumps strain to keep up as outdoor temperatures plunge." |

### A3. Mild / favorable season `climate.mild_season`
Temperature · `demand_amplitude_shift` → `demand.amplitude` · direction: positive · severities: `[base]`

| Severity | Magnitude | Headline |
|---|---|---|
| base | ×0.97 | "An unusually mild season keeps both heating and cooling demand low — a quiet quarter for grid operators." |

### A4. Drought `climate.drought`
Disaster · `revenue_tax` → all players · direction: negative

| Severity | Magnitude | Headline |
|---|---|---|
| moderate | ×0.97 | "A regional drought tightens water availability. Utilities and industry alike feel the pinch." |
| major | ×0.93 | "A record drought grips the region. Reservoirs sit at historic lows, and every water-dependent business — power generation included — feels the squeeze." |

### A5. Wildfire season `climate.wildfire`
Disaster · `revenue_tax` → all players · direction: negative

| Severity | Magnitude | Headline |
|---|---|---|
| moderate | ×0.97 | "Wildfires force the evacuation of a substation — grid operators reroute power across the region while crews fight the blaze." |
| major | ×0.94 | "A severe wildfire season forces rolling substation evacuations across the region — grid operators scramble to reroute power as crews battle blazes on multiple fronts." |
| catastrophic | ×0.88 | "A catastrophic wildfire season overwhelms the region — dozens of substations destroyed and entire communities evacuated. Full grid restoration will take months." |

### A6. Hurricane / tropical storm `climate.hurricane`
Disaster · `revenue_tax` → all players · direction: negative

| Severity | Magnitude | Headline |
|---|---|---|
| major | ×0.93 | "A hurricane makes landfall, downing transmission lines along the coast — restoration crews are mobilizing and expect a multi-week recovery." |
| catastrophic | ×0.82 | "A catastrophic category-5 hurricane makes landfall. Transmission infrastructure is devastated across the coast — full restoration will take months." |

### A7. Flood `climate.flood`
Disaster · `revenue_tax` → all players · direction: negative

| Severity | Magnitude | Headline |
|---|---|---|
| moderate | ×0.97 | "Flash flooding knocks out two substations overnight — expect scattered outages while crews assess the damage." |
| major | ×0.93 | "Historic flooding submerges substations across the region. Widespread outages persist as crews wait for waters to recede." |
| catastrophic | ×0.85 | "Catastrophic, once-in-a-generation flooding overwhelms flood defenses across the region. Dozens of substations are underwater, and full recovery will take months." |

---

## B. Price-shock / geopolitical

`effect.kind: facility_price`, single-shot (`severities: [base]`), `boundary_type: round`. The price-application
mechanism itself is [NPC fuel market spec (#923)](https://github.com/felixvonsamson/Energetica/issues/923)'s call;
this catalog assumes the interface exists.

### Negative

| Vignette | id | Target(s) | Magnitude | Headline |
|---|---|---|---|---|
| War disrupts wind-turbine supply chain | `geo.wind_supply_war` | `wind_turbine` | ×1.35 | "The country that is the main producer of wind-turbine parts is embroiled in a civil war. Costs are expected to rise 35% next quarter." |
| Unrest in polysilicon-refining region | `geo.polysilicon_unrest` | `pv_panel` | ×1.25 | "Export controls from the region that refines most of the world's polysilicon send solar panel prices climbing." |
| Rare-earth magnet export ban | `geo.rare_earth_ban` | `wind_turbine`, `battery_storage` | ×1.20 | "A leading rare-earth exporter halts magnet shipments overnight — wind turbine and battery manufacturers scramble for alternatives." |
| Sanctions on uranium-enriching nation | `geo.uranium_sanctions` | `nuclear_fuel` | ×1.30 | "New sanctions target the world's largest uranium enrichment facility. Utilities relying on its fuel brace for a price spike." |
| Gas pipeline disruption | `geo.gas_pipeline_disruption` | `gas_fuel` | ×1.50 | "A key gas pipeline is shut down amid a dispute between transit nations. Spot prices spike as buyers scramble for alternatives." |
| Coal-region strike / nationalization | `geo.coal_nationalization` | `coal_fuel` | ×1.25 | "A wave of nationalizations sweeps the country's coal industry. Analysts warn of supply disruptions and price hikes." |
| Shipping-lane blockade | `geo.shipping_blockade` | `battery_storage`, `pv_panel` | ×1.08 | "A blockade at a critical shipping chokepoint delays battery and solar-panel shipments worldwide — expect modest cost increases on both." |
| Semiconductor / chip shortage | `geo.chip_shortage` | `storage_electronics` | ×1.15 | "A fire at a major chip fabrication plant tightens an already strained semiconductor market — grid electronics get pricier." |
| Lithium-mine nationalization / export tax | `geo.lithium_export_tax` | `battery_storage` | ×1.30 | "The country holding the world's largest lithium reserves imposes a new export tax — battery storage costs jump." |

### Positive

| Vignette | id | Target(s) | Magnitude | Headline |
|---|---|---|---|---|
| New free-trade agreement | `geo.pv_trade_agreement` | `pv_panel` | ×0.85 | "A new trade agreement drops tariffs on imported solar panels — installers pass the savings on." |
| New domestic gas reserves discovered | `geo.gas_discovery` | `gas_fuel` | ×0.80 | "A major new gas field comes online ahead of schedule, easing supply concerns and pushing prices down." |
| Diplomatic resolution ends a regional conflict | `geo.conflict_resolution` | *(dynamic — whichever fuel is currently elevated; moderator resolves at pick-time)* | ×0.85 | "A ceasefire agreement ends months of fighting in a key fuel-exporting region — prices ease as shipments resume." |
| New PV megafactory comes online | `geo.pv_megafactory` | `pv_panel` | ×0.80 | "A newly opened gigafactory floods the market with cheap solar panels, undercutting existing suppliers." |
| Exporter currency devaluation | `geo.turbine_devaluation` | `wind_turbine` | ×0.90 | "A sharp currency devaluation in a major turbine-exporting country makes its products suddenly cheaper on the world market." |

---

## C. Demand-shift

`effect.kind: demand_amplitude_shift` → `demand.amplitude`, single-shot (`severities: [base]`),
`boundary_type: round` for every vignette in this category (resolution #6).

### Positive (demand up)

| Vignette | id | Magnitude | Headline |
|---|---|---|---|
| Heat-pump adoption wave | `demand.heat_pump_wave` | ×1.08 | "A national subsidy program triggers a wave of heat-pump installations — electricity demand for heating climbs." |
| Widespread AC adoption | `demand.ac_adoption` | ×1.06 | "Rising incomes and a run of hot summers drive a boom in home air-conditioning uptake." |
| EV adoption tipping point | `demand.ev_tipping_point` | ×1.12 | "Electric vehicles cross the halfway mark of new car sales in the region — charging load becomes a real factor on the grid." |
| Data-center boom | `demand.data_center_boom` | ×1.18 | "A cluster of new data centers breaks ground in the region, drawn by cheap land and grid capacity — a major new source of steady load." |
| Industrial reshoring | `demand.industrial_reshoring` | ×1.10 | "A heavy-industry manufacturer relocates its main plant to the region, bringing a large new block of industrial demand with it." |
| Population boom | `demand.population_boom` | ×1.05 | "Strong inward migration pushes the region's population — and its electricity demand — to a new high." |

### Negative (demand down)

| Vignette | id | Magnitude | Headline |
|---|---|---|---|
| Economic recession | `demand.recession` | ×0.90 | "A sharp economic downturn curbs industrial activity and consumer spending alike — electricity demand softens across the board." |
| Pandemic lockdown | `demand.pandemic_lockdown` | ×0.82 | "A new public-health emergency shutters offices and factories overnight — demand drops sharply and suddenly." |
| Energy-efficiency mandate | `demand.efficiency_mandate` | ×0.94 | "A sweeping building-insulation program starts paying off — homes and offices need noticeably less energy to heat and cool." |
| Major plant closure / offshoring | `demand.plant_closure` | ×0.91 | "The region's largest industrial employer announces it's moving production overseas — a major block of demand disappears with it." |
| Population decline | `demand.population_decline` | ×0.95 | "A wave of outward migration leaves the region with fewer residents — and less demand — than the year before." |

---

## D. Technology unlocks

`effect.kind: facility_unlock`, direction: `null`, `boundary_type: round`, `severities: [base]`, no numeric
`magnitude` (unlock is binary, not a shift). D1–D6 fire when cumulative session-wide investment in the prerequisite
crosses the [#917](https://github.com/felixvonsamson/Energetica/issues/917) threshold (magnitude of the threshold
itself deferred to balance tuning, per [#975](https://github.com/felixvonsamson/Energetica/issues/975)). One
hand-authored headline per technology, no shared template (per Felix).

| Technology | id | Prerequisite | Headline |
|---|---|---|---|
| D1. Gen-4 nuclear | `tech.gen4_nuclear` | Nuclear | "A consortium of utilities announces the region's first Gen-IV reactor design cleared for construction — smaller, safer, and able to burn spent fuel from older plants." |
| D2. Solid-state battery | `tech.solid_state_battery` | Battery storage | "Sustained investment in battery storage pays off: solid-state cells hit commercial scale, offering higher density and a longer lifespan than conventional lithium-ion." |
| D3. Multi-layer (tandem) PV | `tech.tandem_pv` | Solar PV | "A breakthrough in tandem cell technology puts a new generation of solar panels on the market — cheaper per watt and meaningfully more efficient than last year's models." |
| D4. Next-gen wind turbine | `tech.next_gen_wind` | Wind | "A new turbine platform ditches the traditional gearbox for a direct-drive design — fewer moving parts, less downtime, and a bigger rotor sweep per unit installed." |
| D5. Modernized hydro | `tech.modern_hydro` | Hydro | "A new dam-construction technique cuts both the cost and build time of hydroelectric projects, drawing on lessons from a wave of recent projects abroad." |
| D6. Combined-cycle gas | `tech.combined_cycle_gas` | Gas (simple-cycle) | "The region's gas fleet gets an upgrade: combined-cycle plants recover waste heat to generate extra power from the same fuel, lifting efficiency well past older simple-cycle units." |

### D7. Full-season storage availability `tech.full_season_storage`

Not investment-triggered — fires when the Advanced/full-season trading-round-format lever
([#917](https://github.com/felixvonsamson/Energetica/issues/917)) activates for a round, making both full-season-only
storage types buildable at once ([facility catalog #975](https://github.com/felixvonsamson/Energetica/issues/975):
Hydrogen storage, Pumped hydro). See the implementer note above — this needs its own trigger-type handling, not the
investment-threshold path D1–D6 use.

| Headline |
|---|
| "Longer trading horizons open the door to new storage technologies: hydrogen storage and pumped hydro plants are now available to build." |

---

## E. Carbon-tax vote outcome

`category: vote`, direction: `null`, `boundary_type: round`. Two independent bits (enacted/rejected × close/clear
margin) rather than a graded severity ladder — doesn't fit the standard `severities`/`magnitude` shape, kept as its
own table (see implementer note above).

| Outcome | id | Headline |
|---|---|---|
| Enacted | `vote.carbon_tax_enacted` | "Vote result: the carbon tax passes. Emitting facilities face a new per-tonne levy starting next round." |
| Enacted (close vote) | `vote.carbon_tax_enacted_close` | "Vote result: the carbon tax squeaks through by a narrow margin. Emitting facilities face a new per-tonne levy starting next round." |
| Rejected | `vote.carbon_tax_rejected` | "Vote result: the carbon tax fails at the ballot. No change to emissions costs — for now." |
| Rejected (close vote) | `vote.carbon_tax_rejected_close` | "Vote result: the carbon tax narrowly fails. Supporters vow to bring it back next round." |
