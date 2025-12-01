import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Contact } from "./contact.entity";
import { Case } from "./case.entity";
@Entity("debts")
export class Debt {
  @PrimaryGeneratedColumn("uuid") id: string;
  @ManyToOne(() => Contact, (c) => c.debts, { eager: true }) contact: Contact;
  @Column({ nullable: true }) product: string;
  @Column("numeric", { precision: 18, scale: 2 }) amount: string;
  @Column({ default: 0 }) dpd: number;
  @Column({ default: "VIGENTE" }) status: string;
  @OneToMany(() => Case, (c) => c.debt) cases: Case[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
