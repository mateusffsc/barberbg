-- MIGRAÇÃO: Adicionar telefone do barbeiro na tabela appointments
-- Objetivo: Incluir coluna barber_phone sincronizada com a tabela barbers
-- Data: 2024

-- IMPORTANTE: Execute este script no Supabase SQL Editor

BEGIN;

-- 1. Adicionar a nova coluna barber_phone na tabela appointments
ALTER TABLE appointments 
ADD COLUMN barber_phone VARCHAR(20);

-- 2. Preencher a coluna com dados existentes da tabela barbers
UPDATE appointments 
SET barber_phone = barbers.phone
FROM barbers 
WHERE appointments.barber_id = barbers.id;

-- 3. Criar índice para otimização de consultas
CREATE INDEX IF NOT EXISTS idx_appointments_barber_phone ON appointments(barber_phone);

-- 4. Atualizar a função sync_appointment_names para incluir barber_phone
CREATE OR REPLACE FUNCTION sync_appointment_names()
RETURNS TRIGGER AS $$
BEGIN
    -- Buscar dados do cliente
    SELECT name, phone INTO NEW.client_name, NEW.client_phone
    FROM clients 
    WHERE id = NEW.client_id;
    
    -- Se cliente não encontrado, usar valores padrão
    IF NEW.client_name IS NULL THEN
        NEW.client_name = 'Cliente não encontrado';
        NEW.client_phone = '';
    END IF;
    
    -- Buscar dados do barbeiro (nome e telefone)
    SELECT name, phone INTO NEW.barber_name, NEW.barber_phone
    FROM barbers 
    WHERE id = NEW.barber_id;
    
    -- Se barbeiro não encontrado, usar valores padrão
    IF NEW.barber_name IS NULL THEN
        NEW.barber_name = 'Barbeiro não encontrado';
        NEW.barber_phone = '';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Criar função para sincronizar telefone do barbeiro quando atualizado na tabela barbers
CREATE OR REPLACE FUNCTION sync_barber_phone_on_barber_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizar telefone do barbeiro em todos os agendamentos
    UPDATE appointments 
    SET barber_phone = NEW.phone 
    WHERE barber_id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Criar trigger para sincronizar quando telefone do barbeiro mudar
CREATE TRIGGER trigger_sync_barber_phone_update
    AFTER UPDATE OF phone ON barbers
    FOR EACH ROW
    EXECUTE FUNCTION sync_barber_phone_on_barber_update();

-- 7. Verificar se a view appointments_optimized existe e atualizá-la para incluir barber_phone
DO $$
BEGIN
    -- Verificar se a view existe
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'appointments_optimized') THEN
        -- Dropar a view existente para recriar com a nova coluna
        DROP VIEW appointments_optimized;
    END IF;
    
    -- Criar a view com todas as colunas incluindo barber_phone
    EXECUTE '
    CREATE VIEW appointments_optimized AS
    SELECT 
        id,
        client_id,
        client_name,
        client_phone,
        barber_id,
        barber_name,
        barber_phone,
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
            WHEN appointment_datetime < NOW() THEN ''past''
            WHEN appointment_datetime::DATE = CURRENT_DATE THEN ''today''
            ELSE ''future''
        END as time_category,
        -- Formatações úteis
        client_name || '' ('' || client_phone || '')'' as client_display,
        barber_name || '' ('' || barber_phone || '')'' as barber_display,
        client_name || '' - '' || services_names as appointment_summary
    FROM appointments';
END $$;

-- 8. Verificar se a função get_appointments_optimized existe e atualizá-la para incluir barber_phone
DO $$
BEGIN
    -- Verificar se a função existe
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_appointments_optimized') THEN
        -- Dropar a função existente para recriar com o novo parâmetro
        DROP FUNCTION get_appointments_optimized;
    END IF;
    
    -- Criar a função com todos os parâmetros incluindo barber_phone_filter
    EXECUTE '
    CREATE FUNCTION get_appointments_optimized(
        start_date DATE DEFAULT NULL,
        end_date DATE DEFAULT NULL,
        client_name_filter TEXT DEFAULT NULL,
        client_phone_filter TEXT DEFAULT NULL,
        barber_name_filter TEXT DEFAULT NULL,
        barber_phone_filter TEXT DEFAULT NULL,
        service_name_filter TEXT DEFAULT NULL,
        status_filter TEXT DEFAULT NULL
    )
    RETURNS TABLE (
        id INTEGER,
        client_name TEXT,
        client_phone TEXT,
        barber_name TEXT,
        barber_phone TEXT,
        services_names TEXT,
        appointment_datetime TIMESTAMP,
        status TEXT,
        total_price DECIMAL
    ) AS $func$
    BEGIN
        RETURN QUERY
        SELECT 
            a.id,
            a.client_name,
            a.client_phone,
            a.barber_name,
            a.barber_phone,
            a.services_names,
            a.appointment_datetime,
            a.status,
            a.total_price
        FROM appointments a
        WHERE 
            (start_date IS NULL OR a.appointment_date >= start_date)
            AND (end_date IS NULL OR a.appointment_date <= end_date)
            AND (client_name_filter IS NULL OR a.client_name ILIKE ''%'' || client_name_filter || ''%'')
            AND (client_phone_filter IS NULL OR a.client_phone ILIKE ''%'' || client_phone_filter || ''%'')
            AND (barber_name_filter IS NULL OR a.barber_name ILIKE ''%'' || barber_name_filter || ''%'')
            AND (barber_phone_filter IS NULL OR a.barber_phone ILIKE ''%'' || barber_phone_filter || ''%'')
            AND (service_name_filter IS NULL OR a.services_names ILIKE ''%'' || service_name_filter || ''%'')
            AND (status_filter IS NULL OR a.status::TEXT = status_filter)
        ORDER BY a.appointment_datetime DESC;
    END;
    $func$ LANGUAGE plpgsql';
END $$;

-- 9. Adicionar comentário para documentação
COMMENT ON COLUMN appointments.barber_phone IS 'Telefone do barbeiro (sincronizado automaticamente da tabela barbers)';

COMMIT;

-- VERIFICAÇÕES PÓS-MIGRAÇÃO:
-- Execute estas queries para verificar se tudo está correto:

-- 1. Verificar se a coluna foi criada
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'appointments' AND column_name = 'barber_phone';

-- 2. Verificar alguns registros
-- SELECT id, barber_name, barber_phone, client_name, client_phone 
-- FROM appointments LIMIT 5;

-- 3. Verificar se não há dados nulos (opcional, pode haver barbeiros sem telefone)
-- SELECT COUNT(*) FROM appointments WHERE barber_phone IS NULL;

-- 4. Testar a sincronização automática
-- UPDATE barbers SET phone = '11999999999' WHERE id = 1;
-- SELECT barber_name, barber_phone FROM appointments WHERE barber_id = 1 LIMIT 1;

-- VANTAGENS DESTA MIGRAÇÃO:
-- ✅ Acesso rápido ao telefone do barbeiro sem JOINs
-- ✅ Sincronização automática via triggers
-- ✅ Mantém integridade referencial
-- ✅ Índice otimizado para busca por telefone
-- ✅ Compatível com estrutura existente
-- ✅ View e funções atualizadas

SELECT 'Migração barber_phone concluída com sucesso!' as status;