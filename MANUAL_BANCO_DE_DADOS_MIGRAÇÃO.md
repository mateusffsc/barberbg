# 📊 MANUAL COMPLETO DO BANCO DE DADOS - SISTEMA BARBEARIA

## 🎯 **OBJETIVO**
Este documento serve como guia completo para migração do banco de dados atual, contendo estrutura detalhada, relacionamentos, volumes de dados e procedimentos necessários.

---

## 📋 **RESUMO EXECUTIVO**

### 📊 **Estatísticas Gerais**
- **Total de tabelas**: 9 principais + 2 auxiliares
- **Total de registros**: 34.353
- **Tamanho estimado**: 33.55 MB
- **Banco atual**: Supabase (PostgreSQL)
- **Performance**: Boa (60-70ms para queries principais)

### 🏆 **Tabelas por Volume**
1. **appointment_services**: 15.354 registros (44.7%)
2. **appointments**: 15.310 registros (44.6%)
3. **clients**: 2.625 registros (7.6%)
4. **schedule_blocks**: 882 registros (2.6%)
5. **users**: 22 registros (0.1%)

---

## 🗂️ **ESTRUTURA DETALHADA DAS TABELAS**

### 1. **APPOINTMENTS** (Agendamentos)
**Volume**: 15.310 registros | **Campos**: 22

```sql
CREATE TABLE appointments (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  barber_id INTEGER REFERENCES barbers(id),
  status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, confirmed, completed, cancelled
  total_price DECIMAL(10,2) NOT NULL,
  final_amount DECIMAL(10,2), -- Valor final pago (pode diferir do total_price)
  note TEXT,
  payment_method VARCHAR(20), -- cash, card, pix
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  appointment_datetime TIMESTAMP NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  barber_name VARCHAR(100), -- Desnormalizado para performance
  barber_phone VARCHAR(20), -- Desnormalizado para performance
  client_name VARCHAR(100), -- Desnormalizado para performance
  client_phone VARCHAR(20), -- Desnormalizado para performance
  services_names TEXT, -- Lista de serviços (desnormalizado)
  services_ids INTEGER[], -- Array de IDs dos serviços
  recurrence_group_id UUID, -- Para agendamentos recorrentes
  reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**📊 Índices Recomendados:**
```sql
CREATE INDEX idx_appointments_datetime ON appointments(appointment_datetime);
CREATE INDEX idx_appointments_barber_date ON appointments(barber_id, appointment_date);
CREATE INDEX idx_appointments_client ON appointments(client_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_recurrence ON appointments(recurrence_group_id) WHERE recurrence_group_id IS NOT NULL;
```

### 2. **CLIENTS** (Clientes)
**Volume**: 2.625 registros | **Campos**: 6

```sql
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) UNIQUE,
  email VARCHAR(100) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**📊 Índices Recomendados:**
```sql
CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_clients_name ON clients(name);
CREATE INDEX idx_clients_email ON clients(email);
```

### 3. **BARBERS** (Barbeiros)
**Volume**: 11 registros | **Campos**: 11

