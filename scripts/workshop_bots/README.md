# Workshop bots

Five bot players for testing a Workshop session from start to finish. You play one player in the browser and
facilitate in another window, while the bots invest, set prices, order fuel and vote in the background, the way
a room of first-time players might. With the `blackout` plan, the grid goes down in Round 2's winter.

The bots use only the public API, as a player's browser does. They read their own state and the public record of
past Trading periods, and nothing else.

## The personas

| Bot        | Plays as                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| `coalking` | Old-energy incumbent. Big coal fleet, prices at fuel cost plus a markup tuned by how much he sold. Orders the fuel he burned last season plus 15%. Votes against the carbon tax and switches to gas once it passes. |
| `greenie`  | Idealist. Wind, water and sun only. Gives power away in Round 1, then asks 40. Adds batteries in Round 2 and pumped hydro once allowed. Votes for the tax. |
| `trader`   | Speculator. Gas peakers and a battery. Tries several markups and keeps the best. Buys less fuel when its price rises. In a season the Recap warned about, he raises his prices and buys no fuel at all. |
| `nuke`     | Planner. Gas and dams in Round 1, a reactor in Round 2 that runs from Round 3, priced just above fuel cost. |
| `gambler`  | Copycat. Guesses in Round 1, then buys whatever earned most per euro, among what he can still buy. Erratic prices, sometimes wild ones (1,500 or 3,000). Forgets his fuel order half the time. Votes at random. |

Each bot writes its reasoning to the log, for example `trader: R2 winter: the Recap warned about this season:
buys no gas, betting that scarcity pays`.

From Round 2 on, the bots size what they buy in megawatts against the demand they have seen, not by their cash.
Trading income is currently far larger than facility prices, and sizing by cash would have them buy hundreds of
facilities.

## Plans

A plan sets the Round levers and events through the facilitator's account before the session starts. You can
still change it on the console until each Round locks.

- `blackout`: Round 1 uses the defaults. Round 2 has manual fuel procurement, a carbon tax vote, a data centre
  boom (+18% demand), and in winter a major cold snap (+22%) together with a gas pipeline disruption (+50% gas
  price). The trader holds his gas back, and the grid goes down in winter. Round 3 runs full seasons with every
  storage type, with a PV megafactory (cheaper PV) and a summer drought.
- `blackout-full-season`: the same, but Round 2 also runs full seasons. Fuel then runs out as the season goes
  on, so the blackout usually comes in autumn and the winter events never fire. Use it to see the stored-energy
  warning in Round 3.

In headless tests with seeds 1 to 6, the `blackout` plan blacked out in Round 2 five times out of six (seed 1, the
default, in winter). Whether it happens in your session also depends on what you build. If you build much more
firm capacity than about 60 MW, or stockpile fuel, you may prevent it.

## Running a live session

Start the local lobby and a Workshop app backend as in
[Running a Workshop Run locally](../../docs/getting-started/local-development.md#running-a-workshop-run-locally),
with `ENERGETICA_INSTANCE_SLUG=workshop-demo`. Then, from the repo root:

```bash
# Once: create the accounts (password <name>1234) and put them on the Run's roster.
.venv/bin/python scripts/workshop_bots/run.py setup

# Start the session over, in the app backend's terminal.
bun run serve:app --rm_instance

# Log in as `player` in one browser window and `prof` in a private window. The player must enter the Run before
# the session starts, since demand is set by the number of players at the start.

# Start the bots. They enter the Run, apply the plan, and play each phase as the facilitator opens it.
.venv/bin/python scripts/workshop_bots/run.py live --plan blackout
```

Then facilitate as usual. The bots act 5 to 30 seconds after each phase opens. In a long price-setting window,
the gambler sometimes changes a price partway through. Stop the bots with Ctrl-C. If you start them again, they act on
the current phase again and forget what they learned.

For about 60 MW of firm capacity, the stand-in the bots were tested against bought 2 coal burners, a gas burner,
a small dam and an onshore turbine in Round 1, then one more gas burner each Round, and never changed a price.

## Running without a browser

`headless` plays a whole session at once: the five bots, a stand-in for you (the `player` account), and the
facilitator. It takes about half a minute and prints each period's mean price, its peak demand and any blackout,
then the balance sheets and the scoreboard.

```bash
.venv/bin/python scripts/workshop_bots/run.py headless --plan blackout --seed 1
```

`--bots` picks which personas play, and `--seed` changes their random choices.
