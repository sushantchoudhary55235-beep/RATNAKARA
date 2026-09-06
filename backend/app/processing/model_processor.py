"""Processing for the CMEMS ocean model NetCDF dataset.

Reads ``data/sample/arabian_sea_model.nc`` lazily with xarray and produces
browser-friendly point grids for the ``/api/v1/model-field`` endpoint.

The original NetCDF file is never modified.
"""

from __future__ import annotations

import math
import os
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import xarray as xr

# Normalized API variable -> source variable in the NetCDF file.
VARIABLE_MAP: dict[str, str] = {
    "temperature": "thetao",
    "salinity": "so",
    "u_current": "uo",
    "v_current": "vo",
}

# Fallback display units, used when the dataset has no usable metadata.
DEFAULT_UNITS: dict[str, str] = {
    "temperature": "°C",
    "salinity": "PSU",
    "u_current": "m/s",
    "v_current": "m/s",
}

# NetCDF `units` attribute -> display unit.
UNIT_ALIASES: dict[str, str] = {
    "degrees_C": "°C",
    "degree_Celsius": "°C",
    "1e-3": "PSU",
    "psu": "PSU",
    "m s-1": "m/s",
    "m s**-1": "m/s",
    "m/s": "m/s",
}

DEFAULT_MODEL_PATH: Path = (
    Path(__file__).resolve().parents[3] / "data" / "sample" / "arabian_sea_model.nc"
)

DEFAULT_MAX_POINTS = 5000
MIN_MAX_POINTS = 100
MAX_MAX_POINTS = 10000

SOURCE_NAME = "Copernicus Marine"

_dataset_cache: dict[str, xr.Dataset] = {}


class ModelProcessingError(Exception):
    """Base class for model processing errors."""

    status_code: int = 500
    message: str = "Unexpected model processing error"

    def __init__(self, message: str | None = None) -> None:
        if message is not None:
            self.message = message
        super().__init__(self.message)


class UnsupportedVariableError(ModelProcessingError):
    status_code = 400

    def __init__(self, variable: str) -> None:
        super().__init__(
            f"Unsupported variable '{variable}'. Supported variables: "
            + ", ".join(sorted(VARIABLE_MAP))
        )


class InvalidBoundsError(ModelProcessingError):
    status_code = 400


class InvalidDepthError(ModelProcessingError):
    status_code = 400


class DatasetUnavailableError(ModelProcessingError):
    status_code = 404


class EmptyRegionError(ModelProcessingError):
    status_code = 404


class NoValidDataError(ModelProcessingError):
    status_code = 404


def model_dataset_path() -> Path:
    """Resolve the model dataset path (env var override supported)."""
    override = os.environ.get("SAGARA_MODEL_PATH")
    return Path(override) if override else DEFAULT_MODEL_PATH


def load_dataset(path: str | os.PathLike | None = None) -> xr.Dataset:
    """Open (lazily) and cache the model dataset.

    ``xr.open_dataset`` does not load data into memory, so application
    startup and cache creation stay cheap; only the requested slices are
    read when a field is actually processed.
    """
    resolved = Path(path) if path is not None else model_dataset_path()
    cache_key = str(resolved.resolve())
    cached = _dataset_cache.get(cache_key)
    if cached is not None:
        return cached
    if not resolved.is_file():
        raise DatasetUnavailableError(
            f"Model dataset not found at {resolved}. Dataset loading is expected "
            "in later phases; the file must exist to serve model fields."
        )
    ds = xr.open_dataset(resolved)
    _dataset_cache[cache_key] = ds
    return ds


def get_variable_map() -> dict[str, str]:
    """Return a copy of the normalized->source variable mapping."""
    return dict(VARIABLE_MAP)


def _display_unit(ds: xr.Dataset, source_var: str, variable: str) -> str:
    units_attr = ds[source_var].attrs.get("units", "")
    if units_attr in UNIT_ALIASES:
        return UNIT_ALIASES[units_attr]
    return DEFAULT_UNITS[variable]


