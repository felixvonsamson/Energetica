"""The recap: a frozen JSON tombstone of an instance's final state (G1, #859).

A recap is a **write-once, immutable snapshot** minted at the ``active → freeze`` transition and
published to the lobby (``recaps/{slug}.json``), where it outlives the instance process (T7). It is a
**curated projection** — a single per-player table plus a small instance-totals header — *not* the
verbatim :class:`~energetica.schemas.leaderboards.PlayerDetailStats`: the extra columns are cheap as
data but costly as render/parse surface, and they graduate from the fog as full-recap features later.

**A retrospective, not a scoreboard (ADR-0005, supersedes G1's competitive framing).** The recap
crowns no winner: there is no rank and no medal. CO2 is laid bare as two un-netted columns — gross
``produced_co2`` and ``captured_co2`` — so a heavy emitter who also captures heavily reads as exactly
that, the relationship visible rather than collapsed. Rows default to ``operating_income`` descending
as a soft "most consequential first" ordering, not a verdict; any per-column notability is derived
client-side, never minted into the payload.

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

    def calculate_produced_co2(self) -> float: ...

    def calculate_net_emissions(self) -> float: ...


class RecapRow(BaseModel):
    """One player's final standing, one row of the per-player table (no rank — ADR-0005)."""

    account_id: int = Field(description="Server-wide account FK, retained for future identity resolution")
    username_at_freeze: str = Field(description="The player's name as it was at freeze (frozen photograph)")
    network_name: str | None = Field(description="The player's network/team at freeze, or None if unaffiliated")
    operating_income: float = Field(description="Lifetime cumulated operating income — the default sort key")
    xp: float = Field(description="Experience points — 'how far I got'")
    produced_co2: float = Field(description="Gross CO2 produced in kg — shown un-netted against captured (ADR-0005)")
    captured_co2: float = Field(description="Total captured CO2 in kg — shown un-netted against produced (ADR-0005)")


class RecapTile(BaseModel):
    """One frozen map tile: its terrain plus who settled it, at freeze (G1 addendum, #859).

    The in-game :class:`~energetica.schemas.map.HexTileOut` shape minus the throwaway ``id``, with the
    live ``player_id`` swapped for the durable ``owner_account_id``. Tiles join the leaderboard
    :class:`RecapRow` s by ``account_id`` — settlement is 1:1 (one player per tile) — so no ``tile_id``
    is needed on the rows and no second identity system enters the tombstone.

    Terrain is frozen (not just ownership) because it is **un-recomputable** after the fact: the map is
    regenerated manually between instances and never persisted, so only this frozen copy renders an old
    recap on the terrain it was actually played on — the same frozen-photograph principle as usernames.
    """

    q: int
    r: int
    solar: float
    wind: float
    hydro: float
    coal: float
    gas: float
    uranium: float
    climate_risk: float
    owner_account_id: int | None = Field(
        description="Durable account FK of the player who settled this tile, or None if unsettled"
    )


class Recap(BaseModel):
    """The full published recap payload: an identity/totals header plus the per-player table.

    Sized for a single payload (~100 players × 8 fields ≈ 15 KB), so the lobby fetches and renders it
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
    total_produced_co2: float = Field(description="Sum of produced_co2 (gross) across all players, in kg")
    total_captured_co2: float = Field(description="Sum of captured_co2 across all players, in kg")
    total_net_emissions: float = Field(description="Sum of net CO2 emissions across all players, in kg")
    rows: list[RecapRow]
    # Required (no default) on purpose: a pre-addendum recap on disk lacks this key, so it fails to
    # load (``load_recap`` → None) and the mint-once guard re-mints it *with* the snapshot — the same
    # self-heal path a corrupt artifact takes. The projection itself lives in ``utils.recap`` (it needs
    # the game-domain Fuel/Renewable enums the leaf must not import), so this field is passed in built.
    tiles: list[RecapTile] = Field(description="Frozen map snapshot: terrain + ownership at freeze")

    @classmethod
    def from_players(
        cls,
        *,
        slug: str,
        config: InstanceConfig,
        players: Iterable[RecapPlayer],
        tiles: Iterable[RecapTile] = (),
    ) -> Recap:
        """Project the live final game state into the frozen recap payload.

        Rows are emitted in ``operating_income``-descending order — the default "most consequential
        first" view, not a ranking (ADR-0005): no row carries a rank. The totals header sums
        ``produced_co2``, ``captured_co2`` and ``net_emissions`` across everyone. Order ties break on
        the immutable ``account_id`` (ascending), so the frozen photograph is fully reproducible: a
        re-mint (admin regenerate) yields the identical row order rather than reshuffling equal-income
        players by enumeration order.

        ``tiles`` is the already-projected frozen map snapshot (built by the caller, which owns the
        game-domain read); it is carried through verbatim so the whole recap is one payload.
        """
        ordered = sorted(
            players,
            key=lambda player: (-player.progression_metrics.get("operating_income", 0), player.user.account_id),
        )
        rows = [
            RecapRow(
                account_id=player.user.account_id,
                username_at_freeze=player.username,
                network_name=player.network.name if player.network else None,
                operating_income=player.progression_metrics.get("operating_income", 0),
                xp=player.progression_metrics.get("xp", 0),
                produced_co2=player.calculate_produced_co2(),
                captured_co2=player.progression_metrics.get("captured_co2", 0),
            )
            for player in ordered
        ]
        return cls(
            slug=slug,
            name=config.name,
            starts_at=config.starts_at,
            freeze_at=config.freeze_at,
            ended_at=config.ended_at,
            player_count=len(rows),
            total_produced_co2=sum(player.calculate_produced_co2() for player in ordered),
            total_captured_co2=sum(player.progression_metrics.get("captured_co2", 0) for player in ordered),
            total_net_emissions=sum(player.calculate_net_emissions() for player in ordered),
            rows=rows,
            tiles=list(tiles),
        )
