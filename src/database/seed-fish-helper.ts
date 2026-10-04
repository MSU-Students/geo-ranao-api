import * as fs from 'fs';
import * as path from 'path';
import { ConservationStatus } from '../fish-observations/entities/fish-observation.entity';
import { StationZone } from '../stations/entities/station.entity';

// Lake sampling points from WQ-All-Sampling-Sites.geojson (with zone)
export const LAKE_SITES: { siteId: string; stationId: string; latitude: number; longitude: number; zone: StationZone }[] = [
  { siteId: 'S1A', stationId: 'STATION-1', latitude: 7.843527, longitude: 124.119834, zone: StationZone.NEARSHORE },
  { siteId: 'S1B', stationId: 'STATION-1', latitude: 7.843528, longitude: 124.1425, zone: StationZone.NEARSHORE },
  { siteId: 'S2A', stationId: 'STATION-2', latitude: 7.825167, longitude: 124.1885, zone: StationZone.NEARSHORE },
  { siteId: 'S2B', stationId: 'STATION-2', latitude: 7.808167, longitude: 124.202222, zone: StationZone.NEARSHORE },
  { siteId: 'S3A', stationId: 'STATION-3', latitude: 7.825833, longitude: 124.22625, zone: StationZone.NEARSHORE },
  { siteId: 'S3B', stationId: 'STATION-3', latitude: 7.808833, longitude: 124.251667, zone: StationZone.NEARSHORE },
  { siteId: 'S4A', stationId: 'STATION-4', latitude: 7.819722, longitude: 124.273639, zone: StationZone.NEARSHORE },
  { siteId: 'S4B', stationId: 'STATION-4', latitude: 7.826528, longitude: 124.296306, zone: StationZone.NEARSHORE },
  { siteId: 'S5A', stationId: 'STATION-5', latitude: 7.864611, longitude: 124.184389, zone: StationZone.NEARSHORE },
  { siteId: 'S5B', stationId: 'STATION-5', latitude: 7.847611, longitude: 124.194, zone: StationZone.NEARSHORE },
  { siteId: 'S6A', stationId: 'STATION-6', latitude: 7.857139, longitude: 124.233806, zone: StationZone.NEARSHORE },
  { siteId: 'S6B', stationId: 'STATION-6', latitude: 7.866667, longitude: 124.255111, zone: StationZone.NEARSHORE },
  { siteId: 'S7A', stationId: 'STATION-7', latitude: 7.869389, longitude: 124.288056, zone: StationZone.NEARSHORE },
  { siteId: 'S7B', stationId: 'STATION-7', latitude: 7.84625, longitude: 124.319639, zone: StationZone.NEARSHORE },
  { siteId: 'S8A', stationId: 'STATION-8', latitude: 7.910861, longitude: 124.219389, zone: StationZone.NEARSHORE },
  { siteId: 'S8B', stationId: 'STATION-8', latitude: 7.902694, longitude: 124.249611, zone: StationZone.NEARSHORE },
  { siteId: 'S9A', stationId: 'STATION-9', latitude: 7.893861, longitude: 124.281194, zone: StationZone.NEARSHORE },
  { siteId: 'S9B', stationId: 'STATION-9', latitude: 7.898028, longitude: 124.318083, zone: StationZone.NEARSHORE },
  { siteId: 'S10A', stationId: 'STATION-10', latitude: 7.959833, longitude: 124.261278, zone: StationZone.OFFSHORE },
  { siteId: 'S10B', stationId: 'STATION-10', latitude: 7.944861, longitude: 124.246167, zone: StationZone.OFFSHORE },
  { siteId: 'S11A', stationId: 'STATION-11', latitude: 7.984306, longitude: 124.286, zone: StationZone.OFFSHORE },
  { siteId: 'S11B', stationId: 'STATION-11', latitude: 7.957778, longitude: 124.284639, zone: StationZone.OFFSHORE },
  { siteId: 'S12A', stationId: 'STATION-12', latitude: 7.985667, longitude: 124.327889, zone: StationZone.OFFSHORE },
  { siteId: 'S12B', stationId: 'STATION-12', latitude: 7.961861, longitude: 124.32925, zone: StationZone.OFFSHORE },
];

const LAKE_GEOJSON_PATH = path.resolve(
  __dirname,
  '../../../geo-ranao-front-end/public/geo/lake-lanao.geojson',
);