def process_model_field(
    *,
    variable: str,
    depth: float,
    time: datetime,
    lat_min: float | None = None,
    lat_max: float | None = None,
    lon_min: float | None = None,
    lon_max: float | None = None,
    max_points: int = DEFAULT_MAX_POINTS,
    dataset: xr.Dataset | None = None,
    path: str | os.PathLike | None = None,
) -> dict:
    """Extract a 2-D field slice from the model NetCDF and return viz-ready points.

    Returns a dict compatible with ``app.schemas.model.ModelFieldResponse``.
    """
    if variable not in VARIABLE_MAP:
        raise UnsupportedVariableError(variable)
    if not math.isfinite(depth) or depth < 0:
        raise InvalidDepthError(f"Invalid depth '{depth}': must be a non-negative number")

    ds = dataset if dataset is not None else load_dataset(path)
    source_var = VARIABLE_MAP[variable]
    if source_var not in ds.data_vars:
        raise DatasetUnavailableError(
            f"Variable '{source_var}' (for '{variable}') is not present in the model dataset"
        )

    # --- Nearest time ---
    if time.tzinfo is not None:
        time = time.astimezone(timezone.utc).replace(tzinfo=None)  # normalize to naive UTC
    time_np = np.datetime64(time)
    try:
        field = ds[source_var].sel(time=time_np, method="nearest")
    except (KeyError, ValueError) as exc:
        raise InvalidBoundsError(f"Invalid time '{time}': {exc}") from exc
    selected_time = field.time.values

    # --- Nearest depth ---
    try:
        field = field.sel(depth=depth, method="nearest")
    except (KeyError, ValueError) as exc:
        raise InvalidDepthError(f"Invalid depth '{depth}': {exc}") from exc
    selected_depth = float(field.depth.values)

    # --- Optional geographic bounds (each pair independent; defaults to dataset range) ---
    if lat_min is None:
        lat_min = float(ds.latitude.min())
    if lat_max is None:
        lat_max = float(ds.latitude.max())
    if lon_min is None:
        lon_min = float(ds.longitude.min())
    if lon_max is None:
        lon_max = float(ds.longitude.max())

    for name, value, lo, hi in (
        ("lat_min", lat_min, -90.0, 90.0),
        ("lat_max", lat_max, -90.0, 90.0),
        ("lon_min", lon_min, -180.0, 180.0),
        ("lon_max", lon_max, -180.0, 180.0),
    ):
        if not math.isfinite(value) or not (lo <= value <= hi):
            raise InvalidBoundsError(
                f"Invalid {name} '{value}': must be a finite number between {lo} and {hi}"
            )
    if lat_min >= lat_max:
        raise InvalidBoundsError(f"Invalid bounds: lat_min ({lat_min}) must be < lat_max ({lat_max})")
    if lon_min >= lon_max:
        raise InvalidBoundsError(f"Invalid bounds: lon_min ({lon_min}) must be < lon_max ({lon_max})")

    region = field.sel(latitude=slice(lat_min, lat_max), longitude=slice(lon_min, lon_max))
    if region.sizes["latitude"] == 0 or region.sizes["longitude"] == 0:
        raise EmptyRegionError(
            f"No grid points in the requested region "
            f"(lat {lat_min}..{lat_max}, lon {lon_min}..{lon_max})"
        )

    # --- Deterministic downsampling: keep <= max_points via a uniform stride ---
    n_lat, n_lon = region.sizes["latitude"], region.sizes["longitude"]
    n_total = n_lat * n_lon
    max_points = max(MIN_MAX_POINTS, min(int(max_points), MAX_MAX_POINTS))
    if n_total > max_points:
        stride = int(math.ceil(math.sqrt(n_total / max_points)))
        region = region.isel(
            latitude=slice(None, None, stride),
            longitude=slice(None, None, stride),
        )

    # --- Flatten to points, dropping NaN (land) cells ---
    values = region.values  # 2-D: (latitude, longitude)
    lats = region.latitude.values
    lons = region.longitude.values
    valid = ~np.isnan(values)
    points = [
        {
            "latitude": float(lats[i]),
            "longitude": float(lons[j]),
            "value": float(values[i, j]),
        }
        for i in range(values.shape[0])
        for j in range(values.shape[1])
        if valid[i, j]
    ]
    if not points:
        raise NoValidDataError(
            f"No valid (non-NaN) data for '{variable}' at depth "
            f"{selected_depth:.2f} m and time {selected_time}"
        )

    return {
        "variable": variable,
        "unit": _display_unit(ds, source_var, variable),
        "depth": selected_depth,
        "time": str(np.datetime64(selected_time, "s")),
        "source": SOURCE_NAME,
        "points": points,
    }