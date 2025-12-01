import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
@Entity('templates')
export class Template {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() channel: string;
  @Column() name: string;
  @Column({ type: 'text' }) body: string;
  @Column({ type: 'jsonb', nullable: true }) variablesSchema: any;
  @Column({ default: false }) approved: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
