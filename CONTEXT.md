# Energetica — Context Glossary

Project-wide glossary of domain terms. Energetica spans several distinct contexts;
this file indexes them and defines the vocabulary for each as it gets documented.
Terms are pinned per-context to keep overloaded words (e.g. three different things
that all sound like "saving") unambiguous.

## Contexts

- **Persistence & Replay** — how the backend persists game state and reconstructs it
  on startup. _Documented below._
- **Electricity-market simulation** — production, markets, climate events, the tick
  loop. _Not yet documented._
- **Accounts & users** — players, server-wide accounts, auth, the lobby. _Documented below._
- **Real-time sync** — socket.io state propagation to the frontend. _Not yet documented._
- **Frontend** — TSX/Tailwind app and the generated API type bridge. _Not yet documented._
- **Workshop Mode** — the moderated, Round-based Run type (#992). _Partly documented below._

When a new context's terms get pinned, add a `## <Context>` section below (or split
into a `CONTEXT-MAP.md` + per-context files if this grows unwieldy).

---

## Persistence & Replay

Overloaded in the code — three different operations all sound like "saving" — so the
terms below are pinned.

### Language

#### Persistence artifacts

**Action log**:
The append-only, line-delimited JSON record of every game event since `init_engine`,
written to `instance/actions_history.log`. The authoritative event source; the ground
truth from which any game state can be reconstructed by replay.
_Avoid_: history file, log (ambiguous with console log).

**Save**:
A pickle of in-memory engine state to `instance/engine_data.pck`, taken every 10 min.
A point-in-time snapshot, not a full backup — it does not include the rest of `instance/`.
_Avoid_: dump, snapshot (reserve "snapshot" for informal use).

**Checkpoint**:
A gzipped tarball of the entire `instance/` directory (which includes a fresh **save**),
taken every 6 h, written to `checkpoints/last_checkpoint.tar.gz`. The unit of disaster
recovery.
_Avoid_: backup, save (a checkpoint contains a save but is not one).

#### Replay

**Replay**:
Re-executing **action log** entries that occur strictly after a known tick to bring
restored state up to the present. Performed by `simulate.py`.

**Loaded tick**:
`engine.total_t` immediately after a **save**/**checkpoint** is loaded — the tick the
restored state is current as of. Replay starts from the action immediately after the
log entry whose `total_t` equals the loaded tick.
_Avoid_: checkpoint tick (the loaded tick usually comes from a 10-min **save**, not a
6-h **checkpoint**).

**Action**:
A single logged event. One of four discriminated types (`action_type`): `init_engine`
(always log line 0), `tick`, `create_user`, `request`. The `request` type carries
arbitrary user-controlled JSON payloads.

#### Upgrading

**Migration**:
A step that converts stored data from the shape an older version of the code wrote into
the shape the newer version expects, so the newer code can read it. There are two kinds.
A **schema migration** changes the tables of a SQL database, such as `accounts.db`. A
**state migration** changes a run's saved state, such as a freeplay **save** or a workshop
session. A code change that reads the same data but simulates differently is not a
migration: nothing needs converting.

### Relationships

- A **checkpoint** contains exactly one **save** plus the rest of `instance/`.
- Disaster recovery = restore a **checkpoint** (or **save**) + **replay** the **action
  log** from the **loaded tick** forward. This requires the **action log** to be
  complete from `init_engine`; truncating it below a tick destroys the ability to
  replay from any earlier **loaded tick**.
- Only **actions** after the **loaded tick** are needed at startup; everything before
  is read solely to locate the **loaded tick**'s log line.

### Flagged ambiguities

- "checkpoint tick" vs "loaded tick": on a normal restart the **loaded tick** comes
  from the 10-min **save**, not the 6-h **checkpoint** — so replay typically covers
  ~10 min of actions, not ~6 h. Resolved: use **loaded tick** for the replay boundary.
- "the log" meant both the **action log** (file) and the console logger in code.
  Resolved: **action log** is always the persisted event source.

---

## Accounts & users

The core identity terms — **Server**, **Instance** (player-facing: **Run**), **Account**,
**User**, **Player** — are defined in the Terminology table of
`docs/architecture/static-serving-and-deployment.md`. Pinned below are the terms this
project's lobby / instance-picker work adds or sharpens.

### Language

**Lobby**:
The server-wide front door: where a player signs up, logs in (once, server-wide), and
picks which **run** to enter or rejoin. Lives on its own subdomain (`lobby.{apex}`) with a
small backend, separate from any run, and **outlives** individual runs (runs are created
and deleted; the lobby is not). It is the public front door only: like every run, it is a
client of the **accounts service** (ADR-0009).
_Avoid_: landing (the **landing** is the pure-static marketing site on the apex; the lobby
is the authenticated identity surface — distinct origins, distinct purposes).

**Accounts service**:
The one process that owns accounts, server-wide sessions and memberships. It is reachable only from
the same server. The lobby, every run and the operator scripts are its clients (ADR-0009). It knows
whether an account has **joined a run**, but nothing about settling.
_Avoid_: lobby (the lobby is a client of the accounts service, not the owner of accounts).

**Joined a run**:
An account that has explicitly, deliberately joined a run — the lobby's two-click join for a
public run (#1030), or a private run's roster add / join-link confirm — recorded as a row in
`instance_membership` the moment that happens, before the account has necessarily settled. The
lobby's "your runs" view is keyed on this, not on settling. See the flagged ambiguity below.

**Settled**:
An account that has picked a tile — has a **Player** in that run's engine. A later, separate
step from joining, and a freeplay engine act only: the **accounts service** does not record it
(ADR-0009; `instance_membership`'s `settled_at` is vestigial and being removed).

**Server-wide session**:
The single authenticated session a player gets from the lobby, carried to every run on the
server. Distinct from the per-run **User**/**Player** state it unlocks.

