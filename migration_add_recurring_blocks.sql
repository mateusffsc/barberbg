-- MIGRAÇÃO: Adicionar suporte a bloqueios recorrentes
-- Objetivo: Permitir criar bloqueios que se repetem automaticamente

-- IMPORTANTE: Execute este script no Supabase SQL Editor

BEGIN;

-- 1. Adicionar colunas para suporte a recorrência
ALTER TABLE schedule_blocks 
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS recurrence_type VARCHAR(20) CHECK (recurrence_type IN ('daily', 'weekly', 'monthly')),
ADD COLUMN IF NOT EXISTS recurrence_pattern JSONB,
ADD COLUMN IF NOT EXISTS recurrence_end_date DATE,
ADD COLUMN IF NOT EXISTS parent_block_id INTEGER REFERENCES schedule_blocks(id) ON DELETE CASCADE;

-- 2. Criar índices para otimizar consultas de bloqueios recorrentes
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_recurring ON schedule_blocks(is_recurring) WHERE is_recurring = TRUE;
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_parent ON schedule_blocks(parent_block_id) WHERE parent_block_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_recurrence_type ON schedule_blocks(recurrence_type) WHERE recurrence_type IS NOT NULL;

-- 3. Adicionar constraints de validação
ALTER TABLE schedule_blocks 
ADD CONSTRAINT chk_recurrence_consistency 
CHECK (
    (is_recurring = FALSE AND recurrence_type IS NULL AND recurrence_pattern IS NULL AND recurrence_end_date IS NULL AND parent_block_id IS NULL)
    OR
    (is_recurring = TRUE AND recurrence_type IS NOT NULL AND recurrence_pattern IS NOT NULL AND recurrence_end_date IS NOT NULL)
);

ALTER TABLE schedule_blocks 
ADD CONSTRAINT chk_recurrence_end_date_valid 
CHECK (recurrence_end_date IS NULL OR recurrence_end_date >= block_date);

