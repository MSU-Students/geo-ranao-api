import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BathymetrySurveyEntity } from './bathymetry-survey.entity';
import { BathymetryPointEntity } from './bathymetry-point.entity';

// One (survey, fixed point) reading — the average of every raw uploaded
// sounding that snapped nearest to that fixed point in this survey. This is
// an audit trail of what each survey contributed, not what rendering reads
// from directly (see BathymetryPointEntity.currentDepth for that); it
// exists so retracting a survey (BathymetryService.remove) can recompute
// what each affected point's currentDepth should revert to.
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

  @ManyToOne(() => BathymetryPointEntity, { onDelete: 'RESTRICT' })
  point: BathymetryPointEntity;

  @Column()
  pointId: number;

  @Column({ type: 'double precision' })
  depth: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
