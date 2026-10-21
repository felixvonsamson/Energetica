"""Five bot personas for testing a Workshop session, and a stand-in for a human player.

Each persona has a plain idea of the game and changes its mind as the session goes on. None of them plays well on
purpose: together they should look like a room of first-time players.

Every Round, a bot sizes its purchases in megawatts against the demand it expects: in Round 1 a guess from the player
count, later what it has seen and the Recap's forecast. What it can pay for caps that: the starting budget in Round
1, a share of its cash later. So the bots follow the catalog's prices and powers rather than buying fixed counts. Some
bots take the loan, each for its own reason.
"""

from __future__ import annotations

import random

from market import FIRM, RENEWABLE, STORAGE, Ctx

Prices = dict[tuple[str, str], float]  # (facility, "sell" or "buy") -> price per MWh


class Strategy:
    name = "base"
    persona = ""

    def __init__(self, seed: int = 0):
        self.rng = random.Random(f"{self.name}:{seed}")

    def invest(self, ctx: Ctx) -> list[str]:
        """The facilities to pick in the Investment phase, one entry per copy."""
        return []

    def prices(self, ctx: Ctx) -> Prices:
        """The prices to set when a price-setting window opens."""
        return {}

    def revise_prices(self, ctx: Ctx) -> Prices:
        """Changes to make halfway through the window, in live runs only."""
        return {}

    def fuel_orders(self, ctx: Ctx) -> dict[str, float]:
        """kg of each fuel to buy under manual procurement. By default, top the stock up to the season's need."""
        return {fuel: max(0.0, line["season_need"] - line["stock"]) for fuel, line in ctx.fuel.items()}

    def ballot(self, ctx: Ctx) -> str | None:
        """ "yes" or "no" in a carbon tax vote."""
        return None

    def wants_loan(self, ctx: Ctx) -> bool:
        """Whether to take the loan in this Investment phase, before picking. Asked only while it can be taken."""
        return False

    def note(self, ctx: Ctx, text: str) -> None:
        """Explain a decision in the bot's log."""
        ctx.memory.setdefault("notes", []).append(f"R{ctx.round} {ctx.season or 'investment'}: {text}")


def shopping(ctx: Ctx, wishes: list[tuple[str | None, int]], budget: float) -> list[str]:
    """Pick from ``wishes``, (facility, count) in order of preference, skipping what is not for sale, too dear or
    over its limit.
    """
    picks: list[str] = []
    left = budget
    for facility, count in wishes:
        item = ctx.offered.get(facility) if facility else None
        if item is None:
            continue
        for _ in range(count):
            if item["price"] > left or picks.count(item["id"]) >= ctx.room_for(item["id"]):
                break
            picks.append(item["id"])
            left -= item["price"]
    return picks


