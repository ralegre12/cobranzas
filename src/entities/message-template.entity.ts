// file: src/entities/message-template.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type TemplateChannel = 'WHATSAPP' | 'SMS' | 'EMAIL';

@Entity('message_templates')
@Index(
  'ux_message_templates_tenant_code_locale_channel',
  ['tenantId', 'code', 'locale', 'channel'],
  {
    unique: true,
  },
)
export class MessageTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;

  @Column({ type: 'varchar', length: 20 })
  channel!: TemplateChannel;

  // Código interno del template (único por tenant+channel+locale)
  @Column({ type: 'varchar', length: 120 })
  code!: string;

  // Idioma/locale (ej: es_AR, es_ES)
  @Column({ type: 'varchar', length: 10, default: 'es_AR' })
  locale!: string;

  // Cuerpo del mensaje. Para WhatsApp, debe corresponder al template aprobado (sin placeholders de header/buttons)
  @Column({ type: 'text' })
  body!: string;

  // Variables requeridas (en orden) — se validan al renderizar
  @Column({ name: 'required_vars', type: 'jsonb', default: () => `'[]'` })
  requiredVars!: string[];

  // Nombre del proveedor (ej: META, SENDGRID, TWILIO), opcional
  @Column({ name: 'provider_name', type: 'varchar', length: 50, nullable: true })
  providerName?: string | null;

  @Column({ name: 'is_approved', type: 'boolean', default: true })
  isApproved!: boolean;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
