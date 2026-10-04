import { MigrationInterface, QueryRunner } from 'typeorm';

// Five lake sub-sites were seeded with zone='TRIBUTARY' by mistake (seed.ts
// originally copied this from a misleadingly-named frontend reference file,
// WQ-Sampling-Sites-Tributary.geojson, which despite its name holds lake
// sub-sites, not the 6 real tributary rivers). Confirmed against each
// station's sibling sub-site, which was seeded correctly:
//   S7B  -> NEARSHORE (sibling S7A is NEARSHORE)
//   S8A  -> NEARSHORE (sibling S8B is NEARSHORE)
//   S9B  -> NEARSHORE (sibling S9A is NEARSHORE)
//   S11A -> OFFSHORE  (sibling S11B is OFFSHORE)
//   S12A -> OFFSHORE  (sibling S12B is OFFSHORE)
// This mattered beyond cosmetics: the Download Center (DownloadCenterPage.vue)
// filters "Lake Stations" vs "Tributary Rivers" directly off this column, so
// these 5 real lake stations were being excluded from map/report downloads
// whenever "Include Tributary Rivers" was switched off.
export class FixStationZoneTypos1791041805414 implements MigrationInterface {
  name = 'FixStationZoneTypos1791041805414';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "stations" SET "zone" = 'NEARSHORE' WHERE "siteId" IN ('S7B', 'S8A', 'S9B')`,
    );
    await queryRunner.query(
      `UPDATE "stations" SET "zone" = 'OFFSHORE' WHERE "siteId" IN ('S11A', 'S12A')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "stations" SET "zone" = 'TRIBUTARY' WHERE "siteId" IN ('S7B', 'S8A', 'S9B', 'S11A', 'S12A')`,
    );
  }
}
