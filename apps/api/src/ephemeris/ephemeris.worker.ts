/**
 * Swiss Ephemeris worker thread.
 *
 * Loads the native swisseph library in an isolated thread so FFI calls
 * don't block the main event loop. Each worker handles one computation
 * at a time; the pool dispatches across multiple workers.
 */
import { parentPort } from 'worker_threads';
import * as path from 'path';

// Load swisseph inside the worker
const swisseph = require('swisseph');
const EPHE_PATH = path.join(path.dirname(require.resolve('swisseph')), 'ephe');
swisseph.swe_set_ephe_path(EPHE_PATH);
swisseph.swe_set_sid_mode(swisseph.SE_SIDM_LAHIRI, 0, 0);

const PLANETS = [
  { id: swisseph.SE_SUN, name: 'Sun' },
  { id: swisseph.SE_MOON, name: 'Moon' },
  { id: swisseph.SE_MARS, name: 'Mars' },
  { id: swisseph.SE_MERCURY, name: 'Mercury' },
  { id: swisseph.SE_JUPITER, name: 'Jupiter' },
  { id: swisseph.SE_VENUS, name: 'Venus' },
  { id: swisseph.SE_SATURN, name: 'Saturn' },
  { id: swisseph.SE_TRUE_NODE, name: 'Rahu' },
];

interface ChartRequest {
  id: string;
  type: 'computeFullChart';
  payload: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    lat: number;
    lng: number;
    tzOffset?: number;
  };
}

interface PlanetPosition {
  name: string;
  longitude: number;
  speed: number;
}

interface ChartResult {
  julianDay: number;
  positions: PlanetPosition[];
  ascendant: number;
  houses: number[];
}

function computeChart(payload: ChartRequest['payload']): ChartResult {
  const { year, month, day, hour, minute, lat, lng, tzOffset } = payload;

  // Compute Julian Day
  const tz = tzOffset != null ? tzOffset : (lng / 15);
  const utHour = hour + minute / 60 - tz;
  const jd = swisseph.swe_julday(year, month, day, utHour, swisseph.SE_GREG_CAL);

  // Compute planetary positions (sidereal)
  const flags = swisseph.SEFLG_SIDEREAL | swisseph.SEFLG_SPEED;
  const positions: PlanetPosition[] = PLANETS.map((p) => {
    const result = swisseph.swe_calc_ut(jd, p.id, flags);
    const lng = ((result.longitude % 360) + 360) % 360;
    return { name: p.name, longitude: lng, speed: result.longitudeSpeed || 0 };
  });

  // Add Ketu (180 degrees from Rahu)
  const rahu = positions.find((p) => p.name === 'Rahu')!;
  positions.push({ name: 'Ketu', longitude: (rahu.longitude + 180) % 360, speed: rahu.speed });

  // Compute houses and ascendant (Equal house system)
  const housesResult = swisseph.swe_houses(jd, lat, lng, 'E');
  const ascendant = ((housesResult.ascendant % 360) + 360) % 360;
  const houses: number[] = [];
  for (let i = 1; i <= 12; i++) {
    houses.push(((housesResult.house[i] % 360) + 360) % 360);
  }

  return { julianDay: jd, positions, ascendant, houses };
}

// Listen for messages from the main thread
parentPort?.on('message', (msg: ChartRequest) => {
  try {
    const result = computeChart(msg.payload);
    parentPort?.postMessage({ id: msg.id, result });
  } catch (err: any) {
    parentPort?.postMessage({ id: msg.id, error: err.message || 'Worker computation failed' });
  }
});
