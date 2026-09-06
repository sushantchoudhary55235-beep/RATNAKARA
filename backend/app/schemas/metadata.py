"""Pydantic response schemas for dataset metadata."""

from pydantic import BaseModel


class SpatialCoverage(BaseModel):
    """Approximate spatial bounding box of a dataset."""

    latitude_min: float
    latitude_max: float
    longitude_min: float
    longitude_max: float


class ModelDatasetMetadata(BaseModel):
    """Metadata for the CMEMS ocean model sample file."""

    filename: str
    source: str
    variables: dict[str, str]
    variable_units: dict[str, str]
    spatial_coverage: SpatialCoverage
    depth_range_m: list[float]
    time_steps: int
    notes: list[str] = []


class ArgoDatasetMetadata(BaseModel):
    """Metadata for the INCOIS Argo observation sample file."""

    filename: str
    source: str
    fields: list[str]
    qc_fields: list[str] = []


class UnderwaterPlatformMetadata(BaseModel):
    """Metadata for the candidate glider/underwater-platform sample file."""

    filename: str
    source: str
    status: str


class DatasetsMetadata(BaseModel):
    """All sample datasets known to the backend."""

    model: ModelDatasetMetadata
    argo: ArgoDatasetMetadata
    underwater_platform: UnderwaterPlatformMetadata


class MetadataResponse(BaseModel):
    """Response for GET /api/v1/metadata."""

    project: str
    version: str
    datasets: DatasetsMetadata