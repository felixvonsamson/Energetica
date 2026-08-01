"""
PROTOTYPE — throwaway, not wired into the app. Wayfinder ticket #933
(child of map #924, "Game-instance persistence: ADR on moving off pickle
onto Postgres").

Question this answers: does an ActiveFacility SQLModel table *feel* right,
concretely, as a stand-in for "adopt an ORM, SQLModel-leaning" (decided in
ticket #928) — before that choice is locked into the ADR?

Real class rewritten: energetica/database/active_facility.py.
Chosen over Player as the representative entity: fewer fields (7 vs. ~30),
but a meatier *mix* of the patterns worth reacting to:
  - a real FK relationship (facility -> player)
  - a polymorphic field: facility_type is typed as a union of THREE
    (really four, once ControllableFacilityType/RenewableFacilityType are
    unpacked) separate StrEnum classes with overlapping string domains,
    not one enum
  - a dict field (multipliers) that has no natural column shape -> JSON
  - a tuple field (position) -> JSON
  - ~20 @property methods computed from other fields + a global config
    dict; the question is whether these survive untouched on a SQLModel
    class, and they do (see below)
  - a hand-rolled ClassVar index (_player_type_index) that the codebase
    survey (docs/research/dbmodel-postgres-survey.md, branch
    research/932-dbmodel-postgres-survey) flagged as a materialized index
    a real DB should replace with a query, not translate 1:1 -> see
    `facilities_of_type()` below

Deliberately left out (out of scope for this prototype):
  - no Alembic / migrations
  - no wiring into engine.py, GameEngine.save()/load(), or any router
  - no rewrite of the ~15 call sites that mutate ActiveFacility today
  - no attempt to port all ~20 @property methods — six representative
    ones are ported verbatim in shape (imports/const_config faked out
    locally so this file has zero dependency on the rest of the app)
  - no answer to "how do we reconstruct the right StrEnum subclass from
    a plain string column" — that ambiguity is *surfaced*, not resolved,
    via the FACILITY_TYPE_LOOKUP shim below

Run: .venv/bin/python scratch/prototype_933_active_facility_sqlmodel.py

This isn't an interactive TUI (LOGIC.md's default shape) — the question
here is "does this table shape hold up against real access patterns,"
not "walk a state machine through edge cases by hand" — so instead it's a
short scripted run through the load-bearing cases, printing full state
after each one.
"""

from enum import StrEnum
from typing import Any

from sqlmodel import JSON, Column, Field, Relationship, Session, SQLModel, create_engine, select

# --- stand-ins for energetica/enums.py, trimmed to what this prototype needs ---


class RenewableFacilityType(StrEnum):
    SOLAR_PANEL = "solar_panel"
    WIND_TURBINE = "wind_turbine"


class ControllableFacilityType(StrEnum):
    COAL_BURNER = "coal_burner"
    GAS_BURNER = "gas_burner"


class StorageFacilityType(StrEnum):
    SMALL_PUMPED_HYDRO = "small_pumped_hydro"


class ExtractionFacilityType(StrEnum):
    COAL_MINE = "coal_mine"


# Real code spells this as a type alias union (PowerFacilityType = Renewable | Controllable,
# then FacilityType = Power | Storage | Extraction). A DB column can't store "one of four
# distinct enum classes" natively -- it stores a string. FACILITY_TYPE_LOOKUP is the shim
# that has to exist *somewhere* to go from "coal_burner" back to ControllableFacilityType.COAL_BURNER
# rather than a bare str. This is new code the current dataclass version never needed, because
# Python object identity meant the original enum member was always just... still the object.
FACILITY_TYPE_LOOKUP: dict[str, StrEnum] = {
    member.value: member
    for enum_cls in (RenewableFacilityType, ControllableFacilityType, StorageFacilityType, ExtractionFacilityType)
    for member in enum_cls
}

# --- stand-in for energetica/config/assets.py's const_config, trimmed ---

const_config: dict[str, dict[str, Any]] = {
    "coal_burner": {"name": "Coal burner", "base_price": 1000.0, "base_power_generation": 500_000.0},
    "solar_panel": {"name": "Solar panel", "base_price": 400.0, "base_power_generation": 200_000.0},
}


# --- the SQLModel rewrite ---


class Player(SQLModel, table=True):
    """Minimal stub -- the real Player has ~30 fields; only `id`/`name` matter here."""

    id: int | None = Field(default=None, primary_key=True)
    name: str

    facilities: list["ActiveFacility"] = Relationship(back_populates="player")


