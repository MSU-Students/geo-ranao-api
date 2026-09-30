import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import dataSource from './data-source';
import { UserEntity, UserRole, AccountStatus } from '../users/entities/user.entity';
import { StationEntity, StationZone } from '../stations/entities/station.entity';
import {
  ConservationStatus,
  FishCategory,
  FishObservationEntity,
  ReviewStatus,
} from '../fish-observations/entities/fish-observation.entity';
import { toGeoPoint } from '../common/geo';

/**
 * Creates the first ADMIN account so someone can log in and start approving
 * researcher applications — without this there's no admin to approve anyone.
 * Safe to re-run: no-ops if an admin already exists.
 */
async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@georanao.local';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';
  const adminFullName = process.env.ADMIN_FULL_NAME ?? 'System Administrator';

  const repo = dataSource.getRepository(UserEntity);
  const existingAdmin = await repo.findOne({ where: { role: UserRole.ADMIN } });
  if (existingAdmin) {
    console.log(`Admin account already exists (${existingAdmin.email}) — skipping.`);
    return;
  }

  const hashed = await bcrypt.hash(adminPassword, 10);
  const admin = repo.create({
    fullName: adminFullName,
    email: adminEmail,
    password: hashed,
    role: UserRole.ADMIN,
    status: AccountStatus.APPROVED,
    affiliation: 'System',
    purposeOfRequest: 'Platform administration',
    reviewedAt: new Date(),
    reviewedBy: 'seed script',
  });
  await repo.save(admin);

  console.log(`Created admin account: ${adminEmail} / ${adminPassword}`);
  console.log('Change ADMIN_PASSWORD in .env and re-seed on a fresh database for anything but local dev.');
}

// The 24 fixed lake sampling points, extracted from the frontend's
// public/geo/WQ-All-Sampling-Sites.geojson (+ the two depth-zone subset
// files, which determine NEARSHORE vs OFFSHORE vs TRIBUTARY below) — these
// coordinates never change, so they're seeded once as reference data rather
// than re-derived from the frontend at request time.
const LAKE_SITES: { siteId: string; stationId: string; latitude: number; longitude: number; zone: StationZone }[] = [
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
  { siteId: 'S7B', stationId: 'STATION-7', latitude: 7.84625, longitude: 124.319639, zone: StationZone.TRIBUTARY },
  { siteId: 'S8A', stationId: 'STATION-8', latitude: 7.910861, longitude: 124.219389, zone: StationZone.TRIBUTARY },
  { siteId: 'S8B', stationId: 'STATION-8', latitude: 7.902694, longitude: 124.249611, zone: StationZone.NEARSHORE },
  { siteId: 'S9A', stationId: 'STATION-9', latitude: 7.893861, longitude: 124.281194, zone: StationZone.NEARSHORE },
  { siteId: 'S9B', stationId: 'STATION-9', latitude: 7.898028, longitude: 124.318083, zone: StationZone.TRIBUTARY },
  { siteId: 'S10A', stationId: 'STATION-10', latitude: 7.959833, longitude: 124.261278, zone: StationZone.OFFSHORE },
  { siteId: 'S10B', stationId: 'STATION-10', latitude: 7.944861, longitude: 124.246167, zone: StationZone.OFFSHORE },
  { siteId: 'S11A', stationId: 'STATION-11', latitude: 7.984306, longitude: 124.286, zone: StationZone.TRIBUTARY },
  { siteId: 'S11B', stationId: 'STATION-11', latitude: 7.957778, longitude: 124.284639, zone: StationZone.OFFSHORE },
  { siteId: 'S12A', stationId: 'STATION-12', latitude: 7.985667, longitude: 124.327889, zone: StationZone.TRIBUTARY },
  { siteId: 'S12B', stationId: 'STATION-12', latitude: 7.961861, longitude: 124.32925, zone: StationZone.OFFSHORE },
];

