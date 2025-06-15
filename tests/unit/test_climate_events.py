import numpy as np

from energetica import create_app
from energetica.database.map import HexTile
from energetica.utils.climate_helpers import climate_event_impact


def test_climate_events_exists() -> None:
    """Test that the daily question exists."""
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    climate_event_impact(HexTile.getitem(1), "flood", np.random.default_rng(0))
    climate_event_impact(HexTile.getitem(1), "heat_wave", np.random.default_rng(0))
    climate_event_impact(HexTile.getitem(1), "cold_wave", np.random.default_rng(0))
    climate_event_impact(HexTile.getitem(1), "hurricane", np.random.default_rng(0))
    climate_event_impact(HexTile.getitem(1), "wildfire", np.random.default_rng(0))
