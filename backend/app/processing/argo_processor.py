"""Processing for the INCOIS Argo NetCDF observation dataset.

Reads ``data/sample/arabian_sea_argo.nc`` lazily with xarray and produces
browser-friendly observation records for the ``/api/v1/observations``
endpoint.

The original NetCDF file is never modified.

Key behaviours
--------------
- Adjusted variables (``TEMP_ADJUSTED``, ``PSAL_ADJUSTED``,
  ``PRES_ADJUSTED``) are preferred; the processor falls back to the
  unadjusted ``TEMP`` / ``PSAL`` / ``PRES`` when adjusted values are
  missing (NaN) or the adjusted columns are entirely unavailable.
- QC: the dataset's own Argo QC flags are respected. Rows whose
  temperature/salinity/pressure QC flag is ``4`` (bad) or ``9``
  (missing) are dropped for the affected measurement. Flags ``1``–``3``
  are kept (1 = good, 2 = probably good, 3 = probably bad per Argo
  convention; we do not invent extra thresholds).
- ``depth`` in the API is a **pressure/depth proxy in dbar** (Argo
  PRES). No approximate pressure→depth conversion is applied.
- Demo mode: when the dataset file is absent the processor returns a
  clearly-marked demo payload (``mode: "demo"``, ``source: "demo"``).
  Demo observations are NEVER mixed with real ones.
"""

from __future__ import annotations

import math
import os
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import xarray as xr

DEFAULT_ARGO_PATH: Path = (
    Path(__file__).resolve().parents[3] / "data" / "sample" / "arabian_sea_argo.nc"
)

DEFAULT_MAX_OBS = 5000
MAX_MAX_OBS = 5000
MIN_MAX_OBS = 1

MAX_RADIUS_KM = 2000.0

# Rows with these Argo QC flag values are rejected for the affected
# measurement: 4 = bad, 9 = missing (per Argo convention).
QC_REJECT_FLAGS = frozenset({4, 9})

# Demo-mode observation set (clearly marked; never mixed with real data).
_DEMO_OBSERVATIONS: list[dict] = [
    {
        "id": "DEMO_ARGO_001",
        "latitude": 15.5,
        "longitude": 65.3,
        "depth": 10.0,
        "time": "2025-01-01T00:00:00",
        "temperature": 26.8,
        "salinity": 35.1,
    },
    {
        "id": "DEMO_ARGO_002",
        "latitude": 18.52,
        "longitude": 72.81,
        "depth": 50.0,
        "time": "2025-01-02T00:00:00",
        "temperature": 25.4,
        "salinity": 35.6,
    },
    {
        "id": "DEMO_ARGO_003",
        "latitude": 12.0,
        "longitude": 60.0,
        "depth": 200.0,
        "time": "2025-01-03T00:00:00",
        "temperature": 15.2,
        "salinity": 36.0,
    },
]


class ArgoProcessingError(Exception):
    """Base class for Argo processing errors."""

    status_code: int = 500
    message: str = "Unexpected Argo processing error"

    def __init__(self, message: str | None = None) -> None:
        if message is not None:
            self.message = message
        super().__init__(self.message)


class InvalidParameterError(ArgoProcessingError):
    """Invalid request parameters (maps to 400)."""

    status_code = 400


class DatasetUnavailableError(ArgoProcessingError):
    """Argo dataset file is not available (maps to 404)."""

    status_code = 404


class NoMatchingDataError(ArgoProcessingError):
    """No observations match the requested filters (maps to 404)."""

    status_code = 404


def argo_dataset_path() -> Path:
    """Resolve the Argo dataset path (env var override supported)."""
    override = os.environ.get("SAGARA_ARGO_PATH")
    if override:
        return Path(override)
    data_dir = os.environ.get("SAGARA_DATA_DIR")
    if data_dir:
        return Path(data_dir) / "sample" / "arabian_sea_argo.nc"
    return DEFAULT_ARGO_PATH


