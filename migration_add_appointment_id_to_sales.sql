-- Migração para adicionar coluna appointment_id à tabela sales
-- Esta coluna permite vincular vendas de produtos a agendamentos específicos

BEGIN;

-- Adicionar coluna appointment_id à tabela sales
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL;

-- Adicionar coluna sale_datetime se não existir (para compatibilidade)
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS sale_datetime TIMESTAMP DEFAULT NOW();

-- Criar índice para melhor performance nas consultas
CREATE INDEX IF NOT EXISTS idx_sales_appointment_id ON sales(appointment_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_datetime ON sales(sale_datetime);

-- Comentários para documentação
COMMENT ON COLUMN sales.appointment_id IS 'ID do agendamento vinculado à venda (opcional)';
COMMENT ON COLUMN sales.sale_datetime IS 'Data e hora da venda';

COMMIT;

-- Verificar se as colunas foram adicionadas corretamente
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sales' 
AND column_name IN ('appointment_id', 'sale_datetime')
ORDER BY column_name;