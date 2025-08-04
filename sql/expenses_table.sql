-- Criar tabela de despesas
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  category VARCHAR(100) NOT NULL,
  expense_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);

-- Adicionar RLS (Row Level Security) se necessário
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Política para permitir que apenas admins vejam as despesas
CREATE POLICY IF NOT EXISTS "Apenas admins podem ver despesas" ON expenses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Comentários para documentação
COMMENT ON TABLE expenses IS 'Tabela para armazenar despesas da barbearia';
COMMENT ON COLUMN expenses.description IS 'Descrição da despesa';
COMMENT ON COLUMN expenses.amount IS 'Valor da despesa em reais';
COMMENT ON COLUMN expenses.category IS 'Categoria da despesa (Aluguel, Energia, etc.)';
COMMENT ON COLUMN expenses.expense_date IS 'Data em que a despesa foi efetuada';
COMMENT ON COLUMN expenses.notes IS 'Observações adicionais sobre a despesa';