### Flagged ambiguities

- **"Membership": joined vs settled.** Originally resolved as membership = settled (has a
  Player) — see ADR-0002/CONTEXT history — specifically to keep a *silent* auto-provisioned
  entry on a public run's first visit from cluttering "your runs" with runs never actually
  played. #1030 revisits this: the lobby's two-click join is itself a deliberate act (not
  silent), so it now writes `instance_membership` immediately, before settling. Currently
  resolved: **membership = joined** (settled or not). Whether a member has settled is known
  only to the run's engine (ADR-0009). A silently auto-provisioned account on a run it never
  explicitly joined still does **not** count as membership — the entry gate's auto-provision
  step itself writes nothing here.

---

## Workshop Mode

### Language

**Facilitator**:
The person at the console: they advance the session, plan each Round, pick events and extend
phases. It is the instance's one elevated role (`docs/architecture/roles.md`). A facilitator has an
account but no player, so they never play.
_Avoid_: moderator, for this role.

**Moderator**:
The person in the room who speaks to the players and leads the session out loud. One person can
be both the moderator and the facilitator, but it can also be two people. The moderator is not a
role in the product: nothing in the code checks for it.

**Facility type pool**:
All of a player's facilities of one type, simulated as a single facility whose power (and, for
storage, capacity) is scaled by how many there are. Individual facilities have no output or charge
of their own; only their lifetimes are tracked one by one.
_Avoid_: unit SOC, per-facility charge.

**Stored energy**:
The energy one storage **facility type pool** holds, in Wh. Its state of charge (SOC) is that energy
over the pool's combined capacity. It belongs to the type, never to the category: lithium-ion energy
cannot become solid-state energy, even though the two are tiers of the same category.

