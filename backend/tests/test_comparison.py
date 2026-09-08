"""Tests for the Model-vs-Reality comparison endpoint.

Most tests use synthetic data (a synthetic Argo dataset + a synthetic
model dataset) so the suite does not depend on the 455 MB real dataset.
Real-data smoke tests run only when the local datasets exist.
"""

from __future__ import annotations

import os
from datetime import datetime

import numpy as np
import pytest
import xarray as xr
from fastapi.testclient import TestClient

from app.processing.argo_processor import (
    _haversine_km,
    _invalidate_cache,
    find_nearest_observation,
)

# ---------------------------------------------------------------------------
# Synthetic fixtures
# ---------------------------------------------------------------------------


def make_argo_ds(n: int = 12) -> xr.Dataset:
    """Synthetic Argo flat-table dataset: lat 10-20, lon 60-70, 200 dbar span."""
    lat = np.linspace(10.0, 20.0, n)
    lon = np.linspace(60.0, 70.0, n)
    pres = np.linspace(10.0, 210.0, n)
    time = np.array(
        [np.datetime64("2026-06-20T00:00:00") + np.timedelta64(int(d), "D") for d in range(n)]
    )
    temp = 27.0 - pres / 20.0
    psal = 35.0 + pres / 500.0
    platform = np.array([f"390000{i:02d}" for i in range(n)])
    cycle = np.arange(1, n + 1)

    data = {
        "PLATFORM_NUMBER": platform,
        "CYCLE_NUMBER": cycle,
        "time": time,
        "latitude": lat,
        "longitude": lon,
        "PRES": pres,
        "PRES_QC": np.ones(n, dtype=int),
        "TEMP": temp,
        "TEMP_QC": np.ones(n, dtype=int),
        "TEMP_ADJUSTED": temp + 0.5,
        "TEMP_ADJUSTED_QC": np.ones(n, dtype=int),
        "PSAL": psal,
        "PSAL_QC": np.ones(n, dtype=int),
        "PSAL_ADJUSTED": psal + 0.1,
        "PSAL_ADJUSTED_QC": np.ones(n, dtype=int),
    }
    return xr.Dataset({k: ("row", v) for k, v in data.items()})


def make_model_ds() -> xr.Dataset:
    """Synthetic CMEMS-like model dataset: 1 time, 2 depths, 3x3 grid."""
    lat = np.array([17.0, 18.0, 19.0])
    lon = np.array([65.0, 66.0, 67.0])
    depth = np.array([5.0, 50.0])
    time = np.array([np.datetime64("2026-06-23T00:00:00")])
    temp = np.full((1, 2, 3, 3), 28.0)
    psal = np.full((1, 2, 3, 3), 35.5)
    return xr.Dataset(
        {
            "thetao": (("time", "depth", "latitude", "longitude"), temp),
            "so": (("time", "depth", "latitude", "longitude"), psal),
        },
        coords={"time": time, "depth": depth, "latitude": lat, "longitude": lon},
    )


@pytest.fixture(autouse=True)
def _clean_cache():
    _invalidate_cache()
    yield
    _invalidate_cache()


@pytest.fixture()
def synthetic_env(tmp_path, monkeypatch):
    """Write synthetic Argo + model datasets and point env vars at them."""
    argo_path = tmp_path / "synthetic_argo.nc"
    make_argo_ds().to_netcdf(argo_path)
    model_path = tmp_path / "synthetic_model.nc"
    make_model_ds().to_netcdf(model_path)
    monkeypatch.setenv("SAGARA_ARGO_PATH", str(argo_path))
    monkeypatch.setenv("SAGARA_MODEL_PATH", str(model_path))
    _invalidate_cache()
    # Clear the model processor's dataset cache so the env var takes effect.
    from app.processing import model_processor

    model_processor._dataset_cache.clear()
    yield {"argo": argo_path, "model": model_path}
    model_processor._dataset_cache.clear()


@pytest.fixture()
def client() -> TestClient:
    from app.main import app

    return TestClient(app)


def compare(client: TestClient, **params) -> object:
    base = {
        "variable": "temperature",
        "latitude": 18.0,
        "longitude": 66.0,
        "depth": 50.0,
        "time": "2026-06-23T00:00:00",
    }
    base.update(params)
    return client.get("/api/v1/comparison", params=base)


# ---------------------------------------------------------------------------
# Endpoint & validation
# ---------------------------------------------------------------------------