# --- In-process cache of filtered numpy columns (lazy, one-shot) ---
_cache: dict[str, dict] = {}


def _invalidate_cache() -> None:
    """Clear the in-process Argo column cache (used by tests)."""
    _cache.clear()


def _load_columns(path: Path) -> dict[str, np.ndarray]:
    """Load, QC-filter and cache the required Argo columns as numpy arrays.

    Loaded once per process; subsequent requests reuse the arrays.
    Only the required variables are read from the NetCDF file.
    """
    cache_key = str(path.resolve())
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    ds = xr.open_dataset(path)

    required = {"PLATFORM_NUMBER", "CYCLE_NUMBER", "time", "latitude", "longitude"}
    missing = required - set(ds.variables)
    if missing:
        raise ArgoProcessingError(
            f"Argo dataset is missing required fields: {', '.join(sorted(missing))}"
        )

    # --- Pick variable availability: adjusted preferred, raw fallback ---
    has_temp_adj = "TEMP_ADJUSTED" in ds.variables
    has_psal_adj = "PSAL_ADJUSTED" in ds.variables
    has_pres_adj = "PRES_ADJUSTED" in ds.variables
    has_temp = "TEMP" in ds.variables
    has_psal = "PSAL" in ds.variables
    has_pres = "PRES" in ds.variables

    temp = ds["TEMP_ADJUSTED"] if has_temp_adj else (ds["TEMP"] if has_temp else None)
    psal = ds["PSAL_ADJUSTED"] if has_psal_adj else (ds["PSAL"] if has_psal else None)
    pres = ds["PRES_ADJUSTED"] if has_pres_adj else (ds["PRES"] if has_pres else None)
    if temp is None or psal is None or pres is None:
        raise ArgoProcessingError(
            "Argo dataset is missing temperature/salinity/pressure measurement columns"
        )

    platform = ds["PLATFORM_NUMBER"].values
    cycle = ds["CYCLE_NUMBER"].values
    time = ds["time"].values
    lat = np.asarray(ds["latitude"].values, dtype=float)
    lon = np.asarray(ds["longitude"].values, dtype=float)
    temp_v = np.asarray(temp.values, dtype=float)
    psal_v = np.asarray(psal.values, dtype=float)
    pres_v = np.asarray(pres.values, dtype=float)

    # --- QC filtering using the dataset's own flags (no invented rules) ---
    # For each measurement, reject rows whose corresponding QC flag is 4
    # (bad) or 9 (missing). We check the QC flag matching the variable
    # actually in use (adjusted flag for adjusted data, raw flag otherwise).
    def _qc_mask(qc_name_adj: str, qc_name_raw: str, uses_adjusted: bool) -> np.ndarray:
        qc_name = qc_name_adj if uses_adjusted and qc_name_adj in ds.variables else (
            qc_name_raw if qc_name_raw in ds.variables else None
        )
        if qc_name is None:
            return np.ones(ds.sizes["row"], dtype=bool)
        qc = np.asarray(ds[qc_name].values).ravel()
        try:
            qc_num = np.asarray(qc, dtype=float)
            # Numeric flags (e.g. 1.0, 4.0); NaN treated as missing -> reject.
            ok = ~np.isnan(qc_num) & ~np.isin(qc_num, list(QC_REJECT_FLAGS))
        except (TypeError, ValueError):
            # Byte/string flags (e.g. b'1'); unknown values kept only if parseable.
            ok = np.ones(qc.shape[0], dtype=bool)
            for i, v in enumerate(qc):
                try:
                    f = int(bytes(v).decode().strip()) if isinstance(v, bytes) else int(str(v).strip())
                    ok[i] = f not in QC_REJECT_FLAGS
                except (ValueError, TypeError):
                    ok[i] = False
        return ok

    temp_ok = _qc_mask("TEMP_ADJUSTED_QC", "TEMP_QC", has_temp_adj)
    psal_ok = _qc_mask("PSAL_ADJUSTED_QC", "PSAL_QC", has_psal_adj)
    pres_ok = _qc_mask("PRES_ADJUSTED_QC", "PRES_QC", has_pres_adj)

    # Blank out measurements whose QC failed; fall back to the raw
    # variable where the adjusted value is unusable but the raw one is OK.
    def _with_fallback(adj_name, raw_name, values, adjusted_available, qc_ok):
        if adjusted_available and raw_name in ds.variables:
            raw = np.asarray(ds[raw_name].values, dtype=float)
            raw_qc_ok = _qc_mask(f"{raw_name}_QC", f"{raw_name}_QC", False)
            bad = ~qc_ok | np.isnan(values)
            # Use raw value where it is QC-valid and the adjusted one is not.
            fallback = bad & raw_qc_ok & ~np.isnan(raw)
            values = np.where(fallback, raw, values)
        values = np.where(qc_ok, values, np.nan)
        return values

    temp_v = _with_fallback("TEMP_ADJUSTED", "TEMP", temp_v, has_temp_adj, temp_ok)
    psal_v = _with_fallback("PSAL_ADJUSTED", "PSAL", psal_v, has_psal_adj, psal_ok)
    pres_v = _with_fallback("PRES_ADJUSTED", "PRES", pres_v, has_pres_adj, pres_ok)

    # Rows without valid coordinates cannot be served as map observations.
    coord_ok = ~np.isnan(lat) & ~np.isnan(lon) & (pres_ok | ~np.isnan(pres_v))

    columns = {
        "platform": platform,
        "cycle": cycle,
        "time": time,
        "lat": lat,
        "lon": lon,
        "temp": temp_v,
        "psal": psal_v,
        "pres": pres_v,
        "coord_ok": coord_ok,
    }
    _cache[cache_key] = columns
    return columns