// The 6 fixed tributary rivers — always sampled at Surface only, per the
// real field protocol (see useWaterQualityModel.ts TRIBUTARY_RIVER_SITES).
const RIVER_SITES: { siteId: string; latitude: number; longitude: number }[] = [
  { siteId: 'Masiu Tail (Sawir)', latitude: 7.787944, longitude: 124.323028 },
  { siteId: 'Masiu River', latitude: 7.816861, longitude: 124.329611 },
  { siteId: 'Taraka River', latitude: 7.885528, longitude: 124.344472 },
  { siteId: 'Poona Bayabao River', latitude: 7.85075, longitude: 124.340306 },
  { siteId: 'Ditsaan Ramain River', latitude: 7.979417, longitude: 124.354639 },
  { siteId: 'Marawi City (Outlet) River', latitude: 8.002806, longitude: 124.291639 },
];

async function seedStations() {
  const repo = dataSource.getRepository(StationEntity);
  const existingCount = await repo.count();
  if (existingCount > 0) {
    console.log(`${existingCount} station(s) already seeded — skipping.`);
    return;
  }

  const rows = [
    ...LAKE_SITES.map((s) =>
      repo.create({ siteId: s.siteId, stationId: s.stationId, location: toGeoPoint(s.latitude, s.longitude), zone: s.zone }),
    ),
    ...RIVER_SITES.map((s) =>
      repo.create({ siteId: s.siteId, location: toGeoPoint(s.latitude, s.longitude), zone: StationZone.RIVER }),
    ),
  ];
  await repo.save(rows);
  console.log(`Seeded ${rows.length} stations (${LAKE_SITES.length} lake sites + ${RIVER_SITES.length} rivers).`);
}

// ─── Fish Observation mock data (for QA / dashboard testing) ───
// Real Lake Lanao boundary (same GeoJSON the frontend map/report code uses
// for its own "is this point actually in the lake" checks) — loaded here so
// generated fish sighting coordinates can be verified against it rather than
// just jittered around a coordinate and hoped into the water. Read from the
// sibling frontend project's public/geo folder, since that's this repo's one
// source of truth for the lake outline; only used by this dev/QA seed
// script, never at runtime, so the cross-project path is acceptable here.
const LAKE_GEOJSON_PATH = path.resolve(
  __dirname,
  '../../../geo-ranao-front-end/public/geo/lake-lanao.geojson',
);
interface LakeGeoJson {
  features: { geometry: { coordinates: [number, number][][][] } }[];
}
interface LakeRings {
  outer: [number, number][];
  holes: [number, number][][];
}
function loadLakeRings(): LakeRings {
  const raw = fs.readFileSync(LAKE_GEOJSON_PATH, 'utf8');
  const geojson = JSON.parse(raw) as LakeGeoJson;
  // MultiPolygon -> first (only) polygon -> its rings: ring 0 is the lake's
  // outer shoreline, the rest are holes (islands/islets within it). GeoJSON
  // coordinates are [lng, lat]; flipped here to [lat, lng] to match every
  // other coordinate pair in this file.
  const rings = geojson.features[0].geometry.coordinates[0].map((ring) =>
    ring.map(([lng, lat]) => [lat, lng] as [number, number]),
  );
  return { outer: rings[0], holes: rings.slice(1) };
}
let lakeRings: LakeRings | null = null;
try {
  lakeRings = loadLakeRings();
} catch (err) {
  console.warn(
    `Could not load the lake boundary from ${LAKE_GEOJSON_PATH} (${(err as Error).message}) — ` +
      'fish sighting coordinates will fall back to unjittered station anchors instead of being ' +
      'verified against the real shoreline.',
  );
}

