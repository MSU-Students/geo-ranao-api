import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// Wide table, one nullable column per parameter — mirrors the frontend's
// WaterQualityUploadRow.values map (src/composables/useWaterQualityUpload.ts)
// and the *_ppm/_c/_ntu XLSX template columns 1:1, so no per-parameter
// key/value normalization is needed on either side of the API.
@Entity('water_quality_readings')
export class WaterQualityReadingEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  researcherId: number;

  @Index()
  @Column()
  siteId: string;

  @Index()
  @Column({ type: 'date' })
  dateObserved: string;

  @Column({ type: 'double precision' })
  depthM: number;

  @Column({ type: 'double precision', nullable: true }) temperature?: number | null;
  @Column({ type: 'double precision', nullable: true }) ph?: number | null;
  @Column({ type: 'double precision', nullable: true }) turbidity?: number | null;
  @Column({ type: 'double precision', nullable: true }) dissolvedOxygen?: number | null;
  @Column({ type: 'double precision', nullable: true }) conductivity?: number | null;
  @Column({ type: 'double precision', nullable: true }) tds?: number | null;
  @Column({ type: 'double precision', nullable: true }) tss?: number | null;
  @Column({ type: 'double precision', nullable: true }) phosphate?: number | null;
  @Column({ type: 'double precision', nullable: true }) ammonia?: number | null;
  @Column({ type: 'double precision', nullable: true }) nitrate?: number | null;
  @Column({ type: 'double precision', nullable: true }) nitrite?: number | null;
  @Column({ type: 'double precision', nullable: true }) sulfate?: number | null;
  @Column({ type: 'double precision', nullable: true }) chlorophyll?: number | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  // Groups rows submitted together via one bulk-upload file so they can be
  // reviewed/approved/rejected as a single batch in the admin UI.
  @Index()
  @Column({ type: 'uuid', nullable: true })
  batchId?: string | null;

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
