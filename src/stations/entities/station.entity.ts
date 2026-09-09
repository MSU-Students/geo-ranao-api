import { AfterLoad, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { GeoPoint } from '../../common/geo';
import { latOf, lngOf } from '../../common/geo';

export enum StationZone {
  NEARSHORE = 'NEARSHORE',
  OFFSHORE = 'OFFSHORE',
  TRIBUTARY = 'TRIBUTARY',
  RIVER = 'RIVER',
}

// Fixed sampling locations — seeded once from the frontend's reference
// GeoJSON (public/geo/WQ-All-Sampling-Sites.geojson) plus the 6 hardcoded
// tributary rivers. Coordinates never change; only readings taken at them do.
@Entity('stations')
export class StationEntity {
  @PrimaryColumn()
  siteId: string;

  @Column({ nullable: true })
  stationId?: string;

  // A real PostGIS point rather than separate lat/lng columns, so spatial
  // queries (nearest station, distance, containment) work later.
  @Index({ spatial: true })
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location: GeoPoint;

  @Column({ type: 'enum', enum: StationZone })
  zone: StationZone;

  // Not columns — derived from `location` so API responses keep the same
  // latitude/longitude shape the frontend already reads.
  latitude: number;
  longitude: number;

  @AfterLoad()
  private splitLocation(): void {
    this.latitude = latOf(this.location);
    this.longitude = lngOf(this.location);
  }
}
