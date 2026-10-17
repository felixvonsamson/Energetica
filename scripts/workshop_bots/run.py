#!.venv/bin/python
"""Fill a Workshop session with five bot players. See README.md beside this file.

.venv/bin/python scripts/workshop_bots/run.py setup                       # once: accounts and roster
.venv/bin/python scripts/workshop_bots/run.py live --plan blackout        # bots play while you facilitate
.venv/bin/python scripts/workshop_bots/run.py headless --plan blackout    # bots and a stand-in, no browser
"""

from __future__ import annotations

import argparse
import json
import os
import random
import subprocess
import sys
import threading
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from api import Api, ApiError, Facilitator, LoginError
from market import SEASONS, Ctx, PeriodView, read_period
from strategies import PERSONAS, STAND_IN, Prices, Strategy

HERE = Path(__file__).resolve().parent
PLANS = HERE / "plans"
SLUG = os.environ.get("ENERGETICA_INSTANCE_SLUG", "workshop-demo")
# Run from the repo root, like the local-development docs.
ACCOUNTS_DB = os.environ.get("ENERGETICA_ACCOUNTS_DB_PATH", ".energetica-dev/accounts.db")

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}

_print_lock = threading.Lock()


def log(message: str) -> None:
    with _print_lock:
        print(f"{time.strftime('%H:%M:%S')} {message}", flush=True)


class History:
    """The public view of every settled period, read once each and shared by all bots."""

    def __init__(self, api: Api):
        self.api = api
        self.views: dict[tuple[int, str], PeriodView] = {}
        self.lock = threading.Lock()

    def until(self, session: dict[str, Any]) -> list[PeriodView]:
        with self.lock:
            current = session["checkpoint"].get("round", 0)
            for round_number in range(1, current + 1):
                for season in SEASONS:
                    if (round_number, season) not in self.views:
                        view = read_period(self.api, round_number, season)
                        if view is not None:
                            self.views[(round_number, season)] = view
            return [self.views[key] for key in sorted(self.views, key=lambda k: (k[0], SEASONS.index(k[1])))]


class Bot:
    """One bot account and the strategy that plays it."""

    def __init__(self, strategy: Strategy, *, live: bool):
        self.strategy = strategy
        self.name = strategy.name
        self.api = Api(strategy.name)
        self.live = live
        self.memory: dict[str, Any] = {}
        self.handled: set[str] = set()
        self.notes_shown = 0

    def context(self, session: dict[str, Any], history: History) -> Ctx:
        checkpoint = session["checkpoint"]
        round_number = checkpoint.get("round", 1)
        recap = None
        if round_number > 1:
            try:
                recap = self.api.get(f"/rounds/{round_number - 1}/recap")
            except ApiError:
                pass
        fuel = self.api.get("/fuel")
        me = self.api.account_id or next(p["account_id"] for p in session["players"] if p["username"] == self.name)
        return Ctx(
            me=me,
            session=session,
            round=round_number,
            season=checkpoint.get("season"),
            money=self.api.get("/selection")["money"],
            fleet=self.api.get("/fleet"),
            offered={f["id"]: f for f in self.api.get("/facilities") if f["for_sale"]},
            fuel={line["fuel"]: line for line in fuel["fuels"]},
            procurement=fuel["procurement"],
            history=history.until(session),
            recap=recap,
            loan=self.api.get("/loan"),
            memory=self.memory,
        )

    def pause(self, low: float, high: float) -> None:
        """Think like a person would, in live runs only."""
        if self.live:
            time.sleep(random.uniform(low, high))

    def handle(self, session: dict[str, Any], history: History) -> None:
        """Act once on the session's current checkpoint."""
        checkpoint = session["checkpoint"]
        key = json.dumps(checkpoint, sort_keys=True)
        if key in self.handled or checkpoint["kind"] not in ("investment", "trading_period"):
            return
        self.handled.add(key)
        try:
            if checkpoint["kind"] == "investment":
                self.pause(5, 25)
                self.invest(session, history)
            else:
                self.pause(3, 15)
                self.trade(session, history)
        except ApiError as error:
            # Most often the facilitator closed the window before the bot was done.
            log(f"{self.name}: {error}")
        self.show_notes()

    def invest(self, session: dict[str, Any], history: History) -> None:
        ctx = self.context(session, history)
        vote = self.api.get("/vote")
        if vote["held"]:
            ballot = self.strategy.ballot(ctx)
            if ballot:
                self.api.cast_ballot(ballot)
                log(f"{self.name} votes {ballot}")
        if ctx.loan["available"] and self.strategy.wants_loan(ctx):
            self.api.send("POST", "/loan")
            ctx.money += ctx.loan["amount"]
            log(f"{self.name} takes the {ctx.loan['amount'] / 1e6:.0f}M loan")
        picked: list[str] = []
        for facility in self.strategy.invest(ctx):
            try:
                self.api.select(facility)
            except ApiError as error:
                log(f"{self.name} cannot pick {facility}: {error}")
                break
            picked.append(facility)
            self.pause(0.5, 2)
        counts = {facility: picked.count(facility) for facility in dict.fromkeys(picked)}
        log(f"{self.name} picks {counts or 'nothing'} (cash {ctx.money / 1e6:.1f}M)")

    def set_prices(self, prices: Prices) -> None:
        for (facility, side), price in prices.items():
            self.api.set_price(facility, side, price)
            self.pause(0.3, 1.5)
        if prices:
            log(f"{self.name} prices " + ", ".join(f"{f} {s} {p:g}" for (f, s), p in prices.items()))

    def trade(self, session: dict[str, Any], history: History) -> None:
        ctx = self.context(session, history)
        self.set_prices(self.strategy.prices(ctx))
        if ctx.procurement == "manual":
            for fuel, quantity in self.strategy.fuel_orders(ctx).items():
                self.api.set_fuel_order(fuel, quantity)
                need = ctx.fuel[fuel]["season_need"] or 1
                log(
                    f"{self.name} orders {quantity / need:.0%} of its {fuel} need (holds {ctx.fuel[fuel]['stock'] / need:.0%})"
                )
        if self.live:
            # Second thoughts partway through the window, unless the facilitator moves on first.
            remaining = (session.get("phase_timer") or {}).get("remaining_seconds", 60)
            deadline = time.monotonic() + random.uniform(0.3, 0.6) * remaining
            while time.monotonic() < deadline:
                time.sleep(1)
                if self.api.get("/session")["checkpoint"] != session["checkpoint"]:
                    return
            self.set_prices(self.strategy.revise_prices(ctx))

    def show_notes(self) -> None:
        notes = self.memory.get("notes", [])
        for note in notes[self.notes_shown :]:
            log(f"   {self.name}: {note}")
        self.notes_shown = len(notes)


