"""A Workshop Run's session: the moderator-paced state machine and the state it carries (#994).

A session runs a configured number of Rounds. Each Round has one Investment phase, then four Trading
periods (spring, summer, autumn, winter), then a Recap. Each of those is a **checkpoint**: the
session sits at one until the moderator advances it, however long that takes. There is no clock,
no timeout and no separate pause. The session also has a checkpoint before Round 1, while players
arrive, and one after the last Recap, when the session is over.

    NotStarted → [Investment → TradingPeriod ×4 → Recap] × round_count → Finished

:class:`WorkshopSession` holds a Run's whole state: the current checkpoint, the Round count, the
round-configuration levers, and the Run's single shared Network. It is saved to a JSON file after
every change and reloaded from it on start, so a restart resumes the session where it was. This is
Workshop's own persistence. It shares nothing with the persistent world's model store or checkpoints
(#1049), and the file follows the shape of the session rather than of any persistent-world object.
"""

from __future__ import annotations

import os
import tempfile
import threading
from pathlib import Path
from typing import TYPE_CHECKING, Annotated, Literal, get_args

from pydantic import BaseModel, Field

from energetica.workshop.network import WorkshopNetwork
from energetica.workshop.setup import open_workshop_run

if TYPE_CHECKING:
    from energetica.identity.accounts import Account
    from energetica.identity.instance_config import InstanceConfig
    from energetica.workshop.player import WorkshopPlayer

Season = Literal["spring", "summer", "autumn", "winter"]
SEASONS: tuple[Season, ...] = get_args(Season)

# How many Rounds a session runs unless the moderator chooses otherwise (#992). A placeholder, like
# every other Workshop magnitude.
DEFAULT_ROUND_COUNT = 3


class NotStarted(BaseModel):
    """Before Round 1: players are arriving and nothing is open yet."""

    model_config = {"frozen": True, "extra": "forbid"}
    kind: Literal["not_started"] = "not_started"


class Investment(BaseModel):
    """A Round's Investment phase, where players build facilities and buy fuel."""

    model_config = {"frozen": True, "extra": "forbid"}
    kind: Literal["investment"] = "investment"
    round: int = Field(ge=1)


class TradingPeriod(BaseModel):
    """One of a Round's four Trading periods, one per season."""

    model_config = {"frozen": True, "extra": "forbid"}
    kind: Literal["trading_period"] = "trading_period"
    round: int = Field(ge=1)
    season: Season


class Recap(BaseModel):
    """The close of a Round, telling the story of what happened in it."""

    model_config = {"frozen": True, "extra": "forbid"}
    kind: Literal["recap"] = "recap"
    round: int = Field(ge=1)


class Finished(BaseModel):
    """After the last Round's Recap. The session cannot advance any further."""

    model_config = {"frozen": True, "extra": "forbid"}
    kind: Literal["finished"] = "finished"


Checkpoint = Annotated[NotStarted | Investment | TradingPeriod | Recap | Finished, Field(discriminator="kind")]


class SessionFinishedError(Exception):
    """Raised when advancing a session that is already :class:`Finished`."""


def next_checkpoint(checkpoint: Checkpoint, *, round_count: int) -> Checkpoint:
    """The checkpoint that follows ``checkpoint`` in a session of ``round_count`` Rounds."""
    match checkpoint:
        case NotStarted():
            return Investment(round=1)
        case Investment(round=round_number):
            return TradingPeriod(round=round_number, season=SEASONS[0])
        case TradingPeriod(round=round_number, season=season) if season != SEASONS[-1]:
            return TradingPeriod(round=round_number, season=SEASONS[SEASONS.index(season) + 1])
        case TradingPeriod(round=round_number):
            return Recap(round=round_number)
        case Recap(round=round_number) if round_number < round_count:
            return Investment(round=round_number + 1)
        case Recap():
            return Finished()
        case Finished():
            raise SessionFinishedError("the session is over")


class RoundLevers(BaseModel):
    """The round-configuration levers the moderator changes during a session.

    Empty for now: each lever is added by the ticket that builds it (#1012, #1018). They belong to
    the session, saved with it, and not to ``WorkshopRun`` in ``instance.json``, which the sysadmin
    writes when the Run is provisioned.
    """

    model_config = {"extra": "forbid"}


class _SavedPlayer(BaseModel):
    account_id: int
    username: str
    money: float


