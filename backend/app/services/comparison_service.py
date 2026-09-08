"""Business logic for the Model-vs-Reality comparison endpoint.

Reuses the Phase 3 model processor (dataset loading, nearest time/depth
selection, unit handling) and the Phase 4 Argo processor (cached NumPy
columns, QC filtering, Haversine). No dataset logic lives here and no
large processing blocks live in the API route.

This is a PROTOTYPE analytical comparison — not official INCOIS
validation. Limitations are documented in the response notes.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone

from app.processing.argo_processor import (
    DEFAULT_MAX_DEPTH_DIFF,
    DEFAULT_MAX_DISTANCE_KM,
    DEFAULT_MAX_TIME_DIFF_DAYS,
    InvalidParameterError,
    NoMatchingDataError,
    find_nearest_observation,
)
from app.processing.model_processor import (
    SOURCE_NAME as MODEL_SOURCE_NAME,
    _display_unit,  # reuse the model's unit mapping
)
from app.schemas.comparison import (
    ComparisonLocation,
    ComparisonMatch,
    ComparisonModelValue,
    ComparisonObservation,
    ComparisonRequested,
    ComparisonResponse,
)

# API variable -> (supported?, Argo column key)
COMPARISON_SUPPORT: dict[str, bool] = {
    "temperature": True,   # Argo TEMP_ADJUSTED / TEMP fallback
    "salinity": True,      # Argo PSAL_ADJUSTED / PSAL fallback
    "u_current": False,    # no Argo current observations exist
    "v_current": False,    # no Argo current observations exist
}

# Default matching windows (documented; configurable via query params).
NOTES: list[str] = [
    "Comparison uses deterministic nearest-neighbour matching between the "
    "model grid and Argo observations (score = normalized distance + "
    "normalized depth difference + normalized time difference).",
    "Argo depth is represented using the pressure/depth proxy in dbar; it is "
    "NOT an exact geometric depth and no conversion formula is invented.",
    "The current prototype model dataset contains a single timestep "
    "(2026-06-23); no meaningful model time interpolation is performed.",
    "This is a prototype analytical comparison and not official INCOIS "
    "validation or a certified accuracy statement.",
]

def get_comparison(
    *,
    variable: str,
    latitude: float,
    longitude: float,
    depth: float,
    time: datetime,
    max_distance_km: float = DEFAULT_MAX_DISTANCE_KM,
    max_depth_diff: float = DEFAULT_MAX_DEPTH_DIFF,
    max_time_diff_days: float = DEFAULT_MAX_TIME_DIFF_DAYS,
) -> ComparisonResponse:
    """Compare the model value against the nearest valid Argo observation."""
    _validate_inputs(variable=variable, latitude=latitude, longitude=longitude, depth=depth)

    if not COMPARISON_SUPPORT[variable]:
        raise InvalidParameterError(
            f"Unsupported comparison for variable '{variable}': the Argo observation "
            "dataset provides temperature and salinity only, so no real current "
            "observations exist to compare against. Current comparisons are not "
            "fabricated."
        )

    # --- Model side (Phase 3 processor reused) ---
    model_value = _get_model_value(
        variable=variable, latitude=latitude, longitude=longitude,
        depth=depth, time=time,
    )

    # --- Observation side (Phase 4 processor reused) ---
    obs = find_nearest_observation(
        variable=variable,
        latitude=latitude,
        longitude=longitude,
        depth=depth,
        time=time,
        max_distance_km=max_distance_km,
        max_depth_diff=max_depth_diff,
        max_time_diff_days=max_time_diff_days,
    )
    if obs is None:
        raise NoMatchingDataError(
            "No valid Argo observation with a QC-passed "
            f"'{variable}' measurement was found within the matching windows "
            f"(radius {max_distance_km} km, depth tolerance {max_depth_diff} dbar, "
            f"time tolerance {max_time_diff_days} days)."
        )

    difference = model_value - obs["value"]
    if difference > 0:
        interpretation = "Model value is higher than observation"
    elif difference < 0:
        interpretation = "Model value is lower than observation"
    else:
        interpretation = "Model value matches observation"

    unit = _model_unit(variable)

    return ComparisonResponse(
        variable=variable,
        unit=unit,
        location=ComparisonLocation(latitude=latitude, longitude=longitude),
        requested=ComparisonRequested(depth=depth, time=_iso(time)),
        model=ComparisonModelValue(value=model_value, source=MODEL_SOURCE_NAME),
        observation=ComparisonObservation(
            value=obs["value"],
            source="Argo",
            id=obs["id"],
            latitude=obs["latitude"],
            longitude=obs["longitude"],
            depth=obs["depth"],
            time=obs["time"],
        ),
        difference=round(difference, 4),
        absolute_difference=round(abs(difference), 4),
        match=ComparisonMatch(
            distance_km=obs["distance_km"],
            depth_difference=obs["depth_difference"],
            time_difference_days=obs["time_difference_days"],
        ),
        interpretation=interpretation,
        mode="real",
        notes=list(NOTES),
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _validate_inputs(*, variable: str, latitude: float, longitude: float, depth: float) -> None:
    if variable not in COMPARISON_SUPPORT:
        from app.processing.model_processor import VARIABLE_MAP

        raise InvalidParameterError(
            f"Unsupported variable '{variable}'. Supported comparison variables: "
            + ", ".join(sorted(VARIABLE_MAP))
        )
    if not math.isfinite(latitude) or not (-90.0 <= latitude <= 90.0):
        raise InvalidParameterError(
            f"Invalid latitude '{latitude}': must be between -90 and 90"
        )
    if not math.isfinite(longitude) or not (-180.0 <= longitude <= 180.0):
        raise InvalidParameterError(
            f"Invalid longitude '{longitude}': must be between -180 and 180"
        )
    if not math.isfinite(depth) or depth < 0:
        raise InvalidParameterError(
            f"Invalid depth '{depth}': must be a non-negative number"
        )


def get_model_surface(
    *, variable: str, depth: float, time: datetime
) -> "dict":
    """Reusable Phase 3 model lookup: 2-D field at the nearest depth/time.

    Shared by the Phase 5 single-point comparison and the Phase 6
    vectorized anomaly scan so the model-side semantics (dataset
    loading, nearest depth/time selection, unit mapping) live in ONE
    place. Raises the existing Phase 3 error hierarchy (404 when the
    dataset file is missing).

    Returns a dict with the 2-D ``field`` (xarray DataArray after
    nearest time/depth selection), its ``unit`` and the selected
    ``depth``/``time``.
    """
    import numpy as np

    from app.processing.model_processor import get_variable_map, load_dataset

    ds = load_dataset()  # raises DatasetUnavailableError (404) if missing
    source_var = get_variable_map()[variable]

    field = ds[source_var]
    if time.tzinfo is not None:
        time = time.astimezone(timezone.utc).replace(tzinfo=None)
    field = field.sel(time=np.datetime64(time), method="nearest")
    field = field.sel(depth=depth, method="nearest")
    return {
        "field": field,
        "unit": _model_unit(variable),
        "selected_depth": float(field.depth.values),
        "selected_time": str(np.datetime64(field.time.values, "s")),
    }


def _get_model_value(
    *, variable: str, latitude: float, longitude: float, depth: float, time: datetime
) -> float:
    """Retrieve the model value at the nearest grid point using Phase 3 processing.

    Uses the shared :func:`get_model_surface` so the model-side
    behaviour (nearest depth/time selection, unit mapping, error
    hierarchy) is reused without duplication.
    """
    from app.processing.model_processor import NoValidDataError

    surface = get_model_surface(variable=variable, depth=depth, time=time)
    field = surface["field"]

    # Nearest grid point to (latitude, longitude).
    lat_idx = int(abs(field.latitude.values - latitude).argmin())
    lon_idx = int(abs(field.longitude.values - longitude).argmin())
    value = float(field.isel(latitude=lat_idx, longitude=lon_idx).values)
    if math.isnan(value):
        raise NoValidDataError(
            f"No valid model value for '{variable}' at the nearest grid point "
            f"({float(field.latitude.values[lat_idx]):.3f}, "
            f"{float(field.longitude.values[lon_idx]):.3f}) — the cell is masked (land)."
        )
    return value


def _model_unit(variable: str) -> str:
    """Unit for the comparison, reusing the model's unit mapping."""
    from app.processing.model_processor import (
        DEFAULT_UNITS,
        get_variable_map,
        load_dataset,
    )

    ds = load_dataset()
    return _display_unit(ds, get_variable_map()[variable], variable) if variable in get_variable_map() else DEFAULT_UNITS[variable]


def _iso(dt: datetime) -> str:
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt.isoformat()