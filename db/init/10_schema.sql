-- Esquema base
CREATE SCHEMA IF NOT EXISTS public;

-- Tabla de casos (deudor / cobranza)
CREATE TABLE IF NOT EXISTS cases (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_ref    VARCHAR(100) NULL,
  debtor_name     VARCHAR(150) NULL,
  debtor_phone    VARCHAR(30)  NULL,
  debtor_email    VARCHAR(150) NULL,
  amount_cents    BIGINT       NULL,    -- 15000.00 => 1500000 (opcional)
  currency        VARCHAR(10)  DEFAULT 'ARS',
  status          VARCHAR(30)  DEFAULT 'OPEN', -- OPEN | PAID | CANCELLED
  metadata        JSONB        DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Tabla de mensajes enviados por canal
CREATE TABLE IF NOT EXISTS messages (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id       UUID NULL REFERENCES cases(id) ON DELETE SET NULL,
  channel       VARCHAR(30)  NOT NULL,         -- WHATSAPP | SMS | EMAIL
  template      VARCHAR(120) NULL,
  to_address    VARCHAR(150) NULL,             -- teléfono/email destino
  payload       JSONB        DEFAULT '{}'::jsonb,
  status        VARCHAR(30)  DEFAULT 'SENT',   -- SENT | FAILED | DELIVERED
  external_id   VARCHAR(120) NULL,             -- id provider (WA/Twilio/etc)
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Tabla de pagos (preferencias de MP, estados)
CREATE TABLE IF NOT EXISTS payments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id          UUID NULL REFERENCES cases(id) ON DELETE SET NULL,
  amount           NUMERIC(18,2) NOT NULL,
  currency         VARCHAR(10)   DEFAULT 'ARS',
  mp_preference_id VARCHAR(120)  NULL,
  mp_status        VARCHAR(40)   NULL,         -- pending | approved | ...
  init_point       TEXT          NULL,         -- url de pago
  metadata         JSONB         DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_messages_case ON messages(case_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel);
CREATE INDEX IF NOT EXISTS idx_payments_case ON payments(case_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
