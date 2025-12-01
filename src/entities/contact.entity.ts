import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { Debt } from './debt.entity';
import { Case } from './case.entity';
@Entity('contacts')
export class Contact {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() fullName: string;
  @Column({ nullable: true }) document: string;
  @Column({ nullable: true }) phone: string;
  @Column({ nullable: true }) email: string;
  @Column({ default: false }) waOptIn: boolean;
  @Column({ default: false }) dnc: boolean;
  @ManyToOne(() => Tenant, (t) => t.contacts, { eager: true }) tenant: Tenant;
  @OneToMany(() => Debt, (d) => d.contact) debts: Debt[];
  @OneToMany(() => Case, (c) => c.contact) cases: Case[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
