/* ============================================================
   RATNAKARA — COASTAL ADVISORY DATA

   IMPORTANT:
   This is DEMO FRONTEND DATA ONLY.

   Do NOT present this as live warnings.
   Do NOT claim these are real advisories.

   This data exists to demonstrate the coastal
   warning visualization system. When the backend
   is connected, replace this array entirely with
   real API responses.

   Architecture note: the data structure mirrors
   the future backend contract defined in contracts.js.
============================================================ */


export const INDIAN_COAST_LOCATIONS = [
  {
    id: "mumbai",
    name: "Mumbai Coast",
    region: "Arabian Sea",
    latitude: 18.92,
    longitude: 72.83,
  },
  {
    id: "goa",
    name: "Goa Coast",
    region: "Arabian Sea",
    latitude: 15.40,
    longitude: 73.88,
  },
  {
    id: "kochi",
    name: "Kochi Coast",
    region: "Arabian Sea",
    latitude: 9.93,
    longitude: 76.27,
  },
  {
    id: "chennai",
    name: "Chennai Coast",
    region: "Bay of Bengal",
    latitude: 13.08,
    longitude: 80.27,
  },
  {
    id: "vizag",
    name: "Visakhapatnam Coast",
    region: "Bay of Bengal",
    latitude: 17.69,
    longitude: 83.22,
  },
  {
    id: "odisha",
    name: "Odisha Coast",
    region: "Bay of Bengal",
    latitude: 19.81,
    longitude: 85.82,
  },
  {
    id: "kolkata",
    name: "Kolkata Coastal Region",
    region: "Bay of Bengal",
    latitude: 22.57,
    longitude: 88.36,
  },
  {
    id: "gujarat",
    name: "Gujarat Coast",
    region: "Arabian Sea",
    latitude: 22.26,
    longitude: 69.04,
  },
  {
    id: "kerala",
    name: "Kerala Coast",
    region: "Arabian Sea",
    latitude: 10.85,
    longitude: 76.17,
  },
  {
    id: "andaman",
    name: "Andaman & Nicobar",
    region: "Bay of Bengal",
    latitude: 11.74,
    longitude: 92.72,
  },
  {
    id: "lakshadweep",
    name: "Lakshadweep",
    region: "Arabian Sea",
    latitude: 10.57,
    longitude: 72.62,
  },
];


/**
 * Demo coastal advisories.
 *
 * Each advisory is a DEMO entry. Values are illustrative
 * and do NOT represent real ocean conditions.
 *
 * When the backend is connected, this array will be
 * replaced by a fetch call to /api/v1/coastal-advisories
 * or similar endpoint.
 */
export const COASTAL_ADVISORIES = [
  {
    id: "demo-mumbai-001",
    name: "Mumbai Coast",
    latitude: 18.92,
    longitude: 72.83,
    type: "HIGH_WAVE",
    severity: "HIGH",
    title: "High Wave Advisory",
    message:
      "Elevated wave conditions expected along the coast. Exercise caution near exposed coastal areas and fishing zones.",
    waveHeight: 2.8,
    currentSpeed: 2.1,
    temperature: 29.4,
    validUntil: "2026-09-10T18:00:00Z",
    satelliteImage: null,
    satelliteSource: null,
    capturedAt: null,
  },
  {
    id: "demo-kochi-001",
    name: "Kochi Coast",
    latitude: 9.93,
    longitude: 76.27,
    type: "STORM_SURGE",
    severity: "MEDIUM",
    title: "Storm Surge Watch",
    message:
      "Moderate storm surge potential. Coastal flooding possible in low-lying areas during high tide cycles.",
    waveHeight: 1.9,
    currentSpeed: 1.7,
    temperature: 28.8,
    validUntil: "2026-09-11T06:00:00Z",
    satelliteImage: null,
    satelliteSource: null,
    capturedAt: null,
  },
  {
    id: "demo-chennai-001",
    name: "Chennai Coast",
    latitude: 13.08,
    longitude: 80.27,
    type: "HIGH_WAVE",
    severity: "MEDIUM",
    title: "Elevated Wave Conditions",
    message:
      "Above-normal wave activity along the eastern coast. Small craft advisory in effect.",
    waveHeight: 2.2,
    currentSpeed: 1.4,
    temperature: 29.1,
    validUntil: "2026-09-10T12:00:00Z",
    satelliteImage: null,
    satelliteSource: null,
    capturedAt: null,
  },
];
