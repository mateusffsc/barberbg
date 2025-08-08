# 🤖 Guia de Automação - Sistema de Barbearia

## 🎯 **Visão Geral**

Este sistema foi projetado para **máxima automação** com queries SQL otimizadas que podem ser executadas por sistemas externos, webhooks, APIs ou qualquer ferramenta de automação.

## 📋 **Estrutura do Banco de Dados**

### **Tabelas Principais:**
- `clients` - Clientes da barbearia
- `barbers` - Barbeiros e seus dados
- `services` - Serviços oferecidos
- `appointments` - **Tabela principal** com dados desnormalizados
- `appointment_services` - Relação serviços/agendamentos (normalizada)

### **Dados Desnormalizados (Performance):**
```sql
-- A tabela appointments contém:
client_name VARCHAR(255)     -- Nome do cliente
client_phone VARCHAR(20)     -- Telefone do cliente  
barber_name VARCHAR(255)     -- Nome do barbeiro
services_names TEXT          -- "Corte, Barba, Sobrancelha"
services_ids INTEGER[]       -- [1, 3, 5]
```

## 🚀 **Funções de Automação**

### 1. **Criar Agendamento Completo**

```sql
-- Cria agendamento + cliente automaticamente se não existir
SELECT create_appointment_automated(
    p_client_name := 'Maria Silva',
    p_client_phone := '(11) 99999-9999',
    p_client_email := 'maria@email.com',
    p_barber_id := 1,
    p_appointment_datetime := '2024-01-15 14:30:00'::TIMESTAMP,
    p_service_ids := ARRAY[1, 3], -- IDs dos serviços
    p_note := 'Cliente prefere corte mais curto',
    p_auto_create_client := true -- Cria cliente se não existir
);
```

**Retorna JSON:**
```json
{
  "success": true,
  "appointment_id": 123,
  "client_id": 45,
  "total_price": 40.00,
  "duration_minutes": 50,
  "message": "Agendamento criado com sucesso"
}
```

### 2. **Buscar Agendamentos (Multi-filtros)**

```sql
-- Busca flexível com múltiplos filtros
SELECT * FROM search_appointments(
    p_start_date := '2024-01-01',
    p_end_date := '2024-01-31',
    p_client_name := 'Maria',        -- Busca parcial no nome
    p_client_phone := '11999',       -- Busca parcial no telefone
    p_barber_name := 'João',         -- Busca parcial no barbeiro
    p_service_name := 'Corte',       -- Busca parcial nos serviços
    p_status := 'scheduled',         -- Status específico
    p_limit := 50                    -- Limite de resultados
);
```

### 3. **Agenda do Barbeiro**

```sql
-- Ver agenda completa de um barbeiro em um dia
SELECT * FROM get_barber_schedule(
    p_barber_id := 1,
    p_date := '2024-01-15'
);
```

### 4. **Criar/Obter Cliente**

```sql
-- Cria cliente se não existir, retorna ID se existir
SELECT create_or_get_client(
    'João Santos',
    '(11) 88888-8888',
    'joao@email.com'
);
```

## 📱 **Casos de Uso para Automação**

### **1. Integração com WhatsApp/Chatbot**

```sql
-- Cliente manda mensagem: "Quero agendar corte com João amanhã 14h"
-- Sistema executa:

-- 1. Buscar barbeiro por nome
SELECT id FROM barbers WHERE name ILIKE '%João%' LIMIT 1;

-- 2. Buscar serviço por nome
SELECT id FROM services WHERE name ILIKE '%corte%' LIMIT 1;

-- 3. Criar agendamento
SELECT create_appointment_automated(
    p_client_name := 'Cliente WhatsApp',
    p_client_phone := '+5511999999999',
    p_barber_id := 1,
    p_appointment_datetime := '2024-01-16 14:00:00'::TIMESTAMP,
    p_service_ids := ARRAY[1]
);
```

### **2. Sistema de Recepção**

```sql
-- Recepcionista digita parte do telefone: "11999"
SELECT * FROM search_appointments(
    p_client_phone := '11999',
    p_start_date := CURRENT_DATE - INTERVAL '30 days'
);

-- Resultado: Histórico completo do cliente
```

### **3. Confirmação de Agendamentos**

```sql
-- Buscar agendamentos de amanhã para enviar confirmação
SELECT 
    client_name,
    client_phone,
    barber_name,
    services_names,
    appointment_time
FROM search_appointments(
    p_start_date := CURRENT_DATE + 1,
    p_end_date := CURRENT_DATE + 1,
    p_status := 'scheduled'
);
```

### **4. Relatórios Automáticos**

