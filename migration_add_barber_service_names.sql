-- MIGRAÇÃO: Adicionar colunas de nome do barbeiro e serviços na tabela appointments
-- Objetivo: Melhorar performance evitando JOINs desnecessários

-- IMPORTANTE: Execute este script no Supabase SQL Editor

BEGIN;

-- 1. Adicionar as novas colunas
ALTER TABLE appointments 
ADD COLUMN client_name VARCHAR(255),
ADD COLUMN client_phone VARCHAR(20),
ADD COLUMN barber_name VARCHAR(255),
ADD COLUMN services_names TEXT,
ADD COLUMN services_ids INTEGER[];

-- 2. Preencher as colunas com dados existentes
-- Atualizar dados do cliente
UPDATE appointments 
SET 
    client_name = clients.name,
    client_phone = clients.phone
FROM clients 
WHERE appointments.client_id = clients.id;

-- Atualizar nome do barbeiro
UPDATE appointments 
SET barber_name = barbers.name
FROM barbers 
WHERE appointments.barber_id = barbers.id;

-- Atualizar nomes dos serviços e IDs
UPDATE appointments 
SET 
    services_names = subquery.services_names,
    services_ids = subquery.services_ids
FROM (
    SELECT 
        a.id,
        STRING_AGG(s.name, ', ' ORDER BY s.name) as services_names,
        ARRAY_AGG(s.id ORDER BY s.name) as services_ids
    FROM appointments a
    JOIN appointment_services aps ON a.id = aps.appointment_id
    JOIN services s ON aps.service_id = s.id
    GROUP BY a.id
) as subquery
WHERE appointments.id = subquery.id;

-- 3. Tornar as colunas obrigatórias (NOT NULL)
ALTER TABLE appointments 
ALTER COLUMN client_name SET NOT NULL,
ALTER COLUMN client_phone SET NOT NULL,
ALTER COLUMN barber_name SET NOT NULL,
ALTER COLUMN services_names SET NOT NULL,
ALTER COLUMN services_ids SET NOT NULL;

-- 4. Criar índices para melhor performance
CREATE INDEX idx_appointments_client_name ON appointments(client_name);
CREATE INDEX idx_appointments_client_phone ON appointments(client_phone);
CREATE INDEX idx_appointments_barber_name ON appointments(barber_name);
CREATE INDEX idx_appointments_services_names ON appointments USING GIN(to_tsvector('portuguese', services_names));
CREATE INDEX idx_appointments_services_ids ON appointments USING GIN(services_ids);
CREATE INDEX idx_appointments_client_name_text ON appointments USING GIN(to_tsvector('portuguese', client_name));

-- 5. Criar função para sincronizar automaticamente os nomes
CREATE OR REPLACE FUNCTION sync_appointment_names()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizar dados do cliente
    SELECT name, phone INTO NEW.client_name, NEW.client_phone
    FROM clients 
    WHERE id = NEW.client_id;
    
    -- Se não encontrar o cliente, usar valores padrão
    IF NEW.client_name IS NULL THEN
        NEW.client_name = 'Cliente não encontrado';
        NEW.client_phone = '';
    END IF;
    
    -- Atualizar nome do barbeiro
    SELECT name INTO NEW.barber_name 
    FROM barbers 
    WHERE id = NEW.barber_id;
    
    -- Se não encontrar o barbeiro, usar valor padrão
    IF NEW.barber_name IS NULL THEN
        NEW.barber_name = 'Barbeiro não encontrado';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Criar trigger para manter nomes sincronizados
CREATE TRIGGER trigger_sync_appointment_names
    BEFORE INSERT OR UPDATE OF client_id, barber_id ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION sync_appointment_names();

-- 7. Criar função para sincronizar serviços quando appointment_services mudar
CREATE OR REPLACE FUNCTION sync_appointment_services()
RETURNS TRIGGER AS $$
DECLARE
    appointment_record RECORD;
