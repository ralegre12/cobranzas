import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Contact } from './contact.entity';
import { Message } from './message.entity';
import { Reply } from './reply.entity';
import { Ptp } from './ptp.entity';
import { Payment } from './payment.entity';
import { Debt } from './debt.entity';

@Entity('cases')
export class Case {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Contact, (c) => c.cases, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'contact_id' })
  contact?: Contact;

  @ManyToOne(() => Debt, (d) => d.cases, { eager: true, nullable: true })
  debt: Debt;

  @Column({ default: 0 })
  priority: number;

  @Column({ default: 'ABIERTO' })
  status: string;

  @Column({ nullable: true })
  owner: string;

  @OneToMany(() => Message, (m) => m.case)
  messages: Message[];

  @Column({ type: 'timestamptz', nullable: true, name: 'last_inbound_at' })
  lastInboundAt?: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_outbound_at' })
  lastOutboundAt?: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_contacted_at' })
  lastContactedAt?: Date;

  @OneToMany(() => Reply, (r) => r.case)
  replies: Reply[];

  @OneToMany(() => Ptp, (p) => p.case)
  ptps: Ptp[];

  @OneToMany(() => Payment, (p) => p.case)
  payments: Payment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
