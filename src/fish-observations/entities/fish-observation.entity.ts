import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FishObservationPhotoEntity } from './fish-observation-photo.entity';

export enum FishCategory {
  ENDEMIC = 'ENDEMIC',
  INVASIVE = 'INVASIVE',
  GENERAL = 'GENERAL',
}

export enum ConservationStatus {
  CRITICALLY_ENDANGERED = 'CRITICALLY_ENDANGERED',
  ENDANGERED = 'ENDANGERED',
  VULNERABLE = 'VULNERABLE',
  LEAST_CONCERN = 'LEAST_CONCERN',
  NOT_EVALUATED = 'NOT_EVALUATED',
}

export enum ReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('fish_observations')
export class FishObservationEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  researcherId: number;

  @Index()
  @Column({ type: 'enum', enum: FishCategory })
  category: FishCategory;

  @Column({ type: 'varchar', nullable: true })
  speciesScientific?: string | null;

  @Column({ type: 'varchar', nullable: true })
  speciesCommon?: string | null;

  @Column({ type: 'enum', enum: ConservationStatus, default: ConservationStatus.NOT_EVALUATED })
  conservationStatus: ConservationStatus;

  @Column({ type: 'double precision', nullable: true })
  trueLengthCm?: number | null;

  @Column({ type: 'double precision', nullable: true })
  bodyDepthCm?: number | null;

  @Column({ type: 'double precision', nullable: true })
  weightG?: number | null;

  // GENERAL category only
  @Column({ type: 'double precision', nullable: true })
  depthM?: number | null;

  @Column({ type: 'int', nullable: true })
  count?: number | null;

  @Column({ type: 'varchar', nullable: true })
  sizeCategory?: string | null;

  @Column({ type: 'double precision', nullable: true })
  latitude?: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude?: number | null;

  @Column({ type: 'varchar', nullable: true })
  municipal?: string | null;

  @Column({ type: 'varchar', nullable: true })
  barangay?: string | null;

  @Index()
  @Column({ type: 'date' })
  dateObserved: string;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'enum', enum: ReviewStatus, default: ReviewStatus.PENDING })
  reviewStatus: ReviewStatus;

  @Column({ type: 'text', nullable: true })
  reviewNote?: string | null;

  @Column({ type: 'varchar', nullable: true })
  reviewedBy?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt?: Date | null;

  @OneToMany(() => FishObservationPhotoEntity, (photo) => photo.observation)
  photos: FishObservationPhotoEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
