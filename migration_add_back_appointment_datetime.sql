-- MIGRAÇÃO: Adicionar de volta a coluna appointment_datetime
-- Mantendo também as colunas appointment_date e appointment_time
-- Esta é a melhor abordagem: ter ambas as opções disponíveis

-- IMPORTANTE: Execute este script no Supabase SQL Editor

BEGIN;

-- 1. Adicionar de volta a coluna appointment_datetime
ALTER TABLE appointments 
ADD COLUMN appointment_datetime TIMESTAMP;

-- 2. Preencher a coluna appointment_datetime combinando date + time
UPDATE appointments 
SET appointment_datetime = (appointment_date + appointment_time)::TIMESTAMP
WHERE appointment_date IS NOT NULL AND appointment_time IS NOT NULL;

-- 3. Tornar a coluna obrigatória
ALTER TABLE appointments 
ALTER COLUMN appointment_datetime SET NOT NULL;

-- 4. Criar índice para a coluna appointment_datetime
CREATE INDEX idx_appointments_datetime ON appointments(appointment_datetime);
CREATE INDEX idx_appointments_barber_datetime ON appointments(barber_id, appointment_datetime);
CREATE INDEX idx_appointments_status_datetime ON appointments(status, appointment_datetime);

-- 5. Criar trigger para manter appointment_datetime sincronizado automaticamente
-- Quando appointment_date ou appointment_time forem alterados, appointment_datetime será atualizado

CREATE OR REPLACE FUNCTION sync_appointment_datetime()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizar appointment_datetime quando date ou time mudarem
    NEW.appointment_datetime = (NEW.appointment_date + NEW.appointment_time)::TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Criar triggers para INSERT e UPDATE
CREATE TRIGGER trigger_sync_appointment_datetime_insert
    BEFORE INSERT ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION sync_appointment_datetime();

CREATE TRIGGER trigger_sync_appointment_datetime_update
    BEFORE UPDATE ON appointments
    FOR EACH ROW
    WHEN (OLD.appointment_date IS DISTINCT FROM NEW.appointment_date 
          OR OLD.appointment_time IS DISTINCT FROM NEW.appointment_time)
    EXECUTE FUNCTION sync_appointment_datetime();

-- 7. Atualizar a view para incluir todas as colunas
CREATE OR REPLACE VIEW appointments_with_all_datetime_formats AS
SELECT 
    *,
    -- Campos calculados adicionais para conveniência
    EXTRACT(YEAR FROM appointment_datetime) as appointment_year,
    EXTRACT(MONTH FROM appointment_datetime) as appointment_month,
    EXTRACT(DAY FROM appointment_datetime) as appointment_day,
    EXTRACT(HOUR FROM appointment_time) as appointment_hour,
    EXTRACT(MINUTE FROM appointment_time) as appointment_minute,
    TO_CHAR(appointment_datetime, 'DD/MM/YYYY HH24:MI') as formatted_datetime,
    TO_CHAR(appointment_date, 'DD/MM/YYYY') as formatted_date,
    TO_CHAR(appointment_time, 'HH24:MI') as formatted_time
FROM appointments;

-- 8. Comentários para documentação
COMMENT ON COLUMN appointments.appointment_datetime IS 'Data e hora combinadas do agendamento (sincronizada automaticamente)';
COMMENT ON COLUMN appointments.appointment_date IS 'Data do agendamento (YYYY-MM-DD)';
COMMENT ON COLUMN appointments.appointment_time IS 'Horário do agendamento (HH:MM:SS)';

-- 9. Função utilitária para buscar agendamentos por período (usando datetime)
CREATE OR REPLACE FUNCTION get_appointments_by_period(
    start_datetime TIMESTAMP,
    end_datetime TIMESTAMP,
    barber_id_filter INTEGER DEFAULT NULL
)
RETURNS TABLE (
    id INTEGER,
    client_id INTEGER,
    barber_id INTEGER,
    appointment_date DATE,
    appointment_time TIME,
    appointment_datetime TIMESTAMP,
    status TEXT,
    total_price DECIMAL,
    notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.client_id,
        a.barber_id,
        a.appointment_date,
        a.appointment_time,
        a.appointment_datetime,
        a.status,
        a.total_price,
        a.note as notes
    FROM appointments a
    WHERE a.appointment_datetime >= start_datetime
      AND a.appointment_datetime <= end_datetime
      AND (barber_id_filter IS NULL OR a.barber_id = barber_id_filter)
    ORDER BY a.appointment_datetime;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- VERIFICAÇÕES PÓS-MIGRAÇÃO:
-- Execute estas queries para verificar se tudo está correto:

-- 1. Verificar se appointment_datetime foi preenchido corretamente
-- SELECT id, appointment_date, appointment_time, appointment_datetime,
--        (appointment_date + appointment_time)::TIMESTAMP as calculated_datetime
-- FROM appointments LIMIT 5;

-- 2. Verificar se não há dados nulos
-- SELECT COUNT(*) as total_registros FROM appointments;
-- SELECT COUNT(*) as registros_com_datetime FROM appointments WHERE appointment_datetime IS NOT NULL;

-- 3. Testar o trigger (inserir um novo registro)
-- INSERT INTO appointments (client_id, barber_id, appointment_date, appointment_time, status, total_price)
-- VALUES (1, 1, '2024-01-15', '14:30:00', 'scheduled', 50.00);
-- SELECT appointment_date, appointment_time, appointment_datetime FROM appointments WHERE id = LASTVAL();

-- 4. Testar a função utilitária
-- SELECT * FROM get_appointments_by_period('2024-01-01'::TIMESTAMP, '2024-12-31'::TIMESTAMP) LIMIT 3;

-- VANTAGENS DESTA ABORDAGEM:
-- ✅ Compatibilidade total com código existente (appointment_datetime)
-- ✅ Flexibilidade para usar campos separados quando necessário
-- ✅ Sincronização automática via triggers
-- ✅ Performance otimizada com índices em ambos os formatos
-- ✅ Não precisa alterar muito código existente