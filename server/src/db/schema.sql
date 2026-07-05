-- ============================================================================
-- schema.sql — esquema completo das Escalas CCLX (idempotente).
--
-- Multi-tenant: Organization -> Church -> (Users, Teams, Months, ...).
-- Executado por `npm run db:migrate`. Seguro de correr várias vezes.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Organizações (nível 0) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  is_system  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Igrejas comunidade (nível 1 — tenant operacional) ─────────────────────
CREATE TABLE IF NOT EXISTS churches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name            TEXT NOT NULL UNIQUE,
  slug            TEXT NOT NULL UNIQUE,
  timezone        TEXT NOT NULL DEFAULT 'Europe/Lisbon',
  date_format     TEXT NOT NULL DEFAULT 'dd/MM/yyyy HH:mm',
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_churches_org ON churches (organization_id);

-- ─── Utilizadores ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id      UUID NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  role           TEXT NOT NULL DEFAULT 'volunteer'
                   CHECK (role IN ('admin', 'leader', 'volunteer')),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  is_org_admin   BOOLEAN NOT NULL DEFAULT FALSE,
  approved_at    TIMESTAMPTZ,
  approved_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
  language       TEXT NOT NULL DEFAULT 'pt-PT',
  calendar_token TEXT UNIQUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_users_church ON users (church_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ─── Equipas ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id        UUID NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  color            TEXT NOT NULL DEFAULT '#6366f1',
  planning_priority INTEGER NOT NULL DEFAULT 50,
  leader_id        UUID REFERENCES users (id) ON DELETE SET NULL,
  sort_order       INTEGER NOT NULL DEFAULT 100,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_team_church_name UNIQUE (church_id, name)
);
CREATE INDEX IF NOT EXISTS idx_teams_church ON teams (church_id);

-- ─── Posições (slots fixos dentro de uma equipa) ───────────────────────────
CREATE TABLE IF NOT EXISTS positions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 100,
  CONSTRAINT uq_position_team_name UNIQUE (team_id, name)
);
CREATE INDEX IF NOT EXISTS idx_positions_team ON positions (team_id);

-- ─── Membros de equipa (voluntários escaláveis) ────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  team_id UUID NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members (user_id);

-- ─── Meses (máquina de estados) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS months (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id              UUID NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
  year                   INTEGER NOT NULL,
  month                  INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  status                 TEXT NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'availability_open', 'scheduling', 'final')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  availability_opened_at TIMESTAMPTZ,
  scheduling_started_at  TIMESTAMPTZ,
  published_at           TIMESTAMPTZ,
  CONSTRAINT uq_month_church_year_month UNIQUE (church_id, year, month)
);
CREATE INDEX IF NOT EXISTS idx_months_church ON months (church_id);

-- ─── Disponibilidades ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS availabilities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_id     UUID NOT NULL REFERENCES months (id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  sunday       DATE NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('available', 'unavailable')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_avail_month_user_sunday UNIQUE (month_id, user_id, sunday)
);
CREATE INDEX IF NOT EXISTS idx_avail_month ON availabilities (month_id);
CREATE INDEX IF NOT EXISTS idx_avail_user ON availabilities (user_id);

-- ─── Escalações (assignments) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_id    UUID NOT NULL REFERENCES months (id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES positions (id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  sunday      DATE NOT NULL,
  is_manual   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_assignment_month_position_sunday UNIQUE (month_id, position_id, sunday)
);
CREATE INDEX IF NOT EXISTS idx_assign_month ON assignments (month_id);
CREATE INDEX IF NOT EXISTS idx_assign_user ON assignments (user_id);
CREATE INDEX IF NOT EXISTS idx_assign_position ON assignments (position_id);

-- ─── Códigos OTP (login passwordless) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes (email);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes (expires_at);

-- ─── Traduções (i18n configurável) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS translations (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key      TEXT NOT NULL,
  language TEXT NOT NULL,
  value    TEXT NOT NULL,
  CONSTRAINT uq_translation_key_lang UNIQUE (key, language)
);
CREATE INDEX IF NOT EXISTS idx_translations_lang ON translations (language);