def load_plan(name: str | None) -> dict[str, Any] | None:
    if name is None:
        return None
    path = Path(name) if Path(name).exists() else PLANS / f"{name}.json"
    return json.loads(path.read_text())


def make_bots(names: list[str], seed: int, *, live: bool) -> list[Bot]:
    strategies = {**PERSONAS, STAND_IN.name: STAND_IN}
    return [Bot(strategies[name](seed=seed), live=live) for name in names]


def balance_summary(bots: list[Bot], round_count: int) -> None:
    """Each bot's operating income per season and its cash now, in millions."""
    for bot in bots:
        cash = bot.api.get("/selection")["money"]
        rounds = []
        for round_number in range(1, round_count + 1):
            try:
                sheet = bot.api.get(f"/rounds/{round_number}/balance-sheet")
            except ApiError:
                continue
            cells = [
                f"{s['sheet']['operating_income'] / 1e6:7.1f}" if s["sheet"] else "      -" for s in sheet["seasons"]
            ]
            rounds.append(f"R{round_number}" + "".join(cells))
        log(f"{bot.name:9s} " + " |".join(rounds) + f" | cash {cash / 1e6:.1f}")


def scoreboard(api: Api) -> None:
    """The final scores and what they are made of, in millions."""
    log("player     score = operating profit - investments - carbon tax + residual value")
    for score in api.get("/scoreboard"):
        parts = (
            score[key] / 1e6 for key in ("score", "operating_profit", "investments", "carbon_tax", "residual_value")
        )
        log(f"{score['username']:9s} " + "".join(f"{part:10.1f}" for part in parts))


# --- commands --------------------------------------------------------------------------------------------------


def setup(args: argparse.Namespace) -> None:
    """Create the facilitator, bot and player accounts, and put them on the Run's roster."""
    remote = [
        f"{variable}={url}"
        for variable in ("ENERGETICA_LOBBY_URL", "ENERGETICA_APP_URL")
        if (url := os.environ.get(variable)) and urlparse(url).hostname not in LOCAL_HOSTS
    ]
    if remote:
        sys.exit(
            f"setup only works on a local Run, but {' and '.join(remote)}. It writes into a local accounts.db and "
            "gives every account the password <name>1234, including the facilitator. On a deployed Run, an operator "
            "creates the accounts on the server with random passwords; pass those to the bots with "
            "ENERGETICA_BOT_PASSWORDS."
        )
    os.environ["ENERGETICA_ACCOUNTS_DB_PATH"] = ACCOUNTS_DB
    from energetica.identity import accounts  # noqa: PLC0415 - only this command needs the backend
    from energetica.kernel.session import generate_password_hash  # noqa: PLC0415

    names = [args.facilitator, args.player, *PERSONAS]
    for name in names:
        accounts.get_or_create_account_id(username=name, pwhash=generate_password_hash(f"{name}1234"))
    lobby_scripts = HERE.parent / "lobby"
    run = [sys.executable, str(lobby_scripts / "grant-facilitator.py"), "--username", args.facilitator]
    subprocess.run([*run, "--slug", SLUG, "--accounts-db", ACCOUNTS_DB], check=True)
    run = [sys.executable, str(lobby_scripts / "whitelist-run.py"), SLUG, "add", args.player, *PERSONAS]
    subprocess.run([*run, "--accounts-db", ACCOUNTS_DB], check=True)
    log(f"accounts ready, each with the password <name>1234: {', '.join(names)}")


