"""Extended tests for the metadata endpoint."""

from fastapi.testclient import TestClient


class TestMetadataSchema:
    def test_full_response_schema(self, client: TestClient) -> None:
        body = client.get("/api/v1/metadata").json()
        # Top-level keys
        for key in ("project", "version", "datasets"):
            assert key in body

        ds = body["datasets"]
        for key in ("model", "argo", "underwater_platform"):
            assert key in ds

    def test_model_dataset_schema(self, client: TestClient) -> None:
        model = client.get("/api/v1/metadata").json()["datasets"]["model"]
        for key in ("filename", "source", "variables", "variable_units", "spatial_coverage", "depth_range_m", "time_steps"):
            assert key in model

    def test_argo_dataset_schema(self, client: TestClient) -> None:
        argo = client.get("/api/v1/metadata").json()["datasets"]["argo"]
        for key in ("filename", "source", "fields", "qc_fields"):
            assert key in argo

    def test_underwater_platform_schema(self, client: TestClient) -> None:
        platform = client.get("/api/v1/metadata").json()["datasets"]["underwater_platform"]
        for key in ("filename", "source", "status"):
            assert key in platform

    def test_model_spatial_coverage(self, client: TestClient) -> None:
        coverage = client.get("/api/v1/metadata").json()["datasets"]["model"]["spatial_coverage"]
        assert coverage["latitude_min"] < coverage["latitude_max"]
        assert coverage["longitude_min"] < coverage["longitude_max"]

    def test_metadata_deterministic(self, client: TestClient) -> None:
        a = client.get("/api/v1/metadata").json()
        b = client.get("/api/v1/metadata").json()
        assert a == b

    def test_metadata_notes_list(self, client: TestClient) -> None:
        model = client.get("/api/v1/metadata").json()["datasets"]["model"]
        assert isinstance(model["notes"], list)
        assert len(model["notes"]) > 0

    def test_glider_not_confirmed(self, client: TestClient) -> None:
        platform = client.get("/api/v1/metadata").json()["datasets"]["underwater_platform"]
        # Must NOT say "confirmed" or "verified" for the glider
        status_lower = platform["status"].lower()
        assert "candidate" in status_lower or "unverified" in status_lower or "not yet verified" in status_lower

    def test_model_time_steps_one(self, client: TestClient) -> None:
        model = client.get("/api/v1/metadata").json()["datasets"]["model"]
        assert model["time_steps"] == 1
        # Single-timestep limitation should be documented
        notes_text = " ".join(model["notes"]).lower()
        assert "single" in notes_text or "one" in notes_text or "1" in notes_text
