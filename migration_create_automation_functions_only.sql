-- MIGRAÇÃO: Criar apenas as funções de automação
-- Para bancos que já têm a estrutura básica

BEGIN;

-- 1. Verificar e criar tipos apenas se não existirem
DO $$
BEGIN
    -- Criar payment_method_enum se não existir
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_enum') THEN
        CREATE TYPE payment_method_enum AS ENUM ('money', 'pix', 'credit_card', 'debit_card');
    END IF;
    
    -- Criar appointment_status_enum se não existir
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status_enum') THEN
        CREATE TYPE appointment_status_enum AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');
    END IF;
END $$;

-- 2. Função para criar cliente automaticamente se não existir
CREATE OR REPLACE FUNCTION create_or_get_client(
    p_name VARCHAR(255),
    p_phone VARCHAR(20) DEFAULT NULL,
    p_email VARCHAR(255) DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    client_id INTEGER;
BEGIN
    -- Tentar encontrar cliente existente por nome e telefone
    SELECT id INTO client_id
    FROM clients 
    WHERE name = p_name 
    AND (p_phone IS NULL OR phone = p_phone)
    LIMIT 1;
    
    -- Se não encontrou, criar novo cliente
    IF client_id IS NULL THEN
        INSERT INTO clients (name, phone, email)
        VALUES (p_name, p_phone, p_email)
        RETURNING id INTO client_id;
    END IF;
    
    RETURN client_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Função para criar agendamento completo
CREATE OR REPLACE FUNCTION create_appointment_automated(
    -- Dados obrigatórios
    p_client_name VARCHAR(255),
    p_barber_id INTEGER,
    p_appointment_datetime TIMESTAMP,
    p_service_ids INTEGER[],
    
    -- Dados opcionais (todos com default)
    p_client_phone VARCHAR(20) DEFAULT NULL,
    p_client_email VARCHAR(255) DEFAULT NULL,
    p_note TEXT DEFAULT NULL,
    p_auto_create_client BOOLEAN DEFAULT TRUE
)
RETURNS JSON AS $$
DECLARE
    v_client_id INTEGER;
    v_appointment_id INTEGER;
    v_total_price DECIMAL(10,2) := 0;
    v_total_duration INTEGER := 0;
    v_service_record RECORD;
    v_barber_record RECORD;
    v_result JSON;
    v_has_desnormalized_columns BOOLEAN := FALSE;
BEGIN
    -- Verificar se as colunas desnormalizadas existem
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' 
        AND column_name IN ('client_name', 'barber_name', 'services_names')
    ) INTO v_has_desnormalized_columns;
    
    -- 1. Obter ou criar cliente
    IF p_auto_create_client THEN
        v_client_id := create_or_get_client(p_client_name, p_client_phone, p_client_email);
    ELSE
        SELECT id INTO v_client_id FROM clients WHERE name = p_client_name LIMIT 1;
        IF v_client_id IS NULL THEN
            RAISE EXCEPTION 'Cliente não encontrado: %', p_client_name;
        END IF;
    END IF;
    
    -- 2. Validar barbeiro
    SELECT * INTO v_barber_record FROM barbers WHERE id = p_barber_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Barbeiro não encontrado: %', p_barber_id;
    END IF;
    
    -- 3. Calcular preço total e duração
    FOR v_service_record IN 
        SELECT * FROM services WHERE id = ANY(p_service_ids)
    LOOP
        v_total_price := v_total_price + v_service_record.price;
        v_total_duration := v_total_duration + v_service_record.duration_minutes;
    END LOOP;
    
    -- 4. Verificar conflitos de horário
    IF EXISTS (
        SELECT 1 FROM appointments 
        WHERE barber_id = p_barber_id 
        AND status::TEXT = 'scheduled'
        AND appointment_datetime = p_appointment_datetime
    ) THEN
        RAISE EXCEPTION 'Conflito de horário para o barbeiro % em %', 
            v_barber_record.name, p_appointment_datetime;
    END IF;
    
    -- 5. Criar agendamento (versão adaptável)
    IF v_has_desnormalized_columns THEN
        -- Versão com colunas desnormalizadas
        INSERT INTO appointments (
            client_id,
            client_name,
            client_phone,
            barber_id,
            barber_name,
            services_names,
            services_ids,
            appointment_datetime,
            appointment_date,
            appointment_time,
            status,
            total_price,
            duration_minutes,
            note
        ) VALUES (
            v_client_id,
            p_client_name,
            p_client_phone,
            p_barber_id,
            v_barber_record.name,
            (SELECT STRING_AGG(name, ', ') FROM services WHERE id = ANY(p_service_ids)),
            p_service_ids,
            p_appointment_datetime,
            p_appointment_datetime::DATE,
            p_appointment_datetime::TIME,
            'scheduled',
            v_total_price,
            v_total_duration,
            p_note
        ) RETURNING id INTO v_appointment_id;
    ELSE
        -- Versão básica (sem colunas desnormalizadas)
        INSERT INTO appointments (
            client_id,
            barber_id,
            appointment_datetime,
            status,
            total_price,
            note
        ) VALUES (
            v_client_id,
            p_barber_id,
            p_appointment_datetime,
            'scheduled',
            v_total_price,
            p_note
        ) RETURNING id INTO v_appointment_id;
    END IF;
    
    -- 6. Criar registros de serviços (se a tabela existir)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointment_services') THEN
        FOR v_service_record IN 
            SELECT * FROM services WHERE id = ANY(p_service_ids)
        LOOP
            INSERT INTO appointment_services (
                appointment_id,
                service_id,
                price_at_booking,
                commission_rate_applied
            ) VALUES (
                v_appointment_id,
                v_service_record.id,
                v_service_record.price,
                CASE 
                    WHEN v_service_record.is_chemical THEN 
                        COALESCE(v_barber_record.commission_rate_chemical_service, 60.00)
                    ELSE 
                        COALESCE(v_barber_record.commission_rate_service, 50.00)
                END
            );
        END LOOP;
    END IF;
    
    -- 7. Retornar resultado
    SELECT json_build_object(
        'success', true,
        'appointment_id', v_appointment_id,
        'client_id', v_client_id,
        'total_price', v_total_price,
        'duration_minutes', v_total_duration,
        'message', 'Agendamento criado com sucesso'
    ) INTO v_result;
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Erro ao criar agendamento'
        );
