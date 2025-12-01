import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('api_keys')
export class ApiKeyEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Column() name: string;
  @Index() @Column() prefix: string;
  @Column() hash: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) lastUsedAt?: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) revokedAt?: Date | null;
}
