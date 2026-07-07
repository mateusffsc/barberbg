-- Migração: adicionar controle de status ativo na tabela users
-- Objetivo: permitir ativar/inativar barbeiros sem perder histórico

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

UPDATE users
SET is_active = true
WHERE is_active IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'barbers'
          AND column_name = 'is_active'
    ) THEN
        UPDATE users AS u
        SET is_active = COALESCE(b.is_active, true)
        FROM barbers AS b
        WHERE b.user_id = u.id;
    END IF;
END $$;

ALTER TABLE users
ALTER COLUMN is_active SET DEFAULT true;

ALTER TABLE users
ALTER COLUMN is_active SET NOT NULL;

COMMENT ON COLUMN users.is_active IS 'Controla se o usuario/barbeiro esta ativo para uso no sistema';
