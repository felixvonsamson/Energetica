"""WIP."""

from typing import Annotated
from pydantic import RootModel, Field


class WindPowerCurveConfig(
    RootModel[
        Annotated[
            list[Annotated[float, Field(ge=0, le=1)]],
            Field(
                min_length=91,
                max_length=91,
                description="Fraction of maximum power output, for speeds between 0 to 90 km/h",
            ),
        ]
    ],
):
    def __getitem__(self, item: int) -> float:
        return self.root[item]
