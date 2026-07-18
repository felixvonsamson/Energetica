"""The recap: a frozen JSON tombstone of an instance's final leaderboard (G1, #859).

A recap is a **write-once, immutable snapshot** minted at the ``active → freeze`` transition and
published to the lobby (``recaps/{slug}.json``), where it outlives the instance process (T7). It is a
**curated projection** — a single income-ranked table plus a small instance-totals header — *not* the
verbatim :class:`~energetica.schemas.leaderboards.PlayerDetailStats`: the extra columns are cheap as
data but costly as render/parse surface, and they graduate from the fog as full-recap features later.

**Frozen-photograph semantics:** every row captures the player's identity *as it was at freeze*
(``username_at_freeze``, ``network_name``). The immutable ``account_id`` FK is retained so a future
cross-instance indexer can resolve the row to a current identity without coupling this baseline to SQL.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Iterable, Mapping, Protocol

from pydantic import AwareDatetime, BaseModel, Field

if TYPE_CHECKING:
    from energetica.instance_config import InstanceConfig


class _RecapUser(Protocol):
    account_id: int


class _RecapNetwork(Protocol):
    name: str


class RecapPlayer(Protocol):
    """The narrow slice of a player the projection actually reads.

    A structural view (any ``Player`` satisfies it), so :meth:`Recap.from_players` depends on this
    shape rather than the ORM — the schema stays a game-domain-free leaf and is testable with plain
    stand-ins.
    """

    @property
    def username(self) -> str: ...

    @property
    def user(self) -> _RecapUser: ...

    @property
    def network(self) -> _RecapNetwork | None: ...

    @property
    def progression_metrics(self) -> Mapping[str, float]: ...

    def calculate_net_emissions(self) -> float: ...


class RecapRow(BaseModel):
    """One player's final standing, one row of the income-ranked leaderboard."""

    rank: int = Field(description="1-based placement by operating_income desc — the medal")
    account_id: int = Field(description="Server-wide account FK, retained for future identity resolution")
    username_at_freeze: str = Field(description="The player's name as it was at freeze (frozen photograph)")
    network_name: str | None = Field(description="The player's network/team at freeze, or None if unaffiliated")
    operating_income: float = Field(description="Lifetime cumulated operating income — the sort key, 'who won'")
    xp: float = Field(description="Experience points — 'how far I got'")
    captured_co2: float = Field(description="Total captured CO2 in kg — the on-theme brag stat")


class Recap(BaseModel):
    """The full published recap payload: an identity/totals header plus the income-ranked table.

    Sized for a single payload (~100 players × 7 fields ≈ 15 KB), so the lobby fetches and renders it
    with no live backend. Carries the same transition timestamps the fragment does, so the lobby can
    render start/end dates without a second lookup.
    """

    slug: str
    name: str
    starts_at: AwareDatetime
    # Both later boundaries mirror the fragment: nullable because ``ended_at`` in particular is often
    # still unset at mint time (the run has only just frozen), and the phase ladder treats a None
    # boundary as simply never crossed.
    freeze_at: AwareDatetime | None = None
    ended_at: AwareDatetime | None = None
    player_count: int
    total_captured_co2: float = Field(description="Sum of captured_co2 across all players, in kg")
    total_net_emissions: float = Field(description="Sum of net CO2 emissions across all players, in kg")
    rows: list[RecapRow]

    @classmethod
    def from_players(
        cls,
        *,
        slug: str,
        config: InstanceConfig,
        players: Iterable[RecapPlayer],
    ) -> Recap:
        """Project the live final game state into the frozen recap payload.

        Players are ranked by ``operating_income`` descending (rank 1 = the winner); the totals header
        sums ``captured_co2`` and ``net_emissions`` across everyone. Ties break on the immutable
        ``account_id`` (ascending), so the ranking — and every row's ``rank`` — is fully reproducible:
        a re-mint (admin regenerate) yields the identical frozen photograph rather than reshuffling
        equal-income players by enumeration order.
        """
        ranked = sorted(
            players,
            key=lambda player: (-player.progression_metrics.get("operating_income", 0), player.user.account_id),
        )
        rows = [
            RecapRow(
                rank=rank,
                account_id=player.user.account_id,
                username_at_freeze=player.username,
                network_name=player.network.name if player.network else None,
                operating_income=player.progression_metrics.get("operating_income", 0),
                xp=player.progression_metrics.get("xp", 0),
                captured_co2=player.progression_metrics.get("captured_co2", 0),
            )
            for rank, player in enumerate(ranked, start=1)
        ]
        return cls(
            slug=slug,
            name=config.name,
            starts_at=config.starts_at,
            freeze_at=config.freeze_at,
            ended_at=config.ended_at,
            player_count=len(rows),
            total_captured_co2=sum(player.progression_metrics.get("captured_co2", 0) for player in ranked),
            total_net_emissions=sum(player.calculate_net_emissions() for player in ranked),
            rows=rows,
        )