class ActiveFacility(SQLModel, table=True):
    """
    SQLModel rewrite of energetica/database/active_facility.py's ActiveFacility.

    Compare to the original: `player: Player` (a live object reference) becomes
    `player_id: int` (a FK) plus a `player: Player` *relationship* -- two fields
    where there was one, because "which row" and "the loaded object" are no
    longer the same thing once a row can be absent from memory.
    """

    id: int | None = Field(default=None, primary_key=True)

    # union of 4 StrEnum classes -> plain str column; FACILITY_TYPE_LOOKUP reconstructs
    # the specific enum member on read (see `facility_type_enum` below)
    facility_type: str

    player_id: int = Field(foreign_key="player.id")
    player: Player = Relationship(back_populates="facilities")

    # tuple[float, float] has no native column type -> JSON
    position: list[float] = Field(sa_column=Column(JSON))

    end_of_life: float

    # dict[str, float] -> JSON, same reasoning as position
    multipliers: dict[str, float] = Field(sa_column=Column(JSON))

    usage: float = 0.0
    cut_out_speed_exceeded: bool = False

    # --- everything below this line has NO sa_column / Field -- these are plain
    # Python @property methods, exactly as in the original. This is the actual
    # answer to the ticket's question: SQLModel classes are still plain Python
    # classes, so computed properties port over completely unchanged.

    @property
    def facility_type_enum(self) -> StrEnum:
        """What the original's `facility_type` attribute *was*: the actual enum member, not a str."""
        return FACILITY_TYPE_LOOKUP[self.facility_type]

    @property
    def decommissioning(self) -> bool:
        return self.end_of_life == 0

    @property
    def const_config(self) -> dict:
        return const_config[self.facility_type]

    @property
    def display_name(self) -> str:
        return self.const_config["name"]

    @property
    def total_cost(self) -> float:
        return self.const_config["base_price"] * self.multipliers["price_multiplier"]

    @property
    def max_power_generation(self) -> float:
        return self.const_config["base_power_generation"] * self.multipliers["power_production_multiplier"]


# --- what _player_type_index did, done as a query instead ---

_INDEX_DOC = """
Original: ActiveFacility._player_type_index is a ClassVar[dict[int, dict[FacilityType, list[ActiveFacility]]]],
populated in __post_init__, hand-maintained in delete(), and fully rebuilt by rebuild_index()
(called from engine.clear_db() and engine.load()) because nothing guarantees it survives a pickle
round-trip on its own. It exists purely so `ActiveFacility.filter_by(player=p, facility_type=t)` is O(1)
instead of an O(n) scan.

Replacement: a query. No separate data structure to keep in sync, nothing to rebuild after
load, nothing that can silently desync from a direct field mutation. The DB's own index on
(player_id, facility_type) is what makes this cheap instead of a hand-rolled Python dict.
"""


def facilities_of_type(session: Session, player_id: int, facility_type: str) -> list[ActiveFacility]:
    statement = select(ActiveFacility).where(
        ActiveFacility.player_id == player_id, ActiveFacility.facility_type == facility_type
    )
    return list(session.exec(statement))


# --- scripted run through the load-bearing cases ---


def _print_state(label: str, facilities: list[ActiveFacility]) -> None:
    print(f"\n--- {label} ---")
    for f in facilities:
        print(
            f"  id={f.id} type={f.facility_type_enum!r} player_id={f.player_id} "
            f"position={f.position} usage={f.usage} total_cost={f.total_cost:.1f} "
            f"display_name={f.display_name!r}"
        )


def main() -> None:
    engine = create_engine("sqlite://")  # in-memory, throwaway
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        alice = Player(name="alice")
        session.add(alice)
        session.commit()
        session.refresh(alice)

        coal = ActiveFacility(
            facility_type=ControllableFacilityType.COAL_BURNER.value,
            player_id=alice.id,
            position=[3.0, 4.0],
            end_of_life=500.0,
            multipliers={"price_multiplier": 1.2, "power_production_multiplier": 1.0},
        )
        solar = ActiveFacility(
            facility_type=RenewableFacilityType.SOLAR_PANEL.value,
            player_id=alice.id,
            position=[5.0, 6.0],
            end_of_life=800.0,
            multipliers={"price_multiplier": 1.0, "power_production_multiplier": 1.1},
        )
        session.add(coal)
        session.add(solar)
        session.commit()

        _print_state("after insert (2 facilities, 1 player)", session.exec(select(ActiveFacility)).all())

        # Case: the _player_type_index replacement -- "give me alice's coal burners"
        print(_INDEX_DOC)
        coal_only = facilities_of_type(session, alice.id, ControllableFacilityType.COAL_BURNER.value)
        _print_state("facilities_of_type(alice, COAL_BURNER) -- the index replacement", coal_only)

        # Case: mutate + commit, then re-read from a fresh session -- does a round-trip survive?
        coal.usage = 0.75
        session.add(coal)
        session.commit()

    with Session(engine) as fresh_session:
        reread = fresh_session.exec(select(ActiveFacility)).all()
        _print_state("re-read from a FRESH session after commit (round-trip check)", reread)
        # this is the thing the survey's "everything assumes synchronous, always-visible
        # in-memory mutation" landmine warns about: `coal` (the Python object mutated above)
        # is a *different* object from what `reread` returns -- no shared identity across sessions.
        print(f"\nsame Python object across sessions? {reread[0] is coal}")


if __name__ == "__main__":
    main()
