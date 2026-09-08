"""Tests for the observations endpoint and the Argo processor.

Unit tests use synthetic xarray datasets; one smoke test uses the real
local Argo dataset when it exists (skipped otherwise).
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

import numpy as np
import pytest
import xarray as xr
from fastapi.testclient import TestClient

from app.processing.argo_processor import (
    argo_dataset_path,
    process_observations,
    _invalidate_cache,
)

# ---------------------------------------------------------------------------
# Synthetic dataset builder
# ---------------------------------------------------------------------------

def make_argo_ds(
    n: int = 10,
    temp_adj: bool = True,
    psal_adj: bool = True,
    pres_adj: bool = True,
) -> xr.Dataset:
    """Build a small synthetic Argo-style flat-table dataset."""
    rng = np.random.RandomState(42)
    lat = np.linspace(10.0, 20.0, n)
    lon = np.linspace(60.0, 70.0, n)
    pres = np.linspace(5.0, 495.0, n)
    time = np.array(
        [np.datetime64("2025-01-01T00:00:00") + np.timedelta64(int(d), "D") for d in range(n)]
    )
    platform = np.array([f"390000{i:02d}" for i in range(n)])
    cycle = np.arange(1, n + 1)

    temp = 27.0 - pres / 50.0 + rng.rand(n) * 0.1
    psal = 35.0 + pres / 500.0 + rng.rand(n) * 0.05

    data: dict = {
        "PLATFORM_NUMBER": ("row", platform),
        "CYCLE_NUMBER": ("row", cycle),
        "time": ("row", time),
        "latitude": ("row", lat),
        "longitude": ("row", lon),
        "PRES": ("row", pres),
        "TEMP": ("row", temp),
        "PSAL": ("row", psal),
    }
    ds = xr.Dataset.from_dict({k: {"dims": v[0], "data": v[1]} for k, v in data.items()})

    # QC flags: all good (1) except a few deliberate bad rows.
    temp_qc = np.ones(n, dtype=int)
    psal_qc = np.ones(n, dtype=int)
    pres_qc = np.ones(n, dtype=int)
    temp_qc[0] = 4  # bad temperature on row 0
    psal_qc[1] = 9  # missing salinity QC on row 1
    ds["TEMP_QC"] = ("row", temp_qc)
    ds["PSAL_QC"] = ("row", psal_qc)
    ds["PRES_QC"] = ("row", pres_qc)

    if temp_adj:
        ds["TEMP_ADJUSTED"] = ("row", temp + 0.5)  # marker: adjusted = raw + 0.5
        ds["TEMP_ADJUSTED_QC"] = ("row", temp_qc)
    if psal_adj:
        ds["PSAL_ADJUSTED"] = ("row", psal + 0.1)  # marker: adjusted = raw + 0.1
        ds["PSAL_ADJUSTED_QC"] = ("row", psal_qc)
    if pres_adj:
        ds["PRES_ADJUSTED"] = ("row", pres + 2.0)  # marker: adjusted = raw + 2.0
        ds["PRES_ADJUSTED_QC"] = ("row", pres_qc)

    return ds


@pytest.fixture()
def synthetic_file(tmp_path):
    """Write a synthetic Argo dataset and yield its path."""
    ds = make_argo_ds()
    path = tmp_path / "synthetic_argo.nc"
    ds.to_netcdf(path)
    yield path


@pytest.fixture(autouse=True)
def _clean_cache():
    """Ensure the processor cache is empty before and after each test."""
    _invalidate_cache()
    yield
    _invalidate_cache()


@pytest.fixture()
def client() -> TestClient:
    from app.main import app

    return TestClient(app)


# ---------------------------------------------------------------------------
# Endpoint existence / basic behaviour
# ---------------------------------------------------------------------------

class TestEndpointExists:
    def test_observations_endpoint_exists(self, client: TestClient, tmp_path):
        os.environ["SAGARA_ARGO_PATH"] = str(tmp_path / "missing.nc")
        try:
            resp = client.get("/api/v1/observations")
            assert resp.status_code == 200
            body = resp.json()
            assert body["mode"] == "demo"
        finally:
            os.environ.pop("SAGARA_ARGO_PATH", None)

    def test_health_still_works(self, client: TestClient):
        assert client.get("/health").status_code == 200


# ---------------------------------------------------------------------------
# Demo mode (dataset missing)
# ---------------------------------------------------------------------------

class TestDemoMode:
    def test_missing_dataset_returns_demo(self, tmp_path):
        data = process_observations(path=tmp_path / "nope.nc")
        assert data["mode"] == "demo"
        assert data["source"] == "demo"
        assert data["count"] == len(data["observations"]) > 0

    def test_demo_not_mixed_with_real(self, synthetic_file):
        real = process_observations(path=synthetic_file)
        demo = process_observations(path=tmp_path_missing())
        assert real["mode"] == "real" and demo["mode"] == "demo"
        assert real["source"] == "Argo" and demo["source"] == "demo"

    def test_missing_dataset_endpoint_demo(self, client: TestClient, tmp_path):
        os.environ["SAGARA_ARGO_PATH"] = str(tmp_path / "nope.nc")
        try:
            resp = client.get("/api/v1/observations")
            body = resp.json()
            assert resp.status_code == 200
            assert body["mode"] == "demo"
        finally:
            os.environ.pop("SAGARA_ARGO_PATH", None)


def tmp_path_missing():
    import pathlib

    return pathlib.Path("definitely/not/a/real/path.nc")


# ---------------------------------------------------------------------------
# Valid request / real mode
# ---------------------------------------------------------------------------

class TestRealMode:
    def test_valid_request_real_mode(self, synthetic_file):
        data = process_observations(path=synthetic_file)
        assert data["mode"] == "real"
        assert data["source"] == "Argo"
        assert data["count"] == 10
        obs = data["observations"][0]
        for key in ("id", "latitude", "longitude", "depth", "time", "temperature", "salinity"):
            assert key in obs

    def test_geographic_bounds(self, synthetic_file):
        data = process_observations(lat_min=10.0, lat_max=14.5, lon_min=60.0, lon_max=75.0, path=synthetic_file)
        assert 0 < data["count"] < 10
        for o in data["observations"]:
            assert 10.0 <= o["latitude"] <= 14.5

    def test_empty_valid_region_404(self, synthetic_file):
        from app.processing.argo_processor import NoMatchingDataError

        with pytest.raises(NoMatchingDataError):
            process_observations(lat_min=-80.0, lat_max=-70.0, path=synthetic_file)

    def test_endpoint_404_for_empty_region(self, client: TestClient, synthetic_file):
        os.environ["SAGARA_ARGO_PATH"] = str(synthetic_file)
        try:
            resp = client.get(
                "/api/v1/observations",
                params={"lat_min": -80.0, "lat_max": -70.0},
            )
            assert resp.status_code == 404
        finally:
            os.environ.pop("SAGARA_ARGO_PATH", None)


# ---------------------------------------------------------------------------
# Validation errors (400)
# ---------------------------------------------------------------------------

class TestValidation:
    @pytest.mark.parametrize("params", [
        {"latitude": 95.0},
        {"latitude": -95.0},
        {"longitude": 200.0},
        {"longitude": -200.0},
        {"lat_min": 91.0},
        {"lat_min": 20.0, "lat_max": 10.0},
        {"lon_min": 80.0, "lon_max": 60.0},
        {"radius_km": 100.0},  # radius without center
        {"latitude": 15.0, "radius_km": 100.0},  # radius needs lon too
    ])
    def test_invalid_params_400(self, client: TestClient, synthetic_file, params):
        os.environ["SAGARA_ARGO_PATH"] = str(synthetic_file)
        try:
            resp = client.get("/api/v1/observations", params=params)
            assert resp.status_code == 400
        finally:
            os.environ.pop("SAGARA_ARGO_PATH", None)

    def test_unsupported_source_400(self, client: TestClient, synthetic_file):
        os.environ["SAGARA_ARGO_PATH"] = str(synthetic_file)
        try:
            assert client.get("/api/v1/observations", params={"source": "bogus"}).status_code == 400
        finally:
            os.environ.pop("SAGARA_ARGO_PATH", None)

    def test_glider_source_400(self, client: TestClient, synthetic_file):
        os.environ["SAGARA_ARGO_PATH"] = str(synthetic_file)
        try:
            resp = client.get("/api/v1/observations", params={"source": "glider"})
            assert resp.status_code == 400
        finally:
            os.environ.pop("SAGARA_ARGO_PATH", None)


# ---------------------------------------------------------------------------
# Depth / time / radius filtering
# ---------------------------------------------------------------------------

class TestFilters:
    def test_depth_filtering(self, synthetic_file):
        # Synthetic pres ranges 5..495 dbar; take ~200 dbar with big window.
        near = process_observations(depth=250.0, depth_tolerance=30.0, path=synthetic_file)
        assert near["count"] >= 1
        for o in near["observations"]:
            assert abs(o["depth"] - 250.0) <= 30.0

    def test_depth_filter_no_match(self, synthetic_file):
        from app.processing.argo_processor import NoMatchingDataError

        with pytest.raises(NoMatchingDataError):
            process_observations(depth=10000.0, depth_tolerance=1.0, path=synthetic_file)

    def test_time_filtering(self, synthetic_file):
        data = process_observations(
            time=datetime(2025, 1, 3), time_tolerance_days=1.0, path=synthetic_file
        )
        assert data["count"] >= 1
        for o in data["observations"]:
            t = datetime.fromisoformat(o["time"])
            assert abs((t - datetime(2025, 1, 3)).days) <= 1

    def test_time_filter_no_match_is_404(self, synthetic_file):
        from app.processing.argo_processor import NoMatchingDataError

        with pytest.raises(NoMatchingDataError):
            process_observations(
                time=datetime(2030, 1, 1), time_tolerance_days=1.0, path=synthetic_file
            )

    def test_radius_filtering(self, synthetic_file):
        # Target the 4th synthetic row (~ lat 13.3, lon 63.3).
        target_lat = 10.0 + (20.0 - 10.0) * 3 / 9
        target_lon = 60.0 + (70.0 - 60.0) * 3 / 9
        small = process_observations(
            lat_min=target_lat, lat_max=target_lat,
            lon_min=target_lon, lon_max=target_lon,
            radius_km=120.0, path=synthetic_file,
        )
        assert small["count"] >= 1
        big = process_observations(
            lat_min=target_lat, lat_max=target_lat,
            lon_min=target_lon, lon_max=target_lon,
            radius_km=1500.0, path=synthetic_file,
        )
        assert big["count"] >= small["count"]

    def test_radius_endpoint(self, client: TestClient, synthetic_file):
        os.environ["SAGARA_ARGO_PATH"] = str(synthetic_file)
        try:
            resp = client.get(
                "/api/v1/observations",
                params={"latitude": 15.0, "longitude": 65.0, "radius_km": 800},
            )
            assert resp.status_code == 200
            body = resp.json()
            assert body["mode"] == "real"
            assert body["count"] >= 1
        finally:
            os.environ.pop("SAGARA_ARGO_PATH", None)


# ---------------------------------------------------------------------------
# Adjusted-variable preference & fallback
# ---------------------------------------------------------------------------

class TestAdjustedPreference:
    def test_adjusted_temperature_preferred(self, synthetic_file):
        data = process_observations(path=synthetic_file)
        # Adjusted = raw + 0.5 on the synthetic data; raw row-0 temp is
        # QC-rejected anyway, so check any other row.
        obs = {o["id"]: o for o in data["observations"]}
        some = next(o for o in obs.values() if o["temperature"] is not None)
        # Verify preference directly via dataset values:
        ds = xr.open_dataset(synthetic_file)
        idx = int(some["id"].rsplit("_", 1)[1])
        assert some["temperature"] == pytest.approx(
            float(ds["TEMP_ADJUSTED"].values[idx]), abs=1e-3
        )

    def test_adjusted_salinity_preferred(self, synthetic_file):
        data = process_observations(path=synthetic_file)
        ds = xr.open_dataset(synthetic_file)
        obs = next(o for o in data["observations"] if o["salinity"] is not None)
        idx = int(obs["id"].rsplit("_", 1)[1])
        assert obs["salinity"] == pytest.approx(
            float(ds["PSAL_ADJUSTED"].values[idx]), abs=1e-3
        )

    def test_adjusted_pressure_preferred(self, synthetic_file):
        data = process_observations(path=synthetic_file)
        ds = xr.open_dataset(synthetic_file)
        obs = data["observations"][1]
        idx = int(obs["id"].rsplit("_", 1)[1])
        assert obs["depth"] == pytest.approx(
            float(ds["PRES_ADJUSTED"].values[idx]), abs=1e-2
        )

    def test_fallback_to_raw_when_no_adjusted(self, tmp_path):
        ds = make_argo_ds(temp_adj=False, psal_adj=False, pres_adj=False)
        path = tmp_path / "raw_only.nc"
        ds.to_netcdf(path)
        data = process_observations(path=path)
        ds2 = xr.open_dataset(path)
        obs = next(o for o in data["observations"] if o["temperature"] is not None)
        idx = int(obs["id"].rsplit("_", 1)[1])
        assert obs["temperature"] == pytest.approx(float(ds2["TEMP"].values[idx]), abs=1e-3)

    def test_fallback_when_adjusted_is_nan(self, tmp_path):
        ds = make_argo_ds()
        # Make adjusted temp NaN on row 2; raw stays valid.
        adj = ds["TEMP_ADJUSTED"].values.copy()
        adj[2] = np.nan
        ds["TEMP_ADJUSTED"] = ("row", adj)
        path = tmp_path / "nan_adj.nc"
        ds.to_netcdf(path)
        data = process_observations(path=path)
        ds2 = xr.open_dataset(path)
        obs = next(o for o in data["observations"] if int(o["id"].rsplit("_", 1)[1]) == 2)
        assert obs["temperature"] == pytest.approx(float(ds2["TEMP"].values[2]), abs=1e-3)


# ---------------------------------------------------------------------------
# Missing values / QC
# ---------------------------------------------------------------------------

class TestMissingAndQC:
    def test_qc_bad_temperature_becomes_null(self, synthetic_file):
        # Row 0 TEMP_QC = 4 -> temperature must be null, not fabricated.
        data = process_observations(lat_min=9.0, lat_max=11.0, path=synthetic_file)
        row0 = next(o for o in data["observations"] if int(o["id"].rsplit("_", 1)[1]) == 0)
        assert row0["temperature"] is None

    def test_qc_bad_salinity_becomes_null(self, synthetic_file):
        # Row 1 PSAL_QC = 9 -> salinity null (no PSAL_ADJUSTED fallback since adj QC also 9).
        data = process_observations(lat_min=10.0, lat_max=12.0, path=synthetic_file)
        row1 = next(o for o in data["observations"] if int(o["id"].rsplit("_", 1)[1]) == 1)
        assert row1["salinity"] is None

    def test_invalid_coordinates_not_returned(self, tmp_path):
        ds = make_argo_ds(n=6)
        lat = ds["latitude"].values.copy()
        lat[3] = np.nan
        lon = ds["longitude"].values.copy()
        lon[4] = np.nan
        ds["latitude"] = ("row", lat)
        ds["longitude"] = ("row", lon)
        path = tmp_path / "bad_coords.nc"
        ds.to_netcdf(path)
        data = process_observations(path=path)
        returned_idx = {int(o["id"].rsplit("_", 1)[1]) for o in data["observations"]}
        assert 3 not in returned_idx
        assert 4 not in returned_idx


# ---------------------------------------------------------------------------
# IDs, limits, determinism, formats
# ---------------------------------------------------------------------------

class TestDeterminismAndLimits:
    def test_deterministic_ids(self, synthetic_file):
        a = process_observations(path=synthetic_file)
        b = process_observations(path=synthetic_file)
        assert [o["id"] for o in a["observations"]] == [o["id"] for o in b["observations"]]
        assert all(o["id"].startswith("ARGO_") for o in a["observations"])

    def test_max_observations_downsampling(self, tmp_path):
        ds = make_argo_ds(n=300)
        path = tmp_path / "large.nc"
        ds.to_netcdf(path)
        data = process_observations(max_observations=50, path=path)
        assert data["count"] <= 50

    def test_downsampling_deterministic(self, tmp_path):
        ds = make_argo_ds(n=300)
        path = tmp_path / "large2.nc"
        ds.to_netcdf(path)
        a = process_observations(max_observations=50, path=path)
        b = process_observations(max_observations=50, path=path)
        assert [o["id"] for o in a["observations"]] == [o["id"] for o in b["observations"]]

    def test_absolute_cap_5000(self, tmp_path):
        from app.processing.argo_processor import MAX_MAX_OBS

        assert MAX_MAX_OBS == 5000

    def test_iso_timestamp_output(self, synthetic_file):
        data = process_observations(path=synthetic_file)
        for o in data["observations"]:
            # fromisoformat raises if not ISO-8601.
            datetime.fromisoformat(o["time"])

    def test_source_metadata_fields(self, synthetic_file):
        data = process_observations(path=synthetic_file)
        assert data["source"] == "Argo"
        assert data["mode"] == "real"
        assert "dbar" in data["depth_units"]
        assert data["notes"]  # QC/pressure documentation present


# ---------------------------------------------------------------------------
# Real-data smoke test (skipped when the file is absent)
# ---------------------------------------------------------------------------

class TestRealDataset:
    @pytest.fixture()
    def real_path(self):
        p = argo_dataset_path()
        if not p.is_file():
            pytest.skip("Real Argo dataset not available on this machine")
        return p

    def test_real_dataset_smoke(self, real_path):
        data = process_observations(
            lat_min=10.0, lat_max=20.0, lon_min=60.0, lon_max=70.0,
            max_observations=100, path=real_path,
        )
        assert data["mode"] == "real"
        assert data["source"] == "Argo"
        assert 0 < data["count"] <= 100
        for o in data["observations"]:
            assert 10.0 <= o["latitude"] <= 20.0
            assert 60.0 <= o["longitude"] <= 70.0
            assert -90.0 <= o["latitude"] <= 90.0
            datetime.fromisoformat(o["time"])

    def test_real_dataset_endpoint(self, client: TestClient):
        if not argo_dataset_path().is_file():
            pytest.skip("Real Argo dataset not available on this machine")
        resp = client.get(
            "/api/v1/observations",
            params={"lat_min": 10.0, "lat_max": 20.0, "lon_min": 60.0, "lon_max": 70.0,
                    "max_observations": 100},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["mode"] == "real"
        assert body["count"] >= 1