/* ============================================================
   RATNAKARA — COARSE OCEAN / LAND MASK

   A single shared geographic land mask used by the
   Temperature overlay, Salinity points and Currents
   fallback paths so data layers follow the real Indian
   Ocean geometry instead of crude rectangles.

   IMPORTANT:
   - The mask is intentionally COARSE (~0.5-1 deg). It exists
     to keep ocean-color overlays off continents, not for
     navigation.
   - Outside the listed polygons everything is treated as
     ocean. Layers only paint where the backend actually has
     data, so far-away ocean stays transparent anyway.
   - Polygons are [latitude, longitude] pairs closed
     implicitly (last vertex connects to the first).

   Regions covered (the model + Argo dataset footprint):
     Arabian Sea, Bay of Bengal, equatorial Indian Ocean,
     Red Sea, Persian Gulf, Sumatra/Andaman waters,
     Madagascar channel, the African continent, and the
     South Asian landmass north to the Himalayas.
============================================================ */

const LAND_POLYGONS = [
  /* Africa (full continent: Mediterranean coast, Suez, Red Sea
     east coast, Horn, east + west coasts, closed through the
     Sahara/Sahel interior). */
  [
    [35.9, -5.6],
    [36.9, -2.0],
    [36.8, 3.0],
    [37.2, 9.0],
    [35.8, 9.8],
    [33.8, 10.0],
    [33.2, 11.5],
    [32.6, 13.2],
    [32.4, 15.0],
    [30.5, 19.0],
    [31.0, 23.5],
    [31.4, 29.5],
    [31.0, 32.3],
    [28.5, 33.5],
    [24.0, 35.7],
    [20.5, 37.2],
    [17.5, 38.5],
    [15.5, 39.8],
    [12.7, 43.1],
    [11.5, 43.3],
    [11.9, 51.1],
    [10.4, 51.1],
    [6.0, 49.0],
    [0.0, 41.5],
    [-6.5, 39.3],
    [-11.0, 40.5],
    [-15.5, 40.6],
    [-19.0, 36.5],
    [-22.0, 35.5],
    [-25.5, 32.9],
    [-29.5, 31.0],
    [-33.0, 27.5],
    [-34.8, 20.0],
    [-34.8, 18.4],
    [-32.0, 18.3],
    [-29.0, 16.5],
    [-23.0, 14.5],
    [-17.0, 11.8],
    [-12.0, 13.4],
    [-6.0, 12.3],
    [0.0, 9.3],
    [4.0, 9.0],
    [6.4, 3.4],
    [4.9, -2.5],
    [4.5, -7.5],
    [8.5, -13.2],
    [11.8, -15.5],
    [14.7, -17.5],
    [18.0, -16.0],
    [23.7, -15.9],
    [26.0, -14.5],
    [28.5, -11.0],
    [30.4, -9.6],
    [33.6, -7.6],
    [35.8, -5.8],
  ],

  /* Arabian Peninsula (Red Sea coast, south coast, Gulf of
     Oman + southern Persian Gulf coast; closed through
     Jordan/Iraq). The Persian Gulf and Red Sea stay ocean
     between this and the neighbouring polygons. */
  [
    [30.0, 48.0],
    [28.6, 48.8],
    [27.0, 50.5],
    [25.6, 52.4],
    [25.3, 55.3],
    [24.4, 56.6],
    [23.0, 58.8],
    [22.5, 59.8],
    [20.5, 58.8],
    [18.5, 57.3],
    [17.0, 55.0],
    [15.5, 52.5],
    [13.8, 48.8],
    [12.8, 45.0],
    [12.7, 43.5],
    [14.0, 43.0],
    [17.5, 42.0],
    [21.0, 39.0],
    [24.5, 37.2],
    [27.0, 35.5],
    [29.0, 34.8],
    [30.5, 38.0],
    [31.5, 44.0],
  ],

  /* Iran + Pakistan (Makran coast and Strait of Hormuz; the
     northern Persian Gulf coast keeps the gulf itself as
     ocean; closed through the Iranian interior). */
  [
    [27.2, 56.2],
    [25.8, 57.9],
    [25.4, 60.5],
    [25.0, 62.5],
    [24.8, 66.8],
    [24.2, 68.0],
    [24.0, 68.3],
    [26.5, 69.0],
    [29.0, 66.0],
    [31.0, 60.0],
    [31.0, 55.0],
    [29.0, 52.0],
    [28.9, 50.8],
    [26.5, 54.8],
  ],

  /* India + Pakistan coast + Himalayan north (west coast,
     Kanyakumari, east coast, Bengal, then the northern border
     through Kashmir and the Makran coast back to Kutch so the
     whole subcontinent interior is masked as land). */
  [
    [24.0, 68.3],
    [22.8, 69.3],
    [20.7, 70.9],
    [21.0, 72.3],
    [19.9, 72.8],
    [17.5, 73.3],
    [15.5, 73.8],
    [13.5, 74.8],
    [11.3, 75.4],
    [9.5, 76.2],
    [8.1, 77.3],
    [8.5, 78.1],
    [10.5, 79.9],
    [12.0, 79.8],
    [13.1, 80.3],
    [14.5, 80.2],
    [16.0, 81.2],
    [18.5, 84.4],
    [19.8, 85.4],
    [21.0, 86.9],
    [22.0, 89.0],
    [24.5, 92.5],
    [26.5, 94.5],
    [27.0, 94.8],
    [29.0, 94.0],
    [29.5, 91.0],
    [28.8, 89.0],
    [27.5, 85.0],
    [28.5, 82.0],
    [30.0, 80.0],
    [31.5, 78.5],
    [33.0, 76.5],
    [34.5, 77.5],
    [35.0, 78.0],
    [34.8, 79.5],
    [32.5, 75.5],
    [31.0, 73.8],
    [29.5, 71.5],
    [27.5, 70.0],
    [28.5, 65.0],
    [27.0, 62.8],
    [26.2, 61.5],
    [25.3, 61.9],
    [25.2, 63.5],
    [25.0, 65.5],
    [24.7, 67.0],
  ],

  /* Sri Lanka. */
  [
    [9.8, 80.3],
    [9.2, 79.8],
    [7.5, 79.8],
    [6.0, 80.1],
    [6.0, 80.7],
    [6.9, 81.9],
    [8.4, 81.3],
    [9.6, 80.5],
  ],

  /* Bangladesh + Myanmar coast + Malay peninsula (west
     Andaman-sea coast; closed through the Indochina/Yunnan
     interior so the Bay of Bengal and Andaman Sea stay
     ocean). */
  [
    [22.0, 89.0],
    [22.3, 91.8],
    [20.1, 92.9],
    [18.5, 94.2],
    [17.5, 94.5],
    [16.0, 96.5],
    [14.0, 98.0],
    [12.0, 98.6],
    [9.9, 98.6],
    [8.0, 98.3],
    [6.4, 99.8],
    [5.4, 100.3],
    [3.0, 101.4],
    [1.3, 103.8],
    [8.0, 100.0],
    [14.0, 99.0],
    [20.0, 98.0],
    [24.0, 97.0],
    [26.5, 98.5],
    [28.5, 101.0],
    [26.0, 102.5],
    [23.5, 92.0],
  ],

  /* Sumatra (west Indian Ocean coast + Malacca side; the
     strait between this and the peninsula stays ocean). */
  [
    [5.6, 95.2],
    [2.0, 97.2],
    [0.0, 99.2],
    [-2.0, 100.9],
    [-4.0, 103.2],
    [-5.9, 105.8],
    [-4.2, 105.0],
    [-2.0, 104.3],
    [0.0, 102.5],
    [2.5, 100.3],
    [4.5, 98.0],
  ],

  /* Andaman & Nicobar islands arc. */
  [
    [13.7, 92.9],
    [12.2, 92.7],
    [10.5, 92.5],
    [9.0, 92.3],
    [7.0, 93.5],
    [8.0, 93.9],
    [10.3, 93.2],
    [12.5, 93.6],
    [13.7, 93.6],
  ],

  /* Eurasia interior (Middle East north of Arabia, Iran
     highlands, Central Asia, Russia, China). Its southern
     edge weaves along the Red Sea head, Persian Gulf and
     Gulf of Oman so those waters stay ocean; the far edge
     overlaps the India/SE-Asia polygons harmlessly. */
  [
    [31.5, 36],
    [31.5, 44],
    [31.0, 48],
    [31.0, 55],
    [29.0, 66],
    [26.5, 69],
    [27.5, 70],
    [35.0, 78],
    [35.0, 95],
    [32.0, 100],
    [25.0, 105],
    [21.0, 110],
    [22.0, 114],
    [25.0, 119],
    [30.0, 122],
    [32.0, 122],
    [45.0, 130],
    [60.0, 140],
    [70.0, 140],
    [73.0, 100],
    [70.0, 60],
    [55.0, 36],
    [49.0, 29],
    [45.0, 28],
    [41.0, 26],
    [36.0, 28],
    [36.5, 33],
    [33.0, 35],
  ],

  /* Madagascar. */
  [
    [-12.0, 49.3],
    [-15.5, 50.5],
    [-18.5, 49.3],
    [-22.0, 48.0],
    [-25.5, 47.0],
    [-25.2, 45.2],
    [-21.5, 43.5],
    [-17.0, 44.0],
    [-13.0, 48.2],
  ],

  /* Antarctica — coarse ring. Without this polygon the
     southern polar landmass is treated as ocean and
     receives temperature colouring. */
  [
    [-65.0, -60.0],
    [-68.0, -20.0],
    [-70.0, 10.0],
    [-67.0, 40.0],
    [-66.0, 55.0],
    [-68.0, 70.0],
    [-66.0, 95.0],
    [-67.0, 110.0],
    [-66.0, 130.0],
    [-67.0, 145.0],
    [-70.0, 165.0],
    [-74.0, 170.0],
    [-78.0, 160.0],
    [-80.0, 120.0],
    [-82.0, 80.0],
    [-80.0, 40.0],
    [-78.0, 10.0],
    [-76.0, -20.0],
    [-74.0, -40.0],
    [-72.0, -55.0],
    [-68.0, -62.0],
  ],

  /* Australia — critical for Indian Ocean boundary. */
  [
    [-12.0, 130.0],
    [-12.5, 136.0],
    [-11.5, 142.0],
    [-13.0, 143.5],
    [-14.5, 145.5],
    [-17.5, 146.0],
    [-19.5, 147.0],
    [-22.5, 150.0],
    [-25.0, 153.0],
    [-28.0, 153.5],
    [-31.0, 153.0],
    [-33.5, 152.0],
    [-37.0, 150.0],
    [-38.5, 148.0],
    [-38.0, 145.0],
    [-36.0, 137.0],
    [-34.5, 136.0],
    [-32.5, 133.0],
    [-33.5, 115.5],
    [-32.0, 115.5],
    [-26.0, 113.5],
    [-22.0, 114.0],
    [-18.0, 122.5],
    [-15.0, 129.5],
  ],

  /* Borneo. */
  [
    [7.0, 117.0],
    [5.0, 119.0],
    [2.0, 118.5],
    [0.5, 110.5],
    [1.0, 109.5],
    [3.5, 109.0],
    [5.5, 115.5],
  ],

  /* Java. */
  [
    [-6.0, 105.5],
    [-6.8, 106.5],
    [-7.5, 108.0],
    [-8.0, 112.0],
    [-8.3, 114.5],
    [-7.5, 114.5],
    [-7.0, 112.0],
    [-6.5, 108.0],
    [-6.0, 106.0],
  ],

  /* Sulawesi (rough outline). */
  [
    [1.5, 120.5],
    [0.0, 121.0],
    [-2.0, 121.5],
    [-4.0, 122.0],
    [-5.5, 123.0],
    [-5.5, 120.5],
    [-3.0, 120.0],
    [-1.0, 121.5],
    [0.5, 120.0],
  ],

  /* New Guinea (western half relevant to Indian Ocean). */
  [
    [-1.0, 131.0],
    [-2.5, 132.5],
    [-4.0, 133.5],
    [-6.0, 138.0],
    [-8.0, 141.0],
    [-6.0, 147.0],
    [-5.0, 152.0],
    [-3.0, 152.0],
    [-2.0, 148.0],
    [-2.0, 141.0],
    [-1.5, 137.0],
  ],

  /* Japan (simplified main islands). */
  [
    [31.0, 131.0],
    [33.0, 131.0],
    [34.5, 132.5],
    [35.5, 135.0],
    [37.0, 137.0],
    [39.0, 140.0],
    [41.0, 140.5],
    [43.0, 145.5],
    [45.0, 142.0],
    [43.5, 141.0],
    [41.0, 140.0],
    [38.0, 139.5],
    [35.5, 139.5],
    [34.0, 137.0],
    [33.0, 133.0],
    [31.5, 131.5],
  ],

  /* Korean Peninsula. */
  [
    [34.0, 126.0],
    [35.0, 126.5],
    [37.0, 127.0],
    [38.5, 128.5],
    [40.0, 129.0],
    [42.5, 130.5],
    [43.0, 132.0],
    [40.0, 130.0],
    [38.0, 129.0],
    [36.0, 129.0],
    [35.0, 128.5],
  ],

  /* Taiwan. */
  [
    [22.0, 120.5],
    [23.5, 120.5],
    [25.0, 121.5],
    [25.5, 122.0],
    [24.5, 122.0],
    [23.0, 121.0],
    [22.0, 120.8],
  ],

  /* Philippines (simplified). */
  [
    [5.0, 119.5],
    [7.0, 119.0],
    [10.0, 119.0],
    [12.0, 121.0],
    [14.5, 121.0],
    [18.5, 121.0],
    [19.5, 122.0],
    [18.0, 122.5],
    [15.0, 122.5],
    [12.0, 124.0],
    [8.0, 126.5],
    [6.0, 126.0],
    [5.0, 125.0],
  ],

  /* Turkey / Caucasus bridge to close the Eurasia gap. */
  [
    [36.0, 26.0],
    [37.0, 28.0],
    [39.0, 28.0],
    [41.0, 29.0],
    [42.0, 33.0],
    [41.0, 36.0],
    [39.0, 38.0],
    [37.0, 36.0],
    [36.0, 33.0],
  ],
];

