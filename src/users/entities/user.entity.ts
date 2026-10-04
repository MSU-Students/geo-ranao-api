import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  RESEARCHER = 'RESEARCHER',
  ADMIN = 'ADMIN',
}

export enum AccountStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fullName: string;

  @Index({ unique: true })
  @Column()
  email: string;

  // Nullable — a Google-only account (see GoogleStrategy / AuthService)
  // never sets a local password and can only ever log in via Google.
  // Explicit `type: 'varchar'` because reflect-metadata can't infer a
  // column type from a union (`string | null`) — see reviewedBy below for
  // the same pattern already in this file.
  @Column({ type: 'varchar', nullable: true })
  password: string | null; // hashed

  // Set once a Google identity is linked — either at signup (a brand-new
  // Google user) or on first Google login for an email that already had a
  // password account (see AuthService.findOrPrepareGoogleUser).
  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  googleId?: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.RESEARCHER })
  role: UserRole;

  @Column({ type: 'enum', enum: AccountStatus, default: AccountStatus.PENDING })
  status: AccountStatus;

  @Column()
  affiliation: string;

  @Column({ nullable: true })
  departmentRole?: string;

  @Column({ type: 'text' })
  purposeOfRequest: string;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt?: Date | null;

  @Column({ type: 'varchar', nullable: true })
  reviewedBy?: string | null;

  @Column({ type: 'text', nullable: true })
  reviewNote?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
