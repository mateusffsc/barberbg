-- MIGRAÇÃO: Alterar formato da coluna phone para apenas números (319999999)
-- Tabela: clients
-- Objetivo: Padronizar telefones para formato numérico sem formatação

-- IMPORTANTE: Execute este script no Supabase SQL Editor

BEGIN;

-- 1. BACKUP da tabela (recomendado)
CREATE TABLE clients_backup AS SELECT * FROM clients;

-- 2. Criar função para limpar telefone (remover formatação)
CREATE OR REPLACE FUNCTION clean_phone_number(phone_input TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Se phone_input for NULL, retornar NULL
    IF phone_input IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Remover todos os caracteres que não são números
    RETURN regexp_replace(phone_input, '[^0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql;

-- 3. Atualizar todos os telefones existentes para formato numérico
UPDATE clients 
SET phone = clean_phone_number(phone)
WHERE phone IS NOT NULL;

-- 4. Remover registros com telefones inválidos (opcional)
-- Descomente as linhas abaixo se quiser remover telefones muito curtos ou muito longos
-- DELETE FROM clients WHERE phone IS NOT NULL AND (LENGTH(phone) < 10 OR LENGTH(phone) > 11);

-- 5. Remover triggers que dependem da coluna phone
DROP TRIGGER IF EXISTS trigger_sync_client_data_update ON clients;
DROP FUNCTION IF EXISTS sync_client_data_on_client_update();

-- 6. Alterar o tipo da coluna para VARCHAR(11) (máximo 11 dígitos)
ALTER TABLE clients 
ALTER COLUMN phone TYPE VARCHAR(11);

-- 7. Adicionar constraint para validar formato do telefone
ALTER TABLE clients 
ADD CONSTRAINT chk_phone_format 
CHECK (phone IS NULL OR (phone ~ '^[0-9]{10,11}$'));

-- 8. Criar índice para busca por telefone
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);

-- 9. Comentário na coluna
COMMENT ON COLUMN clients.phone IS 'Telefone no formato numérico: 11999999999 ou 3199999999';

-- 10. Recriar o trigger que foi removido (se necessário para sincronização com appointments)
CREATE OR REPLACE FUNCTION sync_client_data_on_client_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizar dados do cliente em todos os agendamentos (se a tabela appointments existir)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments') THEN
        -- Verificar se as colunas existem na tabela appointments
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

-- 11. Recriar o trigger
CREATE TRIGGER trigger_sync_client_data_update
    AFTER UPDATE OF name, phone ON clients
    FOR EACH ROW
    EXECUTE FUNCTION sync_client_data_on_client_update();

-- 12. Atualizar também a tabela appointments se ela já tiver a coluna client_phone
-- (Execute apenas se a coluna client_phone já existir na tabela appointments)
DO $$
BEGIN
    -- Verificar se a coluna existe
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' 
        AND column_name = 'client_phone'
    ) THEN
        -- Atualizar telefones na tabela appointments
        UPDATE appointments 
        SET client_phone = clean_phone_number(client_phone)
        WHERE client_phone IS NOT NULL;
        
        -- Alterar tipo da coluna
        ALTER TABLE appointments 
        ALTER COLUMN client_phone TYPE VARCHAR(11);
        
        -- Adicionar constraint
        ALTER TABLE appointments 
        ADD CONSTRAINT chk_appointments_client_phone_format 
        CHECK (client_phone IS NULL OR (client_phone ~ '^[0-9]{10,11}$'));
        
        -- Comentário
        COMMENT ON COLUMN appointments.client_phone IS 'Telefone do cliente no formato numérico: 11999999999 ou 3199999999';
        
        RAISE NOTICE 'Coluna client_phone na tabela appointments também foi atualizada';
    ELSE
        RAISE NOTICE 'Coluna client_phone não existe na tabela appointments';
    END IF;
END $$;

-- 13. Atualizar triggers existentes para manter formato numérico
CREATE OR REPLACE FUNCTION ensure_phone_format()
RETURNS TRIGGER AS $$
BEGIN
    -- Limpar telefone antes de inserir/atualizar
    IF NEW.phone IS NOT NULL THEN
        NEW.phone = clean_phone_number(NEW.phone);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 14. Criar trigger para manter formato automático
DROP TRIGGER IF EXISTS trigger_ensure_phone_format ON clients;
CREATE TRIGGER trigger_ensure_phone_format
    BEFORE INSERT OR UPDATE OF phone ON clients
    FOR EACH ROW
    EXECUTE FUNCTION ensure_phone_format();

-- 15. Função utilitária para formatar telefone para exibição
CREATE OR REPLACE FUNCTION format_phone_display(phone_number TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Se for NULL, retornar NULL
    IF phone_number IS NULL OR phone_number = '' THEN
        RETURN NULL;
    END IF;
    
    -- Se tiver 11 dígitos (celular): (11) 99999-9999
    IF LENGTH(phone_number) = 11 THEN
        RETURN '(' || SUBSTRING(phone_number, 1, 2) || ') ' || 
               SUBSTRING(phone_number, 3, 5) || '-' || 
               SUBSTRING(phone_number, 8, 4);
    END IF;
    
    -- Se tiver 10 dígitos (fixo): (11) 9999-9999
    IF LENGTH(phone_number) = 10 THEN
        RETURN '(' || SUBSTRING(phone_number, 1, 2) || ') ' || 
               SUBSTRING(phone_number, 3, 4) || '-' || 
               SUBSTRING(phone_number, 7, 4);
    END IF;
    
    -- Se não for padrão conhecido, retornar como está
    RETURN phone_number;
END;
$$ LANGUAGE plpgsql;

-- 16. View para exibir telefones formatados
CREATE OR REPLACE VIEW clients_formatted AS
SELECT 
    id,
    name,
    phone,
    format_phone_display(phone) as phone_formatted,
    email,
    created_at,
    updated_at
FROM clients;

COMMIT;

-- VERIFICAÇÕES PÓS-MIGRAÇÃO:
-- Execute estas queries para verificar se tudo está correto:

-- 1. Verificar telefones atualizados
-- SELECT id, name, phone, format_phone_display(phone) as formatted 
-- FROM clients WHERE phone IS NOT NULL LIMIT 10;

-- 2. Verificar se não há telefones inválidos
-- SELECT COUNT(*) as invalid_phones 
-- FROM clients 
-- WHERE phone IS NOT NULL AND NOT (phone ~ '^[0-9]{10,11}$');

-- 3. Testar inserção com telefone formatado
-- INSERT INTO clients (name, phone, email) 
-- VALUES ('Teste', '(11) 99999-9999', 'teste@email.com');
-- SELECT phone FROM clients WHERE name = 'Teste';

-- 4. Testar função de formatação
-- SELECT format_phone_display('11999999999') as celular,
--        format_phone_display('1133334444') as fixo;

-- EXEMPLOS DE TELEFONES APÓS MIGRAÇÃO:
-- Entrada: "(11) 99999-9999" → Saída: "11999999999"
-- Entrada: "11 99999-9999"   → Saída: "11999999999"  
-- Entrada: "+55 11 99999-9999" → Saída: "5511999999999"
-- Entrada: "31 9999-9999"    → Saída: "3199999999"

-- Para remover o backup após confirmar que tudo está funcionando:
-- DROP TABLE clients_backup;