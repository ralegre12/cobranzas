// file: src/entities/campaign.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'campaigns' })
@Index(['tenantId'])
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id', nullable: true })
  tenantId!: string | null;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'uuid', name: 'segment_id', nullable: true })
  segmentId!: string | null;

  @Column({
    type: 'jsonb',
    name: 'channel_priority',
    default: () => ` '["WHATSAPP","SMS","EMAIL"]'::jsonb `,
  })
  channelPriority!: string[]; // jsonb

  @Column({ type: 'int', name: 'daily_cap', default: 500 })
  dailyCap!: number;

  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status!: 'DRAFT' | 'ACTIVE' | 'PAUSED';

  @Column({ type: 'varchar', length: 80, name: 'schedule_cron', nullable: true })
  scheduleCron!: string | null;

  @Column({ type: 'varchar', length: 120, name: 'template_code', nullable: true })
  templateCode!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
