-- MIGRAÇÃO: Adicionar apenas colunas de nome e telefone do cliente
-- Objetivo: Completar a otimização da tabela appointments

-- IMPORTANTE: Execute este script no Supabase SQL Editor

BEGIN;

-- 1. Adicionar apenas as colunas do cliente que estão faltando
ALTER TABLE appointments 
ADD COLUMN client_name VARCHAR(255),
ADD COLUMN client_phone VARCHAR(20);

-- 2. Preencher as colunas com dados existentes dos clientes
UPDATE appointments 
SET 
    client_name = clients.name,
    client_phone = clients.phone
FROM clients 
WHERE appointments.client_id = clients.id;

-- 3. Tornar as colunas obrigatórias (NOT NULL)
ALTER TABLE appointments 
ALTER COLUMN client_name SET NOT NULL,
ALTER COLUMN client_phone SET NOT NULL;

-- 4. Criar índices para melhor performance
CREATE INDEX idx_appointments_client_name ON appointments(client_name);
CREATE INDEX idx_appointments_client_phone ON appointments(client_phone);
CREATE INDEX idx_appointments_client_name_text ON appointments USING GIN(to_tsvector('portuguese', client_name));

-- 5. Atualizar a função existente para incluir dados do cliente
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
    
    -- Manter a lógica existente do barbeiro (se existir)
    IF NEW.barber_id IS NOT NULL THEN
        SELECT name INTO NEW.barber_name 
        FROM barbers 
        WHERE id = NEW.barber_id;
        
        IF NEW.barber_name IS NULL THEN
            NEW.barber_name = 'Barbeiro não encontrado';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Atualizar o trigger existente para incluir client_id
DROP TRIGGER IF EXISTS trigger_sync_appointment_names ON appointments;
DROP TRIGGER IF EXISTS trigger_sync_barber_name ON appointments;

CREATE TRIGGER trigger_sync_appointment_names
    BEFORE INSERT OR UPDATE OF client_id, barber_id ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION sync_appointment_names();

-- 7. Criar trigger para sincronizar quando dados do cliente mudarem
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

-- 8. Atualizar a view existente (se existir) ou criar nova
CREATE OR REPLACE VIEW appointments_with_client_info AS
SELECT 
    *,
    -- Formatações úteis
    client_name || ' (' || client_phone || ')' as client_display,
    client_name || ' - ' || COALESCE(services_names, barber_name, 'Agendamento') as appointment_summary
FROM appointments;

-- 9. Comentários para documentação
COMMENT ON COLUMN appointments.client_name IS 'Nome do cliente (sincronizado automaticamente)';
COMMENT ON COLUMN appointments.client_phone IS 'Telefone do cliente (sincronizado automaticamente)';

-- 10. Função utilitária para buscar por cliente
CREATE OR REPLACE FUNCTION search_appointments_by_client(
    search_term TEXT,
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    id INTEGER,
    client_name TEXT,
    client_phone TEXT,
    barber_name TEXT,
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
        COALESCE(a.barber_name, 'N/A') as barber_name,
        a.appointment_datetime,
        a.status,
        a.total_price
    FROM appointments a
    WHERE 
        (a.client_name ILIKE '%' || search_term || '%' 
         OR a.client_phone ILIKE '%' || search_term || '%')
        AND (start_date IS NULL OR a.appointment_date >= start_date)
        AND (end_date IS NULL OR a.appointment_date <= end_date)
    ORDER BY a.appointment_datetime DESC;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- VERIFICAÇÕES PÓS-MIGRAÇÃO:
-- Execute estas queries para verificar se tudo está correto:

-- 1. Verificar se as colunas foram preenchidas
-- SELECT id, client_name, client_phone, barber_name 
-- FROM appointments LIMIT 5;

-- 2. Verificar se não há dados nulos
-- SELECT COUNT(*) as total FROM appointments;
-- SELECT COUNT(*) as com_cliente FROM appointments WHERE client_name IS NOT NULL;
-- SELECT COUNT(*) as com_telefone FROM appointments WHERE client_phone IS NOT NULL;

-- 3. Testar busca por cliente
-- SELECT * FROM search_appointments_by_client('Maria');

-- 4. Testar busca por telefone
-- SELECT * FROM search_appointments_by_client('11999');

-- 5. Testar a view
-- SELECT client_display, appointment_summary 
-- FROM appointments_with_client_info LIMIT 3;

-- 6. Testar trigger (inserir um novo agendamento)
-- INSERT INTO appointments (client_id, barber_id, appointment_datetime, status, total_price)
-- VALUES (1, 1, '2024-01-15 14:30:00', 'scheduled', 50.00);
-- SELECT client_name, client_phone, barber_name FROM appointments WHERE id = LASTVAL();

-- VANTAGENS DESTA MIGRAÇÃO:
-- ✅ Adiciona apenas as colunas que faltam
-- ✅ Mantém compatibilidade com estrutura existente
-- ✅ Sincronização automática via triggers
-- ✅ Busca rápida por nome/telefone do cliente
-- ✅ Índices otimizados para performance
-- ✅ Funções utilitárias prontas para usar