import { MigrationInterface, QueryRunner } from 'typeorm';

// Makes fish_observations.dateObserved nullable so the Phase 0 sample-data
// seed can insert records with a missing date (counted as "Undated" everywhere
// in the UI, never silently dropped or fabricated).
export class FishDateObservedNullable1791100000000 implements MigrationInterface {
  name = 'FishDateObservedNullable1791100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "fish_observations"
        ALTER COLUMN "dateObserved" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Backfill any nulls with a placeholder before restoring NOT NULL so the
    // revert doesn't fail on existing Undated rows.
    await queryRunner.query(`
      UPDATE "fish_observations"
        SET "dateObserved" = '1970-01-01'
      WHERE "dateObserved" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "fish_observations"
        ALTER COLUMN "dateObserved" SET NOT NULL
    `);
  }
}
