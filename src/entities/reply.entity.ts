import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Case } from "./case.entity";
import { Message } from "./message.entity";
@Entity("replies")
export class Reply {
  @PrimaryGeneratedColumn("uuid") id: string;
  @ManyToOne(() => Case, (c) => c.replies, { onDelete: "SET NULL" })
  @JoinColumn({ name: "caseId" })
  case: Case;
  @ManyToOne(() => Message, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "messageId" })
  message: Message;
  @Column({ nullable: true }) text: string;
  @Column({ nullable: true }) intent: string;
  @Column({ type: "jsonb", nullable: true }) entities: any;
  @Column({ nullable: true, unique: true }) externalId: string;
  @CreateDateColumn() receivedAt: Date;
}
