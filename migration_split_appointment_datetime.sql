-- MIGRAÇÃO: Separar appointment_datetime em appointment_date e appointment_time
-- Tabela: appointments
-- Objetivo: Transformar coluna TIMESTAMP em DATE + TIME separadas

-- IMPORTANTE: Execute este script no Supabase SQL Editor
-- Faça backup da tabela antes de executar!

BEGIN;

-- 1. BACKUP da tabela (opcional, mas recomendado)
CREATE TABLE appointments_backup AS SELECT * FROM appointments;

-- 2. Adicionar as novas colunas
ALTER TABLE appointments 
ADD COLUMN appointment_date DATE,
ADD COLUMN appointment_time TIME;

-- 3. Migrar dados existentes da coluna appointment_datetime para as novas colunas
UPDATE appointments 
SET 
    appointment_date = appointment_datetime::DATE,
    appointment_time = appointment_datetime::TIME
WHERE appointment_datetime IS NOT NULL;

-- 4. Verificar se a migração foi bem-sucedida
-- (Esta query deve retornar 0 se todos os dados foram migrados corretamente)
SELECT COUNT(*) as registros_nao_migrados 
FROM appointments 
WHERE appointment_datetime IS NOT NULL 
AND (appointment_date IS NULL OR appointment_time IS NULL);

-- 5. Tornar as novas colunas obrigatórias (NOT NULL)
ALTER TABLE appointments 
ALTER COLUMN appointment_date SET NOT NULL,
ALTER COLUMN appointment_time SET NOT NULL;

-- 6. Remover a coluna antiga appointment_datetime
ALTER TABLE appointments DROP COLUMN appointment_datetime;

-- 7. Criar índices para otimizar consultas
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_time ON appointments(appointment_time);
CREATE INDEX idx_appointments_date_time ON appointments(appointment_date, appointment_time);
CREATE INDEX idx_appointments_barber_date ON appointments(barber_id, appointment_date);
CREATE INDEX idx_appointments_status_date ON appointments(status, appointment_date);
CREATE INDEX idx_appointments_date_status ON appointments(appointment_date, status);

-- 8. Adicionar constraints de validação
ALTER TABLE appointments 
ADD CONSTRAINT chk_appointment_date_valid 
CHECK (appointment_date >= '2020-01-01'::DATE AND appointment_date <= '2030-12-31'::DATE);

ALTER TABLE appointments 
ADD CONSTRAINT chk_appointment_time_business_hours 
CHECK (appointment_time >= '06:00:00'::TIME AND appointment_time <= '23:59:59'::TIME);

-- 9. Adicionar comentários para documentação
COMMENT ON COLUMN appointments.appointment_date IS 'Data do agendamento no formato YYYY-MM-DD';
COMMENT ON COLUMN appointments.appointment_time IS 'Horário do agendamento no formato HH:MM:SS';

-- 10. Criar função auxiliar para combinar data e hora (útil para ordenação)
CREATE OR REPLACE FUNCTION combine_appointment_datetime(date_val DATE, time_val TIME)
RETURNS TIMESTAMP AS $$
BEGIN
    RETURN (date_val + time_val)::TIMESTAMP;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 11. Criar view para facilitar consultas que precisam do datetime combinado
CREATE OR REPLACE VIEW appointments_with_combined_datetime AS
SELECT 
    id,
    client_id,
    barber_id,
    appointment_date,
    appointment_time,
    combine_appointment_datetime(appointment_date, appointment_time) AS appointment_datetime,
    status,
    total_price,
    note,
    payment_method,
    created_at,
    updated_at
FROM appointments;

-- 12. Atualizar políticas RLS se existirem (manter as mesmas regras de segurança)
-- As políticas RLS existentes continuarão funcionando normalmente

COMMIT;

-- VERIFICAÇÕES PÓS-MIGRAÇÃO:
-- Execute estas queries para verificar se tudo está correto:

-- Verificar estrutura da tabela
-- \d appointments

-- Verificar alguns registros
-- SELECT id, appointment_date, appointment_time, 
--        combine_appointment_datetime(appointment_date, appointment_time) as combined
-- FROM appointments LIMIT 5;

-- Verificar se não há dados nulos
-- SELECT COUNT(*) FROM appointments WHERE appointment_date IS NULL OR appointment_time IS NULL;

-- ROLLBACK (apenas se necessário - CUIDADO!):
/*
BEGIN;
-- Adicionar coluna appointment_datetime de volta
ALTER TABLE appointments ADD COLUMN appointment_datetime TIMESTAMP;

-- Restaurar dados combinando date + time
UPDATE appointments 
SET appointment_datetime = combine_appointment_datetime(appointment_date, appointment_time);

-- Tornar obrigatória
ALTER TABLE appointments ALTER COLUMN appointment_datetime SET NOT NULL;

-- Remover colunas separadas
ALTER TABLE appointments DROP COLUMN appointment_date;
ALTER TABLE appointments DROP COLUMN appointment_time;

-- Limpar recursos criados
DROP VIEW IF EXISTS appointments_with_combined_datetime;
DROP FUNCTION IF EXISTS combine_appointment_datetime(DATE, TIME);
DROP INDEX IF EXISTS idx_appointments_date;
DROP INDEX IF EXISTS idx_appointments_time;
DROP INDEX IF EXISTS idx_appointments_date_time;
DROP INDEX IF EXISTS idx_appointments_barber_date;
DROP INDEX IF EXISTS idx_appointments_status_date;
DROP INDEX IF EXISTS idx_appointments_date_status;

COMMIT;
*/

-- Para remover o backup após confirmar que tudo está funcionando:
-- DROP TABLE appointments_backup;