"""
Class for errors in the game.

These include game-level for API response like "not enough money".
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any


class GameError(Exception):
    """Define the exception class for the game engine."""

    def __init__(self, exception_type: GameExceptionType, **kwargs: Any):
        self.exception_type = exception_type
        self.kwargs = kwargs
        Exception.__init__(self, exception_type)


class GameExceptionType(StrEnum):
    NOT_ENOUGH_MONEY = "Not enough money"
    # Tile related
    TILE_NOT_FOUND = "TileNotFound"
    NO_TILE = "noTile"
    NO_LOCATION = "noLocation"
    PLAYER_HAS_NO_TILE = "Player has no tile"
    LOCATION_OCCUPIED = "locationOccupied"
    CHOICE_UNMODIFIABLE = "choiceUnmodifiable"
    # Auth related
    USERNAME_TAKEN = "USERNAME_TAKEN"
    USER_NOT_FOUND = "USER_NOT_FOUND"
    INVALID_PASSWORD = "INVALID_PASSWORD"
    NOT_AUTHENTICATED = "NOT_AUTHENTICATED"
    USER_IS_NOT_A_PLAYER = "USER_IS_NOT_A_PLAYER"
    PLAYER_NOT_SET_UP = "PLAYER_NOT_SET_UP"
    SIGNUP_DISABLED = "SIGNUP_DISABLED"
    OLD_PASSWORD_INCORRECT = "OLD_PASSWORD_INCORRECT"
    # Technology effects
    INVALID_MULTIPLIER = "InvalidMultiplier"
    # network prices
    MALFORMED_REQUEST = "malformedRequest"
    # Project
    PROJECT_NOT_FOUND = "Project not found"
    CANNOT_DECREASE_PRIORITY_OF_LAST_PROJECT = "CannotDecreasePriorityOfLastProject"
    CANNOT_INCREASE_PRIORITY_OF_FIRST_PROJECT = "CannotIncreasePriorityOfFirstProject"
    REQUIREMENTS_PREVENT_REORDER = "requirementsPreventReorder"
    CANNOT_PAUSE = "cannotPause"
    CANNOT_RESUME = "cannotResume"
    CANNOT_SWAP_PAUSED_PROJECT = "CannotSwapPausedProject"
    PAUSED_PREREQUISITE_PREVENT_UNPAUSE = "PausedPrerequisitePreventUnpause"
    REQUIREMENTS_NOT_SATISFIED = "Requirements not satisfied"
    HAS_DEPENDENTS = "HasDependents"
    # Facilities
    FACILITY_NOT_UPGRADABLE = "Facility not upgradable"
    FACILITY_IS_DECOMMISSIONING = "FacilityIsDecommissioning"
    FACILITY_NOT_FOUND = "Facility not found"
    CANNOT_REMOVE_TECHNOLOGY_OR_FUNCTIONAL_FACILITIES = "Cannot remove technologies or functional facilities"
    # Chat
    WRONG_TITLE_LENGTH = "wrongTitleLength"
    CHAT_ALREADY_EXISTS = "chatAlreadyExist"
    NOT_IN_CHAT = "notInChat"
    NO_MESSAGE = "noMessage"
    MESSAGE_TOO_LONG = "messageTooLong"
    # Daily quiz
    QUIZ_ALREADY_ANSWERED = "quizAlreadyAnswered"
    # Network
    NETWORK_NOT_UNLOCKED = "networkNotUnlocked"
    NO_SUCH_NETWORK = "noSuchNetwork"
    PLAYER_ALREADY_IN_NETWORK = "playerAlreadyInNetwork"
    NAME_ALREADY_USED = "nameAlreadyUsed"
    NOT_IN_NETWORK = "notInNetwork"
    # Resource market
    NOT_ENOUGH_RESOURCE = "notEnoughResource"
    INVALID_QUANTITY = "invalidQuantity"
