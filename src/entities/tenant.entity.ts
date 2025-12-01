import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Contact } from './contact.entity';
@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) name: string;
  @OneToMany(() => Contact, (c) => c.tenant) contacts: Contact[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