interface LakeGeoJson {
  features: { geometry: { coordinates: [number, number][][][] } }[];
}

export interface LakeRings {
  outer: [number, number][];
  holes: [number, number][][];
}

export function loadLakeRings(): LakeRings | null {
  try {
    const raw = fs.readFileSync(LAKE_GEOJSON_PATH, 'utf8');
    const geojson = JSON.parse(raw) as LakeGeoJson;
    const rings = geojson.features[0].geometry.coordinates[0].map((ring) =>
      ring.map(([lng, lat]) => [lat, lng] as [number, number]),
    );
    return { outer: rings[0], holes: rings.slice(1) };
  } catch (err) {
    console.warn(
      `Could not load lake boundary from ${LAKE_GEOJSON_PATH}: ${(err as Error).message}`,
    );
    return null;
  }
}

export const lakeRings: LakeRings | null = loadLakeRings();

export function pointInRing(lat: number, lng: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function isInLake(lat: number, lng: number): boolean {
  if (!lakeRings) return true;
  if (!pointInRing(lat, lng, lakeRings.outer)) return false;
  return !lakeRings.holes.some((hole) => pointInRing(lat, lng, hole));
}

export function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRandomGenerator(seed = 20260930) {
  const rand = mulberry32(seed);
  return {
    rand,
    randRange: (min: number, max: number) => min + rand() * (max - min),
    randInt: (min: number, max: number) => Math.floor(min + rand() * (max - min + 1)),
    pick: <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)],
  };
}

const defaultRng = createRandomGenerator(20260930);
export const randRange = defaultRng.randRange;
export const randInt = defaultRng.randInt;
export const pick = defaultRng.pick;

export function randomInLakePoint(
  anchorLat: number,
  anchorLng: number,
  maxJitterDeg: number,
  rngRange = randRange,
): { lat: number; lng: number } {
  for (let attempt = 0; attempt < 10; attempt++) {
    const jitter = maxJitterDeg * (1 - attempt / 10);
    const lat = anchorLat + rngRange(-jitter, jitter);
    const lng = anchorLng + rngRange(-jitter, jitter);
    if (isInLake(lat, lng)) return { lat, lng };
  }
  return { lat: anchorLat, lng: anchorLng };
}

export const LAKE_SITE_ANCHORS = LAKE_SITES.filter((s) => isInLake(s.latitude, s.longitude));

export interface FishSpeciesDef {
  scientific: string;
  common: string;
  status: ConservationStatus;
  lengthRangeCm: [number, number];
  weightRangeG: [number, number];
}

export const ENDEMIC_SPECIES: FishSpeciesDef[] = [
  { scientific: 'Barbodes lindog', common: 'Lindog Barb', status: ConservationStatus.CRITICALLY_ENDANGERED, lengthRangeCm: [8, 18], weightRangeG: [15, 110] },
  { scientific: 'Barbodes tumba', common: 'Tumba Barb', status: ConservationStatus.CRITICALLY_ENDANGERED, lengthRangeCm: [9, 19], weightRangeG: [20, 120] },
  { scientific: 'Barbodes sirang', common: 'Sirang Barb', status: ConservationStatus.CRITICALLY_ENDANGERED, lengthRangeCm: [8, 16], weightRangeG: [15, 95] },
  { scientific: 'Barbodes amarus', common: 'Amarus Barb', status: ConservationStatus.ENDANGERED, lengthRangeCm: [7, 15], weightRangeG: [10, 80] },
  { scientific: 'Barbodes clemensi', common: "Clemens' Barb", status: ConservationStatus.ENDANGERED, lengthRangeCm: [8, 16], weightRangeG: [12, 85] },
  { scientific: 'Barbodes flavifuscus', common: 'Flavifuscus Barb', status: ConservationStatus.ENDANGERED, lengthRangeCm: [8, 17], weightRangeG: [15, 95] },
  { scientific: 'Barbodes katolo', common: 'Katolo Barb', status: ConservationStatus.ENDANGERED, lengthRangeCm: [7, 14], weightRangeG: [10, 70] },
  { scientific: 'Barbodes lanaoensis', common: 'Lanao Barb', status: ConservationStatus.VULNERABLE, lengthRangeCm: [9, 18], weightRangeG: [18, 100] },
  { scientific: 'Barbodes resinus', common: 'Resinus Barb', status: ConservationStatus.VULNERABLE, lengthRangeCm: [8, 16], weightRangeG: [14, 90] },
  { scientific: 'Barbodes truncatulus', common: 'Truncatulus Barb', status: ConservationStatus.VULNERABLE, lengthRangeCm: [7, 15], weightRangeG: [10, 75] },
  { scientific: 'Barbodes herrei', common: "Herre's Barb", status: ConservationStatus.VULNERABLE, lengthRangeCm: [8, 17], weightRangeG: [15, 90] },
  { scientific: 'Barbodes joaquinae', common: "Joaquina's Barb", status: ConservationStatus.NOT_EVALUATED, lengthRangeCm: [7, 14], weightRangeG: [10, 70] },
  { scientific: 'Barbodes umalii', common: "Umali's Barb", status: ConservationStatus.NOT_EVALUATED, lengthRangeCm: [8, 15], weightRangeG: [12, 80] },
];

