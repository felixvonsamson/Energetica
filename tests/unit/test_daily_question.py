from werkzeug.security import generate_password_hash

from energetica import create_app, engine
from energetica.database.map import HexTile
from energetica.database.player import Player
from energetica.utils.misc import confirm_location


def test_daily_question_exists():
    """Test that the daily question exists."""
    create_app(rm_instance=True, skip_adding_handlers=True)
    assert engine.daily_question is not None
