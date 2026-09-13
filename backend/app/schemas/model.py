"""Pydantic response schemas for the ocean model field endpoint."""

from pydantic import BaseModel


class ModelFieldPoint(BaseModel):
    """A single grid point with its geographic position and value."""

    latitude: float
    longitude: float
    value: float


class ModelFieldResponse(BaseModel):
    """Response for GET /api/v1/model-field."""

    variable: str
    unit: str
    depth: float
    time: str
    source: str
    points: list[ModelFieldPoint]


class ModelCapabilitiesResponse(BaseModel):
    """Actual selectable axes and variables discovered from the model NetCDF."""

    source: str
    variables: dict[str, str]
    depths_m: list[float]
    timestamps: list[str]
    time_steps: int
