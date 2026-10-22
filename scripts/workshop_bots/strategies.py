"""Five rational bot personas for testing a Workshop session, and a stand-in for a human player.

Every persona plays to win, with the same reasoning (see planner.py): it forecasts the coming Round's market from
the public record, buys what adds most to its final score, and sets prices from the same forecast. Its forecasts
are wrong by a random amount, so it makes mistakes. The personas differ in what they are willing to build, how they
price, how far they trust their forecast, and how they vote.
"""

from __future__ import annotations

import random

from collections import Counter

import numpy as np

from forecast import CATALOG_FUEL_PRICES, RENEWABLE_PRICE, fuel_cost, is_storage, spec, weather_kind
from market import FIRM, Ctx
from planner import (
    Beliefs,
    Plan,
    PriceRule,
    best_response,
    build_outlook,
    cost_plus,
    loan_cost,
    operating,
    own_intensity,
    plan_investment,
    scenarios,
    storage_prices,
)

Prices = dict[tuple[str, str], float]  # (facility, "sell" or "buy") -> price per MWh


class Strategy:
    name = "base"
    persona = ""

    def __init__(self, seed: int = 0, name: str | None = None):
        # Several bots can play one persona, each under its own account, such as greenie2.
        self.name = name or type(self).name
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



def burned(ctx: Ctx) -> dict[str, dict]:
    """The fuel lines of the fuels the bot's operating plants burn: the only ones it can order."""
    return {fuel: line for fuel, line in ctx.fuel.items() if line.get("season_need")}


WIND = ("offshore_wind_turbine", "onshore_wind_turbine")
SOLAR = ("multi_layer_pv", "pv_solar", "csp_solar")
HYDRO = ("large_water_dam", "small_water_dam")
STORAGE_TYPES = ("lithium_ion_batteries", "solid_state_batteries", "hydrogen_storage", "pumped_hydro")
GAS = ("combined_cycle", "gas_burner")
COAL = ("modern_coal_plant", "coal_burner")
NUCLEAR = ("nuclear_reactor_gen4", "nuclear_reactor")