-- 4. Função para gerar bloqueios recorrentes
CREATE OR REPLACE FUNCTION generate_recurring_blocks(
    p_parent_block_id INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    parent_block RECORD;
    block_date_iter DATE;
    end_date DATE;
    generated_count INTEGER := 0;
    days_of_week INTEGER[];
    day_of_month INTEGER;
    interval_days INTEGER;
    i INTEGER;
BEGIN
    -- Buscar o bloqueio pai
    SELECT * INTO parent_block 
    FROM schedule_blocks 
    WHERE id = p_parent_block_id AND is_recurring = TRUE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bloqueio pai não encontrado ou não é recorrente';
    END IF;
    
    block_date_iter := parent_block.block_date;
    end_date := parent_block.recurrence_end_date;
    
    -- Processar baseado no tipo de recorrência
    CASE parent_block.recurrence_type
        WHEN 'daily' THEN
            interval_days := COALESCE((parent_block.recurrence_pattern->>'interval')::INTEGER, 1);
            block_date_iter := block_date_iter + interval_days;
            
            WHILE block_date_iter <= end_date LOOP
                INSERT INTO schedule_blocks (
                    barber_id, block_date, start_time, end_time, reason,
                    is_recurring, recurrence_type, recurrence_pattern, 
                    recurrence_end_date, parent_block_id, created_by
                ) VALUES (
                    parent_block.barber_id, block_date_iter, parent_block.start_time, 
                    parent_block.end_time, parent_block.reason,
                    FALSE, NULL, NULL, NULL, p_parent_block_id, parent_block.created_by
                );
                
                generated_count := generated_count + 1;
                block_date_iter := block_date_iter + interval_days;
            END LOOP;
            
        WHEN 'weekly' THEN
            -- Extrair dias da semana do padrão JSON (chave: days_of_week)
            SELECT COALESCE(array_agg(value::INTEGER), ARRAY[]::INTEGER[]) INTO days_of_week
            FROM jsonb_array_elements_text(parent_block.recurrence_pattern->'days_of_week');

            -- Se não houver padrão, repetir no mesmo dia da semana do bloqueio pai
            IF array_length(days_of_week, 1) IS NULL THEN
                days_of_week := ARRAY[EXTRACT(DOW FROM parent_block.block_date)::INTEGER];
            END IF;

            -- Começar a partir do dia seguinte ao bloqueio pai (não contar o dia selecionado)
            block_date_iter := parent_block.block_date + 1;

            WHILE block_date_iter <= end_date LOOP
                -- Inserir apenas nas próximas ocorrências do(s) dia(s) da semana definido(s)
                IF EXTRACT(DOW FROM block_date_iter)::INTEGER = ANY(days_of_week) THEN
                    INSERT INTO schedule_blocks (
                        barber_id, block_date, start_time, end_time, reason,
                        is_recurring, recurrence_type, recurrence_pattern, 
                        recurrence_end_date, parent_block_id, created_by
                    ) VALUES (
                        parent_block.barber_id, block_date_iter, parent_block.start_time, 
                        parent_block.end_time, parent_block.reason,
                        FALSE, NULL, NULL, NULL, p_parent_block_id, parent_block.created_by
                    );
                    
                    generated_count := generated_count + 1;
                END IF;
                
                block_date_iter := block_date_iter + 1;
            END LOOP;
            
        WHEN 'monthly' THEN
            day_of_month := (parent_block.recurrence_pattern->>'day')::INTEGER;
            block_date_iter := (DATE_TRUNC('month', block_date_iter) + INTERVAL '1 month' + (day_of_month - 1 || ' days')::INTERVAL)::DATE;
            
            WHILE block_date_iter <= end_date LOOP
                -- Verificar se o dia existe no mês (evitar 31 de fevereiro, etc.)
                IF EXTRACT(DAY FROM block_date_iter) = day_of_month THEN
                    INSERT INTO schedule_blocks (
                        barber_id, block_date, start_time, end_time, reason,
                        is_recurring, recurrence_type, recurrence_pattern, 
                        recurrence_end_date, parent_block_id, created_by
                    ) VALUES (
                        parent_block.barber_id, block_date_iter, parent_block.start_time, 
                        parent_block.end_time, parent_block.reason,
                        FALSE, NULL, NULL, NULL, p_parent_block_id, parent_block.created_by
                    );
                    
                    generated_count := generated_count + 1;
                END IF;
                
                block_date_iter := (DATE_TRUNC('month', block_date_iter) + INTERVAL '1 month' + (day_of_month - 1 || ' days')::INTERVAL)::DATE;
            END LOOP;
    END CASE;
    
    RETURN generated_count;
END;
$$ LANGUAGE plpgsql;

-- 5. Função para deletar bloqueios recorrentes
CREATE OR REPLACE FUNCTION delete_recurring_blocks(
    p_parent_block_id INTEGER,
    p_delete_future_only BOOLEAN DEFAULT FALSE
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    IF p_delete_future_only THEN
        -- Deletar apenas bloqueios futuros
        DELETE FROM schedule_blocks 
        WHERE parent_block_id = p_parent_block_id 
        AND block_date >= CURRENT_DATE;
    ELSE
        -- Deletar todos os bloqueios filhos
        DELETE FROM schedule_blocks 
        WHERE parent_block_id = p_parent_block_id;
    END IF;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Deletar o bloqueio pai se não for apenas futuros
    IF NOT p_delete_future_only THEN
        DELETE FROM schedule_blocks WHERE id = p_parent_block_id;
        deleted_count := deleted_count + 1;
    END IF;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger para gerar bloqueios automaticamente após inserção
CREATE OR REPLACE FUNCTION trigger_generate_recurring_blocks()
RETURNS TRIGGER AS $$
BEGIN
    -- Se for um bloqueio recorrente, gerar os bloqueios filhos
    IF NEW.is_recurring = TRUE AND NEW.parent_block_id IS NULL THEN
        PERFORM generate_recurring_blocks(NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_generate_recurring_blocks
    AFTER INSERT ON schedule_blocks
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generate_recurring_blocks();

-- 7. Adicionar comentários para documentação
COMMENT ON COLUMN schedule_blocks.is_recurring IS 'Indica se este é um bloqueio recorrente (pai) ou único';
COMMENT ON COLUMN schedule_blocks.recurrence_type IS 'Tipo de recorrência: daily, weekly, monthly';
COMMENT ON COLUMN schedule_blocks.recurrence_pattern IS 'Padrão específico da recorrência em formato JSON';
COMMENT ON COLUMN schedule_blocks.recurrence_end_date IS 'Data final da recorrência';
COMMENT ON COLUMN schedule_blocks.parent_block_id IS 'ID do bloqueio pai (para bloqueios gerados automaticamente)';

-- 8. Exemplos de uso das funções
/*
-- Exemplo 1: Bloqueio diário por 30 dias
INSERT INTO schedule_blocks (
    barber_id, block_date, start_time, end_time, reason,
    is_recurring, recurrence_type, recurrence_pattern, recurrence_end_date, created_by
) VALUES (
    1, '2024-01-15', '12:00', '13:00', 'Almoço',
    TRUE, 'daily', '{"interval": 1}', '2024-02-15', 1
);

-- Exemplo 2: Bloqueio semanal (segunda, quarta, sexta) por 3 meses
INSERT INTO schedule_blocks (
    barber_id, block_date, start_time, end_time, reason,
    is_recurring, recurrence_type, recurrence_pattern, recurrence_end_date, created_by
) VALUES (
    1, '2024-01-15', '18:00', '19:00', 'Academia',
    TRUE, 'weekly', '{"days": [1, 3, 5]}', '2024-04-15', 1
);

-- Exemplo 3: Bloqueio mensal (dia 1 de cada mês) por 1 ano
INSERT INTO schedule_blocks (
    barber_id, block_date, start_time, end_time, reason,
    is_recurring, recurrence_type, recurrence_pattern, recurrence_end_date, created_by
) VALUES (
    1, '2024-01-01', '09:00', '10:00', 'Reunião mensal',
    TRUE, 'monthly', '{"day": 1}', '2024-12-31', 1
);
*/

COMMIT;

-- Verificar se as colunas foram adicionadas corretamente
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'schedule_blocks'
AND column_name IN ('is_recurring', 'recurrence_type', 'recurrence_pattern', 'recurrence_end_date', 'parent_block_id')
ORDER BY ordinal_position;