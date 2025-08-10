"""Schemas for the action logger."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field


class InitEngineAction(BaseModel):
    instance_uuid: str
    env: Literal["dev", "prod"]
    clock_time: int
    in_game_seconds_per_tick: int
    action_type: Literal["init_engine"]
    random_seed: int
    start_date: datetime
    disable_signups: bool


class CreateUserAction(BaseModel):
    timestamp: datetime
    ip: str
    action_type: Literal["create_user"]
    player_id: int
    username: str
    pw_hash: str


class TickAction(BaseModel):
    timestamp: datetime
    action_type: Literal["tick"]
    total_t: int
    elapsed: float


class RequestAction(BaseModel):
    timestamp: datetime
    elapsed: float
    ip: str
    action_type: Literal["request"]
    player_id: int
    request: dict
    response: dict
    # "request": {"endpoint": "/api/v1/map/252:settle", "content_type": "application/json", "content": {}},
    # "response": {"status_code": 204, "content_type": "application/json", "content": "unparsable"},


ActionUnionType = InitEngineAction | CreateUserAction | TickAction | RequestAction
Action = Annotated[ActionUnionType, Field(discriminator="action_type")]