def _haversine_km(lat1: np.ndarray, lon1: np.ndarray, lat2: float, lon2: float) -> np.ndarray:
    """Vectorized great-circle distance (km) between arrays of points and one target."""
    rlat1, rlon1 = np.radians(lat1), np.radians(lon1)
    rlat2, rlon2 = math.radians(lat2), math.radians(lon2)
    dlat = rlat2 - rlat1
    dlon = rlon2 - rlon1
    a = np.sin(dlat / 2) ** 2 + np.cos(rlat1) * np.cos(rlat2) * np.sin(dlon / 2) ** 2
    return 6371.0088 * 2 * np.arcsin(np.sqrt(np.clip(a, 0.0, 1.0)))


def _validate_bounds(lat_min, lat_max, lon_min, lon_max) -> None:
    for name, value, lo, hi in (
        ("lat_min", lat_min, -90.0, 90.0),
        ("lat_max", lat_max, -90.0, 90.0),
        ("lon_min", lon_min, -180.0, 180.0),
        ("lon_max", lon_max, -180.0, 180.0),
    ):
        if value is not None and (not math.isfinite(value) or not (lo <= value <= hi)):
            raise InvalidParameterError(
                f"Invalid {name} '{value}': must be a finite number between {lo} and {hi}"
            )
    # Point-like bounds (lat_min == lat_max) are valid: the service uses
    # them to express a radius-filter center.
    if lat_min is not None and lat_max is not None and lat_min > lat_max:
        raise InvalidParameterError(
            f"Invalid bounds: lat_min ({lat_min}) must be <= lat_max ({lat_max})"
        )
    if lon_min is not None and lon_max is not None and lon_min > lon_max:
        raise InvalidParameterError(
            f"Invalid bounds: lon_min ({lon_min}) must be <= lon_max ({lon_max})"
        )


def _demo_response(notes: list[str]) -> dict:
    return {
        "source": "demo",
        "mode": "demo",
        "count": len(_DEMO_OBSERVATIONS),
        "depth_units": "dbar (pressure/depth proxy)",
        "notes": notes,
        "observations": [dict(o) for o in _DEMO_OBSERVATIONS],
    }


