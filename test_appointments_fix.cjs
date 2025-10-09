const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testAppointmentsFix() {
  console.log('🧪 Testando se a correção do limite de agendamentos funcionou...');
  
  try {
    // Simular a mesma consulta que o frontend faz
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

    const { data, count, error } = await query;

    if (error) {
      console.error('❌ Erro na consulta:', error);
      return;
    }

    console.log('✅ Consulta executada com sucesso!');
    console.log('📊 Total de agendamentos no banco:', count);
    console.log('📋 Agendamentos retornados:', data?.length);
    
    // Verificar se temos agendamentos após 04/11/2025
    const futureAppointments = data?.filter(apt => 
      new Date(apt.appointment_datetime) >= new Date('2025-11-04T00:00:00')
    );
    
    console.log('📅 Agendamentos após 04/11/2025 retornados:', futureAppointments?.length);
    
    if (futureAppointments && futureAppointments.length > 0) {
      console.log('🎉 SUCESSO! Agendamentos futuros estão sendo retornados!');
      console.log('📋 Primeiros 5 agendamentos futuros:');
      futureAppointments.slice(0, 5).forEach(apt => {
        console.log(`  - ${apt.appointment_datetime} | ${apt.client_name} com ${apt.barber_name}`);
      });
    } else {
      console.log('⚠️ Nenhum agendamento futuro encontrado nos resultados');
    }
    
    // Verificar se conseguimos mais de 1000 registros
    if (data && data.length > 1000) {
      console.log('🎉 SUCESSO! Conseguimos mais de 1000 agendamentos!');
    } else {
      console.log('⚠️ Ainda limitado a 1000 registros ou menos');
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testAppointmentsFix();