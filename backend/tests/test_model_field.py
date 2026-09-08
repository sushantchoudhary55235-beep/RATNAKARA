"""Tests for the ocean model field endpoint.

Uses synthetic xarray datasets where possible; one smoke test uses the
real local CMEMS model dataset when it exists (skipped otherwise).
"""

from __future__ import annotations

import os
from datetime import datetime

import numpy as np
import pytest
import xarray as xr
from fastapi.testclient import TestClient

from app.processing.model_processor import (
    DatasetUnavailableError,
    EmptyRegionError,
    InvalidBoundsError,
    InvalidDepthError,
    NoValidDataError,
    UnsupportedVariableError,
    _dataset_cache,
    get_variable_map,
    process_model_field,
)

# ---------------------------------------------------------------------------
# Synthetic model dataset builder
# ---------------------------------------------------------------------------


def make_model_ds() -> xr.Dataset:
    """Synthetic CMEMS-like model dataset: 1 time, 2 depths, 4x4 grid."""
    lat = np.array([10.0, 15.0, 20.0, 25.0])
    lon = np.array([60.0, 65.0, 70.0, 75.0])
    depth = np.array([5.0, 100.0])
    time = np.array([np.datetime64("2026-06-23T00:00:00")])

    temp = np.full((1, 2, 4, 4), 27.5)
    temp[0, 0, 0, 0] = np.nan  # one land cell
    sal = np.full((1, 2, 4, 4), 35.2)
    u_curr = np.full((1, 2, 4, 4), 0.1)
    v_curr = np.full((1, 2, 4, 4), -0.05)

    ds = xr.Dataset(
        {
            "thetao": (("time", "depth", "latitude", "longitude"), temp),
            "so": (("time", "depth", "latitude", "longitude"), sal),
            "uo": (("time", "depth", "latitude", "longitude"), u_curr),
            "vo": (("time", "depth", "latitude", "longitude"), v_curr),
        },
        coords={"time": time, "depth": depth, "latitude": lat, "longitude": lon},
    )
    # Set variable-level attributes (units) as the real model processor expects.
    ds["thetao"].attrs["units"] = "degrees_C"
    ds["so"].attrs["units"] = "1e-3"
    ds["uo"].attrs["units"] = "m s-1"
    ds["vo"].attrs["units"] = "m s-1"
    return ds


@pytest.fixture(autouse=True)
def _clean_cache():
    """Ensure the model processor dataset cache is empty before/after each test."""
    _dataset_cache.clear()
    yield
    _dataset_cache.clear()


@pytest.fixture()
def synthetic_env(tmp_path, monkeypatch):
    """Write a synthetic model dataset and point the env var at it."""
    path = tmp_path / "synthetic_model.nc"
    make_model_ds().to_netcdf(path)
    monkeypatch.setenv("SAGARA_MODEL_PATH", str(path))
    yield path


@pytest.fixture()
def client() -> TestClient:
    from app.main import app

    return TestClient(app)


def get_field(client: TestClient, **params) -> object:
    """Convenience wrapper for GET /api/v1/model-field."""
    base = {
        "variable": "temperature",
        "depth": 5.0,
        "time": "2026-06-23T00:00:00",
    }
    base.update(params)
    return client.get("/api/v1/model-field", params=base)


# ---------------------------------------------------------------------------
# Endpoint existence & basic behaviour
# ---------------------------------------------------------------------------


class TestEndpointExists:
    def test_model_field_endpoint_exists(self, client, synthetic_env):
        resp = get_field(client)
        assert resp.status_code == 200

    def test_health_still_works(self, client):
        assert client.get("/health").status_code == 200

    def test_missing_required_params_422(self, client, synthetic_env):
        resp = client.get("/api/v1/model-field")
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Variable validation
# ---------------------------------------------------------------------------


class TestVariableValidation:
    def test_temperature_works(self, client, synthetic_env):
        body = get_field(client, variable="temperature").json()
        assert body["variable"] == "temperature"
        assert body["unit"] == "°C"
        assert len(body["points"]) > 0

    def test_salinity_works(self, client, synthetic_env):
        body = get_field(client, variable="salinity").json()
        assert body["variable"] == "salinity"
        assert body["unit"] == "PSU"

    def test_u_current_works(self, client, synthetic_env):
        body = get_field(client, variable="u_current").json()
        assert body["variable"] == "u_current"
        assert body["unit"] == "m/s"

    def test_v_current_works(self, client, synthetic_env):
        body = get_field(client, variable="v_current").json()
        assert body["variable"] == "v_current"
        assert body["unit"] == "m/s"

    def test_invalid_variable_400(self, client, synthetic_env):
        resp = get_field(client, variable="chlorophyll")
        assert resp.status_code == 400
        assert "Unsupported variable" in resp.json()["detail"]

    def test_empty_variable_400(self, client, synthetic_env):
        resp = get_field(client, variable="")
        assert resp.status_code == 400

    def test_variable_list_matches_metadata(self, client, synthetic_env):
        """Variable names should match what /metadata reports."""
        meta = client.get("/api/v1/metadata").json()
        meta_vars = set(meta["datasets"]["model"]["variables"].keys())
        api_vars = set(get_variable_map().keys())
        assert api_vars == meta_vars


