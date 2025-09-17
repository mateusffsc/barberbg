-- Migração para adicionar coluna final_amount na tabela appointments
-- Execute este SQL diretamente no Supabase Dashboard > SQL Editor

-- 1. Adicionar a coluna final_amount
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS final_amount DECIMAL(10,2);

-- 2. Adicionar comentário para documentar o propósito da coluna
COMMENT ON COLUMN appointments.final_amount IS 'Valor final pago pelo cliente (pode ser diferente do total_price original)';

-- 3. Criar índice para otimizar consultas de relatórios financeiros
CREATE INDEX IF NOT EXISTS idx_appointments_final_amount 
ON appointments(final_amount) 
WHERE final_amount IS NOT NULL;

-- 4. Verificar se a coluna foi criada corretamente
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND column_name = 'final_amount';