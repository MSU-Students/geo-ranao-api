import { MigrationInterface, QueryRunner } from 'typeorm';

// Photos moved from local disk to Supabase Storage — the column now holds a
// Storage object key instead of a local filename.
export class PhotoStoragePath1787134855484 implements MigrationInterface {
  name = 'PhotoStoragePath1787134855484';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fish_observation_photos" RENAME COLUMN "storedFileName" TO "storagePath"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fish_observation_photos" RENAME COLUMN "storagePath" TO "storedFileName"`,
    );
  }
}
