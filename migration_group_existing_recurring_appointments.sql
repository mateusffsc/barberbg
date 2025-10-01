-- Migração para agrupar agendamentos recorrentes existentes
-- Este script identifica agendamentos que seguem padrões recorrentes e os agrupa com recurrence_group_id

-- Função para detectar e agrupar agendamentos recorrentes
CREATE OR REPLACE FUNCTION group_existing_recurring_appointments()
RETURNS TABLE(
    grouped_count INTEGER,
    total_groups INTEGER
) AS $$
DECLARE
    rec RECORD;
    group_uuid UUID;
    appointment_ids INTEGER[];
    grouped_appointments INTEGER := 0;
    total_groups_created INTEGER := 0;
BEGIN
    -- Buscar grupos de agendamentos que podem ser recorrentes
    -- Critérios: mesmo cliente, barbeiro, serviços, horário e intervalo regular entre datas
    FOR rec IN
        WITH appointment_patterns AS (
            SELECT 
                client_id,
                barber_id,
                services_ids,
                EXTRACT(HOUR FROM appointment_datetime::timestamp) as hour_part,
                EXTRACT(MINUTE FROM appointment_datetime::timestamp) as minute_part,
                EXTRACT(DOW FROM appointment_datetime::timestamp) as day_of_week,
                array_agg(id ORDER BY appointment_datetime) as appointment_ids,
                array_agg(appointment_datetime::date ORDER BY appointment_datetime) as dates,
                COUNT(*) as appointment_count
            FROM appointments 
            WHERE 
                recurrence_group_id IS NULL 
                AND status != 'cancelled'
                AND appointment_datetime >= CURRENT_DATE - INTERVAL '6 months' -- Últimos 6 meses
            GROUP BY 
                client_id, 
                barber_id, 
                services_ids, 
                EXTRACT(HOUR FROM appointment_datetime::timestamp),
                EXTRACT(MINUTE FROM appointment_datetime::timestamp),
                EXTRACT(DOW FROM appointment_datetime::timestamp)
            HAVING COUNT(*) >= 3 -- Pelo menos 3 agendamentos para considerar recorrente
        ),
        recurring_patterns AS (
            SELECT 
                *,
                -- Calcular intervalos entre datas consecutivas
                (
                    SELECT array_agg(
                        (dates[i+1] - dates[i])::integer
                    )
                    FROM generate_series(1, array_length(dates, 1) - 1) as i
                ) as intervals
            FROM appointment_patterns
        )
        SELECT 
            client_id,
            barber_id,
            services_ids,
            hour_part,
            minute_part,
            day_of_week,
            appointment_ids,
            dates,
            appointment_count,
            intervals
        FROM recurring_patterns
        WHERE 
            -- Verificar se os intervalos são consistentes (variação máxima de 1 dia)
            (
                SELECT bool_and(
                    abs(interval_val - (
                        SELECT avg(interval_val2)::integer 
                        FROM unnest(intervals) as interval_val2
                    )) <= 1
                )
                FROM unnest(intervals) as interval_val
            ) = true
            AND array_length(intervals, 1) >= 2 -- Pelo menos 2 intervalos para validar padrão
    LOOP
        -- Gerar novo UUID para o grupo
        group_uuid := gen_random_uuid();
        
        -- Atualizar todos os agendamentos do grupo
        UPDATE appointments 
        SET recurrence_group_id = group_uuid
        WHERE id = ANY(rec.appointment_ids);
        
        -- Contar agendamentos agrupados
        grouped_appointments := grouped_appointments + rec.appointment_count;
        total_groups_created := total_groups_created + 1;
        
        -- Log do grupo criado
        RAISE NOTICE 'Grupo criado: % agendamentos para cliente %, barbeiro %, às %:%h, dia da semana %', 
            rec.appointment_count, rec.client_id, rec.barber_id, rec.hour_part, rec.minute_part, rec.day_of_week;
    END LOOP;
    
    RETURN QUERY SELECT grouped_appointments, total_groups_created;
END;
$$ LANGUAGE plpgsql;

-- Executar a função de agrupamento
SELECT * FROM group_existing_recurring_appointments();

-- Verificar resultados
SELECT 
    'Agendamentos com recurrence_group_id' as description,
    COUNT(*) as count
FROM appointments 
WHERE recurrence_group_id IS NOT NULL

UNION ALL

SELECT 
    'Total de grupos únicos' as description,
    COUNT(DISTINCT recurrence_group_id) as count
FROM appointments 
WHERE recurrence_group_id IS NOT NULL

UNION ALL

SELECT 
    'Agendamentos sem recurrence_group_id' as description,
    COUNT(*) as count
FROM appointments 
WHERE recurrence_group_id IS NULL;

-- Exemplo de consulta para verificar um grupo específico
SELECT 
    id,
    client_name,
    barber_name,
    services_names,
    appointment_datetime,
    recurrence_group_id
FROM appointments 
WHERE recurrence_group_id IS NOT NULL
ORDER BY recurrence_group_id, appointment_datetime
LIMIT 20;

-- Remover a função temporária após uso
DROP FUNCTION IF EXISTS group_existing_recurring_appointments();