def units_for(ctx: Ctx, facility: str | None, watts: float) -> int:
    """How many of ``facility`` it takes to add ``watts``, rounded up."""
    if facility is None or watts <= 0:
        return 0
    return int(-(-watts // ctx.power(facility)))


def best_of(ctx: Ctx, *facilities: str) -> str | None:
    """The first of ``facilities`` for sale. List upgrades first."""
    return next((facility for facility in facilities if facility in ctx.offered), None)


def budget(ctx: Ctx, share: float) -> float:
    """What a bot spends: ``share`` of its cash, or all of it in the last Round, where what it buys keeps most of its
    price as residual value in the final score.
    """
    return ctx.money if ctx.is_last_round else ctx.money * share


def panic(ctx: Ctx) -> float:
    """How much more a bot wants than usual: 30% more after the grid went down in the last Round."""
    return 1.3 if ctx.blackout_last_round() else 1.0


class CoalKing(Strategy):
    """Old-energy incumbent. Builds cheap coal, more than his share of the peak, and grows a little every Round.
    Prices at fuel cost plus a markup that he tunes each period: lower when he sold little, higher when he sold a
    lot. Orders the fuel he burned last season plus 15%. Votes against the carbon tax, and once it passes he builds
    gas instead of coal. Takes the loan in Round 2 to build coal while he still can.
    """

    name = "coalking"
    persona = "Old-energy incumbent: big coal fleet, cost-plus prices tuned by sales, against the carbon tax"

    def invest(self, ctx: Ctx) -> list[str]:
        if ctx.round == 1:
            self.note(ctx, "coal burners for 1.6x his share of the peak, as far as his budget goes")
            return shopping(ctx, [("coal_burner", units_for(ctx, "coal_burner", 1.6 * ctx.fair_share()))], ctx.money)
        if ctx.session.get("carbon_tax_since") is not None:
            plant = best_of(ctx, "combined_cycle", "gas_burner")
            self.note(ctx, f"the carbon tax is on, so {plant} from now on")
        else:
            plant = best_of(ctx, "modern_coal_plant", "coal_burner")
        missing = 1.6 * ctx.fair_share() * panic(ctx) - ctx.capacity(FIRM)
        return shopping(ctx, [(plant, max(1, units_for(ctx, plant, missing)))], budget(ctx, 0.8))

    def prices(self, ctx: Ctx) -> Prices:
        markup = ctx.memory.get("markup", 1.6)
        if ctx.last is not None and "markup" in ctx.memory:
            sold = ctx.last.output(ctx.me) / (ctx.capacity(FIRM) or 1)
            if sold < 0.3:
                markup = max(1.05, markup - 0.2)
            elif sold > 0.6:
                markup += 0.15
            self.note(ctx, f"sold {sold:.0%} of capacity last period, markup now {markup:.2f}")
        ctx.memory["markup"] = markup
        return {(f, "sell"): round(ctx.marginal_cost(f) * markup) for f in ctx.operating() if f in FIRM}

    def fuel_orders(self, ctx: Ctx) -> dict[str, float]:
        orders = {}
        for fuel, line in ctx.fuel.items():
            share = ctx.fuel_margin(ctx.burn_share(fuel) * (1.3 if (line.get("change") or 0) < -0.02 else 1.15))
            orders[fuel] = max(0.0, line["season_need"] * share - line["stock"])
            self.note(ctx, f"burned {ctx.burn_share(fuel):.0%} of his full {fuel} need, orders {share:.0%}")
        return orders

    def ballot(self, ctx: Ctx) -> str:
        return "no"

    def wants_loan(self, ctx: Ctx) -> bool:
        if ctx.round == 2 and not ctx.carbon_tax_on:
            self.note(ctx, "takes the loan to build coal before they tax it")
            return True
        return False


class Greenie(Strategy):
    """Idealist. Only wind, sun and water. Gives her power away for nothing at first, and starts asking a price
    in Round 1's winter. From Round 2 she adds a battery, and long-term storage once it is allowed. Votes for the
    carbon tax.
    """

    name = "greenie"
    persona = "Idealist: renewables only, gives power away at first, adds storage later, for the carbon tax"

    def invest(self, ctx: Ctx) -> list[str]:
        if ctx.round == 1:
            self.note(ctx, "wind turbines for her share of the peak, then PV for 60% of it")
            wishes: list[tuple[str | None, int]] = [
                ("onshore_wind_turbine", units_for(ctx, "onshore_wind_turbine", ctx.fair_share())),
                ("pv_solar", units_for(ctx, "pv_solar", 0.6 * ctx.fair_share())),
            ]
            return shopping(ctx, wishes, ctx.money)
        wind = best_of(ctx, "offshore_wind_turbine", "onshore_wind_turbine")
        missing = 2.0 * ctx.fair_share() - ctx.capacity(RENEWABLE)
        wishes: list[tuple[str | None, int]] = [
            (best_of(ctx, "solid_state_batteries", "lithium_ion_batteries"), 1),
            (best_of(ctx, "pumped_hydro", "hydrogen_storage"), 1),
            (best_of(ctx, "multi_layer_pv", "pv_solar"), 1),
            ("csp_solar", 1),
            (wind, units_for(ctx, wind, missing / 2)),
            (best_of(ctx, "large_water_dam", "small_water_dam"), 2),
        ]
        return shopping(ctx, wishes, ctx.money * 0.6)

    def prices(self, ctx: Ctx) -> Prices:
        level = 40.0
        if ctx.round == 1 and ctx.season != "winter":
            level = 0.0
        elif ctx.round == 1:
            self.note(ctx, "free power earns nothing: asks 40 from now on")
        mean = ctx.last.mean_price if ctx.last else 100.0
        prices: Prices = {}
        for facility in ctx.operating():
            if facility in RENEWABLE:
                prices[(facility, "sell")] = level
            elif facility in STORAGE:
                prices[(facility, "buy")], prices[(facility, "sell")] = ctx.storage_prices(facility, 0.3, 0.7)
        return prices

    def ballot(self, ctx: Ctx) -> str:
        return "yes"


class Trader(Strategy):
    """Speculator. Gas peakers and a battery. Tries a ladder of markups over fuel cost and settles on the one that
    earned most per MW. Plays the fuel market: buys 30% less than he burned when the price has gone up, half as
    much again when it has fallen. In a season the Recap warned about he asks at least 3x fuel cost and buys no fuel at
    all, betting that scarcity pays, until a blackout in such a season teaches him otherwise. Takes the loan in
    Round 2 to grow. Votes for the carbon tax, because it hurts
    coal more than gas.
    """

    name = "trader"
    persona = "Speculator: gas peakers, experiments with markups, plays the fuel price, withholds in a crisis"

    LADDER = (1.3, 2.0, 3.0, 1.6)

    def invest(self, ctx: Ctx) -> list[str]:
        if ctx.round == 1:
            self.note(ctx, "gas peakers for 1.3x his share of the peak")
            return shopping(ctx, [("gas_burner", units_for(ctx, "gas_burner", 1.3 * ctx.fair_share()))], ctx.money)
        # In the last Round a plant keeps most of its price as residual value, so he builds more.
        missing = ctx.fair_share() * panic(ctx) * (1.3 if ctx.is_last_round else 1.0) - ctx.capacity(FIRM)
        battery = best_of(ctx, "lithium_ion_batteries", "solid_state_batteries")
        return shopping(
            ctx, [(battery, 1), ("gas_burner", max(1, units_for(ctx, "gas_burner", missing)))], budget(ctx, 0.7)
        )

    def withholds(self, ctx: Ctx) -> bool:
        """Whether he plays the crisis this season: only if it was forecast, and no crisis he played went dark."""
        played = ctx.memory.setdefault("crises", [])
        if any(view.blackout and (view.round, view.season) in played for view in ctx.history):
            if not ctx.memory.get("learned"):
                ctx.memory["learned"] = True
                self.note(ctx, "the grid went down when he held back his fuel: he will not do that again")
            return False
        if ctx.season not in ctx.forecast_seasons():
            return False
        if (ctx.round, ctx.season) not in played:
            played.append((ctx.round, ctx.season))
        return True

    def prices(self, ctx: Ctx) -> Prices:
        trials: dict[float, list[float]] = ctx.memory.setdefault("trials", {})
        if "markup" in ctx.memory and ctx.last is not None:
            costs = {f: ctx.marginal_cost(f) for f in ctx.operating()}
            trials.setdefault(ctx.memory["markup"], []).append(
                ctx.last.income(ctx.me, costs) / (ctx.capacity(FIRM) or 1)
            )
        untried = [markup for markup in self.LADDER if markup not in trials]
        markup = untried[0] if untried else max(trials, key=lambda m: sum(trials[m]) / len(trials[m]))
        if self.withholds(ctx):
            markup = max(markup, 3.0)
            self.note(ctx, "the Recap warned about this season: prices up")
        ctx.memory["markup"] = markup
        self.note(ctx, f"markup {markup}x fuel cost")
        mean = ctx.last.mean_price if ctx.last else 100.0
        prices: Prices = {}
        for facility in ctx.operating():
            if facility in FIRM:
                prices[(facility, "sell")] = round(ctx.marginal_cost(facility) * markup)
            elif facility in STORAGE:
                prices[(facility, "buy")], prices[(facility, "sell")] = ctx.storage_prices(facility, 0.25, 0.8)
        return prices

    def fuel_orders(self, ctx: Ctx) -> dict[str, float]:
        orders = {}
        for fuel, line in ctx.fuel.items():
            change = line.get("change") or 0
            share = ctx.burn_share(fuel)
            if change > 0.03:
                share *= 0.7
                self.note(ctx, f"{fuel} is up {change:.0%}: buys less than usual and waits for it to fall")
            elif change < -0.03:
                share *= 1.5
            share = ctx.fuel_margin(share)
            if self.withholds(ctx):
                share = 0.0
                self.note(ctx, f"the Recap warned about this season: buys no {fuel}, betting that scarcity pays")
            orders[fuel] = max(0.0, line["season_need"] * share - line["stock"])
        return orders

    def ballot(self, ctx: Ctx) -> str:
        return "yes"

    def wants_loan(self, ctx: Ctx) -> bool:
        if ctx.round == 2:
            self.note(ctx, "borrows to grow")
            return True
        return False


class Nuke(Strategy):
    """Long-term planner. Takes the loan in Round 1 to buy a reactor, which runs from Round 2, with gas burners to
    bridge the wait. Prices nuclear just over fuel cost so it always runs. Buys a second reactor in Round 2. In the
    last Round a reactor would not run, so she buys gas and dams instead. Votes for the carbon tax.
    """

    name = "nuke"
    persona = "Planner: borrows for a reactor in Round 1, nuclear baseload priced at cost; for the carbon tax"

    def invest(self, ctx: Ctx) -> list[str]:
        reactor = best_of(ctx, "nuclear_reactor_gen4", "nuclear_reactor")
        if ctx.round == 1:
            self.note(ctx, "a reactor for Round 2, and gas burners for 80% of her share of the peak to bridge the wait")
            return shopping(
                ctx, [(reactor, 1), ("gas_burner", units_for(ctx, "gas_burner", 0.8 * ctx.fair_share()))], ctx.money
            )
        missing = ctx.fair_share() * panic(ctx) - ctx.capacity(FIRM | {"small_water_dam", "large_water_dam"})
        if not ctx.is_last_round:
            picks = shopping(ctx, [(reactor, 1), ("gas_burner", units_for(ctx, "gas_burner", missing))], ctx.money)
            if reactor in picks:
                self.note(ctx, "another reactor, running next Round")
            else:
                self.note(ctx, "cannot afford another reactor, so gas burners only")
            return picks
        self.note(ctx, "last Round: a reactor would not run, so gas and dams, plenty, since they keep their value")
        missing += 0.3 * ctx.fair_share()
        dam = best_of(ctx, "large_water_dam", "small_water_dam")
        return shopping(ctx, [(dam, 1), ("gas_burner", units_for(ctx, "gas_burner", missing))], budget(ctx, 0.8))

    def prices(self, ctx: Ctx) -> Prices:
        prices: Prices = {}
        for facility in ctx.operating():
            if facility.startswith("nuclear"):
                prices[(facility, "sell")] = round(ctx.marginal_cost(facility) + 15)
            elif facility in FIRM:
                prices[(facility, "sell")] = round(ctx.marginal_cost(facility) * 1.4)
            elif facility in RENEWABLE:
                prices[(facility, "sell")] = 10.0
        return prices

    def ballot(self, ctx: Ctx) -> str:
        return "yes"

    def wants_loan(self, ctx: Ctx) -> bool:
        if ctx.round == 1:
            self.note(ctx, "takes the loan: a reactor costs more than the starting budget")
            return True
        return False


class Gambler(Strategy):
    """Copycat. Guesses in Round 1, then buys whatever earned most per euro in the last Round, among what he can still
    buy. Follows the crowd's price with random swings, and now and then types something wild. Forgets his fuel order
    half the time. Takes the loan the first time he sees it. Votes at random.
    """

    name = "gambler"
    persona = "Copycat: buys last Round's winner, erratic and sometimes wild prices, sloppy with fuel"

    def invest(self, ctx: Ctx) -> list[str]:
        if ctx.round == 1 or not ctx.history:
            guess = self.rng.choice(["coal_burner", "gas_burner", "onshore_wind_turbine"])
            self.note(ctx, f"first guess: {guess}")
            # Even a gambler keeps some plants that run on demand next to his wind.
            share = self.rng.uniform(1.0, 1.5) * ctx.fair_share()
            wishes: list[tuple[str | None, int]] = [(guess, units_for(ctx, guess, share)), ("small_water_dam", 3)]
            if guess == "onshore_wind_turbine":
                wishes = [(guess, units_for(ctx, guess, share)), ("gas_burner", units_for(ctx, "gas_burner", 0.8 * share))]
            return shopping(ctx, wishes, ctx.money * self.rng.uniform(0.7, 1.0))
        earned: dict[str, float] = {}
        for view in ctx.history[-4:]:
            for facility, value in view.income_by_facility().items():
                earned[facility] = earned.get(facility, 0.0) + value
        per_euro = {
            f: value / ctx.offered[f]["price"]
            for f, value in earned.items()
            if f in ctx.offered and ctx.room_for(f) > 0
        }
        if not per_euro:
            return []
        winner = max(per_euro, key=per_euro.__getitem__)
        count = max(1, units_for(ctx, winner, self.rng.uniform(0.5, 1.2) * ctx.fair_share()))
        self.note(ctx, f"copies last Round's winner: {count} x {winner}")
        return shopping(ctx, [(winner, count)], budget(ctx, 0.8))

    def prices(self, ctx: Ctx) -> Prices:
        anchor = ctx.last.mean_price if ctx.last else 120.0
        prices: Prices = {}
        for facility in ctx.operating():
            if self.rng.random() < 0.1:
                price = self.rng.choice([500.0, 1000.0])
                self.note(ctx, f"wild price {price:g} on {facility}")
            else:
                price = max(ctx.marginal_cost(facility) * 1.05, anchor * self.rng.uniform(0.8, 1.25))
            prices[(facility, "sell")] = round(price)
            if facility in STORAGE:
                prices[(facility, "buy")] = round(anchor * 0.6)
        return prices

    def revise_prices(self, ctx: Ctx) -> Prices:
        # second thoughts on one price
        operating = [f for f in ctx.operating() if f not in STORAGE]
        if not operating or self.rng.random() < 0.5:
            return {}
        facility = self.rng.choice(operating)
        anchor = ctx.last.mean_price if ctx.last else 120.0
        return {(facility, "sell"): round(max(ctx.marginal_cost(facility) * 1.05, anchor * self.rng.uniform(0.8, 1.1)))}

    def fuel_orders(self, ctx: Ctx) -> dict[str, float]:
        orders = {}
        for fuel, line in ctx.fuel.items():
            first_time = "fuel_seen" not in ctx.memory
            if not first_time and self.rng.random() < 0.5:
                self.note(ctx, f"forgets to change his {fuel} order")
                continue  # the order stays at what he bought last time
            share = ctx.burn_share(fuel) * self.rng.uniform(0.8, 1.2)
            orders[fuel] = max(0.0, line["season_need"] * share - line["stock"])
        ctx.memory["fuel_seen"] = True
        return orders

    def ballot(self, ctx: Ctx) -> str:
        return self.rng.choice(["yes", "no"])

    def wants_loan(self, ctx: Ctx) -> bool:
        self.note(ctx, "free money: takes the loan")
        return True


class TypicalHuman(Strategy):
    """Stand-in for the human player in headless runs: a cautious first-timer who never changes a price."""

    name = "player"
    persona = "Cautious first-timer who keeps the default prices"

    def invest(self, ctx: Ctx) -> list[str]:
        # Firm plants for a little more than its share of the peak, two thirds coal and one third gas in Round 1, and
        # one wind turbine each Round.
        missing = 1.1 * ctx.fair_share() - ctx.capacity(FIRM)
        if ctx.round == 1:
            wishes: list[tuple[str | None, int]] = [
                ("coal_burner", units_for(ctx, "coal_burner", missing * 2 / 3)),
                ("gas_burner", units_for(ctx, "gas_burner", missing / 3)),
                ("onshore_wind_turbine", 1),
            ]
            return shopping(ctx, wishes, ctx.money)
        return shopping(
            ctx, [("gas_burner", units_for(ctx, "gas_burner", missing)), ("onshore_wind_turbine", 1)], ctx.money
        )

    def ballot(self, ctx: Ctx) -> str:
        return "yes"


PERSONAS: dict[str, type[Strategy]] = {cls.name: cls for cls in (CoalKing, Greenie, Trader, Nuke, Gambler)}
STAND_IN = TypicalHuman
