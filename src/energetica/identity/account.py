"""
A server-wide account, as a run sees it.

The lobby service owns accounts (ADR-0009). A run only needs to know who an account is: its
immutable ``account_id``, which a settled ``Player`` references, and its username. The account's
role and membership in the run are not part of it, since they can change at any time; a run reads
them from the lobby service on every request (:mod:`energetica.identity.web`).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Role = Literal["player", "facilitator"]
"""An account's role in one run (ADR-0004). It can change at any time, so it is not part of :class:`Account`."""


@dataclass(frozen=True)
class Account:
    account_id: int
    username: str