class Rational(Strategy):
    """A bot that forecasts the market and plays for its final score. Subclasses say what it builds and how it prices."""

    noise = 0.1
    others_bias = 0.0
    decay = 0.9
    strategic = False  # whether it looks for the price that earns most, or prices at cost plus a markup
    markup = 1.15
    hurdle = 0.0

    cover = 0.85
    firm_trust = 0.5
    reaction = 0.2

    def beliefs(self) -> Beliefs:
        return Beliefs(
            self.noise, self.others_bias, self.decay, self.rng.randrange(4), self.cover, self.firm_trust, self.reaction
        )

    def candidates(self, ctx: Ctx) -> list[str]:
        return []

    def price_rule(self, ctx: Ctx) -> PriceRule:
        return cost_plus(ctx, self.markup)

    def required(self, ctx: Ctx) -> dict[str, int]:
        return {}

    def tight_seasons(self, ctx: Ctx) -> frozenset[str]:
        return frozenset()

    # -- investing --

    def outlook(self, ctx: Ctx):
        cached = ctx.memory.get("outlook")
        if cached is None or cached[0] != ctx.round:
            cached = (ctx.round, build_outlook(ctx, self.beliefs(), self.rng, tight=self.tight_seasons(ctx)))
            ctx.memory["outlook"] = cached
        return cached[1]

    def plan(self, ctx: Ctx, budget: float) -> Plan:
        return plan_investment(
            ctx,
            self.outlook(ctx),
            [f for f in self.candidates(ctx) if f in ctx.offered],
            budget,
            self.beliefs(),
            self.price_rule(ctx),
            hurdle=self.hurdle,
            required=self.required(ctx),
        )

    def holds_back(self, ctx: Ctx) -> bool:
        return False

    def invest(self, ctx: Ctx) -> list[str]:
        if self.holds_back(ctx):
            return []
        planned = ctx.memory.get("plan")
        plan = planned[1] if planned and planned[0] == ctx.round else self.plan(ctx, ctx.money)
        outlook = self.outlook(ctx)
        fleet = Counter(operating(ctx, ctx.round)) + Counter(
            {f: n for f, n in plan.picks.items() if spec(f).construction_lag_rounds == 0}
        )
        mean = outlook.mean_price(fleet, self.price_rule(ctx)(fleet))
        bought = ", ".join(f"{n} {f}" for f, n in plan.picks.items()) or "nothing"
        self.note(
            ctx,
            f"buys {bought} for {plan.spent / 1e6:.0f}M of {ctx.money / 1e6:.0f}M, expects +{plan.gain / 1e6:.0f}M "
            f"on the score and a mean price of {mean:.0f}",
        )
        return [f for f, n in plan.picks.items() for _ in range(n)]

    def rational_loan(self, ctx: Ctx) -> bool:
        """Take the loan if what it lets the bot buy adds more to the score than the loan costs."""
        without = self.plan(ctx, ctx.money)
        with_loan = self.plan(ctx, ctx.money + ctx.loan["amount"])
        take = with_loan.gain - without.gain > loan_cost(ctx)
        ctx.memory["plan"] = (ctx.round, with_loan if take else without)
        self.note(
            ctx,
            f"the loan would add {(with_loan.gain - without.gain) / 1e6:.0f}M and cost {loan_cost(ctx) / 1e6:.0f}M: "
            + ("takes it" if take else "declines"),
        )
        return take

    # -- trading --

    def season_outlook(self, ctx: Ctx):
        noisy = Beliefs(
            self.noise / 2, self.others_bias, self.decay, self.rng.randrange(4), self.cover, self.firm_trust, 0.0
        )
        return build_outlook(ctx, noisy, self.rng, seasons=[ctx.season], tight=self.tight_seasons(ctx)).seasons[0]

    def prices(self, ctx: Ctx) -> Prices:
        fleet = operating(ctx, ctx.round)
        if not fleet:
            return {}
        season = self.season_outlook(ctx)
        prices = self.price_rule(ctx)(fleet)
        if self.strategic:
            # Before any trading it knows nothing of the others' plants, so it is less sure of its forecast.
            spread = 0.1 if ctx.history else 0.25
            prices = best_response(season, fleet, prices, spread)
            shading = self.learn_shading(ctx)
            for facility in list(prices):
                if weather_kind(facility) is not None or is_storage(facility):
                    continue
                # A few euros off at random, as people do: two bots that reason alike would otherwise tie.
                shade = shading.get(facility, 0.0) + self.rng.uniform(0, 4)
                cost = fuel_cost(facility, {f: line["price"] for f, line in ctx.fuel.items()}, taxed=ctx.carbon_tax_on)
                prices[facility] = round(max(cost + 1, prices[facility] - shade), 1)
            run = season.run(fleet, prices)
            ctx.memory["expected"] = {
                "period": (ctx.round, ctx.season),
                "sold": {o.owner: float(s.mean()) for o, s in zip(run.own, run.cleared.sold[run.start :])},
            }
        ctx.memory["season_prices"] = (ctx.round, ctx.season, prices)
        forecast = season.run(fleet, prices).cleared.price
        out: Prices = {(f, "sell"): p for f, p in prices.items()}
        for facility in fleet:
            if is_storage(facility):
                out[(facility, "buy")], out[(facility, "sell")] = storage_prices(forecast, facility)
        fossil = {f: p for f, p in prices.items() if weather_kind(f) is None}
        self.note(ctx, f"expects a mean price of {forecast.mean():.0f}; prices {fossil or 'renewables low'}")
        ctx.memory["season_outlook"] = (ctx.round, ctx.season, season)
        return out

    def learn_shading(self, ctx: Ctx) -> dict[str, float]:
        """How much below its best price to ask for each plant type, learned from the last period: a plant type that
        sold under a third of what the bot expected was priced too high, so it asks 15 less next time; one that sold
        most of it eases back."""
        shading: dict[str, float] = ctx.memory.setdefault("shading", {})
        expected = ctx.memory.get("expected")
        last = ctx.last
        if expected and last is not None and expected["period"] == (last.round, last.season) and not last.blackout:
            for facility, forecast in expected["sold"].items():
                if forecast <= 0 or weather_kind(facility) is not None:
                    continue
                sold = last.output(ctx.me, facility)
                if sold < forecast / 3:
                    shading[facility] = shading.get(facility, 0.0) + 15
                    self.note(ctx, f"{facility} sold {sold / forecast:.0%} of what it expected: asks less")
                elif sold > forecast * 0.8:
                    shading[facility] = max(0.0, shading.get(facility, 0.0) - 5)
        return shading

    def fuel_need(self, ctx: Ctx) -> dict[str, float]:
        """The fuel its plants should burn this season, from the season's forecast at its prices."""
        fleet = operating(ctx, ctx.round)
        held = ctx.memory.get("season_outlook")
        season = held[2] if held and held[:2] == (ctx.round, ctx.season) else self.season_outlook(ctx)
        priced = ctx.memory.get("season_prices")
        prices = priced[2] if priced and priced[:2] == (ctx.round, ctx.season) else self.price_rule(ctx)(fleet)
        # Running out of fuel could black the grid out, so it plans for a season 10% tighter than forecast.
        need: dict[str, float] = {}
        for case in scenarios(season, 0.1):
            for fuel, kg in case.burn(fleet, prices).items():
                need[fuel] = max(need.get(fuel, 0.0), kg)
        return need

    def fuel_orders(self, ctx: Ctx) -> dict[str, float]:
        need = self.fuel_need(ctx)
        margin = 1.25 if ctx.full_season else 1.1
        # Running short could black the grid out, which resets everyone's cash, so it keeps a margin, and never
        # buys less than half of what its plants would burn at full output.
        return {
            fuel: max(0.0, max(need.get(fuel, 0.0) * margin, 0.5 * line["season_need"]) - line["stock"])
            for fuel, line in burned(ctx).items()
        }

    def self_interest_ballot(self, ctx: Ctx) -> str:
        """For the tax if it emits less per MWh than the room, since the tax then hurts its rivals more."""
        mine, room = own_intensity(ctx)
        return "yes" if mine < room else "no"