def process_observations(
    *,
    lat_min: float | None = None,
    lat_max: float | None = None,
    lon_min: float | None = None,
    lon_max: float | None = None,
    depth: float | None = None,
    depth_tolerance: float = 25.0,
    time: datetime | None = None,
    time_tolerance_days: float = 30.0,
    radius_km: float | None = None,
    max_observations: int = DEFAULT_MAX_OBS,
    path: str | os.PathLike | None = None,
) -> dict:
    """Filter the Argo dataset and return an ObservationResponse-compatible dict.

    ``depth`` filters on the pressure/depth proxy (dbar) using a
    tolerance window ``|pres - depth| <= depth_tolerance`` — it does not
    pretend pressure is exact geometric depth.

    ``time`` selects observations within ``time_tolerance_days`` of the
    requested timestamp (nearest temporal matching); rows outside the
    window are excluded rather than re-dated.
    """
    resolved = Path(path) if path is not None else argo_dataset_path()
    if not resolved.is_file():
        return _demo_response(
            notes=[
                "Argo dataset file not found on this deployment; returning demo data.",
                "Place data/sample/arabian_sea_argo.nc to enable real-data mode.",
            ]
        )

    _validate_bounds(lat_min, lat_max, lon_min, lon_max)

    if depth is not None:
        if not math.isfinite(depth) or depth < 0:
            raise InvalidParameterError(
                f"Invalid depth '{depth}': must be a non-negative number (dbar)"
            )
        if not math.isfinite(depth_tolerance) or depth_tolerance < 0:
            raise InvalidParameterError("depth_tolerance must be a non-negative number")

    if radius_km is not None:
        if not math.isfinite(radius_km) or radius_km <= 0:
            raise InvalidParameterError("radius must be a positive number of kilometers")
        if radius_km > MAX_RADIUS_KM:
            raise InvalidParameterError(
                f"radius must not exceed {MAX_RADIUS_KM} km"
            )
        # Radius requires a center point.
        center_lat = lat_min if lat_max is None else (lat_min + lat_max) / 2 if lat_min == lat_max else None
        # Accept an explicit center via lat/lon single bounds only when
        # lat_min == lat_max / lon_min == lon_max; otherwise require plain
        # lat/lon center semantics handled by the service layer. Here we
        # require lat/lon bounds to be absent or point-like.
        if (lat_min is not None or lat_max is not None) and lat_min != lat_max:
            raise InvalidParameterError(
                "radius filtering requires a point: pass lat/lon (or equal lat_min/lat_max and lon_min/lon_max), not a bounding box"
            )
        if (lon_min is not None or lon_max is not None) and lon_min != lon_max:
            raise InvalidParameterError(
                "radius filtering requires a point: pass lat/lon (or equal lat_min/lat_max and lon_min/lon_max), not a bounding box"
            )
        center_lat = lat_min if lat_min is not None else lat_max
        center_lon = lon_min if lon_min is not None else lon_max
        if center_lat is None or center_lon is None:
            raise InvalidParameterError("radius filtering requires both a latitude and a longitude center")

    if time is not None:
        if time.tzinfo is not None:
            time = time.astimezone(timezone.utc).replace(tzinfo=None)
        if not math.isfinite(time_tolerance_days) or time_tolerance_days < 0:
            raise InvalidParameterError("time_tolerance_days must be a non-negative number")

    cols = _load_columns(resolved)

    lat = cols["lat"]
    lon = cols["lon"]
    pres = cols["pres"]

    # --- Early vectorized filtering (never materialize all rows as dicts) ---
    mask = cols["coord_ok"].copy()

    if radius_km is not None:
        # Radius filtering replaces the bounding-box filter: the center
        # point arrives as point-like bounds (lat_min == lat_max etc.)
        # and applying the box as well would exclude every point.
        dist = _haversine_km(lat, lon, float(center_lat), float(center_lon))  # type: ignore[name-defined]
        mask &= dist <= radius_km
    else:
        if lat_min is not None and lat_max is not None:
            mask &= (lat >= lat_min) & (lat <= lat_max)
        if lon_min is not None and lon_max is not None:
            mask &= (lon >= lon_min) & (lon <= lon_max)

    if depth is not None:
        mask &= ~np.isnan(pres) & (np.abs(pres - depth) <= depth_tolerance)

    if time is not None:
        time_arr = cols["time"]
        t64 = np.datetime64(time)
        dt_days = np.abs((time_arr - t64) / np.timedelta64(1, "D"))
        mask &= dt_days <= time_tolerance_days

    indices = np.nonzero(mask)[0]
    if indices.size == 0:
        raise NoMatchingDataError(
            "No observations match the requested filters (coordinates valid, but the region/time/depth has no data)"
        )

    # --- Deterministic downsampling: uniform stride over row order ---
    max_obs = max(MIN_MAX_OBS, min(int(max_observations), MAX_MAX_OBS))
    total = int(indices.size)
    if total > max_obs:
        stride = int(math.ceil(total / max_obs))
        indices = indices[::stride]

    # --- Build records (only for the selected subset) ---
    platform = cols["platform"]
    cycle = cols["cycle"]
    time_arr = cols["time"]
    temp = cols["temp"]
    psal = cols["psal"]

    observations: list[dict] = []
    for i in indices:
        i = int(i)
        pid = _platform_str(platform[i])
        t = time_arr[i]
        t_str = str(np.datetime64(t, "s")) if np.issubdtype(np.asarray(t).dtype, np.datetime64) else str(t)
        observations.append(
            {
                "id": f"ARGO_{pid}_C{int(cycle[i])}_{i}",
                "latitude": round(float(lat[i]), 5),
                "longitude": round(float(lon[i]), 5),
                "depth": round(float(pres[i]), 2) if not np.isnan(pres[i]) else 0.0,
                "time": t_str,
                "temperature": round(float(temp[i]), 3) if not np.isnan(temp[i]) else None,
                "salinity": round(float(psal[i]), 3) if not np.isnan(psal[i]) else None,
            }
        )

    return {
        "source": "Argo",
        "mode": "real",
        "count": len(observations),
        "depth_units": "dbar (pressure/depth proxy)",
        "notes": [
            "Values originate from the local INCOIS Argo dataset; adjusted variables "
            "(TEMP_ADJUSTED/PSAL_ADJUSTED/PRES_ADJUSTED) preferred with raw fallback.",
            "QC: dataset-provided Argo QC flags applied; flags 4 (bad) and 9 (missing) rejected.",
            "'depth' is the Argo pressure (PRES/PRES_ADJUSTED) in dbar used as a depth proxy, "
            "not an exact geometric depth.",
        ],
        "observations": observations,
    }


