/* ============================================================
   RATNAKARA — FRONTEND DATA CONTRACTS

   These are interface definitions for future backend data.

   Do NOT build the backend now.
   Do NOT fetch external APIs.
   Do NOT claim real-time data.

   When the backend is ready, replace the demo data
   in coastalAdvisories.js with real API responses.
============================================================ */


/**
 * Temperature data point.
 *
 * Future backend will provide an array of these
 * for the thermal visualization layer.
 *
 * @typedef {Object} TemperaturePoint
 * @property {number} latitude  - Geographic latitude (-90 to 90)
 * @property {number} longitude - Geographic longitude (-180 to 180)
 * @property {number} temperature - Sea surface temperature in °C
 * @property {string} [anomaly] - Temperature anomaly if available
 * @property {string} [timestamp] - ISO 8601 timestamp
 */


/**
 * Ocean current data point.
 *
 * Future backend will provide current vectors
 * for the particle flow visualization.
 *
 * @typedef {Object} CurrentPoint
 * @property {number} latitude  - Geographic latitude
 * @property {number} longitude - Geographic longitude
 * @property {number} u - Eastward current component (m/s)
 * @property {number} v - Northward current component (m/s)
 * @property {number} speed - Current speed magnitude (m/s)
 * @property {number} direction - Flow direction in degrees
 * @property {string} [timestamp] - ISO 8601 timestamp
 */


/**
 * Coastal warning / advisory.
 *
 * Future backend will provide real advisories
 * from INCOIS / ocean observation systems.
 *
 * @typedef {Object} CoastalAdvisory
 * @property {string} id - Unique advisory identifier
 * @property {string} name - Human-readable location name
 * @property {number} latitude - Advisory center latitude
 * @property {number} longitude - Advisory center longitude
 * @property {string} type - Advisory type (HIGH_WAVE, CYCLONE, STORM_SURGE, etc.)
 * @property {string} severity - Severity level (LOW, MEDIUM, HIGH, CRITICAL)
 * @property {string} title - Short advisory title
 * @property {string} message - Advisory description
 * @property {number} [waveHeight] - Wave height in meters
 * @property {number} [currentSpeed] - Current speed in m/s
 * @property {number} [temperature] - Water temperature in °C
 * @property {string} validUntil - ISO 8601 expiry timestamp
 * @property {string|null} satelliteImage - URL to satellite image, or null
 * @property {string} [satelliteSource] - Image source (e.g. "Sentinel-2")
 * @property {string} [capturedAt] - ISO 8601 capture timestamp
 */
