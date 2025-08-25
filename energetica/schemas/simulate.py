"""Schemas for the action logger."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field


class InitEngineAction(BaseModel):
    instance_uuid: str
    env: Literal["dev", "prod"]
    game_version: str
    clock_time: int
    in_game_seconds_per_tick: int
    action_type: Literal["init_engine"]
    random_seed: int
    start_date: datetime
    disable_signups: bool


class CreateUserAction(BaseModel):
    timestamp: datetime
    ip: str | None
    action_type: Literal["create_user"]
    player_id: int
    username: str
    pw_hash: str


class TickAction(BaseModel):
    timestamp: datetime
    action_type: Literal["tick"]
    total_t: int
    elapsed: float


class ApiAction(BaseModel):
    timestamp: datetime
    elapsed: float
    ip: str
    action_type: Literal["request"]
    player_id: int | None
    request: ApiActionRequest
    response: ApiActionResponse


class ApiActionRequest(BaseModel):
    endpoint: str
    method: Method
    content_type: str | None
    payload: dict | Literal["unparsable or not JSON"] | None


class ApiActionResponse(BaseModel):
    status_code: int
    content_type: str
    payload: dict | Literal["unparsable or not JSON"] | None


Method = Literal["POST", "PUT", "DELETE", "PATCH", "CONNECT", "HEAD", "OPTIONS", "TRACE", "GET"]

ActionUnionType = InitEngineAction | CreateUserAction | TickAction | ApiAction
Action = Annotated[ActionUnionType, Field(discriminator="action_type")]
