-- MIGRAÇÃO CORRIGIDA: Separar appointment_datetime em appointment_date e appointment_time
-- Versão simplificada que funciona com a estrutura atual da tabela

-- IMPORTANTE: Execute este script no Supabase SQL Editor
-- Faça backup da tabela antes de executar!

BEGIN;

-- 1. BACKUP da tabela (recomendado)
CREATE TABLE appointments_backup AS SELECT * FROM appointments;

-- 2. Verificar estrutura atual da tabela
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'appointments' ORDER BY ordinal_position;

-- 3. Adicionar as novas colunas
ALTER TABLE appointments 
ADD COLUMN appointment_date DATE,
ADD COLUMN appointment_time TIME;

-- 4. Migrar dados existentes da coluna appointment_datetime para as novas colunas
UPDATE appointments 
SET 
    appointment_date = appointment_datetime::DATE,
    appointment_time = appointment_datetime::TIME
WHERE appointment_datetime IS NOT NULL;

-- 5. Verificar se a migração foi bem-sucedida
-- Esta query deve retornar 0 se todos os dados foram migrados corretamente
DO $$
DECLARE
    unmigrated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO unmigrated_count
    FROM appointments 
    WHERE appointment_datetime IS NOT NULL 
    AND (appointment_date IS NULL OR appointment_time IS NULL);
    
    IF unmigrated_count > 0 THEN
        RAISE EXCEPTION 'Migração falhou: % registros não foram migrados', unmigrated_count;
    ELSE
        RAISE NOTICE 'Migração bem-sucedida: todos os registros foram migrados';
    END IF;
END $$;

-- 6. Tornar as novas colunas obrigatórias (NOT NULL)
ALTER TABLE appointments 
ALTER COLUMN appointment_date SET NOT NULL,
ALTER COLUMN appointment_time SET NOT NULL;

-- 7. Remover a coluna antiga appointment_datetime
ALTER TABLE appointments DROP COLUMN appointment_datetime;

-- 8. Criar índices para otimizar consultas
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_time ON appointments(appointment_time);
CREATE INDEX idx_appointments_date_time ON appointments(appointment_date, appointment_time);
CREATE INDEX idx_appointments_barber_date ON appointments(barber_id, appointment_date);
CREATE INDEX idx_appointments_status_date ON appointments(status, appointment_date);

-- 9. Adicionar constraints de validação
ALTER TABLE appointments 
ADD CONSTRAINT chk_appointment_date_valid 
CHECK (appointment_date >= '2020-01-01'::DATE AND appointment_date <= '2030-12-31'::DATE);

ALTER TABLE appointments 
ADD CONSTRAINT chk_appointment_time_business_hours 
CHECK (appointment_time >= '06:00:00'::TIME AND appointment_time <= '23:59:59'::TIME);

-- 10. Adicionar comentários para documentação
COMMENT ON COLUMN appointments.appointment_date IS 'Data do agendamento no formato YYYY-MM-DD';
COMMENT ON COLUMN appointments.appointment_time IS 'Horário do agendamento no formato HH:MM:SS';

-- 11. Criar função auxiliar para combinar data e hora
CREATE OR REPLACE FUNCTION combine_appointment_datetime(date_val DATE, time_val TIME)
RETURNS TIMESTAMP AS $$
BEGIN
    RETURN (date_val + time_val)::TIMESTAMP;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 12. Criar view simplificada (apenas com colunas que existem)
CREATE OR REPLACE VIEW appointments_with_combined_datetime AS
SELECT 
    *,
    combine_appointment_datetime(appointment_date, appointment_time) AS appointment_datetime
FROM appointments;

COMMIT;

-- VERIFICAÇÕES PÓS-MIGRAÇÃO:
-- Execute estas queries para verificar se tudo está correto:

-- 1. Verificar estrutura da tabela
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'appointments' 
-- ORDER BY ordinal_position;

-- 2. Verificar alguns registros
-- SELECT id, appointment_date, appointment_time, 
--        combine_appointment_datetime(appointment_date, appointment_time) as combined
-- FROM appointments LIMIT 5;

-- 3. Verificar se não há dados nulos
-- SELECT COUNT(*) as total_registros FROM appointments;
-- SELECT COUNT(*) as registros_com_data FROM appointments WHERE appointment_date IS NOT NULL;
-- SELECT COUNT(*) as registros_com_hora FROM appointments WHERE appointment_time IS NOT NULL;

-- 4. Testar a view
-- SELECT id, appointment_date, appointment_time, appointment_datetime 
-- FROM appointments_with_combined_datetime LIMIT 3;

-- ROLLBACK COMPLETO (apenas se necessário - CUIDADO!):
/*
BEGIN;
-- Restaurar da tabela de backup
DROP TABLE IF EXISTS appointments;
ALTER TABLE appointments_backup RENAME TO appointments;

-- Limpar recursos criados
DROP VIEW IF EXISTS appointments_with_combined_datetime;
DROP FUNCTION IF EXISTS combine_appointment_datetime(DATE, TIME);

COMMIT;
*/

-- Para remover o backup após confirmar que tudo está funcionando:
-- DROP TABLE appointments_backup;