```sql
-- Relatório diário automático
SELECT * FROM v_dashboard_stats;

-- Agenda do dia para cada barbeiro
SELECT 
    barber_name,
    COUNT(*) as total_appointments,
    SUM(total_price) as expected_revenue
FROM search_appointments(
    p_start_date := CURRENT_DATE,
    p_end_date := CURRENT_DATE,
    p_status := 'scheduled'
)
GROUP BY barber_name;
```

## 🔧 **Integração com Sistemas Externos**

### **1. API REST (Node.js/Python)**

```javascript
// Exemplo em Node.js
const createAppointment = async (clientData, appointmentData) => {
    const query = `
        SELECT create_appointment_automated(
            p_client_name := $1,
            p_client_phone := $2,
            p_client_email := $3,
            p_barber_id := $4,
            p_appointment_datetime := $5,
            p_service_ids := $6,
            p_note := $7
        )
    `;
    
    const result = await db.query(query, [
        clientData.name,
        clientData.phone,
        clientData.email,
        appointmentData.barberId,
        appointmentData.datetime,
        appointmentData.serviceIds,
        appointmentData.note
    ]);
    
    return result.rows[0];
};
```

### **2. Webhook/Zapier**

```sql
-- Query para webhook que recebe dados de formulário web
SELECT create_appointment_automated(
    p_client_name := '{{client_name}}',
    p_client_phone := '{{client_phone}}',
    p_client_email := '{{client_email}}',
    p_barber_id := {{barber_id}},
    p_appointment_datetime := '{{appointment_datetime}}'::TIMESTAMP,
    p_service_ids := ARRAY[{{service_ids}}],
    p_note := '{{note}}'
);
```

### **3. Cron Jobs/Tarefas Agendadas**

```sql
-- Executar diariamente às 8h para lembrar agendamentos
SELECT 
    client_name,
    client_phone,
    appointment_time,
    barber_name,
    services_names
FROM search_appointments(
    p_start_date := CURRENT_DATE,
    p_end_date := CURRENT_DATE,
    p_status := 'scheduled'
)
ORDER BY appointment_time;
```

## 📊 **Queries de Relatórios Prontas**

### **1. Faturamento por Período**

```sql
SELECT 
    DATE_TRUNC('day', appointment_date) as date,
    COUNT(*) as appointments,
    SUM(total_price) as revenue,
    AVG(total_price) as avg_ticket
FROM appointments 
WHERE status = 'completed'
AND appointment_date BETWEEN '2024-01-01' AND '2024-01-31'
GROUP BY DATE_TRUNC('day', appointment_date)
ORDER BY date;
```

### **2. Performance por Barbeiro**

```sql
SELECT 
    barber_name,
    COUNT(*) as total_appointments,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
    SUM(total_price) FILTER (WHERE status = 'completed') as revenue
FROM appointments
WHERE appointment_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY barber_name
ORDER BY revenue DESC;
```

### **3. Serviços Mais Populares**

```sql
SELECT 
    unnest(string_to_array(services_names, ', ')) as service_name,
    COUNT(*) as frequency
FROM appointments
WHERE status = 'completed'
AND appointment_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY service_name
ORDER BY frequency DESC;
```

### **4. Clientes Mais Frequentes**

```sql
SELECT 
    client_name,
    client_phone,
    COUNT(*) as visits,
    SUM(total_price) as total_spent,
    MAX(appointment_date) as last_visit
FROM appointments
WHERE status = 'completed'
GROUP BY client_name, client_phone
HAVING COUNT(*) >= 3
ORDER BY visits DESC, total_spent DESC;
```

## 🔄 **Sincronização Automática**

### **Triggers Ativos:**
- ✅ **Dados do cliente** sincronizados automaticamente
- ✅ **Dados do barbeiro** sincronizados automaticamente  
- ✅ **Lista de serviços** sincronizada automaticamente
- ✅ **Data/hora** sempre consistentes
- ✅ **Preços e comissões** calculados automaticamente

### **Quando Executar:**
- **INSERT** em appointments → Todos os dados preenchidos automaticamente
- **UPDATE** em clients → Todos os agendamentos atualizados
- **UPDATE** em barbers → Todos os agendamentos atualizados
- **UPDATE** em services → Todos os agendamentos atualizados

## 🎯 **Vantagens da Automação**

1. **⚡ Performance Máxima** - Dados desnormalizados, consultas diretas
2. **🔍 Busca Flexível** - Por nome, telefone, barbeiro, serviço
3. **🤖 Automação Total** - Criação automática de clientes
4. **📊 Relatórios Instantâneos** - Views e funções otimizadas
5. **🔄 Sincronização Automática** - Triggers mantêm consistência
6. **📱 Integração Fácil** - APIs, webhooks, chatbots
7. **🛡️ Validação Automática** - Conflitos de horário detectados
8. **💰 Cálculos Automáticos** - Preços, comissões, durações

**Execute o schema completo e tenha um sistema totalmente automatizado!** 🚀