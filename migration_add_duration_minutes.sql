-- Migração para adicionar coluna duration_minutes na tabela appointments
-- Esta coluna armazenará a duração customizada do agendamento em minutos
-- Se for NULL, o sistema usará a duração padrão dos serviços

-- Adicionar coluna duration_minutes
ALTER TABLE appointments 
ADD COLUMN duration_minutes INTEGER;

-- Comentário da coluna
COMMENT ON COLUMN appointments.duration_minutes IS 'Duração customizada do agendamento em minutos. Se NULL, usa duração padrão dos serviços.';

-- Criar índice para otimizar consultas por duração
CREATE INDEX idx_appointments_duration_minutes ON appointments(duration_minutes);

-- Atualizar appointments existentes com duração calculada dos serviços
-- Esta query calcula a duração baseada nos serviços já agendados
UPDATE appointments 
SET duration_minutes = (
    SELECT COALESCE(
        SUM(
            CASE 
                WHEN b.is_special_barber = true THEN 
                    COALESCE(s.duration_minutes_special, s.duration_minutes_normal, 30)
                ELSE 
                    COALESCE(s.duration_minutes_normal, 30)
            END
        ), 
        30
    )
    FROM appointment_services aps
    JOIN services s ON s.id = aps.service_id
    JOIN barbers b ON b.id = appointments.barber_id
    WHERE aps.appointment_id = appointments.id
)
WHERE duration_minutes IS NULL;

-- Verificar se a migração foi aplicada corretamente
SELECT 
    'Migração aplicada com sucesso!' as status,
    COUNT(*) as total_appointments,
    COUNT(duration_minutes) as appointments_with_duration,
    AVG(duration_minutes) as avg_duration_minutes
FROM appointments;