BEGIN
    -- Determinar o appointment_id baseado na operação
    IF TG_OP = 'DELETE' THEN
        appointment_record.id = OLD.appointment_id;
    ELSE
        appointment_record.id = NEW.appointment_id;
    END IF;
    
    -- Atualizar services_names e services_ids para o agendamento
    UPDATE appointments 
    SET 
        services_names = subquery.services_names,
        services_ids = subquery.services_ids
    FROM (
        SELECT 
            STRING_AGG(s.name, ', ' ORDER BY s.name) as services_names,
            ARRAY_AGG(s.id ORDER BY s.name) as services_ids
        FROM appointment_services aps
        JOIN services s ON aps.service_id = s.id
        WHERE aps.appointment_id = appointment_record.id
    ) as subquery
    WHERE appointments.id = appointment_record.id;
    
    -- Se não houver serviços, definir valores padrão
    UPDATE appointments 
    SET 
        services_names = COALESCE(services_names, 'Nenhum serviço'),
        services_ids = COALESCE(services_ids, ARRAY[]::INTEGER[])
    WHERE id = appointment_record.id 
    AND (services_names IS NULL OR services_ids IS NULL);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 8. Criar triggers para sincronizar serviços
CREATE TRIGGER trigger_sync_services_insert
    AFTER INSERT ON appointment_services
    FOR EACH ROW
    EXECUTE FUNCTION sync_appointment_services();

CREATE TRIGGER trigger_sync_services_update
    AFTER UPDATE ON appointment_services
    FOR EACH ROW
    EXECUTE FUNCTION sync_appointment_services();

CREATE TRIGGER trigger_sync_services_delete
    AFTER DELETE ON appointment_services
    FOR EACH ROW
    EXECUTE FUNCTION sync_appointment_services();

-- 9. Criar trigger para sincronizar quando dados do cliente mudarem
CREATE OR REPLACE FUNCTION sync_client_data_on_client_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizar dados do cliente em todos os agendamentos
    UPDATE appointments 
    SET 
        client_name = NEW.name,
        client_phone = NEW.phone
    WHERE client_id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_client_data_update
    AFTER UPDATE OF name, phone ON clients
    FOR EACH ROW
    EXECUTE FUNCTION sync_client_data_on_client_update();

-- 10. Criar trigger para sincronizar quando nome do barbeiro mudar na tabela barbers
CREATE OR REPLACE FUNCTION sync_barber_name_on_barber_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizar nome do barbeiro em todos os agendamentos
    UPDATE appointments 
    SET barber_name = NEW.name 
    WHERE barber_id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_barber_name_update
    AFTER UPDATE OF name ON barbers
    FOR EACH ROW
    EXECUTE FUNCTION sync_barber_name_on_barber_update();

-- 11. Criar trigger para sincronizar quando nome do serviço mudar na tabela services
CREATE OR REPLACE FUNCTION sync_service_name_on_service_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Reprocessar todos os agendamentos que usam este serviço
    UPDATE appointments 
    SET 
        services_names = subquery.services_names,
        services_ids = subquery.services_ids
    FROM (
        SELECT 
            a.id,
            STRING_AGG(s.name, ', ' ORDER BY s.name) as services_names,
            ARRAY_AGG(s.id ORDER BY s.name) as services_ids
        FROM appointments a
        JOIN appointment_services aps ON a.id = aps.appointment_id
        JOIN services s ON aps.service_id = s.id
        WHERE aps.service_id = NEW.id
        GROUP BY a.id
    ) as subquery
    WHERE appointments.id = subquery.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_service_name_update
    AFTER UPDATE OF name ON services
    FOR EACH ROW
    EXECUTE FUNCTION sync_service_name_on_service_update();

-- 12. Comentários para documentação
COMMENT ON COLUMN appointments.client_name IS 'Nome do cliente (sincronizado automaticamente)';
COMMENT ON COLUMN appointments.client_phone IS 'Telefone do cliente (sincronizado automaticamente)';
COMMENT ON COLUMN appointments.barber_name IS 'Nome do barbeiro (sincronizado automaticamente)';
COMMENT ON COLUMN appointments.services_names IS 'Nomes dos serviços separados por vírgula (sincronizado automaticamente)';
COMMENT ON COLUMN appointments.services_ids IS 'Array com IDs dos serviços (sincronizado automaticamente)';

