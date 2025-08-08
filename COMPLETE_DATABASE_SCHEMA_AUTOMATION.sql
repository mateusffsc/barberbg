-- =====================================================
-- SCHEMA COMPLETO DO SISTEMA DE BARBEARIA
-- Sistema de Automação para Agendamentos e Clientes
-- =====================================================

-- =====================================================
-- 1. ESTRUTURA COMPLETA DAS TABELAS
-- =====================================================

-- Tabela: clients
-- Armazena informações dos clientes
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela: users (para autenticação)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'barber', -- 'admin' ou 'barber'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela: barbers
-- Armazena informações dos barbeiros
CREATE TABLE IF NOT EXISTS barbers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    commission_rate_service DECIMAL(5,2) DEFAULT 50.00, -- Porcentagem de comissão em serviços
    commission_rate_product DECIMAL(5,2) DEFAULT 30.00, -- Porcentagem de comissão em produtos
    commission_rate_chemical_service DECIMAL(5,2) DEFAULT 60.00, -- Porcentagem de comissão em serviços químicos
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela: services
-- Armazena os serviços oferecidos
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    is_chemical BOOLEAN DEFAULT FALSE, -- Se é serviço químico (maior comissão)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Enum para métodos de pagamento
CREATE TYPE payment_method_enum AS ENUM ('money', 'pix', 'credit_card', 'debit_card');

-- Enum para status de agendamento
CREATE TYPE appointment_status_enum AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');

-- Tabela: appointments (PRINCIPAL)
-- Armazena os agendamentos com dados desnormalizados para performance
CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    client_name VARCHAR(255) NOT NULL, -- Desnormalizado para performance
    client_phone VARCHAR(20) NOT NULL, -- Desnormalizado para performance
    barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE RESTRICT,
    barber_name VARCHAR(255) NOT NULL, -- Desnormalizado para performance
    services_names TEXT NOT NULL, -- "Corte, Barba, Sobrancelha" - Desnormalizado
    services_ids INTEGER[] NOT NULL, -- [1, 3, 5] - Array de IDs dos serviços
    appointment_datetime TIMESTAMP NOT NULL, -- Data e hora principal
    appointment_date DATE NOT NULL, -- Data separada para consultas
    appointment_time TIME NOT NULL, -- Hora separada para consultas
    status appointment_status_enum DEFAULT 'scheduled',
    total_price DECIMAL(10,2) NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    note TEXT, -- Observações do agendamento
    payment_method payment_method_enum, -- Preenchido quando status = 'completed'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela: appointment_services (para relacionamento many-to-many)
-- Mantém a relação normalizada para integridade
CREATE TABLE IF NOT EXISTS appointment_services (
    id SERIAL PRIMARY KEY,
    appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    price_at_booking DECIMAL(10,2) NOT NULL, -- Preço do serviço no momento do agendamento
    commission_rate_applied DECIMAL(5,2) NOT NULL, -- Taxa de comissão aplicada
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(appointment_id, service_id)
);

