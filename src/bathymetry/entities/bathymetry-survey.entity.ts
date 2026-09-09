import {
  AfterLoad,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { latOf, lngOf } from '../../common/geo';
import { BathymetrySoundingEntity } from './bathymetry-sounding.entity';

export enum ReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface DepthSounding {
  lat: number;
  lng: number;
  depth: number;
}

// A researcher-submitted set of raw depth soundings, cleaned client-side
// (deduplicated, range-checked, filtered to the lake boundary, outliers
// flagged) before submission. Interpolating the points into a grid and
// extracting contour lines happens on demand wherever the survey is
// rendered (buildDepthGridFromPoints / marchContourLevel on the frontend).
@Entity('bathymetry_surveys')
export class BathymetrySurveyEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  researcherId: number;

  @Column()
  label: string;

  @Index()
  @Column({ type: 'date' })
  surveyDate: string;

  // Individual soundings live in bathymetry_soundings (one PostGIS point +
  // depth per row, see that entity) so they can be spatially indexed and
  // queried on their own — `points` below is reassembled from that relation
  // on load, in the same [{lat,lng,depth}] shape clients already use.
  @OneToMany(() => BathymetrySoundingEntity, (sounding) => sounding.survey)
  soundings?: BathymetrySoundingEntity[];

  points: DepthSounding[];

  @Column({ type: 'int' })
  pointCount: number;

  // Raw rows dropped during client-side cleaning (duplicates, out-of-range,
  // outside the lake boundary, statistical outliers) — shown to the admin
  // for transparency, never hidden.
  @Column({ type: 'int', default: 0 })
  cleanedCount: number;

  @Column({ type: 'enum', enum: ReviewStatus, default: ReviewStatus.PENDING })
  reviewStatus: ReviewStatus;

  @Column({ type: 'text', nullable: true })
  reviewNote?: string | null;

  @Column({ type: 'varchar', nullable: true })
  reviewedBy?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @AfterLoad()
  private hydratePoints(): void {
    if (this.soundings) {
      this.points = this.soundings.map((sounding) => ({
        lat: latOf(sounding.location),
        lng: lngOf(sounding.location),
        depth: sounding.depth,
      }));
      this.soundings = undefined;
    }
  }
}
