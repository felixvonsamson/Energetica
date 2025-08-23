"""Unit tests for the daily quiz."""

from energetica import create_app, engine


def test_daily_question_exists() -> None:
    """Test that the daily question exists."""
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    assert engine.daily_question is not None
    assert engine.daily_question is not None