/*
  HOLE polygons (lakes / inland seas). A point inside one of
  these AND inside a land polygon is WATER, not land. Applied
  via the even-odd crossing rule in isLandPoint below.
*/
const LAND_HOLES = [
  /* Black Sea. */
  [
    [41.6, 28.6],
    [43.2, 28.6],
    [45.2, 29.6],
    [46.5, 32.0],
    [45.3, 36.0],
    [43.2, 39.5],
    [41.6, 37.0],
    [41.0, 31.0],
  ],

  /* Caspian Sea. */
  [
    [47.0, 49.2],
    [45.0, 49.8],
    [42.0, 48.8],
    [40.0, 50.0],
    [38.0, 49.0],
    [38.5, 53.8],
    [41.5, 53.5],
    [44.0, 50.0],
    [46.5, 52.8],
    [47.5, 51.5],
  ],
];


/*
  Even-odd ray casting in lat/lon space.
  Runs once per texture pixel / seed point — never per frame.
*/
function pointInPolygon(lat, lon, polygon) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const latI = polygon[i][0];
    const lonI = polygon[i][1];
    const latJ = polygon[j][0];
    const lonJ = polygon[j][1];

    const intersects =
      latI > lat !== latJ > lat &&
      lon < ((lonJ - lonI) * (lat - latI)) / (latJ - latI) + lonI;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}


export function isLandPoint(lat, lon) {
  /*
    Holes subtract: a point inside a hole AND inside land is
    water. Even-odd counting across land + hole polygons gives
    exactly that behaviour without special-casing.
  */
  let crossings = 0;

  for (const polygon of LAND_POLYGONS) {
    if (pointInPolygon(lat, lon, polygon)) {
      crossings++;
    }
  }

  for (const polygon of LAND_HOLES) {
    if (pointInPolygon(lat, lon, polygon)) {
      crossings++;
    }
  }

  return crossings % 2 === 1;
}


export function isOcean(lat, lon) {
  return !isLandPoint(lat, lon);
}
