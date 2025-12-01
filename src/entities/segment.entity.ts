// file: src/entities/segment.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'segments' })
@Index(['tenantId'])
@Index(['tenantId', 'name'], { unique: true })
export class Segment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // 👇 propiedad TypeScript (tenantId) mapeada a la columna snake_case tenant_id
  @Column({ type: 'uuid', name: 'tenant_id', nullable: true })
  tenantId!: string | null;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  /** Debe ser un SELECT que devuelva al menos una columna 'id' (id del case) */
  @Column({ type: 'text', name: 'filter_sql' })
  filterSql!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