END;
$$ LANGUAGE plpgsql;

-- 4. Função de busca otimizada
CREATE OR REPLACE FUNCTION search_appointments(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_client_name TEXT DEFAULT NULL,
    p_client_phone TEXT DEFAULT NULL,
    p_barber_name TEXT DEFAULT NULL,
    p_service_name TEXT DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    id INTEGER,
    client_name TEXT,
    client_phone TEXT,
    barber_name TEXT,
    services_names TEXT,
    appointment_datetime TIMESTAMP,
    status TEXT,
    total_price DECIMAL,
    note TEXT
) AS $$
DECLARE
    v_has_desnormalized_columns BOOLEAN := FALSE;
BEGIN
    -- Verificar se as colunas desnormalizadas existem
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' 
        AND column_name IN ('client_name', 'barber_name')
    ) INTO v_has_desnormalized_columns;
    
    IF v_has_desnormalized_columns THEN
        -- Versão com colunas desnormalizadas
        RETURN QUERY
        SELECT 
            a.id,
            a.client_name,
            a.client_phone,
            a.barber_name,
            a.services_names,
            a.appointment_datetime,
            a.status::TEXT,
            a.total_price,
            a.note
        FROM appointments a
        WHERE 
            (p_start_date IS NULL OR a.appointment_date >= p_start_date)
            AND (p_end_date IS NULL OR a.appointment_date <= p_end_date)
            AND (p_client_name IS NULL OR a.client_name ILIKE '%' || p_client_name || '%')
            AND (p_client_phone IS NULL OR a.client_phone ILIKE '%' || p_client_phone || '%')
            AND (p_barber_name IS NULL OR a.barber_name ILIKE '%' || p_barber_name || '%')
            AND (p_service_name IS NULL OR a.services_names ILIKE '%' || p_service_name || '%')
            AND (p_status IS NULL OR a.status::TEXT = p_status)
        ORDER BY a.appointment_datetime DESC
        LIMIT p_limit;
    ELSE
        -- Versão com JOINs (estrutura básica)
        RETURN QUERY
        SELECT 
            a.id,
            c.name as client_name,
            c.phone as client_phone,
            b.name as barber_name,
            'N/A'::TEXT as services_names,
            a.appointment_datetime,
            a.status::TEXT,
            a.total_price,
            a.note
        FROM appointments a
        LEFT JOIN clients c ON a.client_id = c.id
        LEFT JOIN barbers b ON a.barber_id = b.id
        WHERE 
            (p_start_date IS NULL OR a.appointment_datetime::DATE >= p_start_date)
            AND (p_end_date IS NULL OR a.appointment_datetime::DATE <= p_end_date)
            AND (p_client_name IS NULL OR c.name ILIKE '%' || p_client_name || '%')
            AND (p_client_phone IS NULL OR c.phone ILIKE '%' || p_client_phone || '%')
            AND (p_barber_name IS NULL OR b.name ILIKE '%' || p_barber_name || '%')
            AND (p_status IS NULL OR a.status::TEXT = p_status)
        ORDER BY a.appointment_datetime DESC
        LIMIT p_limit;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Função para obter agenda do barbeiro
