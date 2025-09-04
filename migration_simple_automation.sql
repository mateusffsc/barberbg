-- MIGRAÇÃO SIMPLES: Criar funções de automação básicas
-- Versão simplificada que funciona com qualquer estrutura

BEGIN;

-- 1. Função para criar cliente se não existir
CREATE OR REPLACE FUNCTION create_or_get_client(
    p_name VARCHAR(255),
    p_phone VARCHAR(20),
    p_email VARCHAR(255)
)
RETURNS INTEGER AS $$
DECLARE
    client_id INTEGER;
BEGIN
    -- Tentar encontrar cliente existente
    SELECT id INTO client_id
    FROM clients 
    WHERE name = p_name 
    AND phone = p_phone
    LIMIT 1;
    
    -- Se não encontrou, criar novo
    IF client_id IS NULL THEN
        INSERT INTO clients (name, phone, email)
        VALUES (p_name, p_phone, p_email)
        RETURNING id INTO client_id;
    END IF;
    
    RETURN client_id;
END;
$$ LANGUAGE plpgsql;

-- 2. Função simples para criar agendamento
CREATE OR REPLACE FUNCTION create_appointment_simple(
    p_client_name VARCHAR(255),
    p_client_phone VARCHAR(255),
    p_barber_id INTEGER,
    p_appointment_datetime TIMESTAMP,
    p_total_price DECIMAL,
    p_note TEXT
)
RETURNS JSON AS $$
DECLARE
    v_client_id INTEGER;
    v_appointment_id INTEGER;
    v_result JSON;
BEGIN
    -- 1. Criar ou buscar cliente
    v_client_id := create_or_get_client(p_client_name, p_client_phone, '');
    
    -- 2. Verificar se barbeiro existe
    IF NOT EXISTS (SELECT 1 FROM barbers WHERE id = p_barber_id) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Barbeiro não encontrado',
            'message', 'Barbeiro com ID ' || p_barber_id || ' não existe'
        );
    END IF;
    
    -- 3. Verificar conflito de horário
    IF EXISTS (
        SELECT 1 FROM appointments 
        WHERE barber_id = p_barber_id 
        AND appointment_datetime = p_appointment_datetime
        AND status IN ('scheduled', 'completed')
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Conflito de horário',
            'message', 'Já existe agendamento neste horário'
        );
    END IF;
    
    -- 4. Criar agendamento (versão adaptável)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' 
        AND column_name = 'client_name'
    ) THEN
        -- Versão com colunas desnormalizadas
        INSERT INTO appointments (
            client_id,
            client_name,
            client_phone,
            barber_id,
            appointment_datetime,
            status,
            total_price,
            note
        ) VALUES (
            v_client_id,
            p_client_name,
            p_client_phone,
            p_barber_id,
            p_appointment_datetime,
            'scheduled',
            p_total_price,
            p_note
        ) RETURNING id INTO v_appointment_id;
    ELSE
        -- Versão básica
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
            p_total_price,
            p_note
        ) RETURNING id INTO v_appointment_id;
    END IF;
    
    -- 5. Retornar sucesso
    RETURN json_build_object(
        'success', true,
        'appointment_id', v_appointment_id,
        'client_id', v_client_id,
        'message', 'Agendamento criado com sucesso'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Erro ao criar agendamento'
        );
END;
$$ LANGUAGE plpgsql;

-- 3. Função para buscar agendamentos
CREATE OR REPLACE FUNCTION search_appointments_simple(
    p_client_name TEXT,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    id INTEGER,
    client_name TEXT,
    barber_name TEXT,
    appointment_datetime TIMESTAMP,
    status TEXT,
    total_price DECIMAL
) AS $$
BEGIN
    -- Verificar se tem colunas desnormalizadas
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' 
        AND column_name = 'client_name'
    ) THEN
        -- Versão com colunas desnormalizadas
        RETURN QUERY
        SELECT 
            a.id,
            a.client_name,
            a.barber_name,
            a.appointment_datetime,
            a.status::TEXT,
            a.total_price
        FROM appointments a
        WHERE 
            (p_client_name IS NULL OR a.client_name ILIKE '%' || p_client_name || '%')
            AND (p_start_date IS NULL OR a.appointment_datetime::DATE >= p_start_date)
            AND (p_end_date IS NULL OR a.appointment_datetime::DATE <= p_end_date)
        ORDER BY a.appointment_datetime DESC;
    ELSE
        -- Versão com JOINs
        RETURN QUERY
        SELECT 
            a.id,
            c.name as client_name,
            b.name as barber_name,
            a.appointment_datetime,
            a.status::TEXT,
            a.total_price
        FROM appointments a
        LEFT JOIN clients c ON a.client_id = c.id
        LEFT JOIN barbers b ON a.barber_id = b.id
        WHERE 
            (p_client_name IS NULL OR c.name ILIKE '%' || p_client_name || '%')
            AND (p_start_date IS NULL OR a.appointment_datetime::DATE >= p_start_date)
            AND (p_end_date IS NULL OR a.appointment_datetime::DATE <= p_end_date)
        ORDER BY a.appointment_datetime DESC;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- EXEMPLOS DE USO:

-- 1. Criar agendamento simples
/*
SELECT create_appointment_simple(
    'João Silva',                    -- Nome do cliente
    '11999999999',                   -- Telefone
    1,                               -- ID do barbeiro
    '2024-01-15 14:30:00'::TIMESTAMP, -- Data/hora
    25.00,                           -- Preço
    'Corte simples'                  -- Observações
);
*/

-- 2. Buscar agendamentos
/*
SELECT * FROM search_appointments_simple(
    'João',                          -- Nome do cliente (parcial)
    '2024-01-01'::DATE,             -- Data início
    '2024-01-31'::DATE              -- Data fim
);
*/

-- 3. Criar cliente e agendamento em uma chamada
/*
SELECT create_appointment_simple(
    'Maria Santos',
    '11888888888',
    1,
    '2024-01-16 15:00:00'::TIMESTAMP,
    35.00,
    'Corte + Escova'
);
*/