class CoalKing(Rational):
    """Old-energy incumbent. Builds coal, and gas once the carbon tax passes, as long as he expects it to pay. Stops
    building when he expects prices too low to earn his plants back. Prices at fuel cost plus 15%. Optimistic: he
    expects the others to build a little less than they do. Takes the loan if it pays. Votes against the carbon tax.
    """

    name = "coalking"
    persona = "Old-energy incumbent: coal, then gas once taxed, stops building when prices fall; against the carbon tax"
    noise = 0.12
    others_bias = -0.1
    decay = 1.0
    reaction = 0.0  # he does not expect anyone to follow him

    def candidates(self, ctx: Ctx) -> list[str]:
        return list(GAS if ctx.carbon_tax_on else COAL)

    def holds_back(self, ctx: Ctx) -> bool:
        plant = next((f for f in self.candidates(ctx) if f in ctx.offered), None)
        if plant is None:
            return True
        floor = max(60.0, 1.3 * fuel_cost(plant, {fuel: line["price"] for fuel, line in ctx.fuel.items()}, taxed=ctx.carbon_tax_on))
        fleet = operating(ctx, ctx.round)
        mean = self.outlook(ctx).mean_price(fleet, self.price_rule(ctx)(fleet)) if fleet else 100.0
        if mean < floor:
            self.note(ctx, f"expects a mean price of {mean:.0f}, below his {floor:.0f}: builds nothing this Round")
            return True
        return False

    def wants_loan(self, ctx: Ctx) -> bool:
        return not self.holds_back(ctx) and self.rational_loan(ctx)

    def ballot(self, ctx: Ctx) -> str:
        return "no"


class Greenie(Rational):
    """Idealist. Builds only wind, sun and water, and storage when her forecast shows it pays. Sells her power at any
    price rather than dump it. Never borrows. Votes for the carbon tax.
    """

    name = "greenie"
    persona = "Idealist: renewables only, storage when it pays, never borrows; for the carbon tax"
    noise = 0.12
    # She counts on the others' fossil plants to keep the lights on when the wind drops.
    cover = 1.15
    firm_trust = 1.0

    def candidates(self, ctx: Ctx) -> list[str]:
        return [*WIND, *SOLAR, *HYDRO, *STORAGE_TYPES]

    def ballot(self, ctx: Ctx) -> str:
        return "yes"


class Nuke(Rational):
    """Long-term planner. Takes the loan in Round 1 for a reactor, which works from Round 2, and gas burners to
    bridge the wait. After that, only reactors, when she expects them to pay. Prices nuclear just above fuel cost so
    it always runs. Trusts the long run: an extra plant's profit does not fade in her eyes. Votes for the carbon tax.
    """

    name = "nuke"
    persona = "Planner: borrows for a reactor in Round 1, bridges with gas, then only reactors; for the carbon tax"
    decay = 1.0
    markup = 1.25

    def candidates(self, ctx: Ctx) -> list[str]:
        return [*NUCLEAR, "gas_burner"] if ctx.round == 1 else list(NUCLEAR)

    def required(self, ctx: Ctx) -> dict[str, int]:
        if ctx.round == 1:
            reactor = next((f for f in NUCLEAR if f in ctx.offered), None)
            # Gas burners for 60% of her share of the peak, to earn something while the reactor is built.
            gas = units_for(ctx, "gas_burner", 0.6 * ctx.fair_share())
            return {reactor: 1, "gas_burner": gas} if reactor else {"gas_burner": gas}
        return {}

    def wants_loan(self, ctx: Ctx) -> bool:
        if ctx.round == 1:
            self.note(ctx, "takes the loan: a reactor costs more than the starting budget")
            return True
        return False

    def ballot(self, ctx: Ctx) -> str:
        return "yes"


