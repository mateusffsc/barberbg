-- Script para corrigir limitações de horário noturno
-- Permite agendamentos até 23:59:59

-- 1. Verificar constraints atuais
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'appointments'::regclass 
AND conname LIKE '%time%' OR conname LIKE '%hour%';

-- 2. Remover constraint antiga se existir
ALTER TABLE appointments 
DROP CONSTRAINT IF EXISTS chk_appointment_time_business_hours;

-- 3. Criar nova constraint que permite horários até 23:59:59
ALTER TABLE appointments 
ADD CONSTRAINT chk_appointment_time_business_hours 
CHECK (appointment_time >= '06:00:00'::TIME AND appointment_time <= '23:59:59'::TIME);

-- 4. Verificar se a constraint foi aplicada corretamente
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'appointments'::regclass 
AND conname = 'chk_appointment_time_business_hours';

-- 5. Testar inserção de horários noturnos
-- (Comentado para não executar automaticamente)
/*
INSERT INTO appointments (
    client_id,
    barber_id,
    appointment_datetime,
    appointment_date,
    appointment_time,
    status,
    total_price,
    duration_minutes,
    note
) VALUES (
    1, -- Substitua pelo ID de um cliente válido
    1, -- Substitua pelo ID de um barbeiro válido
    '2024-12-20T21:00:00',
    '2024-12-20',
    '21:00:00',
    'scheduled',
    30.00,
    30,
    'Teste horário noturno - 21:00'
);
*/

-- 6. Verificar agendamentos existentes em horários noturnos
SELECT 
    id,
    client_name,
    appointment_date,
    appointment_time,
    appointment_datetime,
    status
FROM appointments 
WHERE appointment_time >= '20:00:00'
ORDER BY appointment_date DESC, appointment_time DESC
LIMIT 10;

-- 7. Comentários sobre o horário de funcionamento
COMMENT ON CONSTRAINT chk_appointment_time_business_hours ON appointments 
IS 'Permite agendamentos das 06:00 às 23:59 - Horário comercial estendido para atender clientes noturnos';