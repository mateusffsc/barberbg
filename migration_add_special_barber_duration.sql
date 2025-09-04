-- Migração para adicionar campos de duração especial e barbeiro especial
-- Data: 2024
-- Descrição: Adiciona campos duration_minutes_normal e duration_minutes_special na tabela services
--            e campo is_special_barber na tabela barbers

-- 1. Adicionar campos de duração na tabela services
ALTER TABLE services 
ADD COLUMN duration_minutes_normal INTEGER DEFAULT 30,
ADD COLUMN duration_minutes_special INTEGER DEFAULT 40;

-- 2. Migrar dados existentes: copiar duration_minutes para duration_minutes_normal
UPDATE services 
SET duration_minutes_normal = duration_minutes
WHERE duration_minutes_normal IS NULL;

-- 3. Para serviços que contêm "corte", definir duration_minutes_special como 40
UPDATE services 
SET duration_minutes_special = 40
WHERE LOWER(name) LIKE '%corte%' AND duration_minutes_special IS NULL;

-- 4. Para outros serviços, manter o mesmo tempo para ambos
UPDATE services 
SET duration_minutes_special = duration_minutes_normal
WHERE LOWER(name) NOT LIKE '%corte%' AND duration_minutes_special IS NULL;

-- 5. Adicionar campo is_special_barber na tabela barbers
ALTER TABLE barbers 
ADD COLUMN is_special_barber BOOLEAN DEFAULT FALSE;

-- 6. Criar índice para otimização
CREATE INDEX IF NOT EXISTS idx_barbers_is_special ON barbers(is_special_barber);

-- 7. Criar função para calcular duração baseada no tipo de barbeiro
CREATE OR REPLACE FUNCTION get_service_duration(
    p_service_id INTEGER,
    p_barber_id INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_special_barber BOOLEAN;
    v_duration_normal INTEGER;
    v_duration_special INTEGER;
BEGIN
    -- Verificar se o barbeiro é especial
    SELECT is_special_barber INTO v_is_special_barber
    FROM barbers
    WHERE id = p_barber_id;
    
    -- Se não encontrar o barbeiro, retornar NULL
    IF v_is_special_barber IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Buscar as durações do serviço
    SELECT duration_minutes_normal, duration_minutes_special
    INTO v_duration_normal, v_duration_special
    FROM services
    WHERE id = p_service_id;
    
    -- Se não encontrar o serviço, retornar NULL
    IF v_duration_normal IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Retornar a duração apropriada baseada no tipo de barbeiro
    IF v_is_special_barber THEN
        RETURN COALESCE(v_duration_special, v_duration_normal);
    ELSE
        RETURN v_duration_normal;
    END IF;
END;
$$;

-- 8. Comentários sobre a migração
COMMENT ON COLUMN services.duration_minutes_normal IS 'Duração em minutos para barbeiros normais';
COMMENT ON COLUMN services.duration_minutes_special IS 'Duração em minutos para barbeiros especiais';
COMMENT ON COLUMN barbers.is_special_barber IS 'Indica se o barbeiro é especial (usa tempo diferenciado)';
COMMENT ON FUNCTION get_service_duration(INTEGER, INTEGER) IS 'Calcula a duração do serviço baseada no tipo de barbeiro';

-- Verificação final
SELECT 'Migração concluída com sucesso!' as status;