export const INVASIVE_SPECIES: FishSpeciesDef[] = [
  { scientific: 'Glossogobius giuris', common: 'White Goby', status: ConservationStatus.LEAST_CONCERN, lengthRangeCm: [15, 35], weightRangeG: [50, 400] },
  { scientific: 'Giuris margaritacea', common: 'Snakehead Gudgeon', status: ConservationStatus.LEAST_CONCERN, lengthRangeCm: [10, 25], weightRangeG: [30, 250] },
  { scientific: 'Oreochromis niloticus', common: 'Nile Tilapia', status: ConservationStatus.LEAST_CONCERN, lengthRangeCm: [15, 35], weightRangeG: [100, 800] },
  { scientific: 'Hypseleotris agilis', common: 'Agile Gudgeon', status: ConservationStatus.NOT_EVALUATED, lengthRangeCm: [4, 8], weightRangeG: [2, 15] },
  { scientific: 'Cyprinus carpio', common: 'Common Carp', status: ConservationStatus.LEAST_CONCERN, lengthRangeCm: [20, 50], weightRangeG: [300, 2500] },
  { scientific: 'Clarias gariepinus', common: 'African Catfish', status: ConservationStatus.LEAST_CONCERN, lengthRangeCm: [25, 60], weightRangeG: [200, 2000] },
];

export const MUNICIPALITY_LABELS: { municipal: string; barangay: string; latitude: number; longitude: number }[] = [
  { municipal: 'Marawi City', barangay: 'Poblacion', latitude: 7.9986, longitude: 124.2928 },
  { municipal: 'Saguiaran', barangay: 'Poblacion', latitude: 7.9757, longitude: 124.2306 },
  { municipal: 'Marantao', barangay: 'Poblacion', latitude: 7.9202, longitude: 124.2382 },
  { municipal: 'Bacolod-Kalawi', barangay: 'Poblacion', latitude: 7.8801, longitude: 124.2313 },
  { municipal: 'Kapai', barangay: 'Poblacion', latitude: 7.8935, longitude: 124.2688 },
  { municipal: 'Poona Bayabao', barangay: 'Poblacion', latitude: 7.8474, longitude: 124.3396 },
  { municipal: 'Ditsaan-Ramain', barangay: 'Poblacion', latitude: 7.9781, longitude: 124.355 },
  { municipal: 'Taraka', barangay: 'Poblacion', latitude: 7.8836, longitude: 124.3438 },
  { municipal: 'Bayang', barangay: 'Poblacion', latitude: 7.8064, longitude: 124.2382 },
  { municipal: 'Ganassi', barangay: 'Poblacion', latitude: 7.8375, longitude: 124.1198 },
];

export function nearestMunicipality(
  lat: number,
  lng: number,
): { municipal: string; barangay: string } {
  let best = MUNICIPALITY_LABELS[0];
  let bestDist = Infinity;
  for (const m of MUNICIPALITY_LABELS) {
    const dist = (m.latitude - lat) ** 2 + (m.longitude - lng) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = m;
    }
  }
  return { municipal: best.municipal, barangay: best.barangay };
}

export const GENERAL_SIZE_CATEGORIES = ['Small', 'Medium', 'Large'];

export function randomDateObserved(yearStart: number, yearEnd: number, rng = defaultRng): string {
  const year = rng.randInt(yearStart, yearEnd);
  const month = rng.randInt(1, 12);
  const day = rng.randInt(1, 28);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
