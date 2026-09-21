import * as fs from 'fs';
import * as path from 'path';
import dataSource from './data-source';
import { BathymetryPointEntity } from '../bathymetry/entities/bathymetry-point.entity';
import { toGeoPoint } from '../common/geo';

/**
 * One-time generation of the fixed bathymetry sampling grid — every
 * bathymetry upload snaps onto these points (see BathymetryService.create)
 * instead of being stored as arbitrary raw geometry, so storage/rendering
 * stay bounded to this grid's size no matter how large an upload is.
 *
 * Candidate points are laid out on a ~500m lat/lng grid across the lake's
 * bounding box, then kept only if PostGIS says they fall inside the actual
 * lake boundary (ST_Contains against the MultiPolygon — islands are holes
 * in that geometry, so points on an island are correctly excluded too).
 *
 * Safe to re-run: no-ops if the grid already exists. There's no "update
 * the grid" story here on purpose — it's meant to be generated once and
 * left alone, the same way `stations` is fixed reference data.
 */

const GRID_SPACING_M = 500;
const EARTH_RADIUS_M = 6371000;
const BATCH_SIZE = 2000; // keeps each containment-check query's parameter count sane

interface Candidate {
  lat: number;
  lng: number;
}

function loadLakeGeoJson(): unknown {
  const filePath = path.join(__dirname, 'seed-assets', 'lake-lanao.geojson');
  const geojson = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
    features: { geometry: unknown }[];
  };
  const geometry = geojson.features[0]?.geometry;
  if (!geometry) throw new Error('lake-lanao.geojson has no features to read a boundary from.');
  return geometry;
}

function boundsOfMultiPolygon(geometry: { coordinates: [number, number][][][] }): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  // Only the outer ring of each polygon part is needed for a bounding box —
  // holes (islands) are always inside it.
  for (const polygon of geometry.coordinates) {
    const outerRing = polygon[0] ?? [];
    for (const [lng, lat] of outerRing) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  }
  return { minLat, maxLat, minLng, maxLng };
}

function buildCandidateGrid(bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }): Candidate[] {
  const midLatRad = ((bounds.minLat + bounds.maxLat) / 2) * (Math.PI / 180);
  const latStepDeg = (GRID_SPACING_M / EARTH_RADIUS_M) * (180 / Math.PI);
  const lngStepDeg = latStepDeg / Math.max(Math.cos(midLatRad), 0.1);

  const candidates: Candidate[] = [];
  for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += latStepDeg) {
    for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += lngStepDeg) {
      candidates.push({ lat, lng });
    }
  }
  return candidates;
}

async function seedBathymetryGrid() {
  await dataSource.initialize();

  const repo = dataSource.getRepository(BathymetryPointEntity);
  const existingCount = await repo.count();
  if (existingCount > 0) {
    console.log(`${existingCount} bathymetry point(s) already seeded — skipping.`);
    await dataSource.destroy();
    return;
  }

  const geometry = loadLakeGeoJson() as { coordinates: [number, number][][][] };
  const bounds = boundsOfMultiPolygon(geometry);
  const candidates = buildCandidateGrid(bounds);
  console.log(`Testing ${candidates.length} candidate grid point(s) at ~${GRID_SPACING_M}m spacing...`);

  const geometryJson = JSON.stringify(geometry);
  const accepted: Candidate[] = [];

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const values = batch.map((_, j) => `($${j * 3 + 1}::int, $${j * 3 + 2}::double precision, $${j * 3 + 3}::double precision)`).join(', ');
    const params: (number | string)[] = [];
    batch.forEach((c, j) => params.push(j, c.lat, c.lng));

    const rows = (await dataSource.query(
      `
        SELECT c.idx
        FROM (VALUES ${values}) AS c(idx, lat, lng)
        WHERE ST_Contains(
          ST_SetSRID(ST_GeomFromGeoJSON($${batch.length * 3 + 1}), 4326),
          ST_SetSRID(ST_MakePoint(c.lng, c.lat), 4326)
        )
      `,
      [...params, geometryJson],
    )) as { idx: number }[];

    for (const row of rows) accepted.push(batch[row.idx]!);
  }

  console.log(`${accepted.length} of ${candidates.length} candidate(s) fall inside the lake boundary.`);

  const pointRows = accepted.map((c) => repo.create({ location: toGeoPoint(c.lat, c.lng) }));
  await repo.save(pointRows);
  console.log(`Seeded ${pointRows.length} fixed bathymetry point(s).`);

  await dataSource.destroy();
}

seedBathymetryGrid().catch((err: unknown) => {
  console.error('Bathymetry grid seed failed:', err);
  process.exit(1);
});
