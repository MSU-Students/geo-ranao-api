import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import dataSource from './data-source';
import { UserEntity, UserRole, AccountStatus } from '../users/entities/user.entity';
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
  createRandomGenerator,
  isInLake,
  pointInRing,
  ENDEMIC_SPECIES,
  INVASIVE_SPECIES,
  FishSpeciesDef,
  GENERAL_SIZE_CATEGORIES,
} from './seed-fish-helper';

// Refuse to run in production without explicit flag
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SAMPLE_SEED !== 'true') {
  console.error('ERROR: Refusing to run seed:fish-timeseries in production unless ALLOW_SAMPLE_SEED=true');
  process.exit(1);
}

// ── Municipal Zones GeoJSON loading for zone-aware point generation ──
const ZONES_GEOJSON_PATH = path.resolve(
  __dirname,
  '../../../geo-ranao-front-end/public/geo/Municipal-Water-Zones.geojson',
);

interface MunicipalZoneDef {
  name: string;
  ring: [number, number][];
  labelLat: number;
  labelLng: number;
}

interface ZoneFeature {
  type: string;
  properties?: { name?: string; labelLat?: number; labelLng?: number };
  geometry: { type: string; coordinates: [number, number][][] };
}

interface ZoneGeoJson {
  type: string;
  features: ZoneFeature[];
}

function loadMunicipalZones(): MunicipalZoneDef[] {
  try {
    const raw = fs.readFileSync(ZONES_GEOJSON_PATH, 'utf8');
    const geojson = JSON.parse(raw) as ZoneGeoJson;
    return geojson.features
      .filter((f) => f.geometry?.type === 'Polygon')
      .map((f) => {
        const name = f.properties?.name ?? 'Unknown';
        const labelLat = f.properties?.labelLat ?? 7.85;
        const labelLng = f.properties?.labelLng ?? 124.25;
        const outerRing = f.geometry.coordinates[0] ?? [];
        const ring: [number, number][] = outerRing.map(([lng, lat]) => [lat!, lng!]);
        return { name, ring, labelLat, labelLng };
      });
  } catch (err) {
    console.warn(`Could not load municipal zones from ${ZONES_GEOJSON_PATH}: ${(err as Error).message}`);
    return [];
  }
}

const zones = loadMunicipalZones();

function findZoneForPoint(lat: number, lng: number): string | null {
  for (const zone of zones) {
    if (pointInRing(lat, lng, zone.ring)) return zone.name;
  }
  return null;
}

// Deterministic PRNG with fixed seed
const rng = createRandomGenerator(20261004);

function randomPointInZone(zoneName: string): { lat: number; lng: number } {
  const zone = zones.find((z) => z.name === zoneName);
  const anchorLat = zone ? zone.labelLat : 7.89;
  const anchorLng = zone ? zone.labelLng : 124.27;

  for (let attempt = 0; attempt < 25; attempt++) {
    const jitter = 0.02 * (1 - attempt / 25);
    const lat = anchorLat + rng.randRange(-jitter, jitter);
    const lng = anchorLng + rng.randRange(-jitter, jitter);
    if (isInLake(lat, lng)) {
      const foundZone = findZoneForPoint(lat, lng);
      if (foundZone === zoneName || attempt > 15) {
        return { lat, lng };
      }
    }
  }

  // Fallback to general lake anchor
  const fallbackAnchor = rng.pick(LAKE_SITE_ANCHORS);
  return { lat: fallbackAnchor.latitude, lng: fallbackAnchor.longitude };
}

function randomDateInYear(year: number, currentYearMonthMax = 10): string {
  const month = year === 2026 ? rng.randInt(1, currentYearMonthMax) : rng.randInt(1, 12);
  const day = rng.randInt(1, 28);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function getOrCreateSampleUser(userRepo: ReturnType<typeof dataSource.getRepository<UserEntity>>) {
  const email = 'sample.researcher@example.invalid';
  let user = await userRepo.findOne({ where: { email } });
  if (!user) {
    const hashed = await bcrypt.hash('SamplePass123!', 10);
    user = userRepo.create({
      fullName: 'Sample Researcher (Time-Series)',
      email,
      password: hashed,
      role: UserRole.RESEARCHER,
      status: AccountStatus.APPROVED,
      affiliation: 'Mindanao State University - Marawi',
      purposeOfRequest: 'Sample data generation for FishNet time-series testing',
      reviewedAt: new Date(),
      reviewedBy: 'sample seed',
    });
    user = await userRepo.save(user);
    console.log(`Created sample researcher user: ${email}`);
  } else {
    console.log(`Found sample researcher user: ${email} (ID: ${user.id})`);
  }
  return user;
}

async function seedFishTimeSeries() {
  await dataSource.initialize();
  console.log('--- Starting Additive Fish Time-Series Data Seed ---');

  const userRepo = dataSource.getRepository(UserEntity);
  const fishRepo = dataSource.getRepository(FishObservationEntity);

  const sampleUser = await getOrCreateSampleUser(userRepo);
  const recordsToSave: FishObservationEntity[] = [];

  function createRecord(
    category: FishCategory,
    species: FishSpeciesDef | null,
    targetMuni: string | null,
    year: number | null,
    notesSuffix = '',
    customLocation?: { lat: number; lng: number } | null,
  ): FishObservationEntity {
    let lat: number | null = null;
    let lng: number | null = null;

    if (customLocation !== undefined) {
      if (customLocation) {
        lat = customLocation.lat;
        lng = customLocation.lng;
      }
    } else if (targetMuni && targetMuni !== 'Unmapped Waters') {
      const pt = randomPointInZone(targetMuni);
      lat = pt.lat;
      lng = pt.lng;
    } else {
      const anchor = rng.pick(LAKE_SITE_ANCHORS);
      lat = anchor.latitude;
      lng = anchor.longitude;
    }

    const dateObserved = year ? randomDateInYear(year) : null;
    const resolvedMuni = targetMuni ?? (lat && lng ? findZoneForPoint(lat, lng) : null) ?? 'Marawi City';

    return fishRepo.create({
      researcherId: sampleUser.id,
      category,
      speciesScientific: species?.scientific ?? null,
      speciesCommon: species?.common ?? null,
      conservationStatus: species?.status ?? ConservationStatus.NOT_EVALUATED,
      trueLengthCm: species ? Number(rng.randRange(...species.lengthRangeCm).toFixed(1)) : null,
      bodyDepthCm: species
        ? Number(rng.randRange(species.lengthRangeCm[0] * 0.2, species.lengthRangeCm[1] * 0.3).toFixed(1))
        : null,
      weightG: species ? Number(rng.randRange(...species.weightRangeG).toFixed(0)) : null,
      depthM: category === FishCategory.GENERAL ? Number(rng.randRange(1, 18).toFixed(1)) : null,
      count: category === FishCategory.GENERAL ? rng.randInt(1, 40) : 1,
      sizeCategory: category === FishCategory.GENERAL ? rng.pick(GENERAL_SIZE_CATEGORIES) : null,
      location: lat !== null && lng !== null ? toGeoPoint(lat, lng) : null,
      municipal: resolvedMuni,
      barangay: 'Poblacion',
      dateObserved: dateObserved as string, // entity handles null if marked nullable
      notes: `[SAMPLE DATA] ${notesSuffix}`.trim(),
      reviewStatus: ReviewStatus.APPROVED,
      reviewedBy: 'sample seed',
      reviewedAt: new Date(),
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // PATTERN 1: Invasion Alert - Marawi City (Invasive share rises each year)
  // 2022: 12 records (10 Endemic, 2 Invasive)
  // 2023: 14 records (9 Endemic, 5 Invasive)
  // 2024: 14 records (5 Endemic, 9 Invasive)
  // 2025: 15 records (3 Endemic, 12 Invasive)
  // 2026: 12 records (1 Endemic, 11 Invasive)
  // ══════════════════════════════════════════════════════════════════
  const marawiPattern = [
    { year: 2022, endemic: 10, invasive: 2 },
    { year: 2023, endemic: 9, invasive: 5 },
    { year: 2024, endemic: 5, invasive: 9 },
    { year: 2025, endemic: 3, invasive: 12 },
    { year: 2026, endemic: 1, invasive: 11 },
  ];
  for (const item of marawiPattern) {
    for (let i = 0; i < item.endemic; i++) {
      const sp = rng.pick(ENDEMIC_SPECIES);
      recordsToSave.push(createRecord(FishCategory.ENDEMIC, sp, 'Marawi City', item.year, 'Marawi trend observation'));
    }
    for (let i = 0; i < item.invasive; i++) {
      const sp = rng.pick(INVASIVE_SPECIES);
      recordsToSave.push(createRecord(FishCategory.INVASIVE, sp, 'Marawi City', item.year, 'Marawi trend observation'));
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // PATTERN 2: Protection Priority / Watchlist - Bacolod-Kalawi
  // Barbodes lindog recorded in 2022 (4 records), 0 in 2023, 2024, 2025, 2026!
  // Other species continue steadily (8 records/year).
  // ══════════════════════════════════════════════════════════════════
  const lindog = ENDEMIC_SPECIES.find((s) => s.scientific === 'Barbodes lindog') || ENDEMIC_SPECIES[0];
  const otherEndemics = ENDEMIC_SPECIES.filter((s) => s.scientific !== 'Barbodes lindog');

  for (let i = 0; i < 4; i++) {
    recordsToSave.push(createRecord(FishCategory.ENDEMIC, lindog, 'Bacolod-Kalawi', 2022, 'Historic Lindog sighting'));
  }
  for (const year of [2022, 2023, 2024, 2025, 2026]) {
    for (let i = 0; i < 4; i++) {
      const sp = rng.pick(otherEndemics);
      recordsToSave.push(createRecord(FishCategory.ENDEMIC, sp, 'Bacolod-Kalawi', year, 'Bacolod-Kalawi regular survey'));
    }
    for (let i = 0; i < 4; i++) {
      const sp = rng.pick(INVASIVE_SPECIES);
      recordsToSave.push(createRecord(FishCategory.INVASIVE, sp, 'Bacolod-Kalawi', year, 'Bacolod-Kalawi regular survey'));
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // PATTERN 3: Insufficient Data - Madamba (only 2 records overall)
  // ══════════════════════════════════════════════════════════════════
  recordsToSave.push(createRecord(FishCategory.ENDEMIC, ENDEMIC_SPECIES[0], 'Madamba', 2023, 'Sparse Madamba record'));
  recordsToSave.push(createRecord(FishCategory.INVASIVE, INVASIVE_SPECIES[0], 'Madamba', 2025, 'Sparse Madamba record'));

  // ══════════════════════════════════════════════════════════════════
  // PATTERN 4: Stable - Bayang (steady ~10 records/year, balanced split)
  // ══════════════════════════════════════════════════════════════════
  for (const year of [2022, 2023, 2024, 2025, 2026]) {
    for (let i = 0; i < 6; i++) {
      const sp = rng.pick(ENDEMIC_SPECIES);
      recordsToSave.push(createRecord(FishCategory.ENDEMIC, sp, 'Bayang', year, 'Bayang stable monitoring'));
    }
    for (let i = 0; i < 4; i++) {
      const sp = rng.pick(INVASIVE_SPECIES);
      recordsToSave.push(createRecord(FishCategory.INVASIVE, sp, 'Bayang', year, 'Bayang stable monitoring'));
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // PATTERN 5: Monitoring Gap - Ganassi (records in 2022 & 2023, none in 2024-2026)
  // ══════════════════════════════════════════════════════════════════
  for (const year of [2022, 2023]) {
    for (let i = 0; i < 5; i++) {
      const sp = rng.pick(ENDEMIC_SPECIES);
      recordsToSave.push(createRecord(FishCategory.ENDEMIC, sp, 'Ganassi', year, 'Ganassi historical record'));
    }
    for (let i = 0; i < 3; i++) {
      const sp = rng.pick(INVASIVE_SPECIES);
      recordsToSave.push(createRecord(FishCategory.INVASIVE, sp, 'Ganassi', year, 'Ganassi historical record'));
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // BASELINE RECORDS for other major LGUs (Marantao, Taraka, Tugaya, Masiu, Ditsaan-Ramain, etc.)
  // ══════════════════════════════════════════════════════════════════
  const baselineLGUs = [
    'Marantao',
    'Taraka',
    'Tugaya',
    'Masiu',
    'Ditsaan-Ramain',
    'Poona Bayabao',
    'Balindong',
    'Tamparan',
    'Lumbatan',
  ];

  for (const lgu of baselineLGUs) {
    for (const year of [2022, 2023, 2024, 2025, 2026]) {
      const endemicCount = rng.randInt(2, 5);
      const invasiveCount = rng.randInt(2, 4);
      const generalCount = rng.randInt(0, 2);

      for (let i = 0; i < endemicCount; i++) {
        const sp = rng.pick(ENDEMIC_SPECIES);
        recordsToSave.push(createRecord(FishCategory.ENDEMIC, sp, lgu, year, 'Baseline monitoring'));
      }
      for (let i = 0; i < invasiveCount; i++) {
        const sp = rng.pick(INVASIVE_SPECIES);
        recordsToSave.push(createRecord(FishCategory.INVASIVE, sp, lgu, year, 'Baseline monitoring'));
      }
      for (let i = 0; i < generalCount; i++) {
        recordsToSave.push(createRecord(FishCategory.GENERAL, null, lgu, year, 'General catch catch record'));
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // SPECIAL TEST RECORDS
  // 1. Missing dateObserved (3 records)
  // 2. Missing coordinates (1 record)
  // 3. Unmatched municipality string (1 record)
  // ══════════════════════════════════════════════════════════════════
  recordsToSave.push(
    createRecord(FishCategory.ENDEMIC, ENDEMIC_SPECIES[1], 'Marawi City', null, 'Undated sample observation 1'),
  );
  recordsToSave.push(
    createRecord(FishCategory.INVASIVE, INVASIVE_SPECIES[1], 'Taraka', null, 'Undated sample observation 2'),
  );
  recordsToSave.push(
    createRecord(FishCategory.GENERAL, null, 'Bayang', null, 'Undated general catch sample'),
  );

  // Missing coordinates (location: null)
  recordsToSave.push(
    createRecord(
      FishCategory.ENDEMIC,
      ENDEMIC_SPECIES[2],
      'Marantao',
      2024,
      'Record without geographic coordinates',
      null,
    ),
  );

  // Unmatched municipality
  recordsToSave.push(
    createRecord(
      FishCategory.INVASIVE,
      INVASIVE_SPECIES[2],
      'Unmapped Waters',
      2025,
      'Record with unrecognized municipality text',
    ),
  );

  // Save all records
  await fishRepo.save(recordsToSave);
  console.log(`Saved ${recordsToSave.length} sample fish observation records.`);

  // ══════════════════════════════════════════════════════════════════
  // SUMMARY REPORTING & VERIFICATION
  // ══════════════════════════════════════════════════════════════════
  const allSampleRecords = await fishRepo.createQueryBuilder('f')
    .where("f.notes LIKE '[SAMPLE DATA]%'")
    .getMany();

  console.log('\n================ SEED VERIFICATION SUMMARY ================');
  console.log(`Total sample records in database: ${allSampleRecords.length}`);

  // Totals per Year
  const yearCounts: Record<string, number> = {};
  for (const r of allSampleRecords) {
    const yr = r.dateObserved ? r.dateObserved.split('-')[0] : 'Undated';
    yearCounts[yr] = (yearCounts[yr] || 0) + 1;
  }
  console.log('\n--- Totals per Year ---');
  console.table(yearCounts);

  // Totals per Category
  const catCounts: Record<string, number> = {};
  for (const r of allSampleRecords) {
    catCounts[r.category] = (catCounts[r.category] || 0) + 1;
  }
  console.log('--- Totals per Category ---');
  console.table(catCounts);

  // Totals per Stored Municipality
  const muniCounts: Record<string, number> = {};
  for (const r of allSampleRecords) {
    const m = r.municipal || 'Unmatched';
    muniCounts[m] = (muniCounts[m] || 0) + 1;
  }
  console.log('--- Totals per Stored Municipality ---');
  console.table(muniCounts);

  // Special Records Summary
  const undatedCount = allSampleRecords.filter((r) => !r.dateObserved).length;
  const noCoordsCount = allSampleRecords.filter((r) => !r.location).length;
  const unmatchedMuniCount = allSampleRecords.filter(
    (r) => !zones.some((z) => z.name.toLowerCase() === (r.municipal || '').trim().toLowerCase()),
  ).length;

  console.log('--- Special Data Quality Records ---');
  console.log(`Undated records: ${undatedCount}`);
  console.log(`Not on map (no coords): ${noCoordsCount}`);
  console.log(`Unmatched municipality: ${unmatchedMuniCount}`);
  console.log('===========================================================\n');

  await dataSource.destroy();
}

seedFishTimeSeries().catch((err) => {
  console.error('seed:fish-timeseries failed:', err);
  process.exit(1);
});
