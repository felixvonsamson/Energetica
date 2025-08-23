"""routes for admin actions."""

from __future__ import annotations

from fastapi import APIRouter

from energetica.api.http import get_chart_data
from energetica.database.player import Player

router = APIRouter(prefix="/admin-actions", tags=["Admin Actions"])


# ensure the actions on this router are only accessible by admins
@router.get("/chart-data/{player_id}")
def chart_data(player_id: int):  # noqa: ANN201
    """Get chart data for the admin dashboard."""
    player = Player.getitem(player_id)
    return get_chart_data(player)
