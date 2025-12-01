// file: src/entities/message.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  RelationId,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Case } from './case.entity';

export type Channel = 'WHATSAPP' | 'SMS' | 'EMAIL';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Case, (c) => c.messages, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'case_id' })
  case?: Case;

  @RelationId((m: Message) => m.case)
  caseId?: string;

  @Column({ type: 'varchar', length: 30 })
  channel!: Channel;

  @Column({ name: 'template', type: 'varchar', length: 255, nullable: true })
  templateCode?: string;

  @Column({ name: 'to_address', type: 'varchar', length: 150, nullable: true })
  toAddress?: string;

  @Column({ name: 'payload', type: 'jsonb', default: () => `'{}'` })
  variables!: Record<string, any>;

  @Column({ type: 'varchar', length: 50, default: 'QUEUED' })
  status!: string;

  @Column({ name: 'external_id', type: 'varchar', length: 255, nullable: true })
  externalId?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updatedAt?: Date; // 👈

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;

  @Column('jsonb', { nullable: true })
  providerPayload?: Record<string, any>;

  @Column({ type: 'varchar', length: 32, nullable: true })
  lastProviderStatus?: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastProviderStatusAt?: Date;
}
