from __future__ import annotations

from pydantic import BaseModel, Field


class LoginData(BaseModel):
    username: str
    password: str


class SignupData(BaseModel):
    username: str = Field(min_length=3, max_length=18)
    password: str = Field(min_length=7)


class RootSignupData(BaseModel):
    username: str = Field(min_length=3, max_length=18)
    pwhash: str


class ChangePasswordData(BaseModel):
    old_password: str
    new_password: str = Field(min_length=7)