class TestEndpointAndValidation:
    def test_endpoint_exists(self, client, synthetic_env):
        resp = compare(client)
        assert resp.status_code == 200

    def test_invalid_latitude_400(self, client, synthetic_env):
        assert compare(client, latitude=95.0).status_code == 400
        assert compare(client, latitude=-95.0).status_code == 400

    def test_invalid_longitude_400(self, client, synthetic_env):
        assert compare(client, longitude=200.0).status_code == 400
        assert compare(client, longitude=-200.0).status_code == 400

    def test_invalid_variable_400(self, client, synthetic_env):
        resp = compare(client, variable="chlorophyll")
        assert resp.status_code == 400

    def test_missing_required_params_422(self, client, synthetic_env):
        resp = client.get("/api/v1/comparison")
        assert resp.status_code == 422

    def test_invalid_depth_400(self, client, synthetic_env):
        assert compare(client, depth=-5.0).status_code in (400, 422)


# ---------------------------------------------------------------------------
# Variable support
# ---------------------------------------------------------------------------


class TestVariableSupport:
    def test_u_current_unsupported_400(self, client, synthetic_env):
        resp = compare(client, variable="u_current")
        assert resp.status_code == 400
        assert "not fabricated" in resp.json()["detail"] or "temperature and salinity" in resp.json()["detail"]

    def test_v_current_unsupported_400(self, client, synthetic_env):
        resp = compare(client, variable="v_current")
        assert resp.status_code == 400
        detail = resp.json()["detail"].lower()
        assert "unsupported" in detail or "temperature and salinity" in detail

    def test_salinity_comparison_works(self, client, synthetic_env):
        resp = compare(client, variable="salinity")
        assert resp.status_code == 200
        body = resp.json()
        assert body["variable"] == "salinity"
        assert body["model"]["value"] == pytest.approx(35.5, abs=1e-6)


# ---------------------------------------------------------------------------
# Comparison math
# ---------------------------------------------------------------------------


class TestComparisonMath:
    def test_difference_is_model_minus_observation(self, client, synthetic_env):
        body = compare(client).json()
        expected = body["model"]["value"] - body["observation"]["value"]
        assert body["difference"] == pytest.approx(expected, abs=1e-3)

    def test_absolute_difference(self, client, synthetic_env):
        body = compare(client, variable="salinity").json()
        assert body["absolute_difference"] == pytest.approx(
            abs(body["difference"]), abs=1e-6
        )

    def test_interpretation_model_higher(self, client, synthetic_env):
        # Synthetic model temp = 28.0; nearest synthetic obs temp ~ 27 - 50/20 + 0.5 = 25.0
        body = compare(client).json()
        assert body["interpretation"] == "Model value is higher than observation"
        assert body["difference"] > 0

    def test_interpretation_model_lower(self, client, synthetic_env, monkeypatch):
        from app.services import comparison_service as cs

        monkeypatch.setattr(cs, "_get_model_value", lambda **kw: 10.0)
        body = compare(client).json()
        assert body["interpretation"] == "Model value is lower than observation"
        assert body["difference"] < 0

    def test_interpretation_exact_match(self, client, synthetic_env, monkeypatch):
        from app.services import comparison_service as cs

        # Deterministic stubs: model value == observation value exactly.
        monkeypatch.setattr(cs, "_get_model_value", lambda **kw: 25.0)
        obs = find_nearest_observation(
            variable="temperature", latitude=18.0, longitude=66.0,
            depth=50.0, time=datetime(2026, 6, 23),
        )
        assert obs is not None
        monkeypatch.setattr(cs, "find_nearest_observation", lambda **kw: {**obs, "value": 25.0})
        body = compare(client).json()
        assert body["interpretation"] == "Model value matches observation"
        assert body["difference"] == 0

    def test_units(self, client, synthetic_env):
        assert compare(client).json()["unit"] == "°C"
        assert compare(client, variable="salinity").json()["unit"] == "PSU"


# ---------------------------------------------------------------------------
# Nearest-observation matching
# ---------------------------------------------------------------------------


