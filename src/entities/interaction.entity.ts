import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Case } from "@entities/case.entity"; // ajustá este import a tu proyecto

@Entity({ name: "interactions" })
export class Interaction {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_interactions_case")
  @ManyToOne(() => Case, { onDelete: "CASCADE" })
  @JoinColumn({ name: "case_id" })
  case!: Case;

  @Column({ type: "varchar", length: 10 })
  direction!: "OUT" | "IN";

  @Index("idx_interactions_channel")
  @Column({ type: "varchar", length: 20 })
  channel!: "WHATSAPP" | "SMS" | "EMAIL";

  @Column({ type: "text", nullable: true })
  content?: string | null;

  @Column({ type: "jsonb", default: () => `'{}'::jsonb` })
  payload!: Record<string, any>;

  @Index("idx_interactions_intent")
  @Column({ type: "varchar", length: 50, nullable: true })
  intent?: string | null; // PAGO_CONFIRMADO | PROPUESTA | NEGATIVA | …

  @Column({ type: "numeric", precision: 18, scale: 2, nullable: true })
  amount?: string | null; // usar string para numeric en TS

  @Column({ type: "date", name: "ptp_date", nullable: true })
  ptpDate?: string | null;

  @Column({ type: "varchar", length: 20, default: "RECORDED" })
  status!: string;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;
}
