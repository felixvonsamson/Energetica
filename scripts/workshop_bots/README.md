# Workshop bots

Five bot players for testing a Workshop session from start to finish. You play one player in the browser and
facilitate in another window, while the bots invest, set prices, order fuel and vote in the background, the way
a room of first-time players might. With the `blackout` plan, the grid goes down in Round 2's winter.

The bots use only the public API, as a player's browser does. They read their own state and the public record of
past Trading periods, and nothing else.

## The personas

| Bot        | Plays as                                                                                                                                                                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `coalking` | Old-energy incumbent. Five coal burners, then more than his share of the peak. Prices at fuel cost (and carbon tax) plus a markup tuned by how much he sold. Orders the fuel he burned last season plus 15%. Takes the loan in Round 2 to build coal before the tax. Votes against the carbon tax and switches to gas once it passes. |
| `greenie`  | Idealist. Wind and sun only, never borrows. Gives power away in Round 1, then asks 40. Adds batteries in Round 2 and CSP and pumped hydro once allowed. Votes for the tax.                                                                                                                                                            |
| `trader`   | Speculator. Gas peakers and a battery. Tries several markups and keeps the best. Buys less fuel when its price rises. In a season the Recap warned about, he raises his prices and buys no fuel at all, until a blackout in such a season teaches him otherwise. Takes the loan in Round 2.                                           |
| `nuke`     | Planner. Takes the loan in Round 1 for a reactor that runs from Round 2, with gas burners to bridge the wait. Prices nuclear just above fuel cost. In the last Round, where a reactor would not run, buys gas and a dam.                                                                                                              |
| `gambler`  | Copycat. Takes the loan at once. Guesses in Round 1, then buys whatever earned most per euro, among what he can still buy. Erratic prices, sometimes wild ones (500 or the 1,000 ceiling). Forgets his fuel order half the time. Votes at random.                                                                                     |

Each bot writes its reasoning to the log, for example `trader: R2 winter: the Recap warned about this season:
buys no gas, betting that scarcity pays`.

From Round 2 on, the bots size what they buy in megawatts against the demand they expect: the highest they have seen,
grown by the Recap's forecast. They spend at most a share of their cash, and all of it in the last Round, where
what they buy keeps most of its price as residual value in the final score.

## Plans

A plan sets the Round levers and events through the facilitator's account before the session starts. You can
still change it on the console until each Round locks.

- `blackout`: Round 1 uses the defaults. Round 2 has manual fuel procurement, a carbon tax vote, a data centre
  boom (+18% demand), and in winter a major cold snap (+22%) together with a gas pipeline disruption (+50% gas
  price). The trader holds his gas back, and the grid goes down in winter. Round 3 runs full seasons with every
  storage type and automatic fuel again, with a PV megafactory (cheaper PV) and a summer drought.
- `blackout-full-season`: the same, but Round 2 also runs full seasons. In 3 headless runs it also blacked out in
  Round 2 winter. Use it to see the stored-energy warning in Round 3.

Round 3 goes back to automatic fuel because, in a full season, the bots' fuel orders ran out in the last weeks of a
season and blacked out Round 3 as well in most runs. In 8 headless runs with seeds 1 to 8, the `blackout` plan then
blacked out exactly once each time, in Round 2 winter, sometimes at its very first hour. The weather differs from
one session to the next, so the same seed does not always play out the same way. Whether it happens in your
session also depends on what you build. If you build much more firm capacity than the stand-in, or stockpile
fuel, you may prevent it.

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

The stand-in the bots were tested against bought 2 coal burners, a gas burner and an onshore turbine in Round 1
(170 MW of firm capacity), then one more gas burner and onshore turbine each Round. It never took the loan, ordered
its full fuel need and never changed a price.

## Running against a deployed Run

The bots can also play in a Run on a server, such as a test Run before a real workshop. Point them at it and give
them the accounts' passwords:

```bash
export ENERGETICA_LOBBY_URL=https://lobby.energetica-game.org
export ENERGETICA_APP_URL=https://workshop-test.energetica-game.org
export ENERGETICA_INSTANCE_SLUG=<the Run's slug>
export ENERGETICA_BOT_PASSWORDS="$HOME/workshop-bot-passwords.json"  # {"coalking": "...", "greenie": "...", ...}
.venv/bin/python scripts/workshop_bots/run.py live
```

When `ENERGETICA_BOT_PASSWORDS` is set, every account the script logs in as must be in the file. The script stops
and names any account that is missing, rather than trying `<name>1234`. Keep the file outside the repo.

- An operator creates the bot accounts on the server, with random passwords, and puts them on the Run's roster.
  `setup` refuses to run against a remote URL, since it would create accounts with known passwords.
- `--plan` logs in as the facilitator to set the levers. Put the facilitator's password in the file or in
  `ENERGETICA_FACILITATOR_PASSWORD`, or leave out `--plan` and set the levers on the console.
- Never run `headless` against a live Run. It acts as the facilitator and plays the whole session through.
- The bots and every human player must enter the Run before the facilitator starts the session, since demand is
  set by the number of players at the start. Start `live` first and wait for `bots entered`.

## Running without a browser

`headless` plays a whole session at once: the five bots, a stand-in for you (the `player` account), and the
facilitator. It takes about a minute and prints each period's mean price, its peak demand and any blackout, the
balance sheets with each bot's cash, and the scoreboard broken into its parts.

```bash
.venv/bin/python scripts/workshop_bots/run.py headless --plan blackout --seed 1
```

`--bots` picks which personas play, and `--seed` changes their random choices.
