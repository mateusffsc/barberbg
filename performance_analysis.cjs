const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function analyzePerformance() {
  console.log('🔍 ANÁLISE DE PERFORMANCE DO SISTEMA DE AGENDA\n');
  console.log('=' .repeat(60));

  try {
    // 1. Análise do volume de dados
    console.log('\n1️⃣ VOLUME DE DADOS');
    console.log('-'.repeat(30));
    
    const startTime = Date.now();
    
    // Contar agendamentos
    const { count: appointmentsCount, error: appointmentsError } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true });
    
    const appointmentsTime = Date.now() - startTime;
    
    if (appointmentsError) {
      console.log('❌ Erro ao contar agendamentos:', appointmentsError);
    } else {
      console.log(`📊 Total de agendamentos: ${appointmentsCount} (${appointmentsTime}ms)`);
    }

    // Contar clientes
    const clientsStart = Date.now();
    const { count: clientsCount } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true });
    const clientsTime = Date.now() - clientsStart;
    console.log(`👥 Total de clientes: ${clientsCount} (${clientsTime}ms)`);

    // Contar barbeiros
    const barbersStart = Date.now();
    const { count: barbersCount } = await supabase
      .from('barbers')
      .select('*', { count: 'exact', head: true });
    const barbersTime = Date.now() - barbersStart;
    console.log(`✂️  Total de barbeiros: ${barbersCount} (${barbersTime}ms)`);

    // Contar serviços
    const servicesStart = Date.now();
    const { count: servicesCount } = await supabase
      .from('services')
      .select('*', { count: 'exact', head: true });
    const servicesTime = Date.now() - servicesStart;
    console.log(`🛠️  Total de serviços: ${servicesCount} (${servicesTime}ms)`);

    // 2. Análise da query principal de agendamentos
    console.log('\n2️⃣ PERFORMANCE DA QUERY PRINCIPAL');
    console.log('-'.repeat(40));
    
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    defaultStart.setDate(defaultStart.getDate() - 120);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    defaultEnd.setDate(defaultEnd.getDate() + 365);
    const effectiveEnd = new Date(defaultEnd.getFullYear(), defaultEnd.getMonth(), defaultEnd.getDate(), 23, 59, 59, 999);

    console.log(`📅 Período de busca: ${defaultStart.toLocaleDateString('pt-BR')} até ${effectiveEnd.toLocaleDateString('pt-BR')}`);
    
    // Query simples (apenas agendamentos)
    const simpleStart = Date.now();
    const { data: simpleAppointments, error: simpleError } = await supabase
      .from('appointments')
      .select('*')
      .gte('appointment_datetime', defaultStart.toISOString())
      .lte('appointment_datetime', effectiveEnd.toISOString())
      .order('appointment_datetime');
    const simpleTime = Date.now() - simpleStart;
    
    if (simpleError) {
      console.log('❌ Erro na query simples:', simpleError);
    } else {
      console.log(`⚡ Query simples: ${simpleAppointments.length} registros em ${simpleTime}ms`);
    }

    // Query completa (com joins)
    const complexStart = Date.now();
    const { data: complexAppointments, error: complexError } = await supabase
      .from('appointments')
      .select(`
        *,
        client:clients(id, name),
        barber:barbers(id, name, is_special_barber),
        appointment_services(
          service_id,
          price_at_booking,
          commission_rate_applied,
          service:services(id, name, duration_minutes_normal, duration_minutes_special, is_chemical)
        )
      `)
      .gte('appointment_datetime', defaultStart.toISOString())
      .lte('appointment_datetime', effectiveEnd.toISOString())
      .order('appointment_datetime');
    const complexTime = Date.now() - complexStart;
    
    if (complexError) {
      console.log('❌ Erro na query completa:', complexError);
    } else {
      console.log(`🐌 Query completa: ${complexAppointments.length} registros em ${complexTime}ms`);
      console.log(`📈 Diferença: ${complexTime - simpleTime}ms (${((complexTime / simpleTime - 1) * 100).toFixed(1)}% mais lenta)`);
    }

    // 3. Análise de agendamentos por período
    console.log('\n3️⃣ DISTRIBUIÇÃO TEMPORAL');
    console.log('-'.repeat(30));
    
    if (simpleAppointments) {
      const today = new Date();
      const periods = {
        'Passado (> 30 dias)': 0,
        'Passado recente (0-30 dias)': 0,
        'Futuro próximo (0-30 dias)': 0,
        'Futuro distante (> 30 dias)': 0
      };
      
      simpleAppointments.forEach(apt => {
        const aptDate = new Date(apt.appointment_datetime);
        const daysDiff = Math.round((aptDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysDiff < -30) periods['Passado (> 30 dias)']++;
        else if (daysDiff < 0) periods['Passado recente (0-30 dias)']++;
        else if (daysDiff <= 30) periods['Futuro próximo (0-30 dias)']++;
        else periods['Futuro distante (> 30 dias)']++;
      });
      
      Object.entries(periods).forEach(([period, count]) => {
        const percentage = ((count / simpleAppointments.length) * 100).toFixed(1);
        console.log(`   ${period}: ${count} (${percentage}%)`);
      });
    }

    // 4. Análise de agendamentos recorrentes
    console.log('\n4️⃣ AGENDAMENTOS RECORRENTES');
    console.log('-'.repeat(35));
    
    if (simpleAppointments) {
      const recurring = simpleAppointments.filter(apt => apt.recurrence_group_id);
      const nonRecurring = simpleAppointments.filter(apt => !apt.recurrence_group_id);
      
      console.log(`🔄 Recorrentes: ${recurring.length} (${((recurring.length / simpleAppointments.length) * 100).toFixed(1)}%)`);
      console.log(`📅 Únicos: ${nonRecurring.length} (${((nonRecurring.length / simpleAppointments.length) * 100).toFixed(1)}%)`);
      
      // Contar grupos recorrentes
      const groups = new Set(recurring.map(apt => apt.recurrence_group_id));
      console.log(`📊 Grupos recorrentes: ${groups.size}`);
      console.log(`📈 Média por grupo: ${(recurring.length / groups.size).toFixed(1)} agendamentos`);
    }

    // 5. Análise de subscriptions e recarregamentos
    console.log('\n5️⃣ ANÁLISE DE SUBSCRIPTIONS');
    console.log('-'.repeat(35));
    
    console.log('📡 Subscriptions ativas identificadas:');
    console.log('   - appointments (INSERT/UPDATE/DELETE)');
    console.log('   - schedule_blocks (INSERT/UPDATE/DELETE)');
    console.log('   - broadcast channel (appointments-sync)');
    console.log('⚠️  Múltiplas subscriptions podem causar recarregamentos excessivos');

    // 6. Recomendações de otimização
    console.log('\n6️⃣ RECOMENDAÇÕES DE OTIMIZAÇÃO');
    console.log('-'.repeat(40));
    
    const recommendations = [];
    
    if (complexTime > 1000) {
      recommendations.push('🚨 CRÍTICO: Query principal muito lenta (>1s)');
    } else if (complexTime > 500) {
      recommendations.push('⚠️  ATENÇÃO: Query principal lenta (>500ms)');
    }
    
    if (complexTime / simpleTime > 3) {
      recommendations.push('🔍 JOINs estão causando lentidão significativa');
    }
    
    if (appointmentsCount > 10000) {
      recommendations.push('📊 Volume alto de dados - considerar paginação');
    }
    
    if (simpleAppointments && simpleAppointments.length > 1000) {
      recommendations.push('📅 Período de busca muito amplo - reduzir escopo');
    }
    
    recommendations.push('🔄 Múltiplas subscriptions podem causar recarregamentos');
    recommendations.push('⏱️  Debounce de 400ms pode não ser suficiente');
    
    if (recommendations.length === 0) {
      console.log('✅ Performance dentro do esperado');
    } else {
      recommendations.forEach(rec => console.log(`   ${rec}`));
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎯 ANÁLISE CONCLUÍDA');
    
  } catch (error) {
    console.error('❌ Erro na análise:', error);
  }
}

analyzePerformance();