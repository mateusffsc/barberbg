-- MIGRAÇÃO SEGURA: Alterar formato da coluna phone para apenas números (319999999)
-- Versão que remove triggers antes de alterar a coluna

BEGIN;

-- 1. BACKUP da tabela
CREATE TABLE clients_backup AS SELECT * FROM clients;

-- 2. Função para limpar telefone
CREATE OR REPLACE FUNCTION clean_phone_number(phone_input TEXT)
RETURNS TEXT AS $$
BEGIN
    IF phone_input IS NULL THEN
        RETURN NULL;
    END IF;
    -- Remover todos os caracteres que não são números
    RETURN regexp_replace(phone_input, '[^0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql;

-- 3. Listar e remover todos os triggers que dependem da coluna phone
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    -- Buscar triggers na tabela clients
    FOR trigger_record IN 
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers 
        WHERE event_object_table = 'clients'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || trigger_record.trigger_name || ' ON ' || trigger_record.event_object_table;
        RAISE NOTICE 'Trigger removido: %', trigger_record.trigger_name;
    END LOOP;
END $$;

-- 4. Remover funções relacionadas (se existirem)
DROP FUNCTION IF EXISTS sync_client_data_on_client_update() CASCADE;

-- 5. Atualizar telefones para formato numérico
UPDATE clients 
SET phone = clean_phone_number(phone)
WHERE phone IS NOT NULL;

-- 6. Alterar tipo da coluna
ALTER TABLE clients 
ALTER COLUMN phone TYPE VARCHAR(11);

-- 7. Adicionar constraint
ALTER TABLE clients 
ADD CONSTRAINT chk_phone_format 
CHECK (phone IS NULL OR (phone ~ '^[0-9]{10,11}$'));

-- 8. Criar índice
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);

-- 9. Comentário
COMMENT ON COLUMN clients.phone IS 'Telefone no formato numérico: 11999999999 ou 3199999999';

-- 10. Atualizar appointments se existir
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' 
        AND column_name = 'client_phone'
    ) THEN
        -- Remover triggers da tabela appointments também
        DROP TRIGGER IF EXISTS trigger_sync_client_data_update ON appointments;
        
        -- Atualizar telefones
        UPDATE appointments 
        SET client_phone = clean_phone_number(client_phone)
        WHERE client_phone IS NOT NULL;
        
        -- Alterar tipo
        ALTER TABLE appointments 
        ALTER COLUMN client_phone TYPE VARCHAR(11);
        
        -- Constraint
        ALTER TABLE appointments 
        ADD CONSTRAINT chk_appointments_client_phone_format 
        CHECK (client_phone IS NULL OR (client_phone ~ '^[0-9]{10,11}$'));
        
        RAISE NOTICE 'Tabela appointments também foi atualizada';
    END IF;
END $$;

-- 11. Recriar função de sincronização (versão simplificada)
CREATE OR REPLACE FUNCTION sync_client_data_on_client_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizar appointments se existir
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments') THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'appointments' 
            AND column_name IN ('client_name', 'client_phone')
        ) THEN
            UPDATE appointments 
            SET 
                client_name = NEW.name,
                client_phone = NEW.phone
            WHERE client_id = NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. Recriar trigger
CREATE TRIGGER trigger_sync_client_data_update
    AFTER UPDATE OF name, phone ON clients
    FOR EACH ROW
    EXECUTE FUNCTION sync_client_data_on_client_update();

-- 13. Trigger para manter formato numérico
CREATE OR REPLACE FUNCTION ensure_phone_format()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.phone IS NOT NULL THEN
        NEW.phone = clean_phone_number(NEW.phone);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_phone_format
    BEFORE INSERT OR UPDATE OF phone ON clients
    FOR EACH ROW
    EXECUTE FUNCTION ensure_phone_format();

-- 14. Função para formatar telefone na exibição
CREATE OR REPLACE FUNCTION format_phone_display(phone_number TEXT)
RETURNS TEXT AS $$
BEGIN
    IF phone_number IS NULL OR phone_number = '' THEN
        RETURN NULL;
    END IF;
    
    -- Celular (11 dígitos): (11) 99999-9999
    IF LENGTH(phone_number) = 11 THEN
        RETURN '(' || SUBSTRING(phone_number, 1, 2) || ') ' || 
               SUBSTRING(phone_number, 3, 5) || '-' || 
               SUBSTRING(phone_number, 8, 4);
    END IF;
    
    -- Fixo (10 dígitos): (11) 9999-9999
    IF LENGTH(phone_number) = 10 THEN
        RETURN '(' || SUBSTRING(phone_number, 1, 2) || ') ' || 
               SUBSTRING(phone_number, 3, 4) || '-' || 
               SUBSTRING(phone_number, 7, 4);
    END IF;
    
    RETURN phone_number;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- VERIFICAÇÕES:
-- SELECT id, name, phone, format_phone_display(phone) as formatted FROM clients LIMIT 5;
-- SELECT COUNT(*) FROM clients WHERE phone IS NOT NULL AND NOT (phone ~ '^[0-9]{10,11}$');

-- Para remover backup: DROP TABLE clients_backup;