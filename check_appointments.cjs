const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkAppointments() {
  console.log('🔍 Verificando agendamentos no banco de dados...');
  
  try {
    // Contar total de agendamentos
    const { count: totalCount, error: totalError } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true });
      
    if (totalError) {
      console.error('❌ Erro ao contar total:', totalError);
      return;
    }
    
    console.log('📊 Total de agendamentos no banco:', totalCount);
    
    // Verificar agendamentos após 04/11/2025
    const { data: futureAppointments, count: futureCount, error: futureError } = await supabase
      .from('appointments')
      .select('id, appointment_datetime, client_name, barber_name', { count: 'exact' })
      .gte('appointment_datetime', '2025-11-04T00:00:00')
      .order('appointment_datetime')
      .limit(10);
      
    if (futureError) {
      console.error('❌ Erro ao buscar agendamentos futuros:', futureError);
      return;
    }
    
    console.log('📅 Agendamentos após 04/11/2025:', futureCount);
    console.log('📋 Primeiros 10 agendamentos futuros:');
    futureAppointments?.forEach(apt => {
      console.log(`  - ${apt.appointment_datetime} | ${apt.client_name} com ${apt.barber_name}`);
    });
    
    // Verificar últimos agendamentos
    const { data: recentAppointments, error: recentError } = await supabase
      .from('appointments')
      .select('id, appointment_datetime, client_name, barber_name')
      .order('appointment_datetime', { ascending: false })
      .limit(5);
      
    if (recentError) {
      console.error('❌ Erro ao buscar agendamentos recentes:', recentError);
      return;
    }
    
    console.log('🕐 Últimos 5 agendamentos no banco:');
    recentAppointments?.forEach(apt => {
      console.log(`  - ${apt.appointment_datetime} | ${apt.client_name} com ${apt.barber_name}`);
    });

    // Verificar se há limite na consulta padrão (sem filtros)
    const { data: allAppointments, count: allCount, error: allError } = await supabase
      .from('appointments')
      .select('id, appointment_datetime', { count: 'exact' })
      .order('appointment_datetime');
      
    if (allError) {
      console.error('❌ Erro ao buscar todos os agendamentos:', allError);
      return;
    }
    
    console.log('🔢 Agendamentos retornados na consulta padrão:', allAppointments?.length);
    console.log('🔢 Count total da consulta:', allCount);
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

checkAppointments();