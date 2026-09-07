import { MigrationInterface, QueryRunner } from 'typeorm';

// Collapses the separate latitude/longitude columns on fish_observations into
// a single free-text "coordinates" column ("lat, lng"), matching the format
// the Others/General form already collects and everywhere the frontend
// already displays a location back to the user.
export class FishObservationCoordinates1788531617681 implements MigrationInterface {
  name = 'FishObservationCoordinates1788531617681';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "fish_observations" ADD COLUMN "coordinates" character varying`);
    await queryRunner.query(`
      UPDATE "fish_observations"
      SET "coordinates" = concat("latitude", ', ', "longitude")
      WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL
    `);
    await queryRunner.query(`ALTER TABLE "fish_observations" DROP COLUMN "latitude"`);
    await queryRunner.query(`ALTER TABLE "fish_observations" DROP COLUMN "longitude"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "fish_observations" ADD COLUMN "latitude" double precision`);
    await queryRunner.query(`ALTER TABLE "fish_observations" ADD COLUMN "longitude" double precision`);
    await queryRunner.query(`
      UPDATE "fish_observations"
      SET
        "latitude" = NULLIF(split_part("coordinates", ',', 1), '')::double precision,
        "longitude" = NULLIF(trim(split_part("coordinates", ',', 2)), '')::double precision
      WHERE "coordinates" IS NOT NULL
    `);
    await queryRunner.query(`ALTER TABLE "fish_observations" DROP COLUMN "coordinates"`);
  }
}
