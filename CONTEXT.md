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
and deleted; the lobby is not). Owns the server-wide session.
_Avoid_: landing (the **landing** is the pure-static marketing site on the apex; the lobby
is the authenticated identity surface — distinct origins, distinct purposes).

**Joined a run**:
An account that has explicitly, deliberately joined a run — the lobby's two-click join for a
public run (#1030), or a private run's roster add / join-link confirm — recorded as a row in
`instance_membership` the moment that happens, before the account has necessarily settled. The
lobby's "your runs" view is keyed on this, not on settling. See the flagged ambiguity below.

**Settled**:
An account that has picked a tile — has a **Player** in that run's engine. A later, separate
step from joining; `instance_membership`'s `settled_at` is null until it happens.

**Server-wide session**:
The single authenticated session a player gets from the lobby, carried to every run on the
server. Distinct from the per-run **User**/**Player** state it unlocks.

### Flagged ambiguities

- **"Membership": joined vs settled.** Originally resolved as membership = settled (has a
  Player) — see ADR-0002/CONTEXT history — specifically to keep a *silent* auto-provisioned
  entry on a public run's first visit from cluttering "your runs" with runs never actually
  played. #1030 revisits this: the lobby's two-click join is itself a deliberate act (not
  silent), so it now writes `instance_membership` immediately, before settling. Currently
  resolved: **membership = joined** (settled or not); `settled_at` on the row distinguishes the
  two for player-count purposes. A silently auto-provisioned account on a run it never
  explicitly joined still does **not** count as membership — the entry gate's auto-provision
  step itself writes nothing here.

---

## Workshop Mode

### Language

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
364 days, so each of the four seasons is exactly 13 weeks (91 days). Spring starts on 1 March, and
winter runs over the end of the year. The demand curve and the weather use this year length.

**Round format** (#1004):
The three levers that say how a Round's Trading periods are simulated: the **trading-round format**
(representative day or full season), the clearings per day (24, 96 or 288), and the storage
availability (none, batteries only, or every type). The moderator can change the levers at any time,
but a Round keeps the format it started with. Every storage type needs the full-season format. If the
moderator switches back, storage already built keeps running, but no more of it can be bought.

**Representative day** (#1003):
In representative-day mode, the one simulated day that stands for a whole Trading period: the middle
day of its season, cleared at the Round's clearings per day. Its trading money and energy are scaled
×91 (the days in a season) to give the period's total. O&M is not scaled, since it is already one
period's share, and **stored energy** is what the pool really holds at the end of the day.
_Avoid_: sample day, typical day.

**Full season** (#1004):
In full-season mode, all 91 days of a Trading period's season are simulated one after another and
added up, with no scaling. **Stored energy** carries from one day to the next.

**Settling a Trading period** (#1003, #1004):
What happens once a Trading period's price-setting window closes: each player's prices are locked,
the days the **round format** calls for are simulated in the background, and each player is paid its
result. The moderator can close the window early by advancing, as with the Investment phase, but the
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
carbon tax, the floor top-up and blackout resets are left out. Summed over the session, it is the first
term of the final score.
_Avoid_: revenue, gross proceeds, net.

**Balance sheet** (#1008):
A player's statement for one Round, shown on the Round overview: a column per season and one for the
Round. Market income, dumping cost and O&M add up to the season's operating income; the Round column
then takes off the Round's investments to give its **net profit**. A season fills in once it is settled.
Market income already has the cost of the energy storage bought to charge taken off.
_Avoid_: recap (the Recap is the narrative page between Rounds), income statement.
