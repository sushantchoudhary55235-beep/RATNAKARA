"""Business logic for the Smart Ocean Anomaly Detection endpoint.

Reuses the Phase 5 comparison model-side lookup (``get_model_surface``)
and the Phase 4 Argo cached NumPy columns (via the vectorized
``find_anomaly_candidates``). No dataset logic lives here and no large
processing blocks live in the API route.

The result is a PROTOTYPE analytical indicator built from
model-observation differences. It is NOT an official INCOIS warning and
the threshold is a configurable prototype parameter, not a
scientifically approved value.
"""

from __future__ import annotations

import math
from datetime import datetime

import numpy as np

from app.processing.argo_processor import (
    DEFAULT_MAX_ANOMALIES,
    MAX_MAX_ANOMALIES,
    DatasetUnavailableError,
    InvalidParameterError,
    NoMatchingDataError,
    find_anomaly_candidates,
)
from app.schemas.anomaly import (
    Anomaly,
    AnomalyLocation,
    AnomalyModelValue,
    AnomalyObservation,
    AnomalyResponse,
)
from app.services.comparison_service import (
    COMPARISON_SUPPORT,
    get_model_surface,
)

# Prototype analytical thresholds (documented; configurable per request).
# These are demo/analytical values ONLY — not INCOIS-approved thresholds.
PROTOTYPE_THRESHOLDS: dict[str, float] = {
    "temperature": 2.0,  # °C
    "salinity": 0.5,     # PSU
}

# Bounded candidate scan before thresholding (deterministic stride).
MAX_SCAN_CANDIDATES = 20000

NOTES: list[str] = [
    "This is a prototype analytical indicator, not an official INCOIS "
    "warning, forecast, or certified anomaly detection.",
    "The indicator is based on the model-observation difference "
    "(observed Argo value minus expected model value).",
    "The threshold is a configurable prototype analytical threshold, not a "
    "scientifically validated or INCOIS-approved value.",
    "Argo depth is represented using a pressure/depth proxy in dbar; it is "
    "NOT an exact geometric depth and no conversion formula is invented.",
    "The current prototype model dataset contains a single timestep "
    "(2026-06-23); this dataset does not support genuine model time-series "
    "anomaly analysis.",
    "Pairs whose model cell is land-masked (NaN) are skipped — values are "
    "never fabricated.",
]


