"""Engine state pickled before a module moved still loads (#1055).

Pickle records each object's class by its module path. Every ``instance/engine_data.pck`` and
checkpoint written before #1055 names the entity models ``energetica.database.*``, which now live
under ``energetica.freeplay.database``. The pickles here are written at protocol 0, whose opcodes are
plain text, so an old-layout pickle can be made by rewriting the module path in the bytes.
"""

from __future__ import annotations

import io
import pickle

from energetica.freeplay import legacy_pickle
from energetica.freeplay.database.engine_data.cumulative_emissions_data import CumulativeEmissionsData


def _emissions() -> CumulativeEmissionsData:
    emissions = CumulativeEmissionsData()
    emissions.add("steam_engine", 12.5)
    return emissions


def test_a_pickle_naming_the_old_module_path_loads_as_the_moved_class() -> None:
    current = pickle.dumps({"current_climate_data": _emissions()}, protocol=0)
    old_layout = current.replace(b"energetica.freeplay.database.", b"energetica.database.")
    assert b"energetica.freeplay" not in old_layout

    loaded = legacy_pickle.load(io.BytesIO(old_layout))

    assert isinstance(loaded["current_climate_data"], CumulativeEmissionsData)
    assert loaded["current_climate_data"].get_all() == {"steam_engine": 12.5, "construction": 0.0}


def test_a_pickle_naming_the_current_module_path_still_loads() -> None:
    current = pickle.dumps({"current_climate_data": _emissions()})

    loaded = legacy_pickle.load(io.BytesIO(current))

    assert loaded["current_climate_data"].get_all() == {"steam_engine": 12.5, "construction": 0.0}
