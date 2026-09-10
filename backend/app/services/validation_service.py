"""Forecast Truth Engine — batch validation service (improved collocation).

Collocates Argo observations with model grid points using:
1. Nearest model depth level (not just surface)
2. Nearest model grid point (spatial)
3. Temporal window filter
4. Returns detailed collocation metadata

Reuses the existing model processor and Argo processor.
No dataset logic lives here.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone

import numpy as np

from app.processing.argo_processor import (
    _load_columns,
    argo_dataset_path,
)
from app.processing.model_processor import (
    SOURCE_NAME as MODEL_SOURCE_NAME,
    _display_unit,
    get_variable_map,
    load_dataset,
)
from app.schemas.validation import CollocationInfo, ValidationMetrics, ValidationResponse


# --- Explicit collocation tolerances ---
MAX_DEPTH_DIFF_DBAR = 50.0
MAX_TIME_DIFF_DAYS = 730.0

# Model timestep (the dataset has exactly one)
MODEL_TIME = np.datetime64("2026-06-23T00:00:00")
MODEL_TIME_STR = "2026-06-23T00:00:00"

NOTES_TEMPLATE: list[str] = [
    "Forecast Truth Engine: collocated comparison of Copernicus Marine model "
    "temperature against INCOIS Argo observations.",
    "Collocation method: for each Argo observation, the nearest model grid "
    "point (latitude/longitude) AND the nearest model depth level are selected.",
    "Depth matching: Argo pressure/depth proxy (dbar) is matched to the "
    "nearest model depth level; observations > {max_depth} dbar from the "
    "nearest level are rejected.",
    "Temporal matching: only Argo observations within {max_time} days of "
    "the model timestep (2026-06-23) are used.",
    "KNOWN LIMITATION: The model dataset contains a single timestep "
    "(2026-06-23) while the Argo dataset ends at 2025-04-01 (~449 days "
    "earlier). There is NO temporal overlap. The {max_time}-day window "
    "captures the closest available Argo observations, but the temporal "
    "mismatch is a fundamental limitation of this prototype dataset.",
    "This is a prototype analytical comparison and not official INCOIS "
    "validation or a certified accuracy statement.",
]


def get_validation(
    *,
    variable: str = "temperature",
    max_depth_diff: float = MAX_DEPTH_DIFF_DBAR,
    max_time_diff_days: float = MAX_TIME_DIFF_DAYS,
) -> ValidationResponse:
    """Run collocated model-vs-observation comparison and return metrics + metadata."""
    if variable not in ("temperature", "salinity"):
        raise ValueError(
            f"Unsupported variable '{variable}'. Only temperature and salinity "
            "have Argo observations for comparison."
        )

    # --- Load datasets ---
    argo_path = argo_dataset_path()
    if not argo_path.is_file():
        raise FileNotFoundError(f"Argo dataset not found at {argo_path}")

    cols = _load_columns(argo_path)
    argo_lats = cols["lat"]
    argo_lons = cols["lon"]
    argo_pres = cols["pres"]
    argo_time = cols["time"]
    value_col = cols["temp"] if variable == "temperature" else cols["psal"]

    ds = load_dataset()
    source_var = get_variable_map()[variable]
    field_3d = ds[source_var].sel(time=MODEL_TIME, method="nearest")

    model_depths = field_3d.depth.values  # (32,)
    model_lats = field_3d.latitude.values  # (661,)
    model_lons = field_3d.longitude.values  # (660,)
    model_all_depths = field_3d.values  # (32, 661, 660)

    # --- Count total valid Argo candidates ---
    total_valid_argo = int(np.sum(
        cols["coord_ok"] & ~np.isnan(value_col) & ~np.isnan(argo_pres) & (argo_pres >= 0)
    ))

    # --- Step 1: Spatial + temporal mask ---
    mask = cols["coord_ok"].copy()
    mask &= ~np.isnan(value_col)
    mask &= ~np.isnan(argo_pres)
    mask &= argo_pres >= 0
    mask &= (argo_lats >= float(model_lats.min())) & (argo_lats <= float(model_lats.max()))
    mask &= (argo_lons >= float(model_lons.min())) & (argo_lons <= float(model_lons.max()))

    dt_days = np.abs((argo_time - MODEL_TIME) / np.timedelta64(1, "D"))
    mask &= dt_days <= max_time_diff_days

    st_indices = np.nonzero(mask)[0]
    n_st = int(st_indices.size)
    if n_st == 0:
        raise ValueError(
            "No Argo observations match spatial/temporal criteria. "
            f"Time window: {max_time_diff_days} days from 2026-06-23."
        )

    # --- Extract candidate arrays ---
    c_lats = argo_lats[st_indices]
    c_lons = argo_lons[st_indices]
    c_pres = argo_pres[st_indices]
    c_vals = value_col[st_indices]
    c_times = argo_time[st_indices]

    # --- Step 2: Vectorized nearest depth matching ---
    depth_diffs = np.abs(model_depths[np.newaxis, :] - c_pres[:, np.newaxis])  # (N, 32)
    nearest_d_idx = depth_diffs.argmin(axis=1)
    nearest_d_diff = depth_diffs[np.arange(len(nearest_d_idx)), nearest_d_idx]
    depth_ok = nearest_d_diff <= max_depth_diff
    n_depth = int(depth_ok.sum())

    if n_depth == 0:
        raise ValueError(
            f"No Argo observations have a model depth match within {max_depth_diff} dbar."
        )

    # --- Step 3: Vectorized nearest grid point matching ---
    lat_idx = np.abs(model_lats[np.newaxis, :] - c_lats[:, np.newaxis]).argmin(axis=1)
    lon_idx = np.abs(model_lons[np.newaxis, :] - c_lons[:, np.newaxis]).argmin(axis=1)

    matched_model_lats = model_lats[lat_idx]
    matched_model_lons = model_lons[lon_idx]
    # Vectorized haversine between two arrays of equal length
    rlat1, rlon1 = np.radians(c_lats), np.radians(c_lons)
    rlat2, rlon2 = np.radians(matched_model_lats), np.radians(matched_model_lons)
    dlat = rlat2 - rlat1
    dlon = rlon2 - rlon1
    a = np.sin(dlat / 2) ** 2 + np.cos(rlat1) * np.cos(rlat2) * np.sin(dlon / 2) ** 2
    spatial_dists = 6371.0088 * 2 * np.arcsin(np.sqrt(np.clip(a, 0.0, 1.0)))

    # --- Step 4: Extract model values (vectorized) ---
    d_idx_valid = nearest_d_idx[depth_ok]
    la_idx_valid = lat_idx[depth_ok]
    lo_idx_valid = lon_idx[depth_ok]
    model_vals = model_all_depths[d_idx_valid, la_idx_valid, lo_idx_valid]
    obs_vals = c_vals[depth_ok]
    depth_diffs_valid = nearest_d_diff[depth_ok]
    spatial_dists_valid = spatial_dists[depth_ok]
    times_valid = c_times[depth_ok]

    # Filter out NaN model values (land cells)
    valid = ~np.isnan(model_vals) & ~np.isnan(obs_vals)
    n_land_rejected = int((~valid).sum())

    model_final = model_vals[valid]
    obs_final = obs_vals[valid]
    depth_final = depth_diffs_valid[valid]
    spatial_final = spatial_dists_valid[valid]
    times_final = times_valid[valid]

    pair_count = len(model_final)
    if pair_count == 0:
        raise ValueError(
            "No valid collocated pairs formed. "
            "All matched observations land on model land cells."
        )

    # --- Calculate metrics ---
    diffs = model_final - obs_final
    bias = float(np.mean(diffs))
    mae = float(np.mean(np.abs(diffs)))
    rmse = float(np.sqrt(np.mean(diffs ** 2)))
    model_mean = float(np.mean(model_final))
    obs_mean = float(np.mean(obs_final))

    # --- Collocation metadata ---
    obs_times_str = [str(np.datetime64(t, "s")) for t in times_final]
    collocation = CollocationInfo(
        total_argo_candidates=total_valid_argo,
        spatial_temporal_matched=n_st,
        depth_matched=n_depth,
        valid_pairs=pair_count,
        rejected_by_land=n_land_rejected,
        mean_depth_difference_dbar=round(float(np.mean(depth_final)), 4),
        max_depth_difference_dbar=round(float(np.max(depth_final)), 4),
        mean_spatial_distance_km=round(float(np.mean(spatial_final)), 4),
        max_spatial_distance_km=round(float(np.max(spatial_final)), 4),
        model_time_used=MODEL_TIME_STR,
        observation_time_range=[
            min(obs_times_str) if obs_times_str else "",
            max(obs_times_str) if obs_times_str else "",
        ],
        depth_tolerance_dbar=max_depth_diff,
        time_tolerance_days=max_time_diff_days,
    )

    unit = _display_unit(ds, source_var, variable)

    notes = [
        note.format(max_depth=max_depth_diff, max_time=max_time_diff_days)
        for note in NOTES_TEMPLATE
    ]
    notes.append(
        f"Collocation result: {total_valid_argo} total candidates → "
        f"{n_st} spatial+temporal → {n_depth} depth-matched → "
        f"{pair_count} valid pairs ({n_land_rejected} rejected by land)."
    )

    return ValidationResponse(
        variable=variable,
        unit=unit,
        source_model=MODEL_SOURCE_NAME,
        source_observation="Argo",
        mode="real",
        metrics=ValidationMetrics(
            bias=round(bias, 4),
            mae=round(mae, 4),
            rmse=round(rmse, 4),
            pair_count=pair_count,
            model_mean=round(model_mean, 4),
            observation_mean=round(obs_mean, 4),
        ),
        collocation=collocation,
        notes=notes,
    )
