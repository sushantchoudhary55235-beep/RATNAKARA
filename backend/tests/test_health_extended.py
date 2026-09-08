"""Extended tests for the health check endpoint."""

from fastapi.testclient import TestClient


def test_health_response_format(client: TestClient) -> None:
    resp = client.get("/health")
    body = resp.json()
    assert isinstance(body, dict)
    assert "status" in body
    assert "service" in body


def test_health_status_is_ok(client: TestClient) -> None:
    resp = client.get("/health")
    assert resp.json()["status"] == "ok"


def test_health_service_name(client: TestClient) -> None:
    resp = client.get("/health")
    assert resp.json()["service"] == "SAGARA backend"


def test_health_is_fast(client: TestClient) -> None:
    """Health endpoint should not load any datasets and be fast."""
    import time

    start = time.perf_counter()
    resp = client.get("/health")
    elapsed = time.perf_counter() - start
    assert resp.status_code == 200
    assert elapsed < 1.0  # should be well under 1 second


def test_health_does_not_load_datasets(client: TestClient) -> None:
    """Health check should work even if datasets are missing."""
    import os

    old_model = os.environ.get("SAGARA_MODEL_PATH")
    old_argo = os.environ.get("SAGARA_ARGO_PATH")
    try:
        os.environ["SAGARA_MODEL_PATH"] = "/nonexistent/path.nc"
        os.environ["SAGARA_ARGO_PATH"] = "/nonexistent/path.nc"
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
    finally:
        if old_model is not None:
            os.environ["SAGARA_MODEL_PATH"] = old_model
        else:
            os.environ.pop("SAGARA_MODEL_PATH", None)
        if old_argo is not None:
            os.environ["SAGARA_ARGO_PATH"] = old_argo
        else:
            os.environ.pop("SAGARA_ARGO_PATH", None)
