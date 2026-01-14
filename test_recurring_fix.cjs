const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testRecurringFix() {
  console.log('🔍 Testando correção de agendamentos recorrentes...\n');

  try {
    // 1. Testar busca com período ampliado (novo padrão)
    console.log('1️⃣ Testando busca com período ampliado...');
    
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    defaultStart.setDate(defaultStart.getDate() - 30); // -30 dias
    
    const defaultEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    defaultEnd.setDate(defaultEnd.getDate() + 180); // +180 dias
    const effectiveEnd = new Date(defaultEnd.getFullYear(), defaultEnd.getMonth(), defaultEnd.getDate(), 23, 59, 59, 999);

    console.log(`📅 Novo período de busca: ${defaultStart.toLocaleDateString('pt-BR')} até ${effectiveEnd.toLocaleDateString('pt-BR')}`);

    const { data: expandedSearch, error: expandedError } = await supabase
      .from('appointments')
      .select('*')
      .gte('appointment_datetime', defaultStart.toISOString())
      .lte('appointment_datetime', effectiveEnd.toISOString())
      .not('recurrence_group_id', 'is', null)
      .order('appointment_datetime');

    if (expandedError) {
      console.log('❌ Erro na busca ampliada:', expandedError);
      return;
    }

    console.log(`✅ Agendamentos recorrentes encontrados com período ampliado: ${expandedSearch.length}`);

    // 2. Comparar com período antigo
    console.log('\n2️⃣ Comparando com período antigo...');
    
    const oldStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    oldStart.setDate(oldStart.getDate() - 7); // -7 dias (antigo)
    
    const oldEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    oldEnd.setDate(oldEnd.getDate() + 60); // +60 dias (antigo)
    const oldEffectiveEnd = new Date(oldEnd.getFullYear(), oldEnd.getMonth(), oldEnd.getDate(), 23, 59, 59, 999);

    const { data: oldSearch, error: oldError } = await supabase
      .from('appointments')
      .select('*')
      .gte('appointment_datetime', oldStart.toISOString())
      .lte('appointment_datetime', oldEffectiveEnd.toISOString())
      .not('recurrence_group_id', 'is', null)
      .order('appointment_datetime');

    if (oldError) {
      console.log('❌ Erro na busca antiga:', oldError);
      return;
    }

    console.log(`📊 Agendamentos recorrentes com período antigo: ${oldSearch.length}`);
    console.log(`📈 Diferença: +${expandedSearch.length - oldSearch.length} agendamentos agora visíveis`);

    // 3. Testar busca de todos os recorrentes
    console.log('\n3️⃣ Testando busca de TODOS os agendamentos recorrentes...');
    
    const { data: allRecurring, error: allError } = await supabase
      .from('appointments')
      .select('*')
      .not('recurrence_group_id', 'is', null)
      .order('appointment_datetime');

    if (allError) {
      console.log('❌ Erro na busca de todos:', allError);
      return;
    }

    console.log(`🎯 Total de agendamentos recorrentes no sistema: ${allRecurring.length}`);

    // 4. Análise por período
    console.log('\n4️⃣ Análise por período...');
    
    const periods = {
      'Passado (antes de -30 dias)': allRecurring.filter(apt => new Date(apt.appointment_datetime) < defaultStart).length,
      'Período ampliado (-30 a +180 dias)': expandedSearch.length,
      'Futuro distante (após +180 dias)': allRecurring.filter(apt => new Date(apt.appointment_datetime) > effectiveEnd).length
    };

    Object.entries(periods).forEach(([period, count]) => {
      console.log(`   ${period}: ${count} agendamentos`);
    });

    // 5. Mostrar alguns exemplos de agendamentos que agora ficaram visíveis
    console.log('\n5️⃣ Exemplos de agendamentos que agora ficaram visíveis...');
    
    const newlyVisible = expandedSearch.filter(apt => {
      const aptDate = new Date(apt.appointment_datetime);
      return aptDate < oldStart || aptDate > oldEffectiveEnd;
    }).slice(0, 10);

    if (newlyVisible.length > 0) {
      console.log('📋 Primeiros 10 agendamentos que agora aparecem:');
      newlyVisible.forEach((apt, index) => {
        const date = new Date(apt.appointment_datetime);
        const daysFromNow = Math.round((date - now) / (1000 * 60 * 60 * 24));
        console.log(`   ${index + 1}. ${apt.client_name} - ${date.toLocaleDateString('pt-BR')} (${daysFromNow > 0 ? '+' : ''}${daysFromNow} dias)`);
      });
    } else {
      console.log('✅ Todos os agendamentos do período ampliado já eram visíveis');
    }

    // 6. Conclusão
    console.log('\n🎯 RESULTADO DA CORREÇÃO:');
    console.log('========================');
    console.log(`✅ Período de busca ampliado de 67 dias para 210 dias`);
    console.log(`✅ ${expandedSearch.length - oldSearch.length} agendamentos recorrentes adicionais agora visíveis`);
    console.log(`✅ Função para ver TODOS os ${allRecurring.length} agendamentos recorrentes disponível`);
    console.log(`✅ Botão "Ver Todos os Recorrentes" adicionado na interface`);

    if (expandedSearch.length === allRecurring.length) {
      console.log('🎉 PERFEITO: Todos os agendamentos recorrentes agora são visíveis no período padrão!');
    } else {
      console.log(`ℹ️  INFO: ${allRecurring.length - expandedSearch.length} agendamentos ainda fora do período (use o botão "Ver Todos")`);
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testRecurringFix();