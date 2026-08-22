import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitAuthSchema1787118150981 implements MigrationInterface {
  name = 'InitAuthSchema1787118150981';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "users_role_enum" AS ENUM ('RESEARCHER', 'ADMIN')`);
    await queryRunner.query(
      `CREATE TYPE "users_status_enum" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" SERIAL NOT NULL,
        "fullName" character varying NOT NULL,
        "email" character varying NOT NULL,
        "password" character varying NOT NULL,
        "role" "users_role_enum" NOT NULL DEFAULT 'RESEARCHER',
        "status" "users_status_enum" NOT NULL DEFAULT 'PENDING',
        "affiliation" character varying NOT NULL,
        "departmentRole" character varying,
        "purposeOfRequest" text NOT NULL,
        "reviewedAt" TIMESTAMP WITH TIME ZONE,
        "reviewedBy" character varying,
        "reviewNote" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_users_email" ON "users" ("email")`);

    await queryRunner.query(
      `CREATE TYPE "activity_logs_severity_enum" AS ENUM ('neutral', 'positive', 'warning', 'negative')`,
    );
    await queryRunner.query(`
      CREATE TABLE "activity_logs" (
        "id" SERIAL NOT NULL,
        "actor" character varying NOT NULL,
        "action" character varying NOT NULL,
        "detail" text NOT NULL,
        "severity" "activity_logs_severity_enum" NOT NULL DEFAULT 'neutral',
        "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_activity_logs_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "activity_logs"`);
    await queryRunner.query(`DROP TYPE "activity_logs_severity_enum"`);
    await queryRunner.query(`DROP INDEX "IDX_users_email"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "users_status_enum"`);
    await queryRunner.query(`DROP TYPE "users_role_enum"`);
  }
}
