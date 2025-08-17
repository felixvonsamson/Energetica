"""Schemas for API routes related to authentication."""

from __future__ import annotations

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class SignupRequest(BaseModel):
    username: str = Field(min_length=3, max_length=18)
    password: str = Field(min_length=7)


class ChangePasswordRequest(BaseModel):  # TODO(mglst): use PUT or something
    old_password: str
    new_password: str = Field(min_length=7)
