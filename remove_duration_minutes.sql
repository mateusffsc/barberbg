-- Script para remover a coluna duration_minutes da tabela services
-- Esta coluna está causando conflito e deve ser removida

ALTER TABLE services DROP COLUMN IF EXISTS duration_minutes;

-- Verificar se a coluna foi removida
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'services' 
  AND table_schema = 'public'
ORDER BY ordinal_position;