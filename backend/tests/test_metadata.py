"""Tests for the dataset metadata endpoint."""

from fastapi.testclient import TestClient


def test_metadata_returns_project_info(client: TestClient) -> None:
    response = client.get("/api/v1/metadata")
    assert response.status_code == 200
    body = response.json()
    assert body["project"] == "SAGARA"
    assert body["version"] == "0.1.0"


def test_metadata_model_dataset(client: TestClient) -> None:
    body = client.get("/api/v1/metadata").json()
    model = body["datasets"]["model"]
    assert model["filename"] == "arabian_sea_model.nc"
    assert model["source"] == "Copernicus Marine (CMEMS GLORYS12V1)"
    assert model["variables"] == {
        "temperature": "thetao",
        "salinity": "so",
        "u_current": "uo",
        "v_current": "vo",
    }
    assert model["spatial_coverage"]["latitude_min"] == -30.0
    assert model["time_steps"] == 1


def test_metadata_argo_dataset(client: TestClient) -> None:
    body = client.get("/api/v1/metadata").json()
    argo = body["datasets"]["argo"]
    assert argo["filename"] == "arabian_sea_argo.nc"
    assert argo["source"] == "INCOIS / Indian Argo observation dataset"
    for field in ["PLATFORM_NUMBER", "CYCLE_NUMBER", "time", "latitude", "longitude",
                  "PRES", "TEMP", "PSAL"]:
        assert field in argo["fields"]
    assert "TEMP_QC" in argo["qc_fields"]


def test_metadata_underwater_platform_not_confirmed_glider(client: TestClient) -> None:
    body = client.get("/api/v1/metadata").json()
    platform = body["datasets"]["underwater_platform"]
    assert platform["filename"] == "arabian_sea_glider.csv"
    assert "not yet verified" in platform["status"]
    assert "candidate" in platform["status"]