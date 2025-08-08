-- Migração para separar appointment_datetime em appointment_date e appointment_time
-- Execute este script no Supabase SQL Editor

BEGIN;

-- 1. Adicionar as novas colunas
ALTER TABLE appointments 
ADD COLUMN appointment_date DATE,
ADD COLUMN appointment_time TIME;

-- 2. Migrar os dados existentes da coluna appointment_datetime
UPDATE appointments 
SET 
    appointment_date = appointment_datetime::DATE,
    appointment_time = appointment_datetime::TIME
WHERE appointment_datetime IS NOT NULL;

-- 3. Tornar as novas colunas obrigatórias (NOT NULL)
ALTER TABLE appointments 
ALTER COLUMN appointment_date SET NOT NULL,
ALTER COLUMN appointment_time SET NOT NULL;

-- 4. Criar índices para melhor performance nas consultas
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_time ON appointments(appointment_time);
CREATE INDEX idx_appointments_date_time ON appointments(appointment_date, appointment_time);
CREATE INDEX idx_appointments_barber_date ON appointments(barber_id, appointment_date);
CREATE INDEX idx_appointments_status_date ON appointments(status, appointment_date);

-- 5. Adicionar constraints para validação
ALTER TABLE appointments 
ADD CONSTRAINT chk_appointment_date_valid 
CHECK (appointment_date >= '2020-01-01'::DATE);

ALTER TABLE appointments 
ADD CONSTRAINT chk_appointment_time_valid 
CHECK (appointment_time >= '06:00:00'::TIME AND appointment_time <= '23:59:59'::TIME);

-- 6. Comentários nas colunas para documentação
COMMENT ON COLUMN appointments.appointment_date IS 'Data do agendamento (formato: YYYY-MM-DD)';
COMMENT ON COLUMN appointments.appointment_time IS 'Horário do agendamento (formato: HH:MM:SS)';

-- 7. Criar função para combinar data e hora (útil para ordenação e comparações)
CREATE OR REPLACE FUNCTION get_appointment_datetime(date_val DATE, time_val TIME)
RETURNS TIMESTAMP AS $$
BEGIN
    RETURN date_val + time_val;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 8. Criar view para compatibilidade com código existente
CREATE OR REPLACE VIEW appointments_with_datetime AS
SELECT 
    *,
    get_appointment_datetime(appointment_date, appointment_time) AS appointment_datetime
FROM appointments;

-- 9. Atualizar RLS policies se existirem (manter as mesmas regras)
-- As policies existentes continuarão funcionando com as novas colunas

COMMIT;

-- INSTRUÇÕES PÓS-MIGRAÇÃO:
-- 1. Teste todas as funcionalidades do sistema
-- 2. Verifique se as consultas estão retornando os dados corretos
-- 3. Após confirmar que tudo funciona, execute:
--    ALTER TABLE appointments DROP COLUMN appointment_datetime;

-- ROLLBACK (se necessário):
/*
BEGIN;
-- Restaurar coluna original
ALTER TABLE appointments ADD COLUMN appointment_datetime_new TIMESTAMP;
UPDATE appointments SET appointment_datetime_new = get_appointment_datetime(appointment_date, appointment_time);
ALTER TABLE appointments DROP COLUMN appointment_date;
ALTER TABLE appointments DROP COLUMN appointment_time;
ALTER TABLE appointments RENAME COLUMN appointment_datetime_new TO appointment_datetime;
DROP FUNCTION IF EXISTS get_appointment_datetime(DATE, TIME);
DROP VIEW IF EXISTS appointments_with_datetime;
DROP INDEX IF EXISTS idx_appointments_date;
DROP INDEX IF EXISTS idx_appointments_time;
DROP INDEX IF EXISTS idx_appointments_date_time;
DROP INDEX IF EXISTS idx_appointments_barber_date;
DROP INDEX IF EXISTS idx_appointments_status_date;
COMMIT;
*/