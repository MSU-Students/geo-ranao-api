import { MigrationInterface, QueryRunner } from 'typeorm';

// Bathymetry moves from "store every raw uploaded sounding" to "snap every
// upload onto a fixed grid of points" (see seed-bathymetry-grid.ts, run
// after this migration to populate the grid, and BathymetryService.create
// for the snapping/averaging). Storage and rendering are now bounded by the
// fixed grid's size, not by how many rows an upload contains.
//
// bathymetry_soundings previously stored one row per raw uploaded point,
// each with its own PostGIS location. That data doesn't correspond to any
// fixed point (the grid didn't exist yet), so it's cleared rather than
// migrated — this project is still at the dev/demo stage (see
// reset-demo-data.ts, which already wipes this table routinely).
export class BathymetryFixedPoints1789952170561 implements MigrationInterface {
  name = 'BathymetryFixedPoints1789952170561';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "bathymetry_points" (
        "id" SERIAL NOT NULL,
        "location" geography(Point,4326) NOT NULL,
        "currentDepth" double precision,
        "lastSurveyId" integer,
        "lastUpdatedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_bathymetry_points_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_bathymetry_points_location" ON "bathymetry_points" USING GIST ("location")`);

    await queryRunner.query(`DELETE FROM "bathymetry_soundings"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bathymetry_soundings_location"`);
    await queryRunner.query(`ALTER TABLE "bathymetry_soundings" DROP COLUMN "location"`);
    await queryRunner.query(`ALTER TABLE "bathymetry_soundings" ADD COLUMN "pointId" integer NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "bathymetry_soundings" ADD COLUMN "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`
      ALTER TABLE "bathymetry_soundings"
      ADD CONSTRAINT "FK_bathymetry_soundings_pointId" FOREIGN KEY ("pointId") REFERENCES "bathymetry_points"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`CREATE INDEX "IDX_bathymetry_soundings_pointId" ON "bathymetry_soundings" ("pointId")`);

    await queryRunner.query(`ALTER TABLE "bathymetry_surveys" ADD COLUMN "pointsUpdated" integer NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bathymetry_surveys" DROP COLUMN "pointsUpdated"`);

    await queryRunner.query(`DELETE FROM "bathymetry_soundings"`);
    await queryRunner.query(`ALTER TABLE "bathymetry_soundings" DROP CONSTRAINT "FK_bathymetry_soundings_pointId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bathymetry_soundings_pointId"`);
    await queryRunner.query(`ALTER TABLE "bathymetry_soundings" DROP COLUMN "pointId"`);
    await queryRunner.query(`ALTER TABLE "bathymetry_soundings" DROP COLUMN "createdAt"`);
    await queryRunner.query(`ALTER TABLE "bathymetry_soundings" ADD COLUMN "location" geography(Point,4326)`);
    await queryRunner.query(`CREATE INDEX "IDX_bathymetry_soundings_location" ON "bathymetry_soundings" USING GIST ("location")`);
    // NOT NULL was dropped intentionally — there's no data to backfill it with.

    await queryRunner.query(`DROP TABLE "bathymetry_points"`);
  }
}
