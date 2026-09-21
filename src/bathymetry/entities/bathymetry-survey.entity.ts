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
// flagged) before submission, then snapped server-side onto the fixed
// bathymetry_points grid — see BathymetryService.create. `pointCount` is
// the raw upload size; `pointsUpdated` is how many fixed points it actually
// touched after snapping/averaging, which is what bounds storage/rendering.
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

  // Per-(fixed point) readings this survey contributed — an audit trail,
  // not the render source (see BathymetryPointEntity.currentDepth for
  // that). `points` below is reassembled from it, in the same
  // [{lat,lng,depth}] shape clients already use, one row per fixed point
  // this survey touched (not one row per raw uploaded sounding).
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

  // How many distinct fixed points this survey actually updated, after
  // snapping every (post-cleaning) raw sounding to its nearest fixed point
  // and averaging. Always <= the total fixed-point grid size, regardless
  // of how large pointCount is.
  @Column({ type: 'int', default: 0 })
  pointsUpdated: number;

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
      this.points = this.soundings
        .filter((sounding) => sounding.point)
        .map((sounding) => ({
          lat: sounding.point.lat,
          lng: sounding.point.lng,
          depth: sounding.depth,
        }));
      this.soundings = undefined;
    }
  }
}