class _SavedSession(BaseModel):
    """The JSON file a session is saved to."""

    model_config = {"extra": "forbid"}

    checkpoint: Checkpoint
    round_count: int = Field(ge=1)
    levers: RoundLevers
    players: list[_SavedPlayer]


class WorkshopSession:
    """A Workshop Run's whole state, saved to ``path`` after every change.

    Open one per Run with :meth:`open` and keep it for the life of the process. Opening it twice
    against the same file gives two objects that each overwrite the other's saves.
    """

    def __init__(
        self,
        *,
        network: WorkshopNetwork,
        path: Path,
        checkpoint: Checkpoint,
        round_count: int,
        levers: RoundLevers,
    ) -> None:
        if round_count < 1:
            raise ValueError(f"a session needs at least one Round, not {round_count}")
        self.network = network
        self.path = path
        self.checkpoint: Checkpoint = checkpoint
        self.round_count = round_count
        self.levers = levers
        # Makes each change and the save that follows it one step, so two requests can neither
        # advance from the same checkpoint nor save over each other's change.
        self._lock = threading.Lock()

    @classmethod
    def open(cls, config: InstanceConfig, path: Path, *, round_count: int = DEFAULT_ROUND_COUNT) -> WorkshopSession:
        """Reload the session saved at ``path``, or start a new one there if there is none.

        ``round_count`` applies only to a new session; a reloaded one keeps the count it was saved
        with. A file that exists but cannot be read raises ``ValueError`` rather than starting over,
        since starting over would discard a running session. Like :func:`open_workshop_run`, this
        raises :class:`~energetica.workshop.setup.NotAWorkshopRunError` unless ``config`` is a
        Workshop Run.
        """
        network = open_workshop_run(config)
        if not path.exists():
            session = cls(
                network=network, path=path, checkpoint=NotStarted(), round_count=round_count, levers=RoundLevers()
            )
            session._save(session.checkpoint)
            return session
        saved = _SavedSession.model_validate_json(path.read_text(encoding="utf-8"))
        for player in saved.players:
            network.restore(account_id=player.account_id, username=player.username, money=player.money)
        return cls(
            network=network,
            path=path,
            checkpoint=saved.checkpoint,
            round_count=saved.round_count,
            levers=saved.levers,
        )

    def upcoming_checkpoint(self) -> Checkpoint | None:
        """The checkpoint :meth:`advance` would move to, or ``None`` once the session is finished."""
        if isinstance(self.checkpoint, Finished):
            return None
        return next_checkpoint(self.checkpoint, round_count=self.round_count)

    def advance(self) -> Checkpoint:
        """Move to the next checkpoint and return it. The only way the session changes phase.

        Raises :class:`SessionFinishedError` once the session is :class:`Finished`.
        """
        with self._lock:
            checkpoint = next_checkpoint(self.checkpoint, round_count=self.round_count)
            # Saved before it is applied, so a failed write leaves the session where the file says.
            self._save(checkpoint)
            self.checkpoint = checkpoint
            return checkpoint

    def join(self, account: Account) -> WorkshopPlayer:
        """Place ``account`` into the Run's Network, or return its existing player."""
        with self._lock:
            is_new = account.account_id not in self.network.members
            player = self.network.join(account)
            if is_new:
                try:
                    self._save(self.checkpoint)
                except BaseException:
                    # Undo the join, so the session matches the file and the next entry retries it.
                    del self.network.members[account.account_id]
                    raise
            return player

    def _save(self, checkpoint: Checkpoint) -> None:
        """Write the session to its file as it would be at ``checkpoint``."""
        saved = _SavedSession(
            checkpoint=checkpoint,
            round_count=self.round_count,
            levers=self.levers,
            players=[
                _SavedPlayer(account_id=player.account_id, username=player.username, money=player.money)
                for player in self.network.players()
            ],
        )
        _write_atomically(self.path, saved.model_dump_json(indent=2))


def _write_atomically(path: Path, text: str) -> None:
    """Write ``text`` to ``path`` so that a crash mid-write leaves the previous file whole.

    Writes a temporary file beside ``path`` and renames it into place, which replaces the file in
    one step.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(dir=path.parent, prefix=f"{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as tmp_file:
            tmp_file.write(text)
        os.replace(tmp_name, path)
    except BaseException:
        Path(tmp_name).unlink(missing_ok=True)
        raise