-- Tabela: products (para vendas)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela: sales (vendas de produtos)
CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE RESTRICT,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_method payment_method_enum NOT NULL DEFAULT 'money',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 2. ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índices para appointments (tabela principal)
CREATE INDEX IF NOT EXISTS idx_appointments_datetime ON appointments(appointment_datetime);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_time ON appointments(appointment_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_barber_id ON appointments(barber_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client_name ON appointments(client_name);
CREATE INDEX IF NOT EXISTS idx_appointments_client_phone ON appointments(client_phone);
CREATE INDEX IF NOT EXISTS idx_appointments_barber_name ON appointments(barber_name);
CREATE INDEX IF NOT EXISTS idx_appointments_services_ids ON appointments USING GIN(services_ids);

-- Índices para busca de texto
CREATE INDEX IF NOT EXISTS idx_appointments_client_name_text ON appointments USING GIN(to_tsvector('portuguese', client_name));
CREATE INDEX IF NOT EXISTS idx_appointments_services_names_text ON appointments USING GIN(to_tsvector('portuguese', services_names));

-- Índices compostos para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_appointments_barber_date ON appointments(barber_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status_date ON appointments(status, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_date_status ON appointments(appointment_date, status);

-- =====================================================
-- 3. TRIGGERS PARA SINCRONIZAÇÃO AUTOMÁTICA
-- =====================================================

-- Função para sincronizar dados desnormalizados
CREATE OR REPLACE FUNCTION sync_appointment_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Sincronizar dados do cliente
    SELECT name, phone INTO NEW.client_name, NEW.client_phone
    FROM clients WHERE id = NEW.client_id;
    
    -- Sincronizar dados do barbeiro
    SELECT name INTO NEW.barber_name
    FROM barbers WHERE id = NEW.barber_id;
    
    -- Sincronizar appointment_datetime com date + time
    NEW.appointment_datetime = (NEW.appointment_date + NEW.appointment_time)::TIMESTAMP;
    
    -- Valores padrão se não encontrar
    NEW.client_name = COALESCE(NEW.client_name, 'Cliente não encontrado');
    NEW.client_phone = COALESCE(NEW.client_phone, '');
    NEW.barber_name = COALESCE(NEW.barber_name, 'Barbeiro não encontrado');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para INSERT e UPDATE
CREATE TRIGGER trigger_sync_appointment_data
    BEFORE INSERT OR UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION sync_appointment_data();

-- Função para sincronizar serviços
CREATE OR REPLACE FUNCTION sync_appointment_services()
RETURNS TRIGGER AS $$
DECLARE
    appointment_record RECORD;
BEGIN
    -- Determinar appointment_id
    IF TG_OP = 'DELETE' THEN
        appointment_record.id = OLD.appointment_id;
    ELSE
        appointment_record.id = NEW.appointment_id;
    END IF;
    
    -- Atualizar services_names e services_ids
    UPDATE appointments 
    SET 
        services_names = COALESCE(subquery.services_names, 'Nenhum serviço'),
        services_ids = COALESCE(subquery.services_ids, ARRAY[]::INTEGER[])
    FROM (
        SELECT 
            STRING_AGG(s.name, ', ' ORDER BY s.name) as services_names,
            ARRAY_AGG(s.id ORDER BY s.name) as services_ids
        FROM appointment_services aps
        JOIN services s ON aps.service_id = s.id
        WHERE aps.appointment_id = appointment_record.id
    ) as subquery
    WHERE appointments.id = appointment_record.id;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers para appointment_services
CREATE TRIGGER trigger_sync_services_insert
    AFTER INSERT ON appointment_services
    FOR EACH ROW EXECUTE FUNCTION sync_appointment_services();

CREATE TRIGGER trigger_sync_services_update
    AFTER UPDATE ON appointment_services
    FOR EACH ROW EXECUTE FUNCTION sync_appointment_services();

CREATE TRIGGER trigger_sync_services_delete
    AFTER DELETE ON appointment_services
    FOR EACH ROW EXECUTE FUNCTION sync_appointment_services();

-- =====================================================
-- 4. FUNÇÕES DE AUTOMAÇÃO PARA AGENDAMENTOS
-- =====================================================

-- Função para criar cliente automaticamente se não existir
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

-- Função para criar agendamento completo
CREATE OR REPLACE FUNCTION create_appointment_automated(
    -- Dados do cliente
    p_client_name VARCHAR(255),
    p_client_phone VARCHAR(20) DEFAULT NULL,
    p_client_email VARCHAR(255) DEFAULT NULL,
    
    -- Dados do agendamento
    p_barber_id INTEGER,
    p_appointment_datetime TIMESTAMP,
    p_service_ids INTEGER[],
    p_note TEXT DEFAULT NULL,
    
    -- Opções
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
BEGIN
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
        AND status = 'scheduled'
        AND appointment_datetime = p_appointment_datetime
    ) THEN
        RAISE EXCEPTION 'Conflito de horário para o barbeiro % em %', 
            v_barber_record.name, p_appointment_datetime;
    END IF;
    
    -- 5. Criar agendamento
    INSERT INTO appointments (
        client_id,
        barber_id,
        appointment_datetime,
        appointment_date,
        appointment_time,
        status,
        total_price,
        duration_minutes,
        note,
        services_ids
    ) VALUES (
        v_client_id,
        p_barber_id,
        p_appointment_datetime,
        p_appointment_datetime::DATE,
        p_appointment_datetime::TIME,
        'scheduled',
        v_total_price,
        v_total_duration,
        p_note,
        p_service_ids
    ) RETURNING id INTO v_appointment_id;
    
    -- 6. Criar registros de serviços
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
                WHEN v_service_record.is_chemical THEN v_barber_record.commission_rate_chemical_service
                ELSE v_barber_record.commission_rate_service
            END
        );
    END LOOP;
    
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

-- =====================================================
-- 5. FUNÇÕES DE CONSULTA OTIMIZADAS
-- =====================================================

-- Buscar agendamentos com filtros
CREATE OR REPLACE FUNCTION search_appointments(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_client_name TEXT DEFAULT NULL,
    p_client_phone TEXT DEFAULT NULL,
    p_barber_name TEXT DEFAULT NULL,
    p_service_name TEXT DEFAULT NULL,
    p_status appointment_status_enum DEFAULT NULL,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    id INTEGER,
    client_name TEXT,
    client_phone TEXT,
    barber_name TEXT,
    services_names TEXT,
    appointment_datetime TIMESTAMP,
    status appointment_status_enum,
    total_price DECIMAL,
    note TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.client_name,
        a.client_phone,
        a.barber_name,
        a.services_names,
        a.appointment_datetime,
        a.status,
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
        AND (p_status IS NULL OR a.status = p_status)
    ORDER BY a.appointment_datetime DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Obter agenda do barbeiro
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
    status appointment_status_enum,
    total_price DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.appointment_time,
        a.client_name,
        a.client_phone,
        a.services_names,
        a.duration_minutes,
        a.status,
        a.total_price
    FROM appointments a
    WHERE a.barber_id = p_barber_id
    AND a.appointment_date = p_date
    ORDER BY a.appointment_time;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. EXEMPLOS DE USO PARA AUTOMAÇÃO
-- =====================================================

/*
-- EXEMPLO 1: Criar agendamento completo
SELECT create_appointment_automated(
    p_client_name := 'Maria Silva',
    p_client_phone := '(11) 99999-9999',
    p_client_email := 'maria@email.com',
    p_barber_id := 1,
    p_appointment_datetime := '2024-01-15 14:30:00'::TIMESTAMP,
    p_service_ids := ARRAY[1, 3], -- IDs dos serviços
    p_note := 'Cliente prefere corte mais curto'
);

-- EXEMPLO 2: Buscar agendamentos
SELECT * FROM search_appointments(
    p_start_date := '2024-01-01',
    p_end_date := '2024-01-31',
    p_client_name := 'Maria',
    p_barber_name := 'João'
);

-- EXEMPLO 3: Ver agenda do barbeiro
SELECT * FROM get_barber_schedule(
    p_barber_id := 1,
    p_date := '2024-01-15'
);

-- EXEMPLO 4: Buscar por telefone (recepção)
SELECT * FROM search_appointments(
    p_client_phone := '11999'
);

-- EXEMPLO 5: Criar cliente automaticamente
SELECT create_or_get_client(
    'João Santos',
    '(11) 88888-8888',
    'joao@email.com'
);
*/

-- =====================================================
-- 7. VIEWS ÚTEIS PARA RELATÓRIOS
-- =====================================================

-- View com dados completos dos agendamentos
CREATE OR REPLACE VIEW v_appointments_complete AS
SELECT 
    a.*,
    c.email as client_email,
    b.phone as barber_phone,
    b.email as barber_email,
    -- Campos calculados
    CASE 
        WHEN a.appointment_datetime < NOW() THEN 'past'
        WHEN a.appointment_datetime::DATE = CURRENT_DATE THEN 'today'
        ELSE 'future'
    END as time_category,
    EXTRACT(HOUR FROM a.appointment_time) as appointment_hour,
    EXTRACT(DOW FROM a.appointment_date) as day_of_week,
    a.client_name || ' (' || a.client_phone || ')' as client_display
FROM appointments a
LEFT JOIN clients c ON a.client_id = c.id
LEFT JOIN barbers b ON a.barber_id = b.id;

-- View para dashboard
CREATE OR REPLACE VIEW v_dashboard_stats AS
SELECT 
    COUNT(*) as total_appointments,
    COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled_count,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
    COUNT(*) FILTER (WHERE appointment_date = CURRENT_DATE) as today_count,
    SUM(total_price) FILTER (WHERE status = 'completed') as total_revenue,
    AVG(total_price) FILTER (WHERE status = 'completed') as avg_ticket
FROM appointments
WHERE appointment_date >= CURRENT_DATE - INTERVAL '30 days';

-- =====================================================
-- 8. DADOS DE EXEMPLO (OPCIONAL)
-- =====================================================

/*
-- Inserir usuários de exemplo
INSERT INTO users (username, password_hash, role) VALUES
('admin', '$2b$10$example_hash', 'admin'),
('joao', '$2b$10$example_hash', 'barber');

-- Inserir barbeiros de exemplo
INSERT INTO barbers (user_id, name, phone, email) VALUES
(2, 'João Santos', '(11) 99999-0001', 'joao@barbearia.com');

-- Inserir serviços de exemplo
INSERT INTO services (name, description, price, duration_minutes, is_chemical) VALUES
('Corte Masculino', 'Corte tradicional masculino', 25.00, 30, false),
('Barba', 'Aparar e modelar barba', 15.00, 20, false),
('Corte + Barba', 'Combo corte e barba', 35.00, 45, false),
('Química/Relaxamento', 'Tratamento químico capilar', 80.00, 120, true);

-- Inserir clientes de exemplo
INSERT INTO clients (name, phone, email) VALUES
('Maria Silva', '(11) 99999-1001', 'maria@email.com'),
('João Oliveira', '(11) 99999-1002', 'joao@email.com');
*/