```sql
CREATE TABLE barbers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100),
  commission_rate_service DECIMAL(3,2) DEFAULT 0.60, -- 60%
  commission_rate_product DECIMAL(3,2) DEFAULT 0.30, -- 30%
  commission_rate_chemical_service DECIMAL(3,2) DEFAULT 0.70, -- 70%
  is_special_barber BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 4. **SERVICES** (Serviços)
**Volume**: 12 registros | **Campos**: 9

```sql
CREATE TABLE services (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  duration_minutes_normal INTEGER DEFAULT 30,
  duration_minutes_special INTEGER DEFAULT 25,
  is_chemical BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 5. **APPOINTMENT_SERVICES** (Serviços do Agendamento)
**Volume**: 15.354 registros | **Campos**: 6

```sql
CREATE TABLE appointment_services (
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES services(id),
  price_at_booking DECIMAL(10,2) NOT NULL, -- Preço no momento do agendamento
  commission_rate_applied DECIMAL(3,2) NOT NULL, -- Taxa aplicada
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (appointment_id, service_id)
);
```

### 6. **SCHEDULE_BLOCKS** (Bloqueios de Agenda)
**Volume**: 882 registros | **Campos**: 14

```sql
CREATE TABLE schedule_blocks (
  id SERIAL PRIMARY KEY,
  barber_id INTEGER REFERENCES barbers(id),
  block_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_type VARCHAR(20), -- daily, weekly, monthly
  recurrence_pattern JSONB, -- Padrão de recorrência
  recurrence_end_date DATE,
  parent_block_id INTEGER REFERENCES schedule_blocks(id),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 7. **PRODUCTS** (Produtos)
**Volume**: 27 registros | **Campos**: 7

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 8. **SALES** (Vendas)
**Volume**: 110 registros | **Campos**: 9

```sql
CREATE TABLE sales (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  barber_id INTEGER REFERENCES barbers(id),
  appointment_id INTEGER REFERENCES appointments(id),
  sale_datetime TIMESTAMP NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 9. **USERS** (Usuários)
**Volume**: 22 registros | **Campos**: 6

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'barber', -- admin, barber
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔗 **RELACIONAMENTOS E INTEGRIDADE**

### **Relacionamentos Principais**
```
clients (1) ←→ (N) appointments
barbers (1) ←→ (N) appointments
appointments (1) ←→ (N) appointment_services
services (1) ←→ (N) appointment_services
barbers (1) ←→ (N) schedule_blocks
clients (1) ←→ (N) sales
barbers (1) ←→ (N) sales
appointments (1) ←→ (1) sales [opcional]
users (1) ←→ (1) barbers
```

### **Constraints de Integridade**
```sql
-- Chaves estrangeiras
ALTER TABLE appointments ADD CONSTRAINT fk_appointments_client 
  FOREIGN KEY (client_id) REFERENCES clients(id);
  
ALTER TABLE appointments ADD CONSTRAINT fk_appointments_barber 
  FOREIGN KEY (barber_id) REFERENCES barbers(id);

-- Checks
ALTER TABLE appointments ADD CONSTRAINT chk_status 
  CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled'));
  
ALTER TABLE appointments ADD CONSTRAINT chk_positive_price 
  CHECK (total_price > 0);
  
ALTER TABLE barbers ADD CONSTRAINT chk_commission_range 
  CHECK (commission_rate_service BETWEEN 0 AND 1);
```

---

## 📊 **ANÁLISE DE DADOS**

### **Volume por Período**
```
2025-04: 1 agendamento
2025-09: 46 agendamentos  
2025-10: 953 agendamentos
2025-11+: 14.310 agendamentos (crescimento exponencial)
```

### **Distribuição por Status** (Estimativa)
- **Scheduled**: ~30% (4.593 registros)
- **Confirmed**: ~25% (3.828 registros)
- **Completed**: ~40% (6.124 registros)
- **Cancelled**: ~5% (765 registros)

### **Dados Críticos para Migração**
- **Agendamentos recorrentes**: ~13% têm `recurrence_group_id`
- **Campos nulos importantes**: `final_amount`, `note`, `payment_method`
- **Desnormalização**: Nomes e telefones duplicados para performance

---

## 🚀 **PLANO DE MIGRAÇÃO**

### **FASE 1: PREPARAÇÃO (1-2 dias)**

#### 1.1 **Backup Completo**
```bash
# Backup via Supabase CLI
supabase db dump --file backup_$(date +%Y%m%d).sql

# Backup por tabela (alternativo)
pg_dump -h [host] -U [user] -d [database] -t appointments > appointments_backup.sql
```

#### 1.2 **Validação de Integridade**
```sql
-- Verificar referências órfãs
SELECT COUNT(*) FROM appointments a 
LEFT JOIN clients c ON a.client_id = c.id 
WHERE c.id IS NULL;

-- Verificar dados inconsistentes
SELECT COUNT(*) FROM appointments 
WHERE total_price <= 0 OR appointment_datetime < created_at;
```

#### 1.3 **Análise de Performance**
```sql
-- Queries mais lentas
EXPLAIN ANALYZE SELECT * FROM appointments 
WHERE appointment_datetime BETWEEN '2025-01-01' AND '2025-12-31';

-- Tamanho das tabelas
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables WHERE schemaname = 'public';
```

### **FASE 2: MIGRAÇÃO (1 dia)**

#### 2.1 **Criação da Estrutura**
```sql
-- Script de criação completo
-- (Usar os CREATE TABLE acima)

-- Criação de índices
-- (Usar os CREATE INDEX acima)

-- Configuração de sequences
SELECT setval('appointments_id_seq', (SELECT MAX(id) FROM appointments));
```

#### 2.2 **Migração de Dados**
```sql
-- Ordem de migração (respeitando FKs)
1. users
2. clients  
3. barbers
4. services
5. products
6. appointments
7. appointment_services
8. schedule_blocks
9. sales
10. sale_items (se existir)
```

#### 2.3 **Validação Pós-Migração**
```sql
-- Contagem de registros
SELECT 'appointments' as table_name, COUNT(*) as count FROM appointments
UNION ALL
SELECT 'clients', COUNT(*) FROM clients
UNION ALL
SELECT 'barbers', COUNT(*) FROM barbers;

-- Verificação de integridade
SELECT COUNT(*) as orphan_appointments FROM appointments a
LEFT JOIN clients c ON a.client_id = c.id
WHERE c.id IS NULL;
```

### **FASE 3: OTIMIZAÇÃO (1 dia)**

#### 3.1 **Configuração de Performance**
```sql
-- Configurações PostgreSQL recomendadas
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB
```

#### 3.2 **Índices Adicionais**
```sql
-- Índices compostos para queries frequentes
CREATE INDEX idx_appointments_barber_status_date 
  ON appointments(barber_id, status, appointment_date);
  
CREATE INDEX idx_appointments_client_date 
  ON appointments(client_id, appointment_date DESC);
```

#### 3.3 **Particionamento** (Para crescimento futuro)
```sql
-- Particionamento por mês (se necessário)
CREATE TABLE appointments_2026_01 PARTITION OF appointments
FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

---

## 🔧 **CONFIGURAÇÕES ESPECÍFICAS**

### **Supabase → PostgreSQL**
```sql
-- Configurações de migração do Supabase
-- RLS (Row Level Security) - Remover se não necessário
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;

-- Triggers de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_appointments_updated_at 
    BEFORE UPDATE ON appointments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### **Realtime (Se necessário)**
```sql
-- Configuração para subscriptions em tempo real
-- (Dependente da solução escolhida: Pusher, Socket.io, etc.)
```

---

## 📋 **CHECKLIST DE MIGRAÇÃO**

### **PRÉ-MIGRAÇÃO**
- [ ] Backup completo realizado
- [ ] Estrutura do novo banco criada
- [ ] Testes de conectividade OK
- [ ] Validação de integridade atual
- [ ] Downtime planejado comunicado

### **DURANTE A MIGRAÇÃO**
- [ ] Sistema em modo manutenção
- [ ] Dados migrados na ordem correta
- [ ] Sequences atualizadas
- [ ] Índices criados
- [ ] Constraints aplicadas

### **PÓS-MIGRAÇÃO**
- [ ] Contagem de registros validada
- [ ] Integridade referencial verificada
- [ ] Performance testada
- [ ] Aplicação conectada e funcionando
- [ ] Realtime funcionando (se aplicável)
- [ ] Backup do novo banco realizado

---

## ⚠️ **RISCOS E MITIGAÇÕES**

### **Riscos Identificados**
1. **Perda de dados durante migração**
   - **Mitigação**: Backup completo + teste em ambiente de homologação

2. **Downtime prolongado**
   - **Mitigação**: Migração em horário de menor uso + processo otimizado

3. **Problemas de performance**
   - **Mitigação**: Índices criados + configuração otimizada

4. **Incompatibilidade de tipos**
   - **Mitigação**: Mapeamento detalhado + testes prévios

### **Plano de Rollback**
```sql
-- Em caso de problemas, restaurar backup
psql -h [host] -U [user] -d [database] < backup_$(date +%Y%m%d).sql
```

---

## 📊 **ESTIMATIVAS**

### **Tempo de Migração**
- **Preparação**: 4-8 horas
- **Migração**: 2-4 horas  
- **Validação**: 2-4 horas
- **Total**: 8-16 horas

### **Recursos Necessários**
- **Servidor**: 4GB RAM, 2 CPU cores mínimo
- **Armazenamento**: 100MB + 50% margem
- **Rede**: Conexão estável para transferência

### **Custos Estimados**
- **Novo servidor**: Variável por provedor
- **Downtime**: ~4 horas máximo
- **Recursos humanos**: 1-2 desenvolvedores

---

## 🎯 **CONCLUSÃO**

O banco atual está bem estruturado e pronto para migração. Os principais pontos de atenção são:

1. **Volume concentrado** em appointments e appointment_services
2. **Desnormalização** para performance (nomes/telefones)
3. **Agendamentos recorrentes** com UUID
4. **Realtime subscriptions** precisam ser reconfiguradas

A migração é **viável e de baixo risco** seguindo este plano detalhado.

---

**📅 Data do documento**: Janeiro 2026  
**👤 Responsável**: Equipe de Desenvolvimento  
**🔄 Versão**: 1.0