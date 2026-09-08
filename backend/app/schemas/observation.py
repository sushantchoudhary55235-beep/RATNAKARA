"""Pydantic response schemas for the observations endpoint."""

from pydantic import BaseModel, Field


class Observation(BaseModel):
    """A single in-situ observation record.

    ``depth`` is a **pressure/depth proxy** expressed in dbar (from
    PRES/PRES_ADJUSTED). It is NOT an exact geometric depth.
    """

    id: str = Field(..., description="Deterministic ID derived from PLATFORM_NUMBER + CYCLE_NUMBER + row index")
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    depth: float = Field(..., description="Pressure/depth proxy in dbar (PRES or PRES_ADJUSTED)")
    time: str = Field(..., description="ISO-8601 UTC timestamp")
    temperature: float | None = Field(None, description="Sea temperature in degrees Celsius (may be null)")
    salinity: float | None = Field(None, description="Practical salinity in PSU (may be null)")


class ObservationResponse(BaseModel):
    """Response for GET /api/v1/observations."""

    source: str = Field(..., description="Data source, e.g. 'Argo' (real) or 'demo' (dataset unavailable)")
    mode: str = Field(..., description="'real' when served from the local Argo dataset, 'demo' otherwise")
    count: int = Field(..., ge=0, description="Number of observations returned (max 5000)")
    depth_units: str = Field(
        "dbar (pressure/depth proxy)",
        description="Depth values are pressure in dbar used as a depth proxy, not exact geometric depth",
    )
    notes: list[str] = Field(default_factory=list, description="Processing / QC notes for this response")
    observations: list[Observation]