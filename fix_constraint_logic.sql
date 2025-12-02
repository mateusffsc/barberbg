-- CORREÇÃO: Constraint chk_recurrence_consistency
-- Problema: A constraint não permite bloqueios filhos (is_recurring=FALSE com parent_block_id não NULL)
-- Solução: Modificar a constraint para permitir três cenários válidos

BEGIN;

-- Remover a constraint atual
ALTER TABLE schedule_blocks 
DROP CONSTRAINT IF EXISTS chk_recurrence_consistency;

-- Criar a constraint corrigida que permite:
-- 1. Bloqueios normais: is_recurring=FALSE, parent_block_id=NULL, campos de recorrência=NULL
-- 2. Bloqueios pais recorrentes: is_recurring=TRUE, campos de recorrência preenchidos, parent_block_id=NULL
-- 3. Bloqueios filhos: is_recurring=FALSE, parent_block_id preenchido, campos de recorrência=NULL
ALTER TABLE schedule_blocks 
ADD CONSTRAINT chk_recurrence_consistency 
CHECK (
    -- Cenário 1: Bloqueios normais (não recorrentes, sem pai)
    (is_recurring = FALSE 
     AND recurrence_type IS NULL 
     AND recurrence_pattern IS NULL 
     AND recurrence_end_date IS NULL 
     AND parent_block_id IS NULL)
    OR
    -- Cenário 2: Bloqueios pais recorrentes
    (is_recurring = TRUE 
     AND recurrence_type IS NOT NULL 
     AND recurrence_pattern IS NOT NULL 
     AND recurrence_end_date IS NOT NULL 
     AND parent_block_id IS NULL)
    OR
    -- Cenário 3: Bloqueios filhos (gerados por recorrência)
    (is_recurring = FALSE 
     AND recurrence_type IS NULL 
     AND recurrence_pattern IS NULL 
     AND recurrence_end_date IS NULL 
     AND parent_block_id IS NOT NULL)
);

COMMIT;

-- Teste da correção
SELECT 'Constraint chk_recurrence_consistency corrigida com sucesso!' as status;