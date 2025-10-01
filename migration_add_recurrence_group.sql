-- Migração para adicionar campo de grupo de recorrência aos agendamentos
-- Isso permitirá identificar agendamentos que fazem parte da mesma série recorrente

-- Adicionar coluna recurrence_group_id para agrupar agendamentos recorrentes
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS recurrence_group_id UUID DEFAULT NULL;

-- Criar índice para melhorar performance nas consultas de agendamentos recorrentes
CREATE INDEX IF NOT EXISTS idx_appointments_recurrence_group 
ON appointments(recurrence_group_id) 
WHERE recurrence_group_id IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN appointments.recurrence_group_id IS 'UUID que agrupa agendamentos criados na mesma série recorrente. NULL para agendamentos únicos.';