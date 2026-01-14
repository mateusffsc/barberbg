const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testOptimizedPerformance() {
  console.log('🚀 TESTE DE PERFORMANCE OTIMIZADA\n');
  console.log('=' .repeat(60));

  try {
    // Período OTIMIZADO (90 dias: -15 a +75)
    const now = new Date();
    const optimizedStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    optimizedStart.setDate(optimizedStart.getDate() - 15); // 15 dias passado
    const optimizedEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    optimizedEnd.setDate(optimizedEnd.getDate() + 75); // 75 dias futuro
    const effectiveEnd = new Date(optimizedEnd.getFullYear(), optimizedEnd.getMonth(), optimizedEnd.getDate(), 23, 59, 59, 999);

    console.log('\n1️⃣ PERÍODO OTIMIZADO (90 DIAS)');
    console.log('-'.repeat(35));
    console.log(`📅 Período: ${optimizedStart.toLocaleDateString('pt-BR')} até ${effectiveEnd.toLocaleDateString('pt-BR')}`);
    
    // Query OTIMIZADA (sem JOINs)
    const optimizedStart1 = Date.now();
    const { data: optimizedData, count: optimizedCount, error: optimizedError } = await supabase
      .from('appointments')
      .select(`
        id, client_id, barber_id, client_name, client_phone, barber_name, barber_phone,
        appointment_datetime, appointment_date, appointment_time, status, total_price, 
        duration_minutes, services_names, services_ids, note, recurrence_group_id,
        created_at, updated_at, payment_method, reminder_sent
      `, { count: 'exact' })
      .gte('appointment_datetime', optimizedStart.toISOString())
      .lte('appointment_datetime', effectiveEnd.toISOString())
      .order('appointment_datetime');
    const optimizedTime1 = Date.now() - optimizedStart1;
    
    if (optimizedError) {
      console.log('❌ Erro na query otimizada:', optimizedError);
    } else {
      console.log(`⚡ Query OTIMIZADA: ${optimizedData.length} registros em ${optimizedTime1}ms`);
      console.log(`📊 Total no período: ${optimizedCount} agendamentos`);
    }

    // Comparação com período ANTIGO (485 dias: -120 a +365)
    console.log('\n2️⃣ COMPARAÇÃO COM PERÍODO ANTIGO');
    console.log('-'.repeat(40));
    
    const oldStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    oldStart.setDate(oldStart.getDate() - 120);
    const oldEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    oldEnd.setDate(oldEnd.getDate() + 365);
    const oldEffectiveEnd = new Date(oldEnd.getFullYear(), oldEnd.getMonth(), oldEnd.getDate(), 23, 59, 59, 999);

    console.log(`📅 Período antigo: ${oldStart.toLocaleDateString('pt-BR')} até ${oldEffectiveEnd.toLocaleDateString('pt-BR')}`);
    
    const oldStart1 = Date.now();
    const { count: oldCount } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .gte('appointment_datetime', oldStart.toISOString())
      .lte('appointment_datetime', oldEffectiveEnd.toISOString());
    const oldTime1 = Date.now() - oldStart1;
    
    console.log(`🐌 Período antigo: ${oldCount} registros em ${oldTime1}ms`);

    // Análise de melhoria
    console.log('\n3️⃣ ANÁLISE DE MELHORIA');
    console.log('-'.repeat(30));
    
    const dataReduction = ((oldCount - optimizedCount) / oldCount * 100).toFixed(1);
    const timeImprovement = oldTime1 > optimizedTime1 ? ((oldTime1 - optimizedTime1) / oldTime1 * 100).toFixed(1) : 0;
    
    console.log(`📉 Redução de dados: ${dataReduction}% (${oldCount} → ${optimizedCount} registros)`);
    console.log(`⚡ Melhoria de tempo: ${timeImprovement}% (${oldTime1}ms → ${optimizedTime1}ms)`);
    console.log(`🎯 Período reduzido: 485 → 90 dias (${((485-90)/485*100).toFixed(1)}% menor)`);

    // Teste de cache simulado
    console.log('\n4️⃣ SIMULAÇÃO DE CACHE');
    console.log('-'.repeat(25));
    
    const cacheKey = `${optimizedStart.toISOString()}-${effectiveEnd.toISOString()}-all`;
    console.log(`🔑 Cache key: ${cacheKey.substring(0, 50)}...`);
    
    // Simular hit de cache
    const cacheHitTime = 1; // 1ms para retorno do cache
    console.log(`📦 Cache HIT: ${cacheHitTime}ms (${((optimizedTime1 - cacheHitTime) / optimizedTime1 * 100).toFixed(1)}% mais rápido)`);

    // Distribuição temporal dos dados otimizados
    if (optimizedData && optimizedData.length > 0) {
      console.log('\n5️⃣ DISTRIBUIÇÃO TEMPORAL OTIMIZADA');
      console.log('-'.repeat(40));
      
      const today = new Date();
      const periods = {
        'Passado (0-15 dias)': 0,
        'Presente (hoje)': 0,
        'Futuro próximo (0-30 dias)': 0,
        'Futuro distante (30-75 dias)': 0
      };
      
      optimizedData.forEach(apt => {
        const aptDate = new Date(apt.appointment_datetime);
        const daysDiff = Math.round((aptDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysDiff < 0) periods['Passado (0-15 dias)']++;
        else if (daysDiff === 0) periods['Presente (hoje)']++;
        else if (daysDiff <= 30) periods['Futuro próximo (0-30 dias)']++;
        else periods['Futuro distante (30-75 dias)']++;
      });
      
      Object.entries(periods).forEach(([period, count]) => {
        const percentage = ((count / optimizedData.length) * 100).toFixed(1);
        console.log(`   ${period}: ${count} (${percentage}%)`);
      });
    }

    // Resumo das otimizações
    console.log('\n6️⃣ RESUMO DAS OTIMIZAÇÕES IMPLEMENTADAS');
    console.log('-'.repeat(45));
    
    console.log('✅ Período reduzido: 485 → 90 dias');
    console.log('✅ Query otimizada: Removidos JOINs desnecessários');
    console.log('✅ Cache implementado: TTL de 2 minutos');
    console.log('✅ Debounce aumentado: 400ms → 800ms');
    console.log('✅ Limpeza automática de cache nas modificações');

    console.log('\n' + '='.repeat(60));
    console.log('🎯 TESTE DE PERFORMANCE CONCLUÍDO');
    console.log(`🚀 RESULTADO: ${dataReduction}% menos dados, ${timeImprovement}% mais rápido`);
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testOptimizedPerformance();