# Comparison default matching tolerances (documented in API_CONTRACT.md).
# The time default is 730 days because the current prototype model dataset
# has a single timestep (2026-06-23) while the real Argo subset ends
# 2025-04-01 (~448 days earlier); a 365-day default would make every real
# comparison return 404. The selected observation's actual
# time_difference_days is always exposed so large offsets stay visible.
DEFAULT_MAX_DISTANCE_KM = 500.0
DEFAULT_MAX_DEPTH_DIFF = 100.0
DEFAULT_MAX_TIME_DIFF_DAYS = 730.0

COMPARISON_VARIABLES = ("temperature", "salinity")


def find_nearest_observation(
    *,
    variable: str,
    latitude: float,
    longitude: float,
    depth: float,
    time: datetime,
    max_distance_km: float = DEFAULT_MAX_DISTANCE_KM,
    max_depth_diff: float = DEFAULT_MAX_DEPTH_DIFF,
    max_time_diff_days: float = DEFAULT_MAX_TIME_DIFF_DAYS,
    path: str | os.PathLike | None = None,
) -> dict | None:
    """Find the nearest valid Argo observation for a comparison request.

    Deterministic nearest-neighbour selection over the cached Phase 4
    NumPy columns (no row-by-row Python loop over 4M rows):

    1. Candidate mask: valid coordinates + a QC-valid, non-NaN value for
       the requested variable + within all matching windows
       (spatial radius, depth-proxy tolerance, time tolerance).
    2. Score each candidate (fully vectorized):
           score = distance_km / max_distance_km
                 + |pres - depth| / max_depth_diff
                 + time_diff_days / max_time_diff_days
    3. Select the minimum score; ties resolve to the lower row index
       (numpy argmin behaviour), which is deterministic.

    ``depth`` is compared against the Argo pressure/depth proxy (dbar).
    Returns ``None`` when no candidate is inside the windows.
    """
    if variable not in COMPARISON_VARIABLES:
        raise InvalidParameterError(
            f"Unsupported observation variable '{variable}' for comparison. "
            "Argo provides temperature and salinity only."
        )
    if not math.isfinite(max_distance_km) or max_distance_km <= 0:
        raise InvalidParameterError("max_distance_km must be a positive number")
    if not math.isfinite(max_depth_diff) or max_depth_diff < 0:
        raise InvalidParameterError("max_depth_diff must be a non-negative number")
    if not math.isfinite(max_time_diff_days) or max_time_diff_days < 0:
        raise InvalidParameterError("max_time_diff_days must be a non-negative number")

    resolved = Path(path) if path is not None else argo_dataset_path()
    if not resolved.is_file():
        return None

    if time.tzinfo is not None:
        time = time.astimezone(timezone.utc).replace(tzinfo=None)

    cols = _load_columns(resolved)
    value_col = cols["temp"] if variable == "temperature" else cols["psal"]

    lat = cols["lat"]
    lon = cols["lon"]
    pres = cols["pres"]
    time_arr = cols["time"]

    # --- Vectorized candidate mask ---
    mask = cols["coord_ok"] & ~np.isnan(value_col)
    dist = _haversine_km(lat, lon, float(latitude), float(longitude))
    mask &= dist <= max_distance_km
    depth_diff = np.abs(pres - float(depth))
    mask &= ~np.isnan(depth_diff) & (depth_diff <= max_depth_diff)
    t64 = np.datetime64(time)
    dt_days = np.abs((time_arr - t64) / np.timedelta64(1, "D"))
    mask &= dt_days <= max_time_diff_days

    indices = np.nonzero(mask)[0]
    if indices.size == 0:
        return None

    # --- Deterministic scoring (vectorized; ties -> lowest row index) ---
    score = (
        dist[indices] / max_distance_km
        + depth_diff[indices] / max_depth_diff
        + dt_days[indices] / max_time_diff_days
    )
    best = int(indices[int(np.argmin(score))])

    t = time_arr[best]
    t_str = (
        str(np.datetime64(t, "s"))
        if np.issubdtype(np.asarray(t).dtype, np.datetime64)
        else str(t)
    )
    return {
        "id": f"ARGO_{_platform_str(cols['platform'][best])}_C{int(cols['cycle'][best])}_{best}",
        "latitude": round(float(lat[best]), 5),
        "longitude": round(float(lon[best]), 5),
        "depth": round(float(pres[best]), 2),
        "time": t_str,
        "value": round(float(value_col[best]), 3),
        "distance_km": round(float(dist[best]), 2),
        "depth_difference": round(float(depth_diff[best]), 2),
        "time_difference_days": round(float(dt_days[best]), 3),
    }


