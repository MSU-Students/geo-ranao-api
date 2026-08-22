import * as bcrypt from 'bcrypt';
import dataSource from './data-source';
import { UserEntity, UserRole, AccountStatus } from '../users/entities/user.entity';
import { StationEntity, StationZone } from '../stations/entities/station.entity';

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
    ...LAKE_SITES.map((s) => repo.create(s)),
    ...RIVER_SITES.map((s) => repo.create({ ...s, stationId: undefined, zone: StationZone.RIVER })),
  ];
  await repo.save(rows);
  console.log(`Seeded ${rows.length} stations (${LAKE_SITES.length} lake sites + ${RIVER_SITES.length} rivers).`);
}

async function seed() {
  await dataSource.initialize();
  await seedAdmin();
  await seedStations();
  await dataSource.destroy();
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
