import { AfterLoad, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { GeoPoint } from '../../common/geo';
import { latOf, lngOf } from '../../common/geo';

// Fixed sampling grid across Lake Lanao — generated once (see
// seed-bathymetry-grid.ts) at ~500m spacing, clipped to the lake boundary
// via PostGIS ST_Contains, and never regenerated afterward. Every
// bathymetry upload, no matter how many raw soundings it contains, gets
// snapped onto these points (BathymetryService.create) rather than stored
// as arbitrary raw geometry — this is what keeps storage and rendering
// bounded (a few hundred rows) regardless of how large an upload is.
@Entity('bathymetry_points')
export class BathymetryPointEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ spatial: true })
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location: GeoPoint;

  // The most recent survey to cover this point wins outright (no blending
  // across surveys) — matches how "the active survey" already worked
  // before this point ever had its own history.
  @Column({ type: 'double precision', nullable: true })
  currentDepth?: number | null;

  @Column({ type: 'int', nullable: true })
  lastSurveyId?: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastUpdatedAt?: Date | null;

  // Not columns — derived from `location` so API responses keep the same
  // flat {lat, lng} shape every other entity in this app already exposes.
  lat: number;
  lng: number;

  @AfterLoad()
  private splitLocation(): void {
    this.lat = latOf(this.location);
    this.lng = lngOf(this.location);
  }
}
