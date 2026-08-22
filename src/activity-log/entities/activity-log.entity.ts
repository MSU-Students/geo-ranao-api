import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum ActivitySeverity {
  NEUTRAL = 'neutral',
  POSITIVE = 'positive',
  WARNING = 'warning',
  NEGATIVE = 'negative',
}

@Entity('activity_logs')
export class ActivityLogEntity {
  @PrimaryGeneratedColumn()
  id: number;

  // Denormalized snapshot of the actor's name, not a live FK — kept readable
  // even after the acting account is later deleted (see UsersService.remove).
  @Column()
  actor: string;

  @Column()
  action: string;

  @Column({ type: 'text' })
  detail: string;

  @Column({ type: 'enum', enum: ActivitySeverity, default: ActivitySeverity.NEUTRAL })
  severity: ActivitySeverity;

  @CreateDateColumn({ type: 'timestamptz' })
  timestamp: Date;
}
