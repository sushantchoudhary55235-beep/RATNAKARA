"""Dataset metadata service.

Values here come from the Phase 1 inspection of the sample datasets
(data/sample/, inspected 2026-09-06) and the Phase 1.5 documentation
corrections. No dataset files are opened by this module, so application
startup stays fast and does not depend on the large scientific files.
"""

from app.schemas.metadata import (
    ArgoDatasetMetadata,
    DatasetsMetadata,
    MetadataResponse,
    ModelDatasetMetadata,
    SpatialCoverage,
    UnderwaterPlatformMetadata,
)

PROJECT_NAME = "SAGARA"
API_VERSION = "0.1.0"


def get_metadata() -> MetadataResponse:
    """Return verified metadata for the datasets discovered during Phase 1."""
    return MetadataResponse(
        project=PROJECT_NAME,
        version=API_VERSION,
        datasets=DatasetsMetadata(
            model=ModelDatasetMetadata(
                filename="arabian_sea_model.nc",
                source="Copernicus Marine (CMEMS GLORYS12V1)",
                variables={
                    "temperature": "thetao",
                    "salinity": "so",
                    "u_current": "uo",
                    "v_current": "vo",
                },
                variable_units={
                    "temperature": "degrees_C (already Celsius; no Kelvin conversion)",
                    "salinity": "PSU",
                    "u_current": "m/s",
                    "v_current": "m/s",
                },
                spatial_coverage=SpatialCoverage(
                    latitude_min=-30.0,
                    latitude_max=25.0,
                    longitude_min=45.0,
                    longitude_max=99.9167,
                ),
                depth_range_m=[0.49, 541.09],
                time_steps=1,
                notes=[
                    "thetao is already stored in degrees Celsius - do NOT apply a Kelvin to Celsius conversion",
                    "Single timestep (2026-06-23); time-series animation requires additional temporal model data",
                    "Sea-ice variables (siconc, sithick, usi, vsi) are 100% NaN in this region",
                ],
            ),
            argo=ArgoDatasetMetadata(
                filename="arabian_sea_argo.nc",
                source="INCOIS / Indian Argo observation dataset",
                fields=[
                    "PLATFORM_NUMBER",
                    "CYCLE_NUMBER",
                    "DIRECTION",
                    "time",
                    "latitude",
                    "longitude",
                    "PRES",
                    "PRES_ADJUSTED",
                    "TEMP",
                    "TEMP_ADJUSTED",
                    "PSAL",
                    "PSAL_ADJUSTED",
                ],
                qc_fields=[
                    "PRES_QC",
                    "PRES_ADJUSTED_QC",
                    "TEMP_QC",
                    "TEMP_ADJUSTED_QC",
                    "PSAL_QC",
                    "PSAL_ADJUSTED_QC",
                ],
            ),
            underwater_platform=UnderwaterPlatformMetadata(
                filename="arabian_sea_glider.csv",
                source="underwater-platform observation data (candidate glider/underwater-platform observation dataset)",
                status="candidate dataset; glider provenance not yet verified",
            ),
        ),
    )