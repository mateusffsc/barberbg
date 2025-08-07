-- Migration para adicionar formas de pagamento
-- Execute este SQL no Supabase SQL Editor

-- 1. Criar o tipo ENUM para payment_method
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_enum') THEN
        CREATE TYPE payment_method_enum AS ENUM (
            'money',
            'pix', 
            'credit_card',
            'debit_card'
        );
    END IF;
END$$;

-- 2. Adicionar coluna payment_method na tabela sales
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS payment_method payment_method_enum NOT NULL DEFAULT 'money';

-- 3. Adicionar coluna payment_method na tabela appointments (opcional, apenas para agendamentos concluídos)
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS payment_method payment_method_enum;

-- 4. Criar índices para melhor performance (opcional)
CREATE INDEX IF NOT EXISTS idx_sales_payment_method ON sales(payment_method);
CREATE INDEX IF NOT EXISTS idx_appointments_payment_method ON appointments(payment_method) WHERE payment_method IS NOT NULL;

-- 5. Comentários para documentação
COMMENT ON COLUMN sales.payment_method IS 'Forma de pagamento utilizada na venda';
COMMENT ON COLUMN appointments.payment_method IS 'Forma de pagamento utilizada no agendamento (apenas quando concluído)';
COMMENT ON TYPE payment_method_enum IS 'Tipos de forma de pagamento: dinheiro, pix, cartão de crédito, cartão de débito';

-- 6. Verificar se as colunas foram criadas corretamente
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('sales', 'appointments') 
  AND column_name = 'payment_method'
ORDER BY table_name;

-- 7. Verificar se o ENUM foi criado corretamente
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'payment_method_enum'::regtype
ORDER BY enumlabel;