def live(args: argparse.Namespace) -> None:
    """Enter the bots and play every checkpoint as the facilitator reaches it, until the session is over."""
    plan = load_plan(args.plan)
    facilitator = None
    if plan is not None:
        # Log in first, so a missing facilitator password stops the script before any bot enters the Run.
        try:
            facilitator = Facilitator(args.facilitator)
        except LoginError as error:
            sys.exit(
                f"cannot log in as the facilitator {args.facilitator} to apply the plan: {error}. Either provide its "
                "password (in ENERGETICA_BOT_PASSWORDS or ENERGETICA_FACILITATOR_PASSWORD), or drop --plan and set "
                "the levers on the console."
            )
    bots = make_bots(args.bots.split(","), args.seed, live=True)
    log(f"bots entered: {', '.join(bot.name for bot in bots)}")
    if plan is not None and facilitator is not None:
        facilitator.apply_plan(plan)
        log(f"applied the {args.plan} plan; check it on the console before you start")
    history = History(bots[0].api)
    threads: dict[str, threading.Thread] = {}
    last_kind = None
    while True:
        session = bots[0].api.get("/session")
        checkpoint = session["checkpoint"]
        if checkpoint != last_kind:
            log(f"== {checkpoint}")
            if checkpoint["kind"] in ("recap", "finished"):
                balance_summary(bots, session["round_count"])
            last_kind = checkpoint
        if checkpoint["kind"] == "finished":
            scoreboard(bots[0].api)
            return
        for bot in bots:
            thread = threads.get(bot.name)
            if thread is None or not thread.is_alive():
                threads[bot.name] = threading.Thread(target=bot.handle, args=(session, history), daemon=True)
                threads[bot.name].start()
        time.sleep(1)


def headless(args: argparse.Namespace) -> None:
    """Play a whole session at once: the bots, a stand-in for the human player, and the facilitator."""
    facilitator = Facilitator(args.facilitator)
    bots = make_bots([*args.bots.split(","), STAND_IN.name], args.seed, live=False)
    plan = load_plan(args.plan)
    if plan is not None:
        facilitator.apply_plan(plan)
    history = History(facilitator)
    while True:
        session = facilitator.get("/session")
        checkpoint = session["checkpoint"]
        if checkpoint["kind"] == "finished":
            break
        for bot in bots:
            bot.handle(session, history)
        if checkpoint["kind"] == "trading_period":
            facilitator.advance_to_next_checkpoint()
            view = read_period(facilitator, checkpoint["round"], checkpoint["season"])
            if view is not None:
                log(
                    f"-- R{view.round} {view.season}: mean price {view.mean_price:.0f}, peak must-serve "
                    f"{view.peak_must_serve / 1e6:.0f} MW{', BLACKOUT' if view.blackout else ''}"
                )
        else:
            facilitator.advance()
            if checkpoint["kind"] == "investment":
                time.sleep(1.5)  # the purchase happens just after the phase closes
                facilitator.advance()
            if checkpoint["kind"] == "recap":
                balance_summary(bots, session["round_count"])
    scoreboard(facilitator)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("setup", "live", "headless"):
        command = commands.add_parser(name)
        command.add_argument("--facilitator", default="prof", help="the facilitator's username")
        if name == "setup":
            command.add_argument("--player", default="player", help="the account you play with")
        else:
            command.add_argument("--bots", default=",".join(PERSONAS), help="which personas to run")
            command.add_argument("--plan", help="a plan in plans/ (blackout, blackout-full-season) or a JSON file")
            command.add_argument("--seed", type=int, default=1, help="changes the random choices of the bots")
    args = parser.parse_args()
    commands_by_name: dict[str, Callable[[argparse.Namespace], None]] = {
        "setup": setup,
        "live": live,
        "headless": headless,
    }
    try:
        commands_by_name[args.command](args)
    except LoginError as error:
        sys.exit(str(error))
    except KeyboardInterrupt:
        sys.exit(130)


if __name__ == "__main__":
    main()
