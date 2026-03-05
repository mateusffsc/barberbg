-- Migração: Adicionar campo is_active à tabela barbers
-- Data: 2026-03-05
-- Objetivo: Permitir ocultar barbeiros do frontend sem perder dados históricos

-- 1. Adicionar coluna is_active à tabela barbers
ALTER TABLE barbers 
ADD COLUMN is_active BOOLEAN DEFAULT true;

-- 2. Comentário na coluna
COMMENT ON COLUMN barbers.is_active IS 'Indica se o barbeiro está ativo e deve aparecer no frontend';

-- 3. Desativar o barbeiro Luiz Henrique
UPDATE barbers 
SET is_active = false 
WHERE name ILIKE '%luiz henrique%';

-- 4. Verificar resultado
SELECT id, name, is_active 
FROM barbers 
ORDER BY name;