# ---------------------------------------------------------------------------
# Depth validation
# ---------------------------------------------------------------------------


class TestDepthValidation:
    def test_negative_depth_400(self, client, synthetic_env):
        resp = get_field(client, depth=-5.0)
        assert resp.status_code == 400

    def test_zero_depth_works(self, client, synthetic_env):
        body = get_field(client, depth=0.0).json()
        assert len(body["points"]) > 0

    def test_depth_is_nearest_level(self, client, synthetic_env):
        """Depth should select the nearest available level."""
        body = get_field(client, depth=10.0).json()
        # Synthetic has depths 5.0 and 100.0; nearest to 10 is 5.0
        assert body["depth"] == 5.0

    def test_deep_depth_selects_correct_level(self, client, synthetic_env):
        body = get_field(client, depth=80.0).json()
        # Nearest to 80 is 100.0
        assert body["depth"] == 100.0


# ---------------------------------------------------------------------------
# Geographic bounds validation
# ---------------------------------------------------------------------------


class TestBoundsValidation:
    def test_valid_bounds(self, client, synthetic_env):
        body = get_field(client, lat_min=10.0, lat_max=20.0, lon_min=60.0, lon_max=70.0).json()
        assert len(body["points"]) > 0

    def test_lat_min_greater_than_max_400(self, client, synthetic_env):
        resp = get_field(client, lat_min=20.0, lat_max=10.0)
        assert resp.status_code == 400

    def test_lon_min_greater_than_max_400(self, client, synthetic_env):
        resp = get_field(client, lon_min=70.0, lon_max=60.0)
        assert resp.status_code == 400

    def test_out_of_range_lat_400(self, client, synthetic_env):
        resp = get_field(client, lat_min=-95.0, lat_max=-90.0)
        assert resp.status_code == 400

    def test_out_of_range_lon_400(self, client, synthetic_env):
        resp = get_field(client, lon_min=200.0, lon_max=210.0)
        assert resp.status_code == 400

    def test_empty_region_404(self, client, synthetic_env):
        """Requesting a region with no grid points returns 404."""
        resp = get_field(client, lat_min=-80.0, lat_max=-70.0, lon_min=-170.0, lon_max=-160.0)
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# NaN / land cell handling
# ---------------------------------------------------------------------------


class TestNaNHandling:
    def test_nan_cells_excluded(self, client, synthetic_env):
        """NaN (land) cells should not appear in the response."""
        body = get_field(client).json()
        for p in body["points"]:
            assert not np.isnan(p["value"])
            assert p["latitude"] != 10.0 or p["longitude"] != 60.0  # our NaN cell

    def test_all_nan_region_404(self, client, synthetic_env):
        """A region where all cells are NaN should return 404."""
        # Use a region surrounding the NaN cell (10.0, 60.0) but narrow enough
        # that only that cell is selected. lat_min < lat_max is required.
        resp = get_field(client, lat_min=10.0, lat_max=10.0001, lon_min=60.0, lon_max=60.0001)
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# max_points / downsampling
# ---------------------------------------------------------------------------


class TestDownsampling:
    def test_max_points_limits_output(self, client, synthetic_env):
        # max_points=100 is the minimum accepted (MIN_MAX_POINTS=100)
        # The synthetic grid is 4x4=16 points; with max_points=100, all valid are returned
        body = get_field(client, max_points=100).json()
        assert len(body["points"]) >= 1
        # No downsampling needed for a 16-point grid vs 100 limit
        assert len(body["points"]) <= 16

    def test_max_points_clamped_to_minimum(self, client, synthetic_env):
        # max_points < MIN_MAX_POINTS (100) is rejected by FastAPI validation
        resp = get_field(client, max_points=1)
        assert resp.status_code == 422

    def test_max_points_clamped_to_maximum(self, client, synthetic_env):
        # max_points > MAX_MAX_POINTS (10000) is rejected by FastAPI validation
        resp = get_field(client, max_points=50000)
        assert resp.status_code == 422

    def test_deterministic_output(self, client, synthetic_env):
        a = get_field(client).json()
        b = get_field(client).json()
        assert a == b


# ---------------------------------------------------------------------------
# Response schema
# ---------------------------------------------------------------------------


class TestResponseSchema:
    def test_response_has_required_fields(self, client, synthetic_env):
        body = get_field(client).json()
        for key in ("variable", "unit", "depth", "time", "source", "points"):
            assert key in body

    def test_point_schema(self, client, synthetic_env):
        body = get_field(client).json()
        for p in body["points"]:
            for key in ("latitude", "longitude", "value"):
                assert key in p

    def test_source_is_correct(self, client, synthetic_env):
        body = get_field(client).json()
        assert body["source"] == "Copernicus Marine"

    def test_time_is_iso_string(self, client, synthetic_env):
        body = get_field(client).json()
        datetime.fromisoformat(body["time"])


# ---------------------------------------------------------------------------
# Unit handling
# ---------------------------------------------------------------------------


class TestUnitHandling:
    def test_temperature_unit(self, client, synthetic_env):
        assert get_field(client, variable="temperature").json()["unit"] == "°C"

    def test_salinity_unit(self, client, synthetic_env):
        assert get_field(client, variable="salinity").json()["unit"] == "PSU"

    def test_current_unit(self, client, synthetic_env):
        assert get_field(client, variable="u_current").json()["unit"] == "m/s"


# ---------------------------------------------------------------------------
# Missing dataset
# ---------------------------------------------------------------------------


class TestMissingDataset:
    def test_missing_model_file_404(self, tmp_path, monkeypatch, client):
        monkeypatch.setenv("SAGARA_MODEL_PATH", str(tmp_path / "nonexistent.nc"))
        resp = get_field(client)
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Model processor unit tests (direct function calls)
# ---------------------------------------------------------------------------


class TestProcessorUnit:
    def test_process_model_field_returns_dict(self, synthetic_env):
        result = process_model_field(
            variable="temperature",
            depth=5.0,
            time=datetime(2026, 6, 23),
            path=synthetic_env,
        )
        assert "points" in result
        assert "variable" in result
        assert result["variable"] == "temperature"

    def test_process_unsupported_variable(self, synthetic_env):
        with pytest.raises(UnsupportedVariableError):
            process_model_field(
                variable="chlorophyll",
                depth=5.0,
                time=datetime(2026, 6, 23),
                path=synthetic_env,
            )

    def test_process_invalid_depth(self, synthetic_env):
        with pytest.raises(InvalidDepthError):
            process_model_field(
                variable="temperature",
                depth=-10.0,
                time=datetime(2026, 6, 23),
                path=synthetic_env,
            )

    def test_process_empty_region(self, synthetic_env):
        with pytest.raises(EmptyRegionError):
            process_model_field(
                variable="temperature",
                depth=5.0,
                time=datetime(2026, 6, 23),
                lat_min=-80.0,
                lat_max=-70.0,
                lon_min=-170.0,
                lon_max=-160.0,
                path=synthetic_env,
            )

    def test_process_missing_variable_in_dataset(self, tmp_path, monkeypatch):
        """Dataset exists but does not contain the requested variable."""
        # Create a minimal dataset with only thetao
        ds = xr.Dataset(
            {"thetao": (("time", "depth", "latitude", "longitude"), np.ones((1, 1, 2, 2)))},
            coords={
                "time": [np.datetime64("2026-06-23T00:00:00")],
                "depth": [5.0],
                "latitude": [10.0, 15.0],
                "longitude": [60.0, 65.0],
            },
        )
        path = tmp_path / "minimal.nc"
        ds.to_netcdf(path)
        with pytest.raises(DatasetUnavailableError):
            process_model_field(
                variable="salinity",  # so not in this dataset
                depth=5.0,
                time=datetime(2026, 6, 23),
                path=path,
            )

    def test_dataset_caching(self, synthetic_env):
        """Dataset should be cached after first load."""
        ds1 = process_model_field.__module__  # just trigger the module
        from app.processing.model_processor import load_dataset

        d1 = load_dataset(synthetic_env)
        d2 = load_dataset(synthetic_env)
        assert d1 is d2  # same object = cached


# ---------------------------------------------------------------------------
# Real-data smoke tests (skipped when file absent)
# ---------------------------------------------------------------------------


class TestRealDataSmoke:
    def _skip_if_missing(self):
        from app.processing.model_processor import model_dataset_path

        if not model_dataset_path().is_file():
            pytest.skip("Real model dataset not available on this machine")

    def test_real_dataset_temperature(self, client):
        self._skip_if_missing()
        resp = get_field(
            client,
            variable="temperature",
            depth=5.0,
            time="2026-06-23T00:00:00",
            lat_min=10.0,
            lat_max=20.0,
            lon_min=60.0,
            lon_max=70.0,
            max_points=100,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["variable"] == "temperature"
        assert body["unit"] == "°C"
        assert 0 < len(body["points"]) <= 100
        for p in body["points"]:
            assert 10.0 <= p["latitude"] <= 20.0
            assert 60.0 <= p["longitude"] <= 70.0
            assert not np.isnan(p["value"])

    def test_real_dataset_salinity(self, client):
        self._skip_if_missing()
        resp = get_field(client, variable="salinity", depth=50.0, time="2026-06-23T00:00:00")
        assert resp.status_code == 200
        body = resp.json()
        assert body["variable"] == "salinity"

    def test_real_dataset_currents(self, client):
        self._skip_if_missing()
        resp = get_field(client, variable="u_current", depth=5.0, time="2026-06-23T00:00:00")
        assert resp.status_code == 200

    def test_real_dataset_endpoint(self, client):
        self._skip_if_missing()
        resp = client.get(
            "/api/v1/model-field",
            params={
                "variable": "temperature",
                "depth": 5.0,
                "time": "2026-06-23T00:00:00",
                "lat_min": 15.0,
                "lat_max": 20.0,
                "lon_min": 65.0,
                "lon_max": 70.0,
                "max_points": 100,
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["source"] == "Copernicus Marine"