// Standard ray-casting point-in-polygon test.
function pointInRing(lat: number, lng: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function isInLake(lat: number, lng: number): boolean {
  if (!lakeRings) return true; // boundary failed to load — don't block seeding, see warning above
  if (!pointInRing(lat, lng, lakeRings.outer)) return false;
  return !lakeRings.holes.some((hole) => pointInRing(lat, lng, hole));
}

// Jitters a point around a known-in-lake anchor, shrinking the jitter radius
// each retry until the result actually verifies as inside the lake polygon
// (a plain random offset could easily land on shore or on a small islet,
// which is exactly the bug this replaced — fish sightings showing up on
// land). Falls back to the exact anchor coordinates if every retry misses,
// which is always safe since anchors are themselves verified in-lake below.
function randomInLakePoint(anchorLat: number, anchorLng: number, maxJitterDeg: number): { lat: number; lng: number } {
  for (let attempt = 0; attempt < 10; attempt++) {
    const jitter = maxJitterDeg * (1 - attempt / 10);
    const lat = anchorLat + randRange(-jitter, jitter);
    const lng = anchorLng + randRange(-jitter, jitter);
    if (isInLake(lat, lng)) return { lat, lng };
  }
  return { lat: anchorLat, lng: anchorLng };
}

// LAKE_SITES (real water-quality sampling coordinates, defined above) reused
// as fish-sighting anchors — actual in-lake points, unlike municipality town
// centers (which are on land and were the original bug here). Verified
// in-lake individually rather than assumed, in case any real coordinate sits
// right at the shoreline.
const LAKE_SITE_ANCHORS = LAKE_SITES.filter((s) => {
  const ok = isInLake(s.latitude, s.longitude);
  if (!ok) {
    console.warn(`Lake site ${s.siteId} (${s.latitude}, ${s.longitude}) resolves outside the lake polygon — excluded as a fish-sighting anchor.`);
  }
  return ok;
});

// Deterministic PRNG (mulberry32) so re-running against a fresh DB always
// produces the same dataset without committing hundreds of literal rows.
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260930);
function randRange(min: number, max: number): number {
  return min + rand() * (max - min);
}
function randInt(min: number, max: number): number {
  return Math.floor(randRange(min, max + 1));
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

interface FishSpeciesDef {
  scientific: string;
  common: string;
  status: ConservationStatus;
  lengthRangeCm: [number, number];
  weightRangeG: [number, number];
}

// Real endemic Lake Lanao cyprinids (genus Barbodes, formerly Puntius) —
// historically ~20 endemic species, now believed reduced to just two
// (B. lindog, B. tumba) still confirmed in the lake. B. lindog, B. tumba and
// B. sirang carry real, sourced Critically Endangered status; the remaining
// species here are real described taxa but their current status is
// unassessed/unknown in the wild, so the statuses below for those are a
// synthetic spread (Endangered/Vulnerable/Not Evaluated) chosen only to give
// this QA dataset coverage of every dashboard status bucket — not a claim
// about real current IUCN status.
const ENDEMIC_SPECIES: FishSpeciesDef[] = [
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

// Introduced species documented as drivers of the endemic cyprinid decline
// (Glossogobius giuris introduced in the 1960s; Oreochromis niloticus; and
// Giuris margaritacea, now the dominant catch in lake landings), plus two
// generic aquaculture escapees widely present in Philippine lakes generally.
// Conservation statuses reflect these species' real (Least Concern/globally
// widespread) IUCN standing, unlike the endemic list above.
const INVASIVE_SPECIES: FishSpeciesDef[] = [
  { scientific: 'Glossogobius giuris', common: 'White Goby', status: ConservationStatus.LEAST_CONCERN, lengthRangeCm: [15, 35], weightRangeG: [50, 400] },
  { scientific: 'Giuris margaritacea', common: 'Snakehead Gudgeon', status: ConservationStatus.LEAST_CONCERN, lengthRangeCm: [10, 25], weightRangeG: [30, 250] },
  { scientific: 'Oreochromis niloticus', common: 'Nile Tilapia', status: ConservationStatus.LEAST_CONCERN, lengthRangeCm: [15, 35], weightRangeG: [100, 800] },
  { scientific: 'Hypseleotris agilis', common: 'Agile Gudgeon', status: ConservationStatus.NOT_EVALUATED, lengthRangeCm: [4, 8], weightRangeG: [2, 15] },
  { scientific: 'Cyprinus carpio', common: 'Common Carp', status: ConservationStatus.LEAST_CONCERN, lengthRangeCm: [20, 50], weightRangeG: [300, 2500] },
  { scientific: 'Clarias gariepinus', common: 'African Catfish', status: ConservationStatus.LEAST_CONCERN, lengthRangeCm: [25, 60], weightRangeG: [200, 2000] },
];

// Approximate centers for lake-adjacent Lanao del Sur municipalities — used
// only to LABEL a sighting with its nearest municipality/barangay (see
// nearestMunicipality below), never as the sighting's own coordinates. Town
// centers sit on land, sometimes km from the shore, so using them directly
// as fish-sighting locations (the original bug here) put fish outside the
// lake entirely.
const MUNICIPALITY_LABELS: { municipal: string; barangay: string; latitude: number; longitude: number }[] = [
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

function nearestMunicipality(
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

const GENERAL_SIZE_CATEGORIES = ['Small', 'Medium', 'Large'];

function randomDateObserved(yearStart: number, yearEnd: number): string {
  const year = randInt(yearStart, yearEnd);
  const month = randInt(1, 12);
  const day = randInt(1, 28);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function seedFishObservations() {
  const repo = dataSource.getRepository(FishObservationEntity);
  const existingCount = await repo.count();
  if (existingCount > 0) {
    console.log(`${existingCount} fish observation(s) already seeded — skipping.`);
    return;
  }

  const entities: FishObservationEntity[] = [];

  function addSighting(
    category: FishCategory,
    species: FishSpeciesDef | null,
    reviewStatus: ReviewStatus = ReviewStatus.APPROVED,
  ) {
    const anchor = pick(LAKE_SITE_ANCHORS);
    const { lat, lng } = randomInLakePoint(
      anchor.latitude,
      anchor.longitude,
      0.006,
    );
    const { municipal, barangay } = nearestMunicipality(lat, lng);
    entities.push(
      repo.create({
        researcherId: randInt(1, 3),
        category,
        speciesScientific: species?.scientific ?? null,
        speciesCommon: species?.common ?? null,
        conservationStatus: species?.status ?? ConservationStatus.NOT_EVALUATED,
        trueLengthCm: species ? Number(randRange(...species.lengthRangeCm).toFixed(1)) : null,
        bodyDepthCm: species
          ? Number(randRange(species.lengthRangeCm[0] * 0.2, species.lengthRangeCm[1] * 0.3).toFixed(1))
          : null,
        weightG: species ? Number(randRange(...species.weightRangeG).toFixed(0)) : null,
        depthM: category === FishCategory.GENERAL ? Number(randRange(1, 18).toFixed(1)) : null,
        count: category === FishCategory.GENERAL ? randInt(1, 40) : null,
        sizeCategory: category === FishCategory.GENERAL ? pick(GENERAL_SIZE_CATEGORIES) : null,
        location: toGeoPoint(lat, lng),
        municipal,
        barangay,
        dateObserved: randomDateObserved(2024, 2025),
        notes: null,
        reviewStatus,
        reviewedBy: reviewStatus === ReviewStatus.PENDING ? null : 'seed script',
        reviewedAt: reviewStatus === ReviewStatus.PENDING ? null : new Date(),
      }),
    );
  }

  ENDEMIC_SPECIES.forEach((species) => {
    const sightings = randInt(4, 8);
    for (let i = 0; i < sightings; i++) addSighting(FishCategory.ENDEMIC, species);
  });

  INVASIVE_SPECIES.forEach((species) => {
    const sightings = randInt(6, 11);
    for (let i = 0; i < sightings; i++) addSighting(FishCategory.INVASIVE, species);
  });

  for (let i = 0; i < 30; i++) addSighting(FishCategory.GENERAL, null);

  // A handful still awaiting review / rejected, so the admin review queue
  // and a researcher's "mine" view have something to test too — not just the
  // approved-only Dashboard Analytics.
  for (let i = 0; i < 6; i++) addSighting(FishCategory.ENDEMIC, pick(ENDEMIC_SPECIES), ReviewStatus.PENDING);
  for (let i = 0; i < 4; i++) addSighting(FishCategory.INVASIVE, pick(INVASIVE_SPECIES), ReviewStatus.REJECTED);

  await repo.save(entities);
  console.log(
    `Seeded ${entities.length} fish observations (${ENDEMIC_SPECIES.length} endemic + ${INVASIVE_SPECIES.length} invasive species, plus general catch and a few pending/rejected samples).`,
  );
}

async function seed() {
  await dataSource.initialize();
  await seedAdmin();
  await seedStations();
  await seedFishObservations();
  await dataSource.destroy();
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
