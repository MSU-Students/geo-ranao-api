import * as bcrypt from 'bcrypt';
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
import {
  LAKE_SITES,
  LAKE_SITE_ANCHORS,
  randomInLakePoint,
  randRange,
  randInt,
  pick,
  ENDEMIC_SPECIES,
  INVASIVE_SPECIES,
  FishSpeciesDef,
  nearestMunicipality,
  GENERAL_SIZE_CATEGORIES,
  randomDateObserved,
} from './seed-fish-helper';

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
      repo.create({ siteId: s.siteId, stationId: s.stationId, location: toGeoPoint(s.latitude, s.longitude), zone: s.zone ?? StationZone.NEARSHORE }),
    ),
    ...RIVER_SITES.map((s) =>
      repo.create({ siteId: s.siteId, location: toGeoPoint(s.latitude, s.longitude), zone: StationZone.RIVER }),
    ),
  ];
  await repo.save(rows);
  console.log(`Seeded ${rows.length} stations (${LAKE_SITES.length} lake sites + ${RIVER_SITES.length} rivers).`);
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
