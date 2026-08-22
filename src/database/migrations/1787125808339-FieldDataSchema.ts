import { MigrationInterface, QueryRunner } from 'typeorm';

export class FieldDataSchema1787125808339 implements MigrationInterface {
  name = 'FieldDataSchema1787125808339';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── stations (fixed reference data) ──
    await queryRunner.query(
      `CREATE TYPE "stations_zone_enum" AS ENUM ('NEARSHORE', 'OFFSHORE', 'TRIBUTARY', 'RIVER')`,
    );
    await queryRunner.query(`
      CREATE TABLE "stations" (
        "siteId" character varying NOT NULL,
        "stationId" character varying,
        "latitude" double precision NOT NULL,
        "longitude" double precision NOT NULL,
        "zone" "stations_zone_enum" NOT NULL,
        CONSTRAINT "PK_stations_siteId" PRIMARY KEY ("siteId")
      )
    `);

    // ── water_quality_readings ──
    await queryRunner.query(
      `CREATE TYPE "water_quality_readings_reviewstatus_enum" AS ENUM ('PENDING', 'APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "water_quality_readings" (
        "id" SERIAL NOT NULL,
        "researcherId" integer NOT NULL,
        "siteId" character varying NOT NULL,
        "dateObserved" date NOT NULL,
        "depthM" double precision NOT NULL,
        "temperature" double precision,
        "ph" double precision,
        "turbidity" double precision,
        "dissolvedOxygen" double precision,
        "conductivity" double precision,
        "tds" double precision,
        "tss" double precision,
        "phosphate" double precision,
        "ammonia" double precision,
        "nitrate" double precision,
        "nitrite" double precision,
        "sulfate" double precision,
        "chlorophyll" double precision,
        "notes" text,
        "batchId" uuid,
        "reviewStatus" "water_quality_readings_reviewstatus_enum" NOT NULL DEFAULT 'PENDING',
        "reviewNote" text,
        "reviewedBy" character varying,
        "reviewedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_water_quality_readings_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_water_quality_readings_siteId" FOREIGN KEY ("siteId") REFERENCES "stations"("siteId") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_wqr_siteId" ON "water_quality_readings" ("siteId")`);
    await queryRunner.query(`CREATE INDEX "IDX_wqr_dateObserved" ON "water_quality_readings" ("dateObserved")`);
    await queryRunner.query(`CREATE INDEX "IDX_wqr_batchId" ON "water_quality_readings" ("batchId")`);

    // ── fish_observations ──
    await queryRunner.query(
      `CREATE TYPE "fish_observations_category_enum" AS ENUM ('ENDEMIC', 'INVASIVE', 'GENERAL')`,
    );
    await queryRunner.query(`
      CREATE TYPE "fish_observations_conservationstatus_enum" AS ENUM (
        'CRITICALLY_ENDANGERED', 'ENDANGERED', 'VULNERABLE', 'LEAST_CONCERN', 'NOT_EVALUATED'
      )
    `);
    await queryRunner.query(
      `CREATE TYPE "fish_observations_reviewstatus_enum" AS ENUM ('PENDING', 'APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "fish_observations" (
        "id" SERIAL NOT NULL,
        "researcherId" integer NOT NULL,
        "category" "fish_observations_category_enum" NOT NULL,
        "speciesScientific" character varying,
        "speciesCommon" character varying,
        "conservationStatus" "fish_observations_conservationstatus_enum" NOT NULL DEFAULT 'NOT_EVALUATED',
        "trueLengthCm" double precision,
        "bodyDepthCm" double precision,
        "weightG" double precision,
        "depthM" double precision,
        "count" integer,
        "sizeCategory" character varying,
        "latitude" double precision,
        "longitude" double precision,
        "municipal" character varying,
        "barangay" character varying,
        "dateObserved" date NOT NULL,
        "notes" text,
        "reviewStatus" "fish_observations_reviewstatus_enum" NOT NULL DEFAULT 'PENDING',
        "reviewNote" text,
        "reviewedBy" character varying,
        "reviewedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fish_observations_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_fish_obs_category" ON "fish_observations" ("category")`);
    await queryRunner.query(`CREATE INDEX "IDX_fish_obs_dateObserved" ON "fish_observations" ("dateObserved")`);

    // ── fish_observation_photos ──
    await queryRunner.query(`
      CREATE TABLE "fish_observation_photos" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "observationId" integer NOT NULL,
        "storedFileName" character varying NOT NULL,
        "originalFileName" character varying NOT NULL,
        "mimeType" character varying NOT NULL,
        "sizeBytes" integer NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fish_observation_photos_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_fish_observation_photos_observationId" FOREIGN KEY ("observationId") REFERENCES "fish_observations"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "fish_observation_photos"`);
    await queryRunner.query(`DROP TABLE "fish_observations"`);
    await queryRunner.query(`DROP TYPE "fish_observations_reviewstatus_enum"`);
    await queryRunner.query(`DROP TYPE "fish_observations_conservationstatus_enum"`);
    await queryRunner.query(`DROP TYPE "fish_observations_category_enum"`);
    await queryRunner.query(`DROP TABLE "water_quality_readings"`);
    await queryRunner.query(`DROP TYPE "water_quality_readings_reviewstatus_enum"`);
    await queryRunner.query(`DROP TABLE "stations"`);
    await queryRunner.query(`DROP TYPE "stations_zone_enum"`);
  }
}
