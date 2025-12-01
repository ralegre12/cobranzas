// src/entities/payment.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Case } from './case.entity';

@Entity({ name: 'payments' })
@Index('idx_payments_case', ['case'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Case, (c) => c.payments, { nullable: true })
  @JoinColumn({ name: 'caseId' }) // ← coincide con la col "caseId" de 0001
  case?: Case | null;

  @Column({ type: 'varchar', length: 50, default: 'MP' })
  provider!: string;

  @Column({ name: 'preferenceId', type: 'varchar', length: 255, nullable: true })
  preferenceId?: string | null;

  @Column({ name: 'paymentId', type: 'varchar', length: 255, nullable: true, unique: true })
  paymentId?: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  amount?: number | null;

  @Column({ type: 'varchar', length: 50, default: 'PENDING' })
  status!: string;

  @Column({ name: 'accreditedAt', type: 'timestamptz', nullable: true })
  accreditedAt?: Date | null;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;

  @Column({ type: 'jsonb', nullable: true, default: () => `'{}'::jsonb` })
  metadata?: Record<string, any> | null;
}