def _platform_str(value) -> str:
    """Deterministically render a PLATFORM_NUMBER (bytes/float/str) as text."""
    if isinstance(value, bytes):
        return bytes(value).decode(errors="ignore").strip()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


# Anomaly scan defaults / caps (documented in API_CONTRACT.md).
DEFAULT_MAX_ANOMALIES = 50
MAX_MAX_ANOMALIES = 500


def find_anomaly_candidates(
    *,
    variable: str,
    model_values_fn,
    latitude: float | None = None,
    longitude: float | None = None,
    radius_km: float | None = None,
    depth: float | None = None,
    depth_tolerance: float = 25.0,
    time: datetime | None = None,
    time_tolerance_days: float = 365.0,
    max_candidates: int = DEFAULT_MAX_ANOMALIES,
    path: str | os.PathLike | None = None,
) -> list[dict] | None:
    """Vectorized scan of QC-valid Argo rows with their model counterparts.

    ``model_values_fn(lat_array, lon_array) -> np.ndarray`` maps the
    candidate rows' coordinates to model values (provided by the anomaly
    service via the shared Phase 5 model surface). Fully vectorized over
    the cached Phase 4 NumPy columns — no per-row Python loop over 4M
    rows; Python dicts are built only for the final bounded subset.

    Returns ``None`` when the dataset file is missing (demo/unavailable);
    an empty list means the file exists but no row passed the filters.
    """
    if variable not in COMPARISON_VARIABLES:
        raise InvalidParameterError(
            f"Unsupported anomaly variable '{variable}'. Argo provides temperature and salinity only."
        )

    resolved = Path(path) if path is not None else argo_dataset_path()
    if not resolved.is_file():
        return None

    cols = _load_columns(resolved)
    value_col = cols["temp"] if variable == "temperature" else cols["psal"]

    lat = cols["lat"]
    lon = cols["lon"]
    pres = cols["pres"]
    time_arr = cols["time"]

    # --- Vectorized candidate mask (filters identical to Phase 4 semantics) ---
    mask = cols["coord_ok"] & ~np.isnan(value_col)

    dist = None
    if radius_km is not None:
        if latitude is None or longitude is None:
            raise InvalidParameterError("radius_km requires both a latitude and a longitude")
        dist = _haversine_km(lat, lon, float(latitude), float(longitude))
        mask &= dist <= radius_km

    if depth is not None:
        depth_diff = np.abs(pres - float(depth))
        mask &= ~np.isnan(depth_diff) & (depth_diff <= depth_tolerance)

    if time is not None:
        t64 = np.datetime64(time)
        mask &= np.abs((time_arr - t64) / np.timedelta64(1, "D")) <= time_tolerance_days

    indices = np.nonzero(mask)[0]
    if indices.size == 0:
        return []

    # --- Deterministic bounding: uniform stride over row order ---
    max_candidates = max(1, min(int(max_candidates), MAX_MAX_ANOMALIES))
    if indices.size > max_candidates:
        stride = int(math.ceil(indices.size / max_candidates))
        indices = indices[::stride]

    # --- Model values for the bounded subset only (single vectorized lookup) ---
    model_values = np.asarray(
        model_values_fn(lat[indices], lon[indices]), dtype=float
    )

    candidates: list[dict] = []
    time_subset = time_arr[indices]
    for pos, row in enumerate(indices):
        row = int(row)
        model_v = float(model_values[pos])
        if math.isnan(model_v):
            continue  # land-masked model cell: skip, never fabricate
        t = time_subset[pos]
        t_str = (
            str(np.datetime64(t, "s"))
            if np.issubdtype(np.asarray(t).dtype, np.datetime64)
            else str(t)
        )
        candidates.append(
            {
                "observation_id": f"ARGO_{_platform_str(cols['platform'][row])}_C{int(cols['cycle'][row])}_{row}",
                "observation_value": round(float(value_col[row]), 3),
                "model_value": round(model_v, 3),
                "latitude": round(float(lat[row]), 5),
                "longitude": round(float(lon[row]), 5),
                "depth": round(float(pres[row]), 2),
                "time": t_str,
                "distance_km": round(float(dist[row]), 2) if dist is not None else None,
            }
        )
    return candidates
