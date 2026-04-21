"""Utility for banning a player: removes all their game data while preserving a BannedRecord."""

from __future__ import annotations

import asyncio
from datetime import datetime

from energetica.database.active_facility import ActiveFacility
from energetica.database.banned_record import BannedRecord
from energetica.database.climate_event_recovery import ClimateEventRecovery
from energetica.database.messages import Chat, Notification
from energetica.database.ongoing_project import OngoingProject
from energetica.database.ongoing_shipment import OngoingShipment
from energetica.database.player import Player
from energetica.database.resource_on_sale import ResourceOnSale
from energetica.globals import MAIN_EVENT_LOOP, engine
from energetica.utils.network_helpers import leave_network


def ban_player(player: Player) -> None:
    """
    Permanently ban a player.

    Deletes all their game data (tile, network, facilities, projects, shipments,
    market listings, chats, notifications) and removes their User account.
    A BannedRecord is kept to label historical data points (e.g. market charts).
    """
    player_id = player.id
    username = player.username

    # Disconnect active socket sessions before any data is touched
    for sid in list(player.socketio_clients):
        asyncio.run_coroutine_threadsafe(engine.socketio.disconnect(sid), MAIN_EVENT_LOOP)

    # Leave electricity network
    if player.network is not None:
        remaining_network = leave_network(player)
        if remaining_network is not None:
            remaining_network.capacities.update_network(remaining_network)

    # Remove all market listings
    for sale in list(ResourceOnSale.filter_by(player=player)):
        sale.delete()

    # Cancel in-flight shipments and ongoing projects
    for shipment in list(OngoingShipment.filter_by(player=player)):
        shipment.delete()
    for project in list(OngoingProject.filter_by(player=player)):
        project.delete()

    # Destroy all facilities
    for facility in list(ActiveFacility.filter_by(player=player)):
        facility.delete()

    # Remove climate event recoveries
    for cer in list(ClimateEventRecovery.filter_by(player=player)):
        cer.delete()

    # Delete notifications
    for notification in list(Notification.filter_by(player=player)):
        notification.delete()

    # Handle chats
    for chat in list(Chat.filter(lambda c: player in c.participants)):
        if chat.is_group():
            # Remove from group/general chat and delete their messages
            chat.participants.discard(player)
            chat.messages = [m for m in chat.messages if m.player != player]
            chat.player_last_read_index.pop(player_id, None)
        else:
            # Delete the 1-to-1 chat entirely; reset the other participant's last opened chat
            for other in chat.participants:
                if other != player and other.last_opened_chat_id == chat.id:
                    other.last_opened_chat_id = engine.general_chat_id
            chat.delete()

    # Liberate the tile
    if player.tile is not None:
        player.tile.player = None

    # Clean up per-player engine caches
    engine.config.for_player.pop(player_id, None)
    if engine.daily_question and "player_answers" in engine.daily_question:
        engine.daily_question["player_answers"].pop(player_id, None)

    # Record the ban before deleting the objects
    engine.banned_records[player_id] = BannedRecord(
        id=player_id,
        username=username,
        banned_at=datetime.now(),
    )
    engine.log(f"Player {username} (id={player_id}) was banned")

    # Delete User then Player
    user = player.user
    user.player = None
    user.delete()
    player.delete()

    # Invalidate caches for all connected players
    engine.invalidate_queries(["players"], ["leaderboards"], ["chats"], ["map"])
