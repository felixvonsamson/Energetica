"""WIP."""

from typing import Annotated
from pydantic import RootModel, Field


class SeasonalRiverDischargeConfig(
    RootModel[
        Annotated[
            list[Annotated[float, Field(ge=0, le=1)]],
            Field(
                min_length=72,
                max_length=72,
            ),
        ]
    ],
):
    def __getitem__(self, item: int) -> float:
        return self.root[item]
