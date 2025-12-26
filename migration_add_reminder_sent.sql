-- Adiciona coluna para controle de envio de lembrete de horário
-- Tabela: appointments

BEGIN;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;

-- Índice para consultas que buscam pendentes de lembrete
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_sent
  ON appointments(reminder_sent);

COMMIT;

