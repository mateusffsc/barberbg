# 🔄 Migração: Separar appointment_datetime em date + time

## 📋 Objetivo
Transformar a coluna `appointment_datetime` (TIMESTAMP) da tabela `appointments` em duas colunas separadas:
- `appointment_date` (DATE) - apenas a data
- `appointment_time` (TIME) - apenas o horário

## ⚠️ IMPORTANTE - ANTES DE EXECUTAR

1. **Faça backup do banco de dados**
2. **Execute em ambiente de desenvolvimento primeiro**
3. **Teste todas as funcionalidades após a migração**

## 🚀 Passos para Execução

### 1. Execute a Migração SQL
```sql
-- VERSÃO CORRIGIDA - Use este arquivo:
-- migration_fix_appointment_datetime.sql
-- no SQL Editor do Supabase

-- OU se preferir, use o arquivo original corrigido:
-- migration_split_appointment_datetime.sql
```

### 2. Verifique a Migração
Após executar, verifique se tudo está correto:

```sql
-- Verificar estrutura da tabela
\d appointments

-- Verificar alguns registros
SELECT id, appointment_date, appointment_time, 
       combine_appointment_datetime(appointment_date, appointment_time) as combined
FROM appointments LIMIT 5;

-- Verificar se não há dados nulos
SELECT COUNT(*) FROM appointments WHERE appointment_date IS NULL OR appointment_time IS NULL;
```

### 3. Atualize o Código Frontend

#### Hooks que precisam ser atualizados:
- `src/hooks/useAppointments.ts`
- Todas as queries que usam `appointment_datetime`

#### Componentes que precisam ser atualizados:
- Formulários de agendamento (usar inputs separados)
- Listagens de agendamentos
- Calendário (usar função de combinação)

#### Exemplo de atualização:
```typescript
// ANTES:
const appointment = {
  appointment_datetime: '2024-01-15T14:30:00'
}

// DEPOIS:
const appointment = {
  appointment_date: '2024-01-15',
  appointment_time: '14:30:00'
}
```

## 📁 Arquivos Criados/Atualizados

### ✅ Migração SQL
- `migration_split_appointment_datetime.sql` - Script principal de migração

### ✅ Tipos TypeScript
- `src/types/appointment.ts` - Interfaces atualizadas

### ✅ Utilitários
- `src/utils/dateTimeUtils.ts` - Funções para trabalhar com date/time

## 🔧 Funcionalidades da Migração

### ✅ O que a migração faz:
1. Cria backup da tabela original
2. Adiciona colunas `appointment_date` e `appointment_time`
3. Migra dados existentes
4. Remove coluna `appointment_datetime` antiga
5. Cria índices otimizados
6. Adiciona constraints de validação
7. Cria função auxiliar para combinar date+time
8. Cria view para compatibilidade

### ✅ Índices criados:
- `idx_appointments_date` - Para consultas por data
- `idx_appointments_time` - Para consultas por horário
- `idx_appointments_date_time` - Para consultas combinadas
- `idx_appointments_barber_date` - Para consultas por barbeiro e data
- `idx_appointments_status_date` - Para consultas por status e data

### ✅ Constraints adicionadas:
- Validação de data (entre 2020-2030)
- Validação de horário comercial (06:00-23:59)

## 🛠️ Próximos Passos Após Migração

1. **Atualizar useAppointments.ts**
   - Modificar queries para usar date/time separados
   - Atualizar funções de criação/edição

2. **Atualizar Formulários**
   - Usar `<input type="date">` e `<input type="time">`
   - Implementar validações no frontend

3. **Atualizar Calendário**
   - Usar função `combineDateTime()` dos utilitários
   - Testar todas as visualizações (mês/semana/dia)

4. **Testar Funcionalidades**
   - Criar novos agendamentos
   - Editar agendamentos existentes
   - Filtros por data/hora
   - Relatórios

## 🔄 Rollback (Se Necessário)

Se algo der errado, há um script de rollback comentado no final da migração. **Use com extremo cuidado!**

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do Supabase
2. Execute as queries de verificação
3. Consulte o backup criado automaticamente