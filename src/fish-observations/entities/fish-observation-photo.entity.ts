import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { FishObservationEntity } from './fish-observation.entity';

// Auto-expiring photo attachments (see PHOTO_RETENTION_DAYS) — the
// structured observation row is kept forever, only the raw image files are
// deleted on a schedule, per the Phase 1 decision to not retain photos
// long-term. Files live in Supabase Storage (private bucket); storagePath is
// the object key there, e.g. "1/3f2a...-lateral.jpg".
@Entity('fish_observation_photos')
export class FishObservationPhotoEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => FishObservationEntity, (observation) => observation.photos, {
    onDelete: 'CASCADE',
  })
  observation: FishObservationEntity;

  @Column()
  observationId: number;

  @Column()
  storagePath: string;

  @Column()
  originalFileName: string;

  @Column()
  mimeType: string;

  @Column({ type: 'int' })
  sizeBytes: number;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
