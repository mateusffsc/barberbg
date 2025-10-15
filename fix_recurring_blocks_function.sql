-- CORREÇÃO: Função generate_recurring_blocks
-- Problema: A função estava criando bloqueios filhos com is_recurring=FALSE mas com dados de recorrência não nulos
-- Solução: Garantir que bloqueios filhos tenham TODOS os campos de recorrência como NULL

BEGIN;

-- Recriar a função generate_recurring_blocks corrigida
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
    target_day_of_week INTEGER;
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
                    
                    -- Avançar um dia
                    block_date_iter := block_date_iter + 1;
                END LOOP;
            
        WHEN 'monthly' THEN
            day_of_month := (parent_block.recurrence_pattern->>'day_of_month')::INTEGER;
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

-- Verificar se o trigger existe e está ativo
DO $$
BEGIN
    -- Recriar o trigger se necessário
    DROP TRIGGER IF EXISTS trigger_auto_generate_recurring_blocks ON schedule_blocks;
    
    CREATE TRIGGER trigger_auto_generate_recurring_blocks
        AFTER INSERT ON schedule_blocks
        FOR EACH ROW
        EXECUTE FUNCTION trigger_generate_recurring_blocks();
        
    RAISE NOTICE 'Trigger trigger_auto_generate_recurring_blocks recriado com sucesso';
END $$;

COMMIT;

-- Teste da correção
SELECT 'Função generate_recurring_blocks corrigida com sucesso!' as status;