**Reinvest-or-lose** (#1001):
When storage retires, its **stored energy** stays with the type while the pool's capacity shrinks.
Whatever no longer fits is lost when that Round's Investment phase closes, unless the player builds
more of the same type in it. Example: three batteries of capacity 100 hold 150 (SOC 50%). Replaced by
two, they hold 150 (SOC 75%). Replaced by one, it holds 100 (SOC 100%) and 50 is lost.

**Workshop year** (#1004):
364 days, so each of the four seasons is exactly 13 weeks (91 days). Day 0 is a Monday, and spring starts
on day 56, the Monday closest to 1 March, so every season starts on a Monday. Winter runs over the end of the
year. The demand curve and the weather use this year length. The demand curve (#1201) is French national
consumption at 15-minute steps, with its weekends, lined up so its year also starts on a Monday.

**Round format** (#1004, #1190):
The three levers that say how a Round's Trading periods are simulated: the **trading-round format**
(representative week or full season), the clearings per day (24, 96 or 288), and the storage
availability (none, batteries only, or every type). Each Round's format is part of its **Round plan**,
so it is set per Round and **locked** a Round ahead. Every storage type needs the full-season format. If a
later Round switches back, storage already built keeps running, but no more of it can be bought.

**Round plan** (#1190):
One Round's levers (its **round format**, **fuel procurement** and whether it holds a carbon tax **vote**)
and the **events** planned for it.
The session holds one per Round. The facilitator can edit any Round's plan until it is **locked**.
Changing a lever in one Round also changes it in every later Round: only the levers that changed carry,
each on its own, and a change that would leave a later Round invalid is refused. Events never carry. The
phase timers are not part of a plan: they apply to the next phase that opens.

**Default plan** (#1190):
The levers the workshop recommends for each Round, a fixed list. When a session is created, each
Round's **Round plan** is copied from it: a shorter session uses the start of the list, and a longer one
repeats its last entry. It holds levers only, never events.

**Lock** (#1190):
When a **Round plan** can no longer change, because players have been told what it holds. Round 1's plan
locks when the session starts, and Round N+1's when Recap N opens, since the Recap tells players what
comes next. Which Rounds are locked follows from where the session is.
_Avoid_: freeze, commit.

**Added Round** (#1298):
A Round the facilitator adds after the last one, such as when the room moves faster than planned.
It can be added until the last Round's Recap opens, since that Recap shows the final scores, and it cannot be
removed. Its **Round plan** copies the last Round's levers, without its events. Everything that depends on which
Round is the last follows the new count: the loan can be taken in what was the last Round, a loan payment that
was due after the end is taken as the added Round starts, demand keeps growing, and residual value counts from the
new end. Only the **session-length price** stays as it was.

**Representative week** (#1164, ADR-0008, #1198):
The seven simulated days that stand for a whole Trading period in representative-week mode: the middle
week of its season, cleared at the Round's clearings per day. Its trading money and energy are scaled ×13
(the weeks in a season) to give the period's total. O&M is not scaled, since it is already one period's
share. Its sun position and seasonal wind are its own, and so is the
shape of its demand, scaled so that its average matches the season's. Its wind and solar weather are
**borrowed** from the 7-day runs of the season whose output comes closest to the season's real average. **Stored energy** starts each week at its **cyclic start** and does not
carry over between periods.
It replaced the representative day, the middle day of the season scaled ×91 (#1003).
_Avoid_: sample week, typical week, representative day.

**Borrowed weather** (#1164, ADR-0008):
The weather a **representative week** takes from another 7-day run of its season: the wind noise for
wind, and the clear-sky index (cloud cover) for solar. Only the weather is borrowed, never the output,
so the sun and the seasonal wind still follow the week's own dates.

**Cyclic start** (#1164, ADR-0008):
The **stored energy** a **representative week** starts with: what the week ends with when cleared once from empty,
so that clearing it again starts and ends at about the same charge and the ×13 scaling counts only real
trading. The jump from the previous period's charge is not priced.

**Full season** (#1004):
In full-season mode, all 91 days of a Trading period's season are simulated one after another and
added up, with no scaling. **Stored energy** carries from one day to the next.

**Settling a Trading period** (#1003, #1004):
What happens once a Trading period's price-setting window closes: each player's prices are locked,
the days the **round format** calls for are simulated in the background, and each player is paid its
result. The facilitator can close the window early by advancing, as with the Investment phase, but the
session only leaves the period once it is settled, and cannot advance while the simulation runs. A
period is settled once.

**Settlement point** (#1007):
One clearing of the market within a Trading period's simulated days: there are as many per day as the
round format's clearings per day. The review charts step through a period one settlement point at a time.
_Avoid_: tick, timestep.

**Trading-period record** (#1007):
Everything a settled Trading period did at each of its settlement points, kept at full resolution for its
review: the price and cleared power, each player's generation, dumping, charging and stored energy per
facility type, what each demand tier was served, and every bid placed, sold or not, from which the merit
order at any point is rebuilt. It is saved to its own file beside the session's.

**Operating profit** (#1006):
All of a player's trading income, after any climate-event `revenue_tax`, minus their operating costs:
O&M, fuel bought, the energy storage bought to charge, and renewable output dumped unsold. Fuel counts
when it is bought, not when it is burned, since its price changes over time. Facility investments, the
carbon tax, the floor top-up and the **blackout cost** are left out. Summed over the session, it is the first
term of the final score.
_Avoid_: revenue, gross proceeds, net.

**Floor top-up** (#1016, #1286):
Cash carries forward from Round to Round. As a new Round starts, a player holding less than 70% of the
Round-1 starting budget (35M of 50M) is topped up to exactly that. The top-up is silent.

**Blackout**, **rationing** and **blackout cost** (#1005, #1286):
A blackout is a clearing that leaves must-serve demand unserved: the grid goes down for a day, or until the
end of the Trading period if that comes first. It then restarts with electricity rationed: demand is cut by
10% for the rest of the Round, and by another 10% after each further blackout, which can happen in the same
Trading period or a later one. The next Round starts with demand back at its full level. When the Recap
opens, each blackout in the Round costs every player 30% of their operating profit for it, up to all of it;
a player who made a loss pays nothing. The cost comes out of cash, and the balance sheet shows it below
operating income, but it never changes a score.
_Avoid_: blackout reset (removed in #1286).

**Final score** and **residual value** (#1017, #1222):
A player's final score is their operating profit over the whole session, minus their **investments** (what
they paid for every facility they bought, price shocks included, plus the cost of any **loan**), minus the carbon tax they paid less
their shared payback, plus the residual value of the facilities they still own. Cash is not part of it, so the
floor top-up and the blackout cost never change a score. A facility's residual value is its price for
the session's length (see **session-length price**) times the share of its lifetime left once the session is
over, counting only the Rounds after the last one. A facility still under construction keeps its whole lifetime, so it pays back its full price.
The energy a storage facility holds is worth nothing. The **scoreboard** ranks every player by score, and
everyone in the Run sees it all game (#1250). Mid-game it uses the same formula over the Rounds completed so
far (a Round is completed once its Recap opens), with residual value counted from the Round after the last
completed one. So it changes once per Round, and after the last Round it is the final score.
_Avoid_: leaderboard, salvage value.

**Session-length price** (#1306):
What a long-lived facility costs in a session, fixed for the whole session by how many Rounds it starts with. Nuclear
reactors and water dams earn for fewer Rounds in a short session, so they cost less there: a nuclear reactor costs
53M in a session of 3 Rounds or fewer, 60M in one of 4 and 70M in a longer one. Every other facility costs its
catalog price whatever the length. Price shocks apply on top. A Round **added** once the session has started
leaves the prices as they were. One added before it starts prices for the new length.

**Loan** (#1225):
Money a player borrows to invest more than their cash allows: 50M, once per session, taken in an open
Investment phase in any Round but the last. It is added to their cash straight away, and they can cancel it
until the phase closes, as long as their selection still fits without it. It is paid back in two payments of
30M, taken as the next two Rounds start, before the floor top-up; a payment due after the last Round is
taken when the session ends. The final score counts the 10M it costs as an investment with no residual
value, whatever the floor top-up does to the payments.
_Avoid_: credit, debt (a player's cash can go negative without a loan).

**Balance sheet** (#1008):
A player's statement for one Round, shown on the Round overview: a column per season and one for the
Round. Market income, dumping cost, O&M, any revenue tax and fuel cost add up to the season's operating income.
Any **carbon tax** comes below it; the Round column then takes off the Round's investments to give its **net
profit**. A season fills in once it is settled. A **loan** and its payments show in a financing section
below net profit, apart from it.
Market income already has the cost of the energy storage bought to charge taken off.
_Avoid_: recap (the Recap is the narrative page between Rounds), income statement.

**Carbon tax** (#1015):
The tax a passed **vote** puts in force, settled in every Trading period from that Round on. Each player pays a
fixed price per kg of CO₂ their facilities emitted generating in the period. In a Round's first Trading period, they
also pay on the CO₂ emitted building what they bought in its Investment phase. Everything paid makes up the
period's takings, shared out equally among the players settled in the period: the **shared payback** (`carbon_tax_share`
in the code). It is left out of operating profit, and the Round's **net profit** takes it off.
_Avoid_: emissions tax, carbon price.

**Fuel procurement** (#1009, #1190):
How players get fuel, a lever set per Round in its **Round plan**. Under **automatic** procurement, a
player pays for the fuel their facilities burned, less what their stock covered. Under **manual**
procurement, they buy each fuel in the price-setting window, and its cost is charged when the period is
settled. Their facilities can burn only the fuel they hold plus what they bought: once it runs out, those
facilities produce less, and the next window notes that it ran out (#1010). Either way fuel is paid for at the season's price, which moves a little each season and jumps
when a price shock lands.

**Season need** (#1009):
The fuel a player's operating facilities burn running at full output for a whole season. The first
manual order of a fuel defaults to half of it (#1224). After that, an order defaults to what the player bought
last time.

**Stockpile limit** (#1009):
The most fuel of one type a player may hold: 3 times its season need. An order that would go over it is
cut down to fit. Unused fuel carries over, and fuel left at the end of the session is worth nothing.

**Unlock** (#1011):
A facility becoming available to buy partway through a session, kept so the Recap can announce it.
An **upgrade tier** unlocks once the money every player has spent buying its **base tier** reaches the
unlock threshold, which is the same for every technology and grows with the number of players. That is
checked when a Round ends, and the upgrade can be bought from the next Round. Concentrated solar power
unlocks from a set Round instead, and hydrogen storage and pumped hydro the first Round that allows
every storage type, checked at the Recap before it, or when the session starts for Round 1. That Round's
plan is **locked** by then, so what the Recap announced holds. Only the facilitator sees how close an
unlock is.
_Avoid_: tech tree, research.

**Event** (#1012, #1189, #1190):
A named vignette from a fixed catalog, such as a heatwave, a gas pipeline disruption or an EV tipping
point, in one of three categories: climate, price shock or geopolitics, and demand shift. The facilitator
**plans** an event and one of its severities for a Round, and a seasonal event also for a season. It can
be changed or dropped until the Round's plan is **locked**. A Round event **fires** when the Round's
Investment phase opens, and a seasonal event when its season's Trading period opens. Each category holds
at most one event per **boundary**: one per Round, or one per season for a seasonal event. Round 1 holds
none. A fired
event's headline is told at the Recap, and nobody, the facilitator included, sees it before. The Recap
before a Round also tells what the Round holds: a Round event with its exact effect, and a seasonal event
only as a **forecast** that names its season, gives no figures, and sounds more certain the more severe
the event is.
_Avoid_: lever (a lever is a setting that stays; an event fires once), scenario.

**Peak demand** (#1013):
The most the market cleared at one **settlement point** in a Round, kept as the Round's Trading periods settle:
a clearing that clears more than the peak so far replaces it. It is must-serve demand before any **rationing**,
since rationing ends with the Round.
The Recap forecasts next Round's peak as this one grown by **demand growth** and moved by the demand shifts that
start next Round.

**Demand growth** (#1226):
How much demand grows from one Round to the next, before any event. Each Round after the first has a growth
factor, and its demand is the Round before's times that factor, so demand grows exponentially. The factor for
Round N+1 is worked out when Recap N opens, from the room's average operating profit per player in Round N: the
more the room earned, the faster demand grows, within a floor and a cap. It counts the profit before any **blackout
cost**. The Recap announces the growth as a percentage, without the formula. The demand
shifts of events multiply on top of it.
_Avoid_: player progression, demand trend.

**Recap** (#1013):
The page between two Rounds, printed as a newspaper, The Megawatt Times. Recap N has two sections kept
strictly apart. **The Year in Review** tells what happened in Round N: each event that fired, with its
headline and a line of plain numbers such as "Demand +18% for the summer", the day and hour of each blackout with what it cost,
the room's figures, and how each season's wind and sunshine compared with a normal season (#1200). **The
Year Ahead** tells what Round N+1 holds: its unlocks, a carbon tax **vote** if it holds one, its Round
events with their exact effect, the **demand growth** and the change in peak demand, and its seasonal events as
**forecasts**. The
last Round has a "Final Edition" instead. Everyone in the Run reads the same Recap, and only once it has
opened. Not to be confused with a persistent-world run's recap (ADR-0005), which is a final table of
players.
_Avoid_: summary, report.

**Vote** (#1014):
Players deciding together, with a yes or no ballot, whether a carbon tax applies. The facilitator proposes
it by turning on a Round's carbon tax vote lever, and the Recap before that Round announces it, so Round 1
holds no vote. Players vote
while the Round's Investment phase is open, and can change their ballot until it closes. The vote passes
with more yes than no among the ballots cast; a tie or no ballot at all fails. Nobody sees the tally, not
even the facilitator: everyone sees only the result, announced when the Round's first Trading period opens.
A carbon tax that passes stays for the rest of the session. Once a vote closes, its lever turns off in the
later Rounds, so a failed tax can be proposed again.
_Avoid_: poll, referendum.

**Revenue tax** (#1012):
The share of every player's sale revenue a climate disaster (a drought, wildfire, hurricane or flood)
takes in the Trading period it fires at. The same share for every player.