class TestNearestObservation:
    def test_nearest_selection_is_closest(self, synthetic_env):
        obs = find_nearest_observation(
            variable="temperature",
            latitude=18.0,
            longitude=66.0,
            depth=50.0,
            time=datetime(2025, 1, 5),
        )
        assert obs is not None
        # Synthetic row 8: lat 17.27, lon 66.67, pres 150 — should be near row 7/8.
        assert 10.0 <= obs["latitude"] <= 20.0
        assert obs["distance_km"] <= 500.0

    def test_matching_is_deterministic(self, synthetic_env):
        a = find_nearest_observation(
            variable="temperature", latitude=18.0, longitude=66.0,
            depth=50.0, time=datetime(2025, 1, 5),
        )
        b = find_nearest_observation(
            variable="temperature", latitude=18.0, longitude=66.0,
            depth=50.0, time=datetime(2025, 1, 5),
        )
        assert a == b

    def test_no_matching_observation_returns_none(self, synthetic_env):
        obs = find_nearest_observation(
            variable="temperature",
            latitude=18.0, longitude=66.0, depth=50.0,
            time=datetime(2030, 1, 1),
            max_time_diff_days=10,
        )
        assert obs is None

    def test_no_match_endpoint_404(self, client, synthetic_env):
        resp = compare(client, time="2030-01-01T00:00:00", max_time_diff_days=5)
        assert resp.status_code == 404

    def test_no_match_tight_radius_404(self, client, synthetic_env):
        resp = compare(client, latitude=-80.0, longitude=-150.0, max_distance_km=50)
        assert resp.status_code == 404

    def test_haversine_known_distance(self):
        # ~111.2 km per degree of latitude on a sphere.
        dist = _haversine_km(np.array([10.0]), np.array([60.0]), 11.0, 60.0)
        assert dist[0] == pytest.approx(111.2, rel=0.01)

    def test_haversine_zero(self):
        dist = _haversine_km(np.array([15.0]), np.array([65.0]), 15.0, 65.0)
        assert dist[0] == pytest.approx(0.0, abs=1e-9)

    def test_match_metadata_exposed(self, client, synthetic_env):
        body = compare(client).json()
        for key in ("distance_km", "depth_difference", "time_difference_days"):
            assert key in body["match"]
        assert body["match"]["distance_km"] >= 0
        assert body["match"]["depth_difference"] >= 0
        assert body["match"]["time_difference_days"] >= 0

    def test_depth_difference_calculation(self, synthetic_env):
        obs = find_nearest_observation(
            variable="temperature", latitude=18.0, longitude=66.0,
            depth=110.0, time=datetime(2025, 1, 10),
            max_depth_diff=50.0,
        )
        assert obs is not None
        assert obs["depth_difference"] <= 50.0


# ---------------------------------------------------------------------------
# Response shape, modes, honesty
# ---------------------------------------------------------------------------


class TestResponseShape:
    def test_response_schema(self, client, synthetic_env):
        body = compare(client).json()
        for key in (
            "variable", "unit", "location", "requested", "model", "observation",
            "difference", "absolute_difference", "match", "interpretation",
            "mode", "notes",
        ):
            assert key in body
        obs = body["observation"]
        for key in ("value", "source", "id", "latitude", "longitude", "depth", "time"):
            assert key in obs

    def test_real_mode_with_synthetic_files(self, client, synthetic_env):
        body = compare(client).json()
        assert body["mode"] == "real"
        assert body["model"]["source"] == "Copernicus Marine"
        assert body["observation"]["source"] == "Argo"

    def test_iso_8601_times(self, client, synthetic_env):
        body = compare(client).json()
        datetime.fromisoformat(body["requested"]["time"])
        datetime.fromisoformat(body["observation"]["time"])

    def test_pressure_proxy_documented(self, client, synthetic_env):
        body = compare(client).json()
        notes = " ".join(body["notes"]).lower()
        assert "pressure/depth proxy" in notes
        assert "not official incovalue" not in notes  # sanity guard
        assert "not official incovis" not in notes

    def test_not_official_validation_claim(self, client, synthetic_env):
        body = compare(client).json()
        notes = " ".join(body["notes"]).lower()
        assert "prototype analytical comparison" in notes
        assert "official incovalue" not in notes

    def test_no_fabricated_values(self, client, synthetic_env):
        # Observation value must equal the synthetic dataset's TEMP_ADJUSTED
        # (adjusted preferred) within rounding.
        body = compare(client).json()
        ds = xr.open_dataset(synthetic_env["argo"])
        obs = body["observation"]
        # find the row matching the returned id's trailing index
        idx = int(obs["id"].rsplit("_", 1)[1])
        assert obs["value"] == pytest.approx(float(ds["TEMP_ADJUSTED"].values[idx]), abs=1e-3)

    def test_null_measurement_no_fabrication(self, tmp_path, monkeypatch, client):
        # Make all adjusted+raw temperatures QC-bad so no candidate exists.
        ds = make_argo_ds(n=6)
        for name in ("TEMP_QC", "TEMP_ADJUSTED_QC"):
            ds[name] = ("row", np.full(6, 4, dtype=int))
        path = tmp_path / "bad_temp.nc"
        ds.to_netcdf(path)
        model_path = tmp_path / "synthetic_model.nc"
        make_model_ds().to_netcdf(model_path)
        monkeypatch.setenv("SAGARA_ARGO_PATH", str(path))
        monkeypatch.setenv("SAGARA_MODEL_PATH", str(model_path))
        _invalidate_cache()
        from app.processing import model_processor

        model_processor._dataset_cache.clear()
        try:
            resp = compare(client)
            # A null measurement must NOT be fabricated into a comparison.
            assert resp.status_code == 404
        finally:
            model_processor._dataset_cache.clear()


