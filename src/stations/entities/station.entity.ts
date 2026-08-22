import { Column, Entity, PrimaryColumn } from 'typeorm';

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

  @Column({ type: 'double precision' })
  latitude: number;

  @Column({ type: 'double precision' })
  longitude: number;

  @Column({ type: 'enum', enum: StationZone })
  zone: StationZone;
}
