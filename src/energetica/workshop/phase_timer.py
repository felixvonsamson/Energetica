"""The countdown on a Workshop phase (#996): how long players have left to invest or to set prices.

A phase opens with the duration the moderator configured, and the moderator can give the room more
time with "+N minutes" while it runs, or end it early by advancing: the phase then closes as if its
time had run out (#1004). Either way the session stays where it is: only the moderator's next advance
moves it on (#994).

:class:`PhaseTimer` is plain data with no clock of its own. Callers pass the current time in, so the
arithmetic needs no I/O and is the same before and after a restart.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from pydantic import AwareDatetime, BaseModel


class PhaseTimer(BaseModel):
    """A phase's countdown: when it opened, how long it was configured for, and each extension."""

    model_config = {"frozen": True, "extra": "forbid"}

    started_at: AwareDatetime
    duration: timedelta
    extensions: tuple[timedelta, ...] = ()

    @property
    def ends_at(self) -> datetime:
        """When the phase closes, counting every extension."""
        return self.started_at + self.duration + sum(self.extensions, timedelta(0))

    def remaining(self, now: datetime) -> timedelta:
        """How long the phase has left at ``now``. Zero once it has closed."""
        return max(self.ends_at - now, timedelta(0))

    def is_active(self, now: datetime) -> bool:
        """Whether the phase is still open at ``now``."""
        return now < self.ends_at

    def extended(self, by: timedelta) -> PhaseTimer:
        """This timer with ``by`` more time. ``by`` must be positive."""
        if by <= timedelta(0):
            raise ValueError(f"an extension must add time, not {by}")
        return self.model_copy(update={"extensions": (*self.extensions, by)})

    def closed_at(self, now: datetime) -> PhaseTimer:
        """This timer, ending at ``now`` instead, if it would end later."""
        if now >= self.ends_at:
            return self
        return PhaseTimer(started_at=self.started_at, duration=max(now - self.started_at, timedelta(0)))
