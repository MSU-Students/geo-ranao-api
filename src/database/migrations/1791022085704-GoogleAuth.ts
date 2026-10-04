import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds Google Sign-In alongside the existing email/password login — see
// GoogleStrategy and AuthService.findOrPrepareGoogleUser(). A user row can
// now exist with no local password at all (Google-only account), so
// "password" has to stop being NOT NULL; "googleId" links a row to its
// Google account, unique so the same Google identity can't claim two rows.
export class GoogleAuth1791022085704 implements MigrationInterface {
  name = 'GoogleAuth1791022085704';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "googleId" character varying`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_users_googleId" UNIQUE ("googleId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_users_googleId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "googleId"`);
    // Can't safely restore NOT NULL without knowing every row has a password
    // again (Google-only rows created in the meantime wouldn't) — left
    // nullable on rollback rather than risking a migration failure.
  }
}
