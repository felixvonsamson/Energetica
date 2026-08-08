# Workshop Mode — Event & headline catalog (PROTOTYPE, throwaway)

Prototype for [Event headline library (#919)](https://github.com/felixvonsamson/Energetica/issues/919), part of the
[Workshop Mode map (#880)](https://github.com/felixvonsamson/Energetica/issues/880). Not production content — a
big draft to react to and cut down. Lives on branch `prototype/919-event-headlines`; nothing here is wired to code.

## Shape

Each event is a **named vignette**, not just an abstract severity tier. The moderator's round-config page (built in
[#918](https://github.com/felixvonsamson/Energetica/issues/918)) lists vignettes per category as a pool of tiles;
picking one adds it to next round, with its suggested effect shown as an editable field. Some vignettes carry their
own severity sub-levels (a graded family — e.g. Heatwave: Minor/Moderate/Major); others are single-shot (a war
either starts or it doesn't).

```yaml
event:
  id: geo.wind_supply_war              # stable slug: <category>.<short_name>
  category: price_shock_geopolitical   # climate | price_shock_geopolitical | demand_shift | tech_unlock | vote
  direction: negative                  # negative | positive | null (tech_unlock, vote — not meaningful there)
  name: "War disrupts the wind-turbine supply chain"     # moderator-facing tile label
  effect:
    target: facility_price.wind_turbine   # points at a still-fog price-multiplier interface — owned by #923 (NPC fuel market) for fuels, TBD for equipment capex
    suggested_magnitude: "+35%"
    moderator_editable: true
  severities: [base]                   # or [minor, moderate, major] for graded families
  headlines:
    base:                              # rotation pool for this severity level, 3-5 entries
      - "The country that is the main producer of wind-turbine parts is embroiled in a civil war. Analysts expect turbine costs to rise sharply next quarter."
      - "…"
```

Only a couple of headline variants are drafted per entry below (to judge tone/breadth) rather than the full 3-5 —
padding out the rotation pool is mechanical once the vignette list itself is settled.

---

## A. Climate

Effects target **demand** (heating/cooling load, reliability strain during the event) — not generation output, to
avoid colliding with the parked "renewable-output weather variability" lever (#917). Flag if that should change.

| Vignette | Severity levels | Suggested effect | Sample headline |
|---|---|---|---|
| Heatwave | Minor / Moderate / Major | demand_amplitude +3% / +8% / +18% (cooling load) | Moderate: "A regional heatwave pushes cooling demand to a five-year high — expect tighter margins this quarter." |
| Cold snap | Minor / Moderate / Major | demand_amplitude +4% / +10% / +22% (heating load, heat-pump COP drop) | Major: "An arctic cold snap sends heating demand soaring — heat pumps strain to keep up as outdoor temperatures plunge." |
| Drought | Moderate / Severe | hydro facility O&M/reliability note (no output derate, per the parked-lever constraint — framed as a narrative-only flag) or demand_amplitude small increase (more AC/pumping) | Severe: "A record drought grips the region. Reservoirs sit at historic lows; water-use restrictions loom." |
| Wildfire season | Moderate / Major | demand_amplitude +2%/+5% (evacuation shelters, AC), transmission-reliability flavor | Major: "Wildfires force the evacuation of two substations — grid operators reroute power across the region." |
| Hurricane / tropical storm | Major / Catastrophic | demand_amplitude volatility flag, transmission-reliability note | Catastrophic: "A category-4 hurricane makes landfall. Transmission lines are down across the coast; restoration crews are mobilizing." |
| Flood | Moderate / Major | demand_amplitude volatility flag, transmission-reliability note | Moderate: "Flash flooding knocks out two substations overnight — expect scattered outages while crews assess the damage." |
| Mild / favorable season *(optional positive)* | base | demand_amplitude −3% (both heating and cooling load down) | "An unusually mild season keeps both heating and cooling demand low — a quiet quarter for grid operators." |

---

## B. Price-shock / geopolitical

Effect target is a fuel or equipment-capex price multiplier — the actual price-application mechanism is
[NPC fuel market spec (#923)](https://github.com/felixvonsamson/Energetica/issues/923)'s call; this catalog assumes
the interface exists and cross-links rather than resolves it.

### Negative

| Vignette | Suggested effect | Sample headline |
|---|---|---|
| War in the main wind-turbine-parts-producing country | wind turbine capex +35% | "The country that is the main producer of wind-turbine parts is embroiled in a civil war. Costs are expected to rise 35% next quarter." |
| Unrest in the main polysilicon-refining region | PV panel capex +25% | "Export controls from the region that refines most of the world's polysilicon send solar panel prices climbing." |
| Rare-earth magnet export ban | wind turbine + battery capex +20% | "A leading rare-earth exporter halts magnet shipments overnight — wind turbine and battery manufacturers scramble for alternatives." |
| Sanctions on the main uranium-enriching nation | nuclear fuel cost +30% | "New sanctions target the world's largest uranium enrichment facility. Utilities relying on its fuel brace for a price spike." |
| Gas pipeline disruption | gas price +50% | "A key gas pipeline is shut down amid a dispute between transit nations. Spot prices spike as buyers scramble for alternatives." |
| Coal-region strike / nationalization | coal price +25% | "A wave of nationalizations sweeps the country's coal industry. Analysts warn of supply disruptions and price hikes." |
| Shipping-lane blockade | broad equipment capex +8% (diversified, all facility types) | "A blockade at a critical shipping chokepoint delays deliveries worldwide — expect modest cost increases across the board." |
| Semiconductor / chip shortage | grid inverter & storage electronics capex +15% | "A fire at a major chip fabrication plant tightens an already strained semiconductor market — grid electronics get pricier." |
| Lithium-mine nationalization / export tax | battery storage capex +30% | "The country holding the world's largest lithium reserves imposes a new export tax — battery storage costs jump." |

### Positive

| Vignette | Suggested effect | Sample headline |
|---|---|---|
| New free-trade agreement | PV panel capex −15% | "A new trade agreement drops tariffs on imported solar panels — installers pass the savings on." |
| New domestic gas reserves discovered | gas price −20% | "A major new gas field comes online ahead of schedule, easing supply concerns and pushing prices down." |
| Diplomatic resolution ends a regional conflict | affected fuel price −15% (whichever is currently elevated) | "A ceasefire agreement ends months of fighting in a key fuel-exporting region — prices ease as shipments resume." |
| New PV megafactory comes online | PV panel capex −20% | "A newly opened gigafactory floods the market with cheap solar panels, undercutting existing suppliers." |
| Exporter currency devaluation | wind turbine capex −10% (temporary) | "A sharp currency devaluation in a major turbine-exporting country makes its products suddenly cheaper on the world market." |

---

## C. Demand-shift

Effect target is the per-Round `amplitude` scalar ([#911](https://github.com/felixvonsamson/Energetica/issues/911)).

### Positive (demand up)

| Vignette | Suggested effect | Sample headline |
|---|---|---|
| Heat-pump adoption wave | amplitude +8% | "A national subsidy program triggers a wave of heat-pump installations — electricity demand for heating climbs." |
| Widespread AC adoption | amplitude +6% | "Rising incomes and a run of hot summers drive a boom in home air-conditioning uptake." |
| EV adoption tipping point | amplitude +12% | "Electric vehicles cross the halfway mark of new car sales in the region — charging load becomes a real factor on the grid." |
| Data-center boom | amplitude +18% | "A cluster of new data centers breaks ground in the region, drawn by cheap land and grid capacity — a major new source of steady load." |
| Industrial reshoring | amplitude +10% | "A heavy-industry manufacturer relocates its main plant to the region, bringing a large new block of industrial demand with it." |
| Population boom | amplitude +5% | "Strong inward migration pushes the region's population — and its electricity demand — to a new high." |

### Negative (demand down)

| Vignette | Suggested effect | Sample headline |
|---|---|---|
| Economic recession | amplitude −10% | "A sharp economic downturn curbs industrial activity and consumer spending alike — electricity demand softens across the board." |
| Pandemic lockdown | amplitude −18% | "A new public-health emergency shutters offices and factories overnight — demand drops sharply and suddenly." |
| Energy-efficiency mandate | amplitude −6% | "A sweeping building-insulation program starts paying off — homes and offices need noticeably less energy to heat and cool." |
| Major plant closure / offshoring | amplitude −9% | "The region's largest industrial employer announces it's moving production overseas — a major block of demand disappears with it." |
| Population decline | amplitude −5% | "A wave of outward migration leaves the region with fewer residents — and less demand — than the year before." |

---

## D. Technology unlocks

One hand-authored headline per technology (per Felix — no shared template). Fires when cumulative session-wide
investment in the prerequisite tech crosses the [#917](https://github.com/felixvonsamson/Energetica/issues/917)
threshold. The six from Felix's list, plus a few more candidates to react to — none of these overlap the
out-of-scope carbon-capture-as-facility item on the map.

| Technology | Prerequisite (base tech invested in) | Sample headline |
|---|---|---|
| Gen-4 nuclear | Nuclear | "A consortium of utilities announces the region's first Gen-IV reactor design cleared for construction — smaller, safer, and able to burn spent fuel from older plants." |
| Solid-state battery | Lithium-ion battery | "Sustained investment in battery storage pays off: solid-state cells hit commercial scale, offering higher density and a longer lifespan than conventional lithium-ion." |
| Multi-layer (tandem) PV | Solar PV | "A breakthrough in tandem cell technology puts a new generation of solar panels on the market — cheaper per watt and meaningfully more efficient than last year's models." |
| Next-gen wind turbine (direct-drive, larger rotor) | Wind | "A new turbine platform ditches the traditional gearbox for a direct-drive design — fewer moving parts, less downtime, and a bigger rotor sweep per unit installed." |
| Modernized hydro (new civil-engineering technique) | Hydro | "A new dam-construction technique cuts both the cost and build time of hydroelectric projects, drawing on lessons from a wave of recent projects abroad." |
| Combined-cycle gas | Gas (simple-cycle) | "The region's gas fleet gets an upgrade: combined-cycle plants recover waste heat to generate extra power from the same fuel, lifting efficiency well past older simple-cycle units." |
| *(idea)* Floating offshore wind | Wind | "The first floating turbine platform is towed into deep water off the coast — unlocking offshore wind sites once considered too deep to build in." |
| *(idea)* Sodium-ion battery | Battery storage | "A cheaper alternative to lithium-ion reaches the market: sodium-ion cells trade some energy density for a supply chain free of scarce imported metals." |
| *(idea)* Enhanced geothermal | *(new base tech — not currently in the catalog)* | "A new drilling technique makes geothermal power viable far outside the handful of regions with naturally hot ground — engineers call it a 'hot dry rock' breakthrough." |
| *(idea)* Green hydrogen electrolyzer storage | Battery storage *(or new base tech)* | "A pilot electrolyzer plant starts turning surplus renewable power into hydrogen — a long-duration storage option that doesn't rely on scarce battery metals." |
| *(idea)* Grid-scale flow battery | Battery storage | "A vanadium flow battery installation goes live, offering a storage option that can be scaled up for duration independently of its power rating — well suited to multi-day balancing." |

---

## E. Carbon-tax vote outcome

Binary, not severity-graded.

| Outcome | Sample headline |
|---|---|
| Enacted | "Vote result: the carbon tax passes. Emitting facilities face a new per-tonne levy starting next round." |
| Enacted (close vote) | "Vote result: the carbon tax squeaks through by a narrow margin. Emitting facilities face a new per-tonne levy starting next round." |
| Rejected | "Vote result: the carbon tax fails at the ballot. No change to emissions costs — for now." |
| Rejected (close vote) | "Vote result: the carbon tax narrowly fails. Supporters vow to bring it back next round." |

---

## Open items surfaced while drafting

- **Drought's effect** avoids touching hydro output per the parked-lever constraint, but a drought that doesn't
  derate hydro reads a little toothless — worth deciding whether this is the one exception, or whether it should
  stay narrative-only like the others.
- **Enhanced geothermal / green hydrogen** would need a "base tech" to be invested in before they can unlock under
  the existing threshold mechanism — they don't have one in the current catalog (nuclear/battery/PV/wind/hydro/gas).
  Either invented as a standalone always-available unlock, or dropped.
- **Shipping-lane blockade** is the one "diversified" event that touches every facility type's capex at once rather
  than a single fuel/tech — worth confirming that's a shape the effect system should support, or whether it should
  be narrowed to a specific commodity.