-- 13. Criar view otimizada para consultas rápidas
CREATE OR REPLACE VIEW appointments_optimized AS
SELECT 
    id,
    client_id,
    client_name,
    client_phone,
    barber_id,
    barber_name,
    services_names,
    services_ids,
    appointment_datetime,
    appointment_date,
    appointment_time,
    status,
    total_price,
    note,
    payment_method,
    created_at,
    updated_at,
    -- Campos calculados úteis
    ARRAY_LENGTH(services_ids, 1) as services_count,
    CASE 
        WHEN appointment_datetime < NOW() THEN 'past'
        WHEN appointment_datetime::DATE = CURRENT_DATE THEN 'today'
        ELSE 'future'
    END as time_category,
    -- Formatações úteis
    client_name || ' (' || client_phone || ')' as client_display,
    client_name || ' - ' || services_names as appointment_summary
FROM appointments;

-- 14. Função utilitária para buscar agendamentos com filtros otimizados
CREATE OR REPLACE FUNCTION get_appointments_optimized(
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    client_name_filter TEXT DEFAULT NULL,
    client_phone_filter TEXT DEFAULT NULL,
    barber_name_filter TEXT DEFAULT NULL,
    service_name_filter TEXT DEFAULT NULL,
    status_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    id INTEGER,
    client_name TEXT,
    client_phone TEXT,
    barber_name TEXT,
    services_names TEXT,
    appointment_datetime TIMESTAMP,
    status TEXT,
    total_price DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.client_name,
        a.client_phone,
        a.barber_name,
        a.services_names,
        a.appointment_datetime,
        a.status,
        a.total_price
    FROM appointments a
    WHERE 
        (start_date IS NULL OR a.appointment_date >= start_date)
        AND (end_date IS NULL OR a.appointment_date <= end_date)
        AND (client_name_filter IS NULL OR a.client_name ILIKE '%' || client_name_filter || '%')
        AND (client_phone_filter IS NULL OR a.client_phone ILIKE '%' || client_phone_filter || '%')
        AND (barber_name_filter IS NULL OR a.barber_name ILIKE '%' || barber_name_filter || '%')
        AND (service_name_filter IS NULL OR a.services_names ILIKE '%' || service_name_filter || '%')
        AND (status_filter IS NULL OR a.status = status_filter)
    ORDER BY a.appointment_datetime;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- VERIFICAÇÕES PÓS-MIGRAÇÃO:
-- Execute estas queries para verificar se tudo está correto:

-- 1. Verificar se as colunas foram preenchidas
-- SELECT id, client_name, client_phone, barber_name, services_names, services_ids 
-- FROM appointments LIMIT 5;

-- 2. Verificar se não há dados nulos
-- SELECT COUNT(*) as total FROM appointments;
-- SELECT COUNT(*) as com_cliente FROM appointments WHERE client_name IS NOT NULL;
-- SELECT COUNT(*) as com_barbeiro FROM appointments WHERE barber_name IS NOT NULL;
-- SELECT COUNT(*) as com_servicos FROM appointments WHERE services_names IS NOT NULL;

-- 3. Testar busca por nome do cliente
-- SELECT * FROM get_appointments_optimized(
--     start_date := '2024-01-01',
--     end_date := '2024-12-31',
--     client_name_filter := 'Maria'
-- );

-- 4. Testar busca por telefone
-- SELECT * FROM get_appointments_optimized(
--     client_phone_filter := '11999'
-- );

-- 5. Testar busca por nome do barbeiro
-- SELECT * FROM get_appointments_optimized(
--     barber_name_filter := 'João'
-- );

-- 6. Testar busca por serviço
-- SELECT * FROM get_appointments_optimized(
--     service_name_filter := 'Corte'
-- );

-- 7. Testar a view otimizada
-- SELECT client_name, client_phone, barber_name, services_names, 
--        services_count, time_category, client_display, appointment_summary
-- FROM appointments_optimized 
-- WHERE time_category = 'today';

-- 8. Testar busca global
-- SELECT client_name, client_phone, barber_name, services_names, appointment_datetime
-- FROM appointments_optimized
-- WHERE client_name ILIKE '%Maria%' 
--    OR client_phone ILIKE '%999%'
--    OR barber_name ILIKE '%João%'
--    OR services_names ILIKE '%Corte%';

-- VANTAGENS DESTA MIGRAÇÃO:
-- ✅ Consultas muito mais rápidas (sem JOINs)
-- ✅ Busca por texto nos nomes (barbeiro/serviços)
-- ✅ Sincronização automática via triggers
-- ✅ Mantém integridade referencial
-- ✅ Índices otimizados para busca
-- ✅ View e funções utilitárias prontas