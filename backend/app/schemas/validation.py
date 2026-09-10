"""Pydantic response schema for the Forecast Truth Engine validation endpoint."""

from pydantic import BaseModel, Field


class ValidationMetrics(BaseModel):
    """Aggregate model-vs-observation metrics across matched pairs."""

    bias: float = Field(..., description="Mean(model - observation) across all valid pairs")
    mae: float = Field(..., description="Mean(|model - observation|) across all valid pairs")
    rmse: float = Field(..., description="Root-mean-square(model - observation) across all valid pairs")
    pair_count: int = Field(..., ge=0, description="Number of valid model-observation pairs used")
    model_mean: float = Field(..., description="Mean model value across all valid pairs")
    observation_mean: float = Field(..., description="Mean observation value across all valid pairs")


class CollocationInfo(BaseModel):
    """Metadata about the collocation process explaining why the result is trustworthy."""

    total_argo_candidates: int = Field(
        ..., description="Total Argo observations with valid coords, value, and pressure"
    )
    spatial_temporal_matched: int = Field(
        ..., description="Candidates within model lat/lon bounds and time window"
    )
    depth_matched: int = Field(
        ..., description="Candidates whose nearest model depth is within tolerance"
    )
    valid_pairs: int = Field(
        ..., description="Final collocated pairs (non-NaN model + observation)"
    )
    rejected_by_land: int = Field(
        ..., description="Pairs rejected because model grid cell is land (NaN)"
    )
    mean_depth_difference_dbar: float = Field(
        ..., description="Mean absolute depth difference across valid pairs (dbar)"
    )
    max_depth_difference_dbar: float = Field(
        ..., description="Maximum depth difference across valid pairs (dbar)"
    )
    mean_spatial_distance_km: float = Field(
        ..., description="Mean Haversine distance between Argo obs and matched model grid point (km)"
    )
    max_spatial_distance_km: float = Field(
        ..., description="Maximum spatial distance across valid pairs (km)"
    )
    model_time_used: str = Field(
        ..., description="Model timestep used for comparison (ISO 8601)"
    )
    observation_time_range: list[str] = Field(
        ..., description="Earliest and latest Argo observation timestamps in valid pairs [min, max]"
    )
    depth_tolerance_dbar: float = Field(
        ..., description="Maximum depth difference tolerance applied (dbar)"
    )
    time_tolerance_days: float = Field(
        ..., description="Maximum time difference tolerance applied (days)"
    )


class ValidationResponse(BaseModel):
    """Response for GET /api/v1/validation — the Forecast Truth Engine."""

    variable: str = Field(..., description="Variable being validated (e.g. 'temperature')")
    unit: str = Field(..., description="Measurement unit")
    source_model: str = Field(..., description="Model data source")
    source_observation: str = Field(..., description="Observation data source")
    mode: str = Field(..., description="'real' when both datasets are local")
    metrics: ValidationMetrics
    collocation: CollocationInfo
    notes: list[str] = Field(default_factory=list, description="Methodology notes and caveats")