CREATE OR REPLACE FUNCTION get_barber_schedule(
    p_barber_id INTEGER,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    appointment_time TIME,
    client_name TEXT,
    client_phone TEXT,
    services_names TEXT,
    duration_minutes INTEGER,
    status TEXT,
    total_price DECIMAL
) AS $$
DECLARE
    v_has_desnormalized_columns BOOLEAN := FALSE;
BEGIN
    -- Verificar se as colunas desnormalizadas existem
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' 
        AND column_name IN ('client_name', 'appointment_time')
    ) INTO v_has_desnormalized_columns;
    
    IF v_has_desnormalized_columns THEN
        -- Versão com colunas desnormalizadas
        RETURN QUERY
        SELECT 
            a.appointment_time,
            a.client_name,
            a.client_phone,
            a.services_names,
            a.duration_minutes,
            a.status::TEXT,
            a.total_price
        FROM appointments a
        WHERE a.barber_id = p_barber_id
        AND a.appointment_date = p_date
        ORDER BY a.appointment_time;
    ELSE
        -- Versão com JOINs
        RETURN QUERY
        SELECT 
            a.appointment_datetime::TIME as appointment_time,
            c.name as client_name,
            c.phone as client_phone,
            'N/A'::TEXT as services_names,
            COALESCE(a.duration_minutes, 30) as duration_minutes,
            a.status::TEXT,
            a.total_price
        FROM appointments a
        LEFT JOIN clients c ON a.client_id = c.id
        WHERE a.barber_id = p_barber_id
        AND a.appointment_datetime::DATE = p_date
        ORDER BY a.appointment_datetime::TIME;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- TESTE A FUNÇÃO:
/*
SELECT create_appointment_automated(
    'Maria Silva'::VARCHAR,
    '11999999999'::VARCHAR,
    'maria@email.com'::VARCHAR,
    1::INTEGER,
    '2024-01-15 14:30:00'::TIMESTAMP,
    ARRAY[1]::INTEGER[],
    'Teste de agendamento'::TEXT,
    true::BOOLEAN
);
*/