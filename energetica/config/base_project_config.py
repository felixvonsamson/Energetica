"""WIP."""

from pydantic import BaseModel, Field, HttpUrl

from energetica.enums import FunctionalFacilityType, TechnologyType


class BaseProjectConfig(BaseModel):
    name: str = Field(description="Name of the facility")
    description: str = Field(description="Description of the power facility")
    wikipedia_link: HttpUrl | None = Field(description="Wikipedia link for more information")
    base_price: int = Field(ge=0, description="Base price of the power facility")
    base_construction_time: float = Field(ge=0, description="Base construction time in seconds")
    base_construction_pollution: float = Field(ge=0, description="Base construction pollution in kg CO2", default=0)
    requirements: dict[TechnologyType | FunctionalFacilityType, int] = Field(
        description="Requirements for building the power facility",
    )
