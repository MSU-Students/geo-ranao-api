import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { GeoPoint } from '../../common/geo';
import { BathymetrySurveyEntity } from './bathymetry-survey.entity';

// One depth sounding within a survey — split out from the survey's old
// `points` JSONB blob so each point is its own indexed PostGIS location.
// A single opaque array-per-survey can't be spatially queried per point;
// this shape is what nearest-sounding lookups, clipping to the lake
// boundary, etc. need later.
@Entity('bathymetry_soundings')
export class BathymetrySoundingEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => BathymetrySurveyEntity, (survey) => survey.soundings, {
    onDelete: 'CASCADE',
  })
  survey: BathymetrySurveyEntity;

  @Column()
  surveyId: number;

  @Index({ spatial: true })
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location: GeoPoint;

  @Column({ type: 'double precision' })
  depth: number;
}