def get_anomalies(
    *,
    variable: str,
    latitude: float | None = None,
    longitude: float | None = None,
    radius_km: float | None = None,
    depth: float | None = None,
    depth_tolerance: float = 25.0,
    time: datetime | None = None,
    time_tolerance_days: float = 365.0,
    threshold: float | None = None,
    max_results: int = DEFAULT_MAX_ANOMALIES,
) -> AnomalyResponse:
    """Scan model-observation pairs and return prototype anomaly candidates."""
    _validate(
        variable=variable, latitude=latitude, longitude=longitude,
        radius_km=radius_km, depth=depth, depth_tolerance=depth_tolerance,
        time_tolerance_days=time_tolerance_days, threshold=threshold,
        max_results=max_results,
    )

    if not COMPARISON_SUPPORT[variable]:
        raise InvalidParameterError(
            f"Unsupported anomaly variable '{variable}': the Argo observation "
            "dataset provides temperature and salinity only, so no real current "
            "observations exist. Current anomalies are not fabricated."
        )

    used_threshold = float(threshold) if threshold is not None else PROTOTYPE_THRESHOLDS[variable]

    # --- Model surface (Phase 5 shared lookup; 404 if model file missing) ---
    surface = get_model_surface(
        variable=variable,
        depth=depth if depth is not None else 0.0,
        time=time if time is not None else datetime(2026, 6, 23),
    )
    field = surface["field"]
    unit = surface["unit"]

    # Vectorized nearest-grid-index lookup for candidate coordinates.
    lat_grid = np.asarray(field.latitude.values, dtype=float)
    lon_grid = np.asarray(field.longitude.values, dtype=float)
    values_2d = np.asarray(field.values, dtype=float)

    def model_values_fn(cand_lat: np.ndarray, cand_lon: np.ndarray) -> np.ndarray:
        lat_idx = _nearest_indices(lat_grid, cand_lat)
        lon_idx = _nearest_indices(lon_grid, cand_lon)
        return values_2d[lat_idx, lon_idx]

    # --- Vectorized Argo candidate scan (Phase 4 cached columns; None = file missing) ---
    candidates = find_anomaly_candidates(
        variable=variable,
        model_values_fn=model_values_fn,
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
        depth=depth,
        depth_tolerance=depth_tolerance,
        time=time,
        time_tolerance_days=time_tolerance_days,
        max_candidates=MAX_SCAN_CANDIDATES,
    )
    if candidates is None:
        raise DatasetUnavailableError(
            "Argo dataset is not available on this deployment; anomaly "
            "indicators require the real local model and Argo datasets "
            "(real and demo data are never mixed)."
        )
    if not candidates:
        raise NoMatchingDataError(
            "No valid Argo observations with a QC-passed "
            f"'{variable}' measurement matched the requested filters."
        )

    # --- Threshold application (vectorized semantics, bounded list) ---
    anomalies: list[Anomaly] = []
    for c in candidates:
        difference = c["observation_value"] - c["model_value"]
        abs_diff = abs(difference)
        status = "WARNING" if abs_diff >= used_threshold else "NORMAL"
        if status != "WARNING":
            continue
        if difference > 0:
            interpretation = "Observed value is higher than model value."
        elif difference < 0:
            interpretation = "Observed value is lower than model value."
        else:
            interpretation = "Observed value matches model value."
        anomalies.append(
            Anomaly(
                status=status,
                variable=variable,
                unit=unit,
                location=AnomalyLocation(latitude=c["latitude"], longitude=c["longitude"]),
                depth=c["depth"],
                time=c["time"],
                observed_value=c["observation_value"],
                expected_value=c["model_value"],
                difference=round(difference, 4),
                absolute_difference=round(abs_diff, 4),
                threshold=used_threshold,
                observation=AnomalyObservation(id=c["observation_id"], source="Argo"),
                model=AnomalyModelValue(source="Copernicus Marine"),
                message=(
                    f"Unusual {variable} difference detected between model and "
                    f"observation. {interpretation}"
                ),
            )
        )

    # Deterministic ordering: largest absolute difference first; ties by
    # observation id (stable, reproducible).
    anomalies.sort(key=lambda a: (-a.absolute_difference, a.observation.id))
    anomalies = anomalies[: max(1, min(int(max_results), MAX_MAX_ANOMALIES))]

    overall_status = "WARNING" if anomalies else "NORMAL"
    return AnomalyResponse(
        count=len(anomalies),
        status=overall_status,
        variable=variable,
        unit=unit,
        threshold=used_threshold,
        mode="real",
        anomalies=anomalies,
        notes=list(NOTES),
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _validate(
    *,
    variable: str,
    latitude: float | None,
    longitude: float | None,
    radius_km: float | None,
    depth: float | None,
    depth_tolerance: float,
    time_tolerance_days: float,
    threshold: float | None,
    max_results: int,
) -> None:
    if variable not in COMPARISON_SUPPORT:
        from app.processing.model_processor import VARIABLE_MAP

        raise InvalidParameterError(
            f"Unsupported variable '{variable}'. Supported anomaly variables: "
            + ", ".join(sorted(VARIABLE_MAP))
        )
    if latitude is not None and (not math.isfinite(latitude) or not (-90.0 <= latitude <= 90.0)):
        raise InvalidParameterError(
            f"Invalid latitude '{latitude}': must be between -90 and 90"
        )
    if longitude is not None and (not math.isfinite(longitude) or not (-180.0 <= longitude <= 180.0)):
        raise InvalidParameterError(
            f"Invalid longitude '{longitude}': must be between -180 and 180"
        )
    if (latitude is None) != (longitude is None):
        raise InvalidParameterError(
            "anomaly location filtering requires BOTH latitude and longitude"
        )
    if radius_km is not None:
        if not math.isfinite(radius_km) or radius_km <= 0:
            raise InvalidParameterError("radius_km must be a positive number of kilometers")
        if latitude is None or longitude is None:
            raise InvalidParameterError(
                "radius_km requires both a latitude and a longitude (the circle center)"
            )
    if depth is not None and (not math.isfinite(depth) or depth < 0):
        raise InvalidParameterError(
            f"Invalid depth '{depth}': must be a non-negative number (dbar)"
        )
    if not math.isfinite(depth_tolerance) or depth_tolerance < 0:
        raise InvalidParameterError("depth_tolerance must be a non-negative number")
    if not math.isfinite(time_tolerance_days) or time_tolerance_days < 0:
        raise InvalidParameterError("time_tolerance_days must be a non-negative number")
    if threshold is not None and (not math.isfinite(threshold) or threshold < 0):
        raise InvalidParameterError(
            f"Invalid threshold '{threshold}': must be a non-negative number"
        )
    if not math.isfinite(max_results) or max_results < 1:
        raise InvalidParameterError("max_results must be a positive integer")


def _nearest_indices(grid_sorted: np.ndarray, values: np.ndarray) -> np.ndarray:
    """Vectorized nearest-index lookup for an ascending sorted grid."""
    if grid_sorted.size < 2 or not np.all(np.diff(grid_sorted) >= 0):
        # Fallback (small grids): brute-force nearest via broadcasting chunks.
        idx = np.empty(values.shape, dtype=np.int64)
        chunk = 4096
        for start in range(0, values.size, chunk):
            block = values[start:start + chunk]
            idx[start:start + chunk] = np.abs(
                block[:, None] - grid_sorted[None, :]
            ).argmin(axis=1)
        return idx
    pos = np.searchsorted(grid_sorted, values)
    pos = np.clip(pos, 1, grid_sorted.size - 1)
    left = grid_sorted[pos - 1]
    right = grid_sorted[pos]
    return pos - 1 + (np.abs(values - right) < np.abs(values - left)).astype(np.int64)