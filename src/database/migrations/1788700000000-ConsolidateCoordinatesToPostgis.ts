import { MigrationInterface, QueryRunner } from 'typeorm';

// Consolidates every separate-lat/lng or free-text-coordinate column into a
// real PostGIS geography(Point,4326), so spatial queries (nearest station,
// distance, containment within the lake boundary, etc.) are possible later:
//   - stations.latitude/longitude            -> stations.location
//   - fish_observations.coordinates (text)   -> fish_observations.location
//   - bathymetry_surveys.points (jsonb blob) -> bathymetry_soundings (one
//     PostGIS point + depth per row — a per-survey array can't be spatially
//     indexed or queried per point, a child table can)
export class ConsolidateCoordinatesToPostgis1788700000000 implements MigrationInterface {
  name = 'ConsolidateCoordinatesToPostgis1788700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "postgis"`);

    // ── stations: latitude/longitude -> location ──
    await queryRunner.query(`ALTER TABLE "stations" ADD COLUMN "location" geography(Point,4326)`);
    await queryRunner.query(`
      UPDATE "stations"
      SET "location" = ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography
    `);
    await queryRunner.query(`ALTER TABLE "stations" ALTER COLUMN "location" SET NOT NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_stations_location" ON "stations" USING GIST ("location")`);
    await queryRunner.query(`ALTER TABLE "stations" DROP COLUMN "latitude"`);
    await queryRunner.query(`ALTER TABLE "stations" DROP COLUMN "longitude"`);

    // ── fish_observations: coordinates ("lat, lng" text) -> location ──
    await queryRunner.query(`ALTER TABLE "fish_observations" ADD COLUMN "location" geography(Point,4326)`);
    await queryRunner.query(`
      UPDATE "fish_observations"
      SET "location" = ST_SetSRID(
        ST_MakePoint(
          trim(split_part("coordinates", ',', 2))::double precision,
          trim(split_part("coordinates", ',', 1))::double precision
        ),
        4326
      )::geography
      WHERE "coordinates" IS NOT NULL
        AND "coordinates" ~ '^\\s*-?\\d+(\\.\\d+)?\\s*,\\s*-?\\d+(\\.\\d+)?\\s*$'
    `);
    await queryRunner.query(`CREATE INDEX "IDX_fish_obs_location" ON "fish_observations" USING GIST ("location")`);
    await queryRunner.query(`ALTER TABLE "fish_observations" DROP COLUMN "coordinates"`);

    // ── bathymetry_surveys.points (jsonb [{lat,lng,depth}]) -> bathymetry_soundings ──
    await queryRunner.query(`
      CREATE TABLE "bathymetry_soundings" (
        "id" SERIAL NOT NULL,
        "surveyId" integer NOT NULL,
        "location" geography(Point,4326) NOT NULL,
        "depth" double precision NOT NULL,
        CONSTRAINT "PK_bathymetry_soundings_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_bathymetry_soundings_surveyId" FOREIGN KEY ("surveyId") REFERENCES "bathymetry_surveys"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      INSERT INTO "bathymetry_soundings" ("surveyId", "location", "depth")
      SELECT
        s."id",
        ST_SetSRID(ST_MakePoint((elem->>'lng')::double precision, (elem->>'lat')::double precision), 4326)::geography,
        (elem->>'depth')::double precision
      FROM "bathymetry_surveys" s, jsonb_array_elements(s."points") AS elem
    `);
    await queryRunner.query(`CREATE INDEX "IDX_bathymetry_soundings_surveyId" ON "bathymetry_soundings" ("surveyId")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_bathymetry_soundings_location" ON "bathymetry_soundings" USING GIST ("location")`,
    );
    await queryRunner.query(`ALTER TABLE "bathymetry_surveys" DROP COLUMN "points"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── bathymetry_surveys: rebuild points jsonb from bathymetry_soundings ──
    await queryRunner.query(`ALTER TABLE "bathymetry_surveys" ADD COLUMN "points" jsonb`);
    await queryRunner.query(`
      UPDATE "bathymetry_surveys" s
      SET "points" = COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object('lat', ST_Y(b."location"::geometry), 'lng', ST_X(b."location"::geometry), 'depth', b."depth")
          ORDER BY b."id"
        )
        FROM "bathymetry_soundings" b
        WHERE b."surveyId" = s."id"
      ), '[]'::jsonb)
    `);
    await queryRunner.query(`ALTER TABLE "bathymetry_surveys" ALTER COLUMN "points" SET NOT NULL`);
    await queryRunner.query(`DROP TABLE "bathymetry_soundings"`);

    // ── fish_observations: rebuild coordinates text from location ──
    await queryRunner.query(`ALTER TABLE "fish_observations" ADD COLUMN "coordinates" character varying`);
    await queryRunner.query(`
      UPDATE "fish_observations"
      SET "coordinates" = concat(ST_Y("location"::geometry), ', ', ST_X("location"::geometry))
      WHERE "location" IS NOT NULL
    `);
    await queryRunner.query(`DROP INDEX "IDX_fish_obs_location"`);
    await queryRunner.query(`ALTER TABLE "fish_observations" DROP COLUMN "location"`);

    // ── stations: rebuild latitude/longitude from location ──
    await queryRunner.query(`ALTER TABLE "stations" ADD COLUMN "latitude" double precision`);
    await queryRunner.query(`ALTER TABLE "stations" ADD COLUMN "longitude" double precision`);
    await queryRunner.query(`
      UPDATE "stations"
      SET "latitude" = ST_Y("location"::geometry), "longitude" = ST_X("location"::geometry)
    `);
    await queryRunner.query(`ALTER TABLE "stations" ALTER COLUMN "latitude" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "stations" ALTER COLUMN "longitude" SET NOT NULL`);
    await queryRunner.query(`DROP INDEX "IDX_stations_location"`);
    await queryRunner.query(`ALTER TABLE "stations" DROP COLUMN "location"`);
  }
}
