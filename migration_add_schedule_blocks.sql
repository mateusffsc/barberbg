-- MIGRAÇÃO: Criar tabela para bloqueios de agenda
-- Objetivo: Permitir bloquear períodos específicos na agenda

-- IMPORTANTE: Execute este script no Supabase SQL Editor

BEGIN;

-- 1. Criar tabela schedule_blocks
CREATE TABLE IF NOT EXISTS schedule_blocks (
    id SERIAL PRIMARY KEY,
    barber_id INTEGER REFERENCES barbers(id) ON DELETE CASCADE,
    block_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- 2. Criar índices para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_barber_date ON schedule_blocks(barber_id, block_date);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_date_time ON schedule_blocks(block_date, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_created_at ON schedule_blocks(created_at);

-- 3. Adicionar constraints para validação
ALTER TABLE schedule_blocks 
ADD CONSTRAINT chk_block_date_valid 
CHECK (block_date >= CURRENT_DATE);

ALTER TABLE schedule_blocks 
ADD CONSTRAINT chk_block_time_valid 
CHECK (start_time < end_time);

ALTER TABLE schedule_blocks 
ADD CONSTRAINT chk_block_business_hours 
CHECK (start_time >= '06:00:00'::TIME AND end_time <= '23:59:59'::TIME);

-- 4. Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_schedule_blocks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Criar trigger para atualizar updated_at
CREATE TRIGGER trigger_update_schedule_blocks_updated_at
    BEFORE UPDATE ON schedule_blocks
    FOR EACH ROW
    EXECUTE FUNCTION update_schedule_blocks_updated_at();

-- 6. Adicionar comentários para documentação
COMMENT ON TABLE schedule_blocks IS 'Bloqueios de agenda para impedir agendamentos em períodos específicos';
COMMENT ON COLUMN schedule_blocks.barber_id IS 'ID do barbeiro (NULL = bloqueio geral para todos os barbeiros)';
COMMENT ON COLUMN schedule_blocks.block_date IS 'Data do bloqueio';
COMMENT ON COLUMN schedule_blocks.start_time IS 'Horário de início do bloqueio';
COMMENT ON COLUMN schedule_blocks.end_time IS 'Horário de fim do bloqueio';
COMMENT ON COLUMN schedule_blocks.reason IS 'Motivo do bloqueio (opcional)';
COMMENT ON COLUMN schedule_blocks.created_by IS 'Usuário que criou o bloqueio';

-- 7. Criar função para verificar conflitos com bloqueios
CREATE OR REPLACE FUNCTION check_schedule_block_conflict(
    p_barber_id INTEGER,
    p_appointment_date DATE,
    p_appointment_time TIME,
    p_duration_minutes INTEGER DEFAULT 30
)
RETURNS BOOLEAN AS $$
DECLARE
    appointment_end_time TIME;
    conflict_count INTEGER;
BEGIN
    -- Calcular horário de fim do agendamento
    appointment_end_time := p_appointment_time + (p_duration_minutes || ' minutes')::INTERVAL;
    
    -- Verificar se há conflito com bloqueios
    SELECT COUNT(*) INTO conflict_count
    FROM schedule_blocks
    WHERE block_date = p_appointment_date
    AND (barber_id = p_barber_id OR barber_id IS NULL) -- Bloqueio específico ou geral
    AND (
        -- Agendamento começa durante o bloqueio
        (p_appointment_time >= start_time AND p_appointment_time < end_time)
        OR
        -- Agendamento termina durante o bloqueio
        (appointment_end_time > start_time AND appointment_end_time <= end_time)
        OR
        -- Agendamento engloba todo o bloqueio
        (p_appointment_time <= start_time AND appointment_end_time >= end_time)
    );
    
    RETURN conflict_count > 0;
END;
$$ LANGUAGE plpgsql;

-- 8. Verificar se a tabela foi criada corretamente
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'schedule_blocks'
ORDER BY ordinal_position;

COMMIT;

-- 9. Exemplo de uso da função de verificação de conflito
-- SELECT check_schedule_block_conflict(1, '2024-01-15', '14:00:00', 30);