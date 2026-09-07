import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

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
// rendered (buildDepthGridFromPoints / marchContourLevel on the frontend),
// so only the cleaned source points need to be stored here — same approach
// the admin's old session-only preview used, just persisted and reviewed.
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

  @Column({ type: 'jsonb' })
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
}
