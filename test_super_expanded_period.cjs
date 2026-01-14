const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testSuperExpandedPeriod() {
  console.log('🔍 Testando período super ampliado...\n');

  try {
    // Testar com período super ampliado
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    defaultStart.setDate(defaultStart.getDate() - 120); // -120 dias
    
    const defaultEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    defaultEnd.setDate(defaultEnd.getDate() + 365); // +365 dias
    const effectiveEnd = new Date(defaultEnd.getFullYear(), defaultEnd.getMonth(), defaultEnd.getDate(), 23, 59, 59, 999);

    console.log(`📅 Período super ampliado: ${defaultStart.toLocaleDateString('pt-BR')} até ${effectiveEnd.toLocaleDateString('pt-BR')}`);
    console.log(`📊 Total de dias: ${Math.round((effectiveEnd - defaultStart) / (1000 * 60 * 60 * 24))} dias`);

    const { data: superExpandedSearch, error: superError } = await supabase
      .from('appointments')
      .select('*')
      .gte('appointment_datetime', defaultStart.toISOString())
      .lte('appointment_datetime', effectiveEnd.toISOString())
      .not('recurrence_group_id', 'is', null)
      .order('appointment_datetime');

    if (superError) {
      console.log('❌ Erro na busca super ampliada:', superError);
      return;
    }

    console.log(`✅ Agendamentos recorrentes encontrados: ${superExpandedSearch.length}`);

    // Comparar com total
    const { data: allRecurring } = await supabase
      .from('appointments')
      .select('*')
      .not('recurrence_group_id', 'is', null);

    console.log(`📊 Total de recorrentes no sistema: ${allRecurring.length}`);
    console.log(`📈 Cobertura: ${((superExpandedSearch.length / allRecurring.length) * 100).toFixed(1)}%`);

    if (superExpandedSearch.length === allRecurring.length) {
      console.log('🎉 PERFEITO: Todos os agendamentos recorrentes agora são visíveis!');
    } else {
      const hidden = allRecurring.length - superExpandedSearch.length;
      console.log(`⚠️  Ainda há ${hidden} agendamentos ocultos`);
      
      // Mostrar os que ainda estão ocultos
      const hiddenOnes = allRecurring.filter(apt => {
        const aptDate = new Date(apt.appointment_datetime);
        return aptDate < defaultStart || aptDate > effectiveEnd;
      });

      if (hiddenOnes.length > 0) {
        console.log('\n📋 Agendamentos ainda ocultos:');
        hiddenOnes.slice(0, 5).forEach((apt, index) => {
          const date = new Date(apt.appointment_datetime);
          const daysFromNow = Math.round((date - now) / (1000 * 60 * 60 * 24));
          console.log(`   ${index + 1}. ${apt.client_name} - ${date.toLocaleDateString('pt-BR')} (${daysFromNow > 0 ? '+' : ''}${daysFromNow} dias)`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testSuperExpandedPeriod();