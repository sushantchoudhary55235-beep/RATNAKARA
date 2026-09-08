"""Pydantic response schemas for the comparison endpoint."""

from pydantic import BaseModel, Field


class ComparisonLocation(BaseModel):
    """Requested geographic location."""

    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class ComparisonRequested(BaseModel):
    """Requested depth and time."""

    depth: float = Field(..., description="Requested depth in meters (model) / pressure-proxy dbar (Argo)")
    time: str = Field(..., description="Requested ISO-8601 timestamp")


class ComparisonModelValue(BaseModel):
    """Model value at the requested location/depth/time."""

    value: float
    source: str = "Copernicus Marine"


class ComparisonObservation(BaseModel):
    """Nearest valid Argo observation used for the comparison."""

    value: float
    source: str = "Argo"
    id: str
    latitude: float
    longitude: float
    depth: float = Field(..., description="Pressure/depth proxy in dbar (PRES/PRES_ADJUSTED)")
    time: str = Field(..., description="ISO-8601 observation timestamp")


class ComparisonMatch(BaseModel):
    """Why this observation was selected (exposed for transparency)."""

    distance_km: float = Field(..., description="Haversine distance between requested location and observation")
    depth_difference: float = Field(..., description="|requested depth - observation pressure/depth proxy| in dbar")
    time_difference_days: float = Field(..., description="|requested time - observation time| in days")


class ComparisonResponse(BaseModel):
    """Response for GET /api/v1/comparison."""

    variable: str
    unit: str
    location: ComparisonLocation
    requested: ComparisonRequested
    model: ComparisonModelValue
    observation: ComparisonObservation
    difference: float = Field(..., description="model value - observation value")
    absolute_difference: float = Field(..., description="absolute value of the difference")
    match: ComparisonMatch
    interpretation: str = Field(..., description="Plain-language interpretation of the difference")
    mode: str = Field(..., description="'real' when both datasets are local and real")
    notes: list[str] = Field(default_factory=list, description="Matching method and scientific limitations")