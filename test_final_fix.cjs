const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Criar cliente com as mesmas configurações do frontend
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  {
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'Prefer': 'count=exact'
      }
    }
  }
);

async function testFinalFix() {
  console.log('🔧 Testando correção final do limite de agendamentos...');
  
  try {
    // Simular exatamente a mesma consulta do useAppointments.ts
    let query = supabase
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
      `, { count: 'exact' })
      .order('appointment_datetime')
      .limit(5000);

    console.log('📡 Executando consulta com limit(5000)...');
    const { data, count, error } = await query;

    if (error) {
      console.error('❌ Erro na consulta:', error);
      return;
    }

    console.log('✅ Consulta executada com sucesso!');
    console.log('📊 Total de agendamentos no banco:', count);
    console.log('📋 Agendamentos retornados pela consulta:', data?.length);
    
    // Verificar agendamentos após 04/11/2025
    const futureAppointments = data?.filter(apt => 
      new Date(apt.appointment_datetime) >= new Date('2025-11-04T00:00:00')
    );
    
    console.log('📅 Agendamentos após 04/11/2025 retornados:', futureAppointments?.length);
    
    // Verificar se conseguimos mais de 1000 registros
    if (data && data.length > 1000) {
      console.log('🎉 SUCESSO! Conseguimos mais de 1000 registros!');
      console.log('📈 Limite anterior de 1000 foi superado!');
    } else if (data && data.length === 1000) {
      console.log('⚠️ Ainda limitado a exatamente 1000 registros');
      console.log('🔍 Pode ser um limite do PostgREST no servidor Supabase');
    } else {
      console.log('ℹ️ Retornados', data?.length, 'registros (menos que 1000)');
    }
    
    // Mostrar alguns agendamentos futuros se existirem
    if (futureAppointments && futureAppointments.length > 0) {
      console.log('\n📋 Primeiros 3 agendamentos após 04/11/2025:');
      futureAppointments.slice(0, 3).forEach((apt, index) => {
        console.log(`  ${index + 1}. ${apt.appointment_datetime} | ${apt.client_name || 'Cliente'} com ${apt.barber_name || 'Barbeiro'}`);
      });
    }
    
    // Teste adicional: consulta sem limit para comparar
    console.log('\n🔄 Testando consulta sem limit...');
    const { data: dataNoLimit, count: countNoLimit, error: errorNoLimit } = await supabase
      .from('appointments')
      .select('id, appointment_datetime, client_name, barber_name', { count: 'exact' })
      .order('appointment_datetime');
    
    if (!errorNoLimit) {
      console.log('📊 Consulta sem limit - Total no banco:', countNoLimit);
      console.log('📋 Consulta sem limit - Registros retornados:', dataNoLimit?.length);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testFinalFix();