"""Request bodies that carry credentials: the lobby's login and sign-up forms (ADR-0003)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class SignupRequest(BaseModel):
    username: str = Field(min_length=3, max_length=18)
    password: str = Field(min_length=7)
