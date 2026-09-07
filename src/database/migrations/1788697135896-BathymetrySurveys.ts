import { MigrationInterface, QueryRunner } from 'typeorm';

export class BathymetrySurveys1788697135896 implements MigrationInterface {
  name = 'BathymetrySurveys1788697135896';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "bathymetry_surveys_reviewstatus_enum" AS ENUM ('PENDING', 'APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "bathymetry_surveys" (
        "id" SERIAL NOT NULL,
        "researcherId" integer NOT NULL,
        "label" character varying NOT NULL,
        "surveyDate" date NOT NULL,
        "points" jsonb NOT NULL,
        "pointCount" integer NOT NULL,
        "cleanedCount" integer NOT NULL DEFAULT 0,
        "reviewStatus" "bathymetry_surveys_reviewstatus_enum" NOT NULL DEFAULT 'PENDING',
        "reviewNote" text,
        "reviewedBy" character varying,
        "reviewedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bathymetry_surveys_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_bathy_surveyDate" ON "bathymetry_surveys" ("surveyDate")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "bathymetry_surveys"`);
    await queryRunner.query(`DROP TYPE "bathymetry_surveys_reviewstatus_enum"`);
  }
}
