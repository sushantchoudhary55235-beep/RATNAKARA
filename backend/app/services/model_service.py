"""Business logic for ocean model field requests.

The service calls the model processor and returns normalized data.
No xarray/NetCDF logic lives here and none lives in the API route.
"""

from __future__ import annotations

from datetime import datetime

from app.processing.model_processor import (
    DEFAULT_MAX_POINTS,
    get_variable_map,
    process_model_field,
)
from app.schemas.model import ModelFieldResponse


def get_model_field(
    *,
    variable: str,
    depth: float,
    time: datetime,
    lat_min: float | None = None,
    lat_max: float | None = None,
    lon_min: float | None = None,
    lon_max: float | None = None,
    max_points: int = DEFAULT_MAX_POINTS,
) -> ModelFieldResponse:
    """Process a model field slice and return the normalized response."""
    data = process_model_field(
        variable=variable,
        depth=depth,
        time=time,
        lat_min=lat_min,
        lat_max=lat_max,
        lon_min=lon_min,
        lon_max=lon_max,
        max_points=max_points,
    )
    return ModelFieldResponse(**data)