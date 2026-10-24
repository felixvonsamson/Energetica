"""Module for simulating user actions on the server."""

from __future__ import annotations

import asyncio
import cProfile
import pstats
import secrets
from typing import Any

import httpx
from fastapi import FastAPI
from starlette.types import Receive, Scope, Send

from energetica.freeplay.globals import engine
from energetica.freeplay.schemas.simulate import Action
from energetica.identity import accounts
from energetica.identity.accounts import Account
from energetica.identity.web import REPLAYED_ACCOUNT_SCOPE_KEY
from energetica.kernel.session import generate_password_hash
from energetica.utils import misc
from energetica.utils.tick_execution import tick


def create_user(username: str) -> Account:
    """Sign up a playing account named ``username``.

    The action log holds no password hash (#1341), so the account gets a random password nobody
    knows. Replay never needs it, since it calls the app as the account directly.
    """
    return misc.signup_playing_user(None, username, generate_password_hash(secrets.token_urlsafe(32)))


def find_account(account_id: int) -> Account:
    """The account a logged request came from, given the ``user_id`` it was logged with.

    That ``user_id`` is the account_id, not a per-instance object id (there is no such thing any
    more; see ADR-0004).
    """
    account = accounts.get_account_by_id(account_id)
    if account is None:
        raise ValueError(f"Cannot replay a request: account with id {account_id} does not exist")
    return account


def client_as(app: FastAPI, account: Account) -> httpx.AsyncClient:
    """A client that calls ``app`` in-process, as ``account``, without a session cookie (#1342).

    Replay is the run talking to itself, so its requests do not pass the entry gate: they were
    admitted when they were logged. The account travels in the request's ASGI scope, which only
    in-process code can set (see :data:`~energetica.identity.web.REPLAYED_ACCOUNT_SCOPE_KEY`).
    """

    async def app_as_account(scope: Scope, receive: Receive, send: Send) -> None:
        await app({**scope, REPLAYED_ACCOUNT_SCOPE_KEY: account}, receive, send)

    # A crash in the app comes back as the 500 a real client would get, so that
    # ``stop_on_server_error`` decides what happens next.
    transport = httpx.ASGITransport(app=app_as_account, raise_app_exceptions=False)
    return httpx.AsyncClient(transport=transport, base_url="http://replay")


def verify() -> None:
    assert True


def simulate(*simulate_args: Any, profiling: bool = False, **simulate_kwargs: Any) -> bool:
    """
    Wrapper around _simulate. Allows to run profiling if requested.

    Returns true if the simulation was successful, false otherwise.
    """
    if not profiling:
        return _simulate(*simulate_args, **simulate_kwargs)
    else:
        with cProfile.Profile() as profile:
            retval = _simulate(*simulate_args, **simulate_kwargs)
            stats = pstats.Stats(profile)
        stats.sort_stats(pstats.SortKey.CUMULATIVE).print_stats(30)
        return retval


def _simulate(
    app: FastAPI,
    actions: list[Action],
    simulating: bool,
    stop_on_mismatch: bool,
    stop_on_server_error: bool,
    stop_on_assertion_error: bool,
    checkpoint_every_k_ticks: int = 10000,
    checkpoint_ticks: list[int] | None = None,
) -> bool:
    """Simulate the list of actions. Returns true if the simulation was successful, false otherwise."""
    if checkpoint_ticks is None:
        checkpoint_ticks = []

    clients: dict[int, httpx.AsyncClient] = {}
    # One event loop for the whole replay, so that each account's client is reused.
    with asyncio.Runner() as runner:
        try:
            for action in actions:
                print(action)
                if action.action_type == "tick":
                    tick()
                    if (
                        checkpoint_every_k_ticks
                        and action.total_t % checkpoint_every_k_ticks == 0
                        or action.total_t in checkpoint_ticks
                    ):
                        engine.save_checkpoint(f"checkpoints/simulation/checkpoint_{action.total_t}.tar.gz")
                elif action.action_type == "create_user":
                    clients[action.user_id] = client_as(app, create_user(action.username))
                elif action.action_type == "request":
                    user_id = action.user_id
                    if user_id not in clients:
                        clients[user_id] = client_as(app, find_account(user_id))
                    client, request = clients[user_id], action.request
                    if request.content_type == "application/json":
                        sent = client.request(request.method, request.endpoint, json=request.payload)
                    elif isinstance(request.payload, dict):
                        sent = client.request(request.method, request.endpoint, data=request.payload)
                    else:
                        sent = client.request(request.method, request.endpoint, content=request.payload)
                    response = runner.run(sent)
                    if response.status_code != action.response.status_code:
                        print(
                            f"""\033[31mStatus code {response.status_code} does not match expected status code """
                            f"""{action.response.status_code}.\033[0m""",
                        )
                        if stop_on_mismatch:
                            break
                    if response.status_code != 200:
                        print(f"Status code: {response.status_code}")
                        if response.status_code // 100 == 4:
                            print("\033[33m" + response.text + "\033[0m")
                        elif response.status_code // 100 == 5:
                            print("\033[31mServer error, look at the stack above.\033[0m")
                            if stop_on_server_error:
                                break
                try:
                    # After every tick and action, verify the state of the engine
                    verify()
                except AssertionError:
                    print("\033[31mAssertion error.\033[0m")
                    if stop_on_assertion_error:
                        break
            else:
                return True
            return False
        finally:
            for client in clients.values():
                runner.run(client.aclose())
