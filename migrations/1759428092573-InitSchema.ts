import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1759428092573 implements MigrationInterface {
    name = 'InitSchema1759428092573'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "channel" character varying(30) NOT NULL, "template" character varying(255), "to_address" character varying(150), "payload" jsonb NOT NULL DEFAULT '{}', "status" character varying(50) NOT NULL DEFAULT 'SENT', "external_id" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "case_id" uuid, CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "replies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "text" character varying, "intent" character varying, "entities" jsonb, "external_id" character varying, "received_at" TIMESTAMP NOT NULL DEFAULT now(), "caseId" uuid, "messageId" uuid, CONSTRAINT "UQ_915b8655427e4ea56b8c494dbdf" UNIQUE ("external_id"), CONSTRAINT "PK_08f619ebe431e27e9d206bea132" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "ptp" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "promised_date" date NOT NULL, "promised_amount" numeric(18,2) NOT NULL, "source" character varying(20) NOT NULL DEFAULT 'AI', "status" character varying(20) NOT NULL DEFAULT 'OPEN', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "case_id" uuid, CONSTRAINT "PK_2ff0551d3c0bffe0e2acefd54b1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_ptp_case" ON "ptp" ("case_id") `);
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "provider" character varying(50) NOT NULL DEFAULT 'MP', "preferenceId" character varying(255), "paymentId" character varying(255), "amount" numeric(18,2), "status" character varying(50) NOT NULL DEFAULT 'PENDING', "accreditedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "metadata" jsonb DEFAULT '{}'::jsonb, "caseId" uuid, CONSTRAINT "UQ_ae0b0903f275c81d8a2a45ce3b5" UNIQUE ("paymentId"), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_payments_case" ON "payments" ("caseId") `);
        await queryRunner.query(`CREATE TABLE "cases" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "priority" integer NOT NULL DEFAULT '0', "status" character varying NOT NULL DEFAULT 'ABIERTO', "owner" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "contact_id" uuid, "debt_id" uuid, CONSTRAINT "PK_264acb3048c240fb89aa34626db" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "debts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "product" character varying, "amount" numeric(18,2) NOT NULL, "dpd" integer NOT NULL DEFAULT '0', "status" character varying NOT NULL DEFAULT 'VIGENTE', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "contact_id" uuid, CONSTRAINT "PK_4bd9f54aab9e59628a3a2657fa1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "contacts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "full_name" character varying NOT NULL, "document" character varying, "phone" character varying, "email" character varying, "wa_opt_in" boolean NOT NULL DEFAULT false, "dnc" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "tenant_id" uuid, CONSTRAINT "PK_b99cd40cfd66a99f1571f4f72e6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tenants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_32731f181236a46182a38c992a8" UNIQUE ("name"), CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "channel" character varying NOT NULL, "name" character varying NOT NULL, "body" text NOT NULL, "variables_schema" jsonb, "approved" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_515948649ce0bbbe391de702ae5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "segments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid, "name" character varying(100) NOT NULL, "filter_sql" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_beff1eec19679fe8ad4f291f04e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e4e508df317e59c3d0f356270b" ON "segments" ("tenant_id", "name") `);
        await queryRunner.query(`CREATE INDEX "IDX_c3778e47f96f67d89bc0229d57" ON "segments" ("tenant_id") `);
        await queryRunner.query(`CREATE TABLE "message_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid, "channel" character varying(20) NOT NULL, "code" character varying(120) NOT NULL, "locale" character varying(10) NOT NULL DEFAULT 'es_AR', "body" text NOT NULL, "required_vars" jsonb NOT NULL DEFAULT '[]', "provider_name" character varying(50), "is_approved" boolean NOT NULL DEFAULT true, "version" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9ac2bd9635be662d183f314947d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "ux_message_templates_tenant_code_locale_channel" ON "message_templates" ("tenant_id", "code", "locale", "channel") `);
        await queryRunner.query(`CREATE TABLE "interactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "direction" character varying(10) NOT NULL, "channel" character varying(20) NOT NULL, "content" text, "payload" jsonb NOT NULL DEFAULT '{}'::jsonb, "intent" character varying(50), "amount" numeric(18,2), "ptp_date" date, "status" character varying(20) NOT NULL DEFAULT 'RECORDED', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "case_id" uuid, CONSTRAINT "PK_911b7416a6671b4148b18c18ecb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_interactions_case" ON "interactions" ("case_id") `);
        await queryRunner.query(`CREATE INDEX "idx_interactions_channel" ON "interactions" ("channel") `);
        await queryRunner.query(`CREATE INDEX "idx_interactions_intent" ON "interactions" ("intent") `);
        await queryRunner.query(`CREATE TABLE "campaigns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid, "name" character varying(100) NOT NULL, "segment_id" uuid, "channel_priority" jsonb NOT NULL DEFAULT  '["WHATSAPP","SMS","EMAIL"]'::jsonb , "daily_cap" integer NOT NULL DEFAULT '500', "status" character varying(20) NOT NULL DEFAULT 'DRAFT', "schedule_cron" character varying(80), "template_code" character varying(120), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_831e3fcd4fc45b4e4c3f57a9ee4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d4b32d1e898a336c770e08bf5e" ON "campaigns" ("tenant_id") `);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_10c1ee76e73d2b25b7ca6d5312b" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "replies" ADD CONSTRAINT "FK_5d82a9f5a656899f5f831f961a4" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "replies" ADD CONSTRAINT "FK_9533133288fca2c982fb8894439" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ptp" ADD CONSTRAINT "FK_888e31f1af37292f7a4b23d2a7c" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_c4c5616f9143e873e988fed2fe7" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cases" ADD CONSTRAINT "FK_235467ca40e0930d12441c0f373" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cases" ADD CONSTRAINT "FK_d9b75f0932995421723503670c6" FOREIGN KEY ("debt_id") REFERENCES "debts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "debts" ADD CONSTRAINT "FK_1b0ca8b43655d2b5927e88b65bc" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "contacts" ADD CONSTRAINT "FK_71ec7d68cfafa5f3d93c959b807" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "interactions" ADD CONSTRAINT "FK_4c0f06002a6ac731e6aa7b3b9c8" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "interactions" DROP CONSTRAINT "FK_4c0f06002a6ac731e6aa7b3b9c8"`);
        await queryRunner.query(`ALTER TABLE "contacts" DROP CONSTRAINT "FK_71ec7d68cfafa5f3d93c959b807"`);
        await queryRunner.query(`ALTER TABLE "debts" DROP CONSTRAINT "FK_1b0ca8b43655d2b5927e88b65bc"`);
        await queryRunner.query(`ALTER TABLE "cases" DROP CONSTRAINT "FK_d9b75f0932995421723503670c6"`);
        await queryRunner.query(`ALTER TABLE "cases" DROP CONSTRAINT "FK_235467ca40e0930d12441c0f373"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_c4c5616f9143e873e988fed2fe7"`);
        await queryRunner.query(`ALTER TABLE "ptp" DROP CONSTRAINT "FK_888e31f1af37292f7a4b23d2a7c"`);
        await queryRunner.query(`ALTER TABLE "replies" DROP CONSTRAINT "FK_9533133288fca2c982fb8894439"`);
        await queryRunner.query(`ALTER TABLE "replies" DROP CONSTRAINT "FK_5d82a9f5a656899f5f831f961a4"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_10c1ee76e73d2b25b7ca6d5312b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d4b32d1e898a336c770e08bf5e"`);
        await queryRunner.query(`DROP TABLE "campaigns"`);
        await queryRunner.query(`DROP INDEX "public"."idx_interactions_intent"`);
        await queryRunner.query(`DROP INDEX "public"."idx_interactions_channel"`);
        await queryRunner.query(`DROP INDEX "public"."idx_interactions_case"`);
        await queryRunner.query(`DROP TABLE "interactions"`);
        await queryRunner.query(`DROP INDEX "public"."ux_message_templates_tenant_code_locale_channel"`);
        await queryRunner.query(`DROP TABLE "message_templates"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c3778e47f96f67d89bc0229d57"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e4e508df317e59c3d0f356270b"`);
        await queryRunner.query(`DROP TABLE "segments"`);
        await queryRunner.query(`DROP TABLE "templates"`);
        await queryRunner.query(`DROP TABLE "tenants"`);
        await queryRunner.query(`DROP TABLE "contacts"`);
        await queryRunner.query(`DROP TABLE "debts"`);
        await queryRunner.query(`DROP TABLE "cases"`);
        await queryRunner.query(`DROP INDEX "public"."idx_payments_case"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP INDEX "public"."idx_ptp_case"`);
        await queryRunner.query(`DROP TABLE "ptp"`);
        await queryRunner.query(`DROP TABLE "replies"`);
        await queryRunner.query(`DROP TABLE "messages"`);
    }

}