class Trader(Rational):
    """Speculator. Gas and coal plants and batteries, and renewables too once the carbon tax passes. Looks for the
    price that earns most in each season, and expects tight seasons where the Recap warns of one. Plays the fuel
    market: fuel prices drift back to the catalog price, so he stocks up when fuel is cheap and buys less when it is
    dear, and stocks up before a season the Recap warns about. Takes the loan if it pays. Votes for the tax if he
    emits less than the room.
    """

    name = "trader"
    persona = "Speculator: gas, coal and batteries, renewables once taxed; strategic prices; speculates on fuel"
    noise = 0.08
    decay = 0.85
    strategic = True
    reaction = 0.3

    def candidates(self, ctx: Ctx) -> list[str]:
        plants = [*GAS, *COAL, "lithium_ion_batteries", "solid_state_batteries"]
        return plants + ([*WIND, *SOLAR] if ctx.carbon_tax_on else [])

    def tight_seasons(self, ctx: Ctx) -> frozenset[str]:
        return frozenset(ctx.forecast_seasons())

    def wants_loan(self, ctx: Ctx) -> bool:
        return self.rational_loan(ctx)

    def fuel_orders(self, ctx: Ctx) -> dict[str, float]:
        need = self.fuel_need(ctx)
        warned = ctx.forecast_seasons()
        upcoming = SEASONS[SEASONS.index(ctx.season) + 1] if ctx.season != "winter" else None
        orders = {}
        # Fuel left over at the end of the session is worth nothing, so he never stocks more than the seasons left
        # would burn.
        seasons_left = (ctx.session["round_count"] - ctx.round) * 4 + 3 - SEASONS.index(ctx.season)
        for fuel, line in burned(ctx).items():
            burn = need.get(fuel, 0.0)
            ratio = line["price"] / CATALOG_FUEL_PRICES_BY_NAME[fuel]
            if ratio < 0.9 and seasons_left > 0:
                target = burn * (1 + min(1, seasons_left))
                self.note(ctx, f"{fuel} at {ratio:.0%} of its usual price: stocks up for later seasons")
            elif ratio > 1.15:
                target = burn * 0.9
                self.note(ctx, f"{fuel} at {ratio:.0%} of its usual price: buys less, burns his stock")
            else:
                target = burn * 1.15
            if upcoming in warned and fuel != "uranium" and seasons_left > 0:
                target = max(target, 2 * burn)
                self.note(ctx, f"the Recap warns about {upcoming}: stocks up on {fuel} before it")
            orders[fuel] = max(0.0, target - line["stock"])
        return orders

    def ballot(self, ctx: Ctx) -> str:
        return self.self_interest_ballot(ctx)


class Strategizer(Rational):
    """Rational player. Builds whatever its forecast says adds most to its score, looks for the price that earns most,
    takes the loan if it pays, and votes for the tax if it emits less than the room. Its forecasts are the best of the
    bots'.
    """

    name = "strategizer"
    persona = "Rational player: the best investment it can see, strategic prices, loan if it pays"
    noise = 0.05
    reaction = 0.5  # it expects its rivals to see the same chances it does
    strategic = True

    def candidates(self, ctx: Ctx) -> list[str]:
        return list(ctx.offered)

    def tight_seasons(self, ctx: Ctx) -> frozenset[str]:
        return frozenset(ctx.forecast_seasons())

    def wants_loan(self, ctx: Ctx) -> bool:
        return self.rational_loan(ctx)

    def ballot(self, ctx: Ctx) -> str:
        return self.self_interest_ballot(ctx)


CATALOG_FUEL_PRICES_BY_NAME = {fuel.value: price for fuel, price in CATALOG_FUEL_PRICES.items()}
SEASONS = ("spring", "summer", "autumn", "winter")


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


PERSONAS: dict[str, type[Strategy]] = {cls.name: cls for cls in (CoalKing, Greenie, Trader, Nuke, Strategizer)}
STAND_IN = TypicalHuman
