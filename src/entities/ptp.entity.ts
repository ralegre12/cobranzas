import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Case } from '@entities/case.entity'; // ajustá el import

@Entity({ name: 'ptp' })
export class Ptp {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_ptp_case')
  @ManyToOne(() => Case, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'case_id' })
  case!: Case;

  @Column({ type: 'date', name: 'promised_date' })
  promisedDate!: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, name: 'promised_amount' })
  promisedAmount!: string; // numeric en TS → string

  @Column({ type: 'varchar', length: 20, default: 'AI' })
  source!: 'AI' | 'AGENT' | 'SELF_SERVICE';

  @Column({ type: 'varchar', length: 20, default: 'OPEN' })
  status!: 'OPEN' | 'KEPT' | 'BROKEN';

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