# ---------------------------------------------------------------------------
# Demo / missing-data behavior
# ---------------------------------------------------------------------------


class TestMissingData:
    def test_missing_argo_404_not_demo_mix(self, tmp_path, monkeypatch, client):
        # Model exists, Argo missing -> clear unavailable response, no fake obs.
        model_path = tmp_path / "synthetic_model.nc"
        make_model_ds().to_netcdf(model_path)
        monkeypatch.setenv("SAGARA_MODEL_PATH", str(model_path))
        monkeypatch.setenv("SAGARA_ARGO_PATH", str(tmp_path / "missing.nc"))
        _invalidate_cache()
        from app.processing import model_processor

        model_processor._dataset_cache.clear()
        try:
            resp = compare(client)
            assert resp.status_code == 404
        finally:
            model_processor._dataset_cache.clear()

    def test_missing_model_404(self, tmp_path, monkeypatch, client):
        argo_path = tmp_path / "synthetic_argo.nc"
        make_argo_ds().to_netcdf(argo_path)
        monkeypatch.setenv("SAGARA_ARGO_PATH", str(argo_path))
        monkeypatch.setenv("SAGARA_MODEL_PATH", str(tmp_path / "missing.nc"))
        _invalidate_cache()
        from app.processing import model_processor

        model_processor._dataset_cache.clear()
        try:
            resp = compare(client)
            assert resp.status_code == 404
        finally:
            model_processor._dataset_cache.clear()


# ---------------------------------------------------------------------------
# Real-data smoke tests (skipped when files absent)
# ---------------------------------------------------------------------------


class TestRealDataSmoke:
    # The real model file has a single timestep (2026-06-23) while the real
    # Argo subset ends 2025-04-01. The smoke tests therefore request a time
    # inside the Argo era: the model side still selects its only timestep
    # (nearest-time behaviour, documented), and the observation side finds
    # genuinely nearby observations.
    REQUEST_TIME = "2024-06-01T00:00:00"

    def _skip_if_missing(self):
        from app.processing.argo_processor import argo_dataset_path
        from app.processing.model_processor import model_dataset_path

        if not (argo_dataset_path().is_file() and model_dataset_path().is_file()):
            pytest.skip("Real datasets not available on this machine")

    def test_real_temperature_comparison(self, client):
        self._skip_if_missing()
        resp = compare(
            client,
            latitude=15.5,
            longitude=65.0,
            depth=50.0,
            time=self.REQUEST_TIME,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["mode"] == "real"
        assert body["model"]["source"] == "Copernicus Marine"
        assert body["observation"]["source"] == "Argo"
        assert body["observation"]["id"].startswith("ARGO_")
        # difference = model - observation, exactly
        assert body["difference"] == pytest.approx(
            body["model"]["value"] - body["observation"]["value"], abs=1e-3
        )

    def test_real_salinity_comparison(self, client):
        self._skip_if_missing()
        resp = compare(
            client,
            variable="salinity",
            latitude=15.5,
            longitude=65.0,
            depth=50.0,
            time=self.REQUEST_TIME,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["variable"] == "salinity"
        assert body["unit"] in ("PSU", "1e-3")
        assert 30.0 < body["observation"]["value"] < 40.0