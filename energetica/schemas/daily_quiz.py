"""Schemas for API routes for the daily quiz."""

from typing import Literal

from pydantic import BaseModel


class DailyQuizBase(BaseModel):
    question: str
    answer1: str
    answer2: str
    answer3: str
    player_answer: Literal["answer1", "answer2", "answer3"] | None = None
    correct_answer: Literal["answer1", "answer2", "answer3", "all correct"] | None = None
    answered_correctly: bool | None = None
    explanation: str | None = None
    learn_more_link: str | None = None


class DailyQuizSubmitRequest(BaseModel):
    player_answer: Literal["answer1", "answer2", "answer3"]
