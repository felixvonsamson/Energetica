from typing import Literal

from pydantic import BaseModel


class DailyQuizBase(BaseModel):
    question: str
    answer1: str
    answer2: str
    answer3: str
    player_answer: Literal["answer1", "answer2", "answer3"] | None
    correct_answer: Literal["answer1", "answer2", "answer3", "all correct"] | None
    answered_correctly: bool | None
    explanation: str | None


class DailyQuizSubmission(BaseModel):
    player_answer: Literal["answer1", "answer2", "answer3"]
