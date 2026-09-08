"""Business logic for observation requests.

The service calls the Argo processor and returns normalized data.
No xarray/NetCDF logic lives here and none lives in the API route.
"""

from __future__ import annotations

from datetime import datetime

from app.processing.argo_processor import (
    DEFAULT_MAX_OBS,
    InvalidParameterError,
    process_observations,
)
from app.schemas.observation import ObservationResponse

SUPPORTED_SOURCES = ("argo", "glider", "all")


def get_observations(
    *,
    source: str = "argo",
    latitude: float | None = None,
    longitude: float | None = None,
    lat_min: float | None = None,
    lat_max: float | None = None,
    lon_min: float | None = None,
    lon_max: float | None = None,
    depth: float | None = None,
    depth_tolerance: float = 25.0,
    time: datetime | None = None,
    time_tolerance_days: float = 30.0,
    radius_km: float | None = None,
    variable: str | None = None,
    max_observations: int = DEFAULT_MAX_OBS,
) -> ObservationResponse:
    """Process an observation request and return the normalized response.

    ``source`` supports ``argo`` (real data) and ``all`` (currently equal
    to argo until verified glider data is integrated). ``glider`` raises
    400 because the candidate dataset's provenance is unverified and no
    observations may be fabricated.
    """
    if source not in SUPPORTED_SOURCES:
        raise InvalidParameterError(
            f"Unsupported source '{source}'. Supported sources: argo, all (glider: pending verified data)"
        )
    if source == "glider":
        raise InvalidParameterError(
            "Glider data is not yet available: the candidate dataset's provenance is "
            "unverified, so no glider observations are served (no fabricated data)."
        )

    # A point + radius is expressed to the processor as point-like bounds.
    if radius_km is not None:
        if latitude is not None:
            if lat_min is not None or lat_max is not None:
                raise InvalidParameterError("Pass either latitude or lat_min/lat_max, not both")
            lat_min = lat_max = latitude
        if longitude is not None:
            if lon_min is not None or lon_max is not None:
                raise InvalidParameterError("Pass either longitude or lon_min/lon_max, not both")
            lon_min = lon_max = longitude

    data = process_observations(
        lat_min=lat_min,
        lat_max=lat_max,
        lon_min=lon_min,
        lon_max=lon_max,
        depth=depth,
        depth_tolerance=depth_tolerance,
        time=time,
        time_tolerance_days=time_tolerance_days,
        radius_km=radius_km,
        max_observations=max_observations,
    )

    if variable is not None:
        data = _filter_variable(data, variable)

    return ObservationResponse(**data)


def _filter_variable(data: dict, variable: str) -> dict:
    """Keep only observations reporting the requested measurement.

    ``variable`` may be ``temperature``, ``salinity`` or ``temp_sal``
    (both must be present). Unknown names raise 400.
    """
    if variable not in ("temperature", "salinity", "temp_sal"):
        raise InvalidParameterError(
            "Unsupported variable '" + variable + "'. Supported: temperature, salinity, temp_sal"
        )

    def keep(o: dict) -> bool:
        if variable == "temperature":
            return o["temperature"] is not None
        if variable == "salinity":
            return o["salinity"] is not None
        return o["temperature"] is not None and o["salinity"] is not None

    observations = [o for o in data["observations"] if keep(o)]
    data["observations"] = observations
    data["count"] = len(observations)
    return data