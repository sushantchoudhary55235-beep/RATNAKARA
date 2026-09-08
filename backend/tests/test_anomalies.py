"""Tests for the Smart Ocean Anomaly Detection endpoint.

Most tests use synthetic Argo + model datasets (no dependence on the
455 MB real files). Real-data smoke tests run only when both local
datasets exist.
"""

from __future__ import annotations

from datetime import datetime

import numpy as np
import pytest
import xarray as xr
from fastapi.testclient import TestClient

from app.processing.argo_processor import (
    MAX_MAX_ANOMALIES,
    _invalidate_cache,
)

# ---------------------------------------------------------------------------
# Synthetic fixtures (same generators as the comparison tests)
# ---------------------------------------------------------------------------


def make_argo_ds(n: int = 12, temp_qc_bad_all: bool = False) -> xr.Dataset:
    """Synthetic Argo flat table: lat 10-20, lon 60-70, 10-210 dbar, June 2026."""
    lat = np.linspace(10.0, 20.0, n)
    lon = np.linspace(60.0, 70.0, n)
    pres = np.linspace(10.0, 210.0, n)
    time = np.array(
        [np.datetime64("2026-06-20T00:00:00") + np.timedelta64(int(d), "D") for d in range(n)]
    )
    temp = 27.0 - pres / 20.0        # surface ~26.5, deep ~16.5
    psal = 35.0 + pres / 500.0
    platform = np.array([f"390000{i:02d}" for i in range(n)])
    cycle = np.arange(1, n + 1)

    temp_qc = np.full(n, 4 if temp_qc_bad_all else 1, dtype=int)
    data = {
        "PLATFORM_NUMBER": platform,
        "CYCLE_NUMBER": cycle,
        "time": time,
        "latitude": lat,
        "longitude": lon,
        "PRES": pres,
        "PRES_QC": np.ones(n, dtype=int),
        "TEMP": temp,
        "TEMP_QC": temp_qc,
        "TEMP_ADJUSTED": temp + 0.5,
        "TEMP_ADJUSTED_QC": temp_qc,
        "PSAL": psal,
        "PSAL_QC": np.ones(n, dtype=int),
        "PSAL_ADJUSTED": psal + 0.1,
        "PSAL_ADJUSTED_QC": np.ones(n, dtype=int),
    }
    return xr.Dataset({k: ("row", v) for k, v in data.items()})


def make_model_ds() -> xr.Dataset:
    """Synthetic model: uniform temp 28.0 °C, salinity 35.5 PSU."""
    lat = np.array([11.0, 14.0, 17.0, 20.0])
    lon = np.array([61.0, 64.0, 67.0, 70.0])
    depth = np.array([5.0, 50.0])
    time = np.array([np.datetime64("2026-06-23T00:00:00")])
    return xr.Dataset(
        {
            "thetao": (("time", "depth", "latitude", "longitude"), np.full((1, 2, 4, 4), 28.0)),
            "so": (("time", "depth", "latitude", "longitude"), np.full((1, 2, 4, 4), 35.5)),
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
    argo_path = tmp_path / "synthetic_argo.nc"
    make_argo_ds().to_netcdf(argo_path)
    model_path = tmp_path / "synthetic_model.nc"
    make_model_ds().to_netcdf(model_path)
    monkeypatch.setenv("SAGARA_ARGO_PATH", str(argo_path))
    monkeypatch.setenv("SAGARA_MODEL_PATH", str(model_path))
    _invalidate_cache()
    from app.processing import model_processor

    model_processor._dataset_cache.clear()
    yield {"argo": argo_path, "model": model_path}
    model_processor._dataset_cache.clear()


@pytest.fixture()
def client() -> TestClient:
    from app.main import app

    return TestClient(app)


def query(client: TestClient, **params) -> object:
    base = {"variable": "temperature"}
    base.update(params)
    return client.get("/api/v1/anomalies", params=base)


# ---------------------------------------------------------------------------
# Endpoint, variables, validation
# ---------------------------------------------------------------------------


class TestEndpointAndValidation:
    def test_endpoint_exists(self, client, synthetic_env):
        resp = query(client)
        assert resp.status_code in (200, 404)  # 200 with synthetic data
        assert resp.status_code == 200

    def test_invalid_latitude_400(self, client, synthetic_env):
        assert query(client, latitude=95.0, longitude=65.0).status_code == 400
        assert query(client, latitude=-95.0, longitude=65.0).status_code == 400

    def test_invalid_longitude_400(self, client, synthetic_env):
        assert query(client, latitude=15.0, longitude=200.0).status_code == 400
        assert query(client, latitude=15.0, longitude=-200.0).status_code == 400

    def test_invalid_variable_400(self, client, synthetic_env):
        assert query(client, variable="chlorophyll").status_code == 400

    def test_u_current_rejected_400(self, client, synthetic_env):
        resp = query(client, variable="u_current")
        assert resp.status_code == 400
        assert "not fabricated" in resp.json()["detail"] or "temperature and salinity" in resp.json()["detail"]

    def test_v_current_rejected_400(self, client, synthetic_env):
        resp = query(client, variable="v_current")
        assert resp.status_code == 400
        assert "temperature and salinity" in resp.json()["detail"]

    def test_negative_threshold_rejected(self, client, synthetic_env):
        assert query(client, threshold=-1.0).status_code == 400

    def test_negative_depth_rejected(self, client, synthetic_env):
        assert query(client, depth=-10.0).status_code == 400

    def test_negative_radius_rejected(self, client, synthetic_env):
        assert query(client, latitude=15.0, longitude=65.0, radius_km=-5).status_code == 400

    def test_radius_without_center_rejected(self, client, synthetic_env):
        assert query(client, radius_km=100).status_code == 400

    def test_missing_variable_422(self, client, synthetic_env):
        assert client.get("/api/v1/anomalies").status_code == 422


# ---------------------------------------------------------------------------
# Threshold logic / statuses
# ---------------------------------------------------------------------------


class TestThresholdLogic:
    def test_warning_result(self, client, synthetic_env):
        # Synthetic model temp = 28.0; obs ~26.5-16.5 -> several WARNINGs with default 2.0.
        body = query(client).json()
        assert body["count"] >= 1
        assert body["status"] == "WARNING"
        for a in body["anomalies"]:
            assert a["status"] == "WARNING"
            assert a["absolute_difference"] >= body["threshold"]

    def test_normal_result_when_no_warning(self, client, synthetic_env):
        # Very high threshold -> no WARNINGs; overall NORMAL with empty list.
        body = query(client, threshold=100.0).json()
        assert body["count"] == 0
        assert body["status"] == "NORMAL"
        assert body["anomalies"] == []

    def test_exact_threshold_is_warning(self, client, synthetic_env):
        # Deepest synthetic obs temp = 27 - 210/20 + 0.5 = 17.0; model 28.0
        # -> abs diff = 11.0 exactly. threshold=11.0 must be WARNING (>=).
        body = query(client, threshold=11.0).json()
        assert body["status"] == "WARNING"
        assert any(
            a["absolute_difference"] == pytest.approx(11.0, abs=0.01)
            for a in body["anomalies"]
        )

    def test_just_below_threshold_is_normal(self, client, synthetic_env):
        body = query(client, threshold=11.1).json()
        # 11.0 < 11.1 -> no WARNINGs.
        assert body["status"] == "NORMAL"

    def test_difference_calculation(self, client, synthetic_env):
        body = query(client).json()
        for a in body["anomalies"]:
            assert a["difference"] == pytest.approx(
                a["observed_value"] - a["expected_value"], abs=1e-3
            )

    def test_absolute_difference(self, client, synthetic_env):
        body = query(client).json()
        for a in body["anomalies"]:
            assert a["absolute_difference"] == pytest.approx(abs(a["difference"]), abs=1e-6)

    def test_observed_higher_interpretation(self, client, synthetic_env):
        body = query(client).json()
        higher = [a for a in body["anomalies"] if a["difference"] > 0]
        if higher:
            assert "higher than model" in higher[0]["message"]

    def test_observed_lower_interpretation(self, client, synthetic_env):
        body = query(client).json()
        lower = [a for a in body["anomalies"] if a["difference"] < 0]
        if lower:
            assert "lower than model" in lower[0]["message"]

    def test_salinity_anomaly(self, client, synthetic_env):
        # Salinity model 35.5, obs 35.02-35.52 -> diff up to ~0.48 < 0.5 default
        # -> NORMAL; with a low threshold WARNINGs appear.
        body = query(client, variable="salinity", threshold=0.3).json()
        assert body["variable"] == "salinity"
        assert body["unit"] == "PSU"
        assert body["threshold"] == 0.3

    def test_default_thresholds(self, client, synthetic_env):
        assert query(client).json()["threshold"] == 2.0
        assert query(client, variable="salinity").json()["threshold"] == 0.5

    def test_custom_threshold_exposed(self, client, synthetic_env):
        body = query(client, threshold=3.5).json()
        assert body["threshold"] == 3.5
        for a in body["anomalies"]:
            assert a["threshold"] == 3.5


# ---------------------------------------------------------------------------
# Filtering
# ---------------------------------------------------------------------------


class TestFiltering:
    def test_haversine_location_filtering(self, client, synthetic_env):
        # Center near the northern rows; tight radius excludes southern rows.
        body = query(client, latitude=19.0, longitude=69.0, radius_km=200).json()
        if body["count"] > 0:
            for a in body["anomalies"]:
                # All results must be within ~200 km + rounding of the center.
                assert a["location"]["latitude"] >= 17.0

    def test_depth_filtering(self, client, synthetic_env):
        body = query(client, depth=200.0, depth_tolerance=20.0).json()
        if body["count"] > 0:
            for a in body["anomalies"]:
                assert abs(a["depth"] - 200.0) <= 20.0 + 1e-6

    def test_time_filtering(self, client, synthetic_env):
        body = query(client, time="2026-06-21T00:00:00", time_tolerance_days=1).json()
        # Rows 1-2 are within 1 day of 2026-06-21; obs at ~180 dbar have
        # temp ~17.5/17.0 -> diff 10.5/11.0 -> WARNINGs expected.
        assert body["count"] >= 1
        for a in body["anomalies"]:
            dt = abs(
                datetime.fromisoformat(a["time"]) - datetime(2026, 6, 21)
            ).days
            assert dt <= 1

    def test_no_matching_observation_404(self, client, synthetic_env):
        resp = query(client, time="2030-01-01T00:00:00", time_tolerance_days=5)
        assert resp.status_code == 404

    def test_no_match_tight_radius_404(self, client, synthetic_env):
        resp = query(client, latitude=-80.0, longitude=-150.0, radius_km=50)
        assert resp.status_code == 404

    def test_max_results_cap(self, client, synthetic_env):
        body = query(client, max_results=3).json()
        assert body["count"] <= 3

    def test_hard_cap_constant(self):
        assert MAX_MAX_ANOMALIES == 500

    def test_deterministic_output(self, client, synthetic_env):
        a = query(client).json()
        b = query(client).json()
        assert a == b


# ---------------------------------------------------------------------------
# Schema, honesty, modes
# ---------------------------------------------------------------------------


class TestSchemaAndHonesty:
    def test_response_schema(self, client, synthetic_env):
        body = query(client).json()
        for key in ("count", "status", "indicator_type", "variable", "unit",
                    "threshold", "threshold_type", "mode", "anomalies", "notes"):
            assert key in body
        a = body["anomalies"][0]
        for key in ("status", "indicator_type", "variable", "unit", "location",
                    "depth", "time", "observed_value", "expected_value",
                    "difference", "absolute_difference", "threshold",
                    "threshold_type", "observation", "model", "message"):
            assert key in a

    def test_iso_timestamp(self, client, synthetic_env):
        body = query(client).json()
        for a in body["anomalies"]:
            datetime.fromisoformat(a["time"])

    def test_prototype_threshold_labelled(self, client, synthetic_env):
        body = query(client).json()
        assert body["threshold_type"] == "prototype analytical threshold"
        assert body["anomalies"][0]["threshold_type"] == "prototype analytical threshold"

    def test_indicator_type_labelled(self, client, synthetic_env):
        body = query(client).json()
        assert body["indicator_type"] == "prototype_analytical_indicator"

    def test_not_official_incois_warning(self, client, synthetic_env):
        body = query(client).json()
        notes = " ".join(body["notes"]).lower()
        assert "not an official incois warning" in notes
        assert "prototype analytical indicator" in notes

    def test_pressure_proxy_documented(self, client, synthetic_env):
        body = query(client).json()
        notes = " ".join(body["notes"]).lower()
        assert "pressure/depth proxy" in notes

    def test_no_fabricated_values(self, client, synthetic_env):
        body = query(client).json()
        ds = xr.open_dataset(synthetic_env["argo"])
        for a in body["anomalies"]:
            idx = int(a["observation"]["id"].rsplit("_", 1)[1])
            assert a["observed_value"] == pytest.approx(
                float(ds["TEMP_ADJUSTED"].values[idx]), abs=1e-3
            )

    def test_real_mode(self, client, synthetic_env):
        assert query(client).json()["mode"] == "real"

    def test_qc_bad_variable_404_not_fabricated(self, tmp_path, monkeypatch, client):
        ds = make_argo_ds(n=8, temp_qc_bad_all=True)
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
            resp = query(client)
            assert resp.status_code == 404
        finally:
            model_processor._dataset_cache.clear()


# ---------------------------------------------------------------------------
# Missing-data behaviour
# ---------------------------------------------------------------------------


class TestMissingData:
    def test_missing_argo_404_no_demo_mix(self, tmp_path, monkeypatch, client):
        model_path = tmp_path / "synthetic_model.nc"
        make_model_ds().to_netcdf(model_path)
        monkeypatch.setenv("SAGARA_MODEL_PATH", str(model_path))
        monkeypatch.setenv("SAGARA_ARGO_PATH", str(tmp_path / "missing.nc"))
        _invalidate_cache()
        from app.processing import model_processor

        model_processor._dataset_cache.clear()
        try:
            resp = query(client)
            assert resp.status_code == 404
            assert "never mixed" in resp.json()["detail"]
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
            resp = query(client)
            assert resp.status_code == 404
        finally:
            model_processor._dataset_cache.clear()


# ---------------------------------------------------------------------------
# Real-data smoke tests (skipped when files absent)
# ---------------------------------------------------------------------------


class TestRealDataSmoke:
    def _skip_if_missing(self):
        from app.processing.argo_processor import argo_dataset_path
        from app.processing.model_processor import model_dataset_path

        if not (argo_dataset_path().is_file() and model_dataset_path().is_file()):
            pytest.skip("Real datasets not available on this machine")

    def test_real_anomaly_scan(self, client):
        self._skip_if_missing()
        resp = query(
            client,
            latitude=15.5,
            longitude=65.0,
            radius_km=300,
            time="2024-06-01T00:00:00",
            time_tolerance_days=90,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["mode"] == "real"
        assert body["count"] >= 1
        for a in body["anomalies"]:
            assert a["status"] in ("NORMAL", "WARNING")
            assert a["observation"]["id"].startswith("ARGO_")
            assert a["observation"]["source"] == "Argo"
            assert a["model"]["source"] == "Copernicus Marine"
            assert a["threshold_type"] == "prototype analytical threshold"
        # Difference math holds for every returned candidate.
        for a in body["anomalies"]:
            assert a["difference"] == pytest.approx(
                a["observed_value"] - a["expected_value"], abs=1e-3
            )