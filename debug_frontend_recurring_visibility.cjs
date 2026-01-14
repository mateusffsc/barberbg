const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function debugFrontendRecurringVisibility() {
  console.log('🔍 Debugando visibilidade dos agendamentos recorrentes no frontend...\n');

  try {
    // 1. Simular exatamente o que o frontend faz
    console.log('1️⃣ Simulando busca do frontend com período ampliado...');
    
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    defaultStart.setDate(defaultStart.getDate() - 30); // Período ampliado
    
    const defaultEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    defaultEnd.setDate(defaultEnd.getDate() + 180); // Período ampliado
    const effectiveEnd = new Date(defaultEnd.getFullYear(), defaultEnd.getMonth(), defaultEnd.getDate(), 23, 59, 59, 999);

    console.log(`📅 Período de busca do frontend: ${defaultStart.toLocaleDateString('pt-BR')} até ${effectiveEnd.toLocaleDateString('pt-BR')}`);

    // Simular a query exata do frontend
    const { data: frontendAppointments, error: frontendError } = await supabase
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

    if (frontendError) {
      console.log('❌ Erro na busca do frontend:', frontendError);
      return;
    }

    console.log(`✅ Total de agendamentos encontrados: ${frontendAppointments.length}`);

    // 2. Filtrar apenas os recorrentes
    const recurringAppointments = frontendAppointments.filter(apt => apt.recurrence_group_id);
    console.log(`📊 Agendamentos recorrentes encontrados: ${recurringAppointments.length}`);

    // 3. Verificar se há agendamentos recorrentes fora do período
    console.log('\n2️⃣ Verificando agendamentos recorrentes fora do período...');
    
    const { data: allRecurring, error: allError } = await supabase
      .from('appointments')
      .select('*')
      .not('recurrence_group_id', 'is', null)
      .order('appointment_datetime');

    if (allError) {
      console.log('❌ Erro ao buscar todos os recorrentes:', allError);
      return;
    }

    const hiddenRecurring = allRecurring.filter(apt => {
      const aptDate = new Date(apt.appointment_datetime);
      return aptDate < defaultStart || aptDate > effectiveEnd;
    });

    console.log(`🙈 Agendamentos recorrentes OCULTOS: ${hiddenRecurring.length}`);
    console.log(`✅ Agendamentos recorrentes VISÍVEIS: ${recurringAppointments.length}`);
    console.log(`📊 Total de recorrentes no sistema: ${allRecurring.length}`);

    // 4. Mostrar alguns exemplos de ocultos se houver
    if (hiddenRecurring.length > 0) {
      console.log('\n📋 Primeiros 10 agendamentos recorrentes ocultos:');
      hiddenRecurring.slice(0, 10).forEach((apt, index) => {
        const date = new Date(apt.appointment_datetime);
        const daysFromNow = Math.round((date - now) / (1000 * 60 * 60 * 24));
        console.log(`   ${index + 1}. ${apt.client_name} - ${date.toLocaleDateString('pt-BR')} (${daysFromNow > 0 ? '+' : ''}${daysFromNow} dias)`);
      });
    }

    // 5. Verificar se há problema com filtro de barbeiro
    console.log('\n3️⃣ Verificando filtro de barbeiro...');
    
    const { data: barbers, error: barbersError } = await supabase
      .from('barbers')
      .select('*');

    if (barbersError) {
      console.log('❌ Erro ao buscar barbeiros:', barbersError);
      return;
    }

    console.log(`👥 Total de barbeiros: ${barbers.length}`);

    // Verificar distribuição por barbeiro
    const recurringByBarber = {};
    recurringAppointments.forEach(apt => {
      const barberId = apt.barber_id;
      if (!recurringByBarber[barberId]) {
        recurringByBarber[barberId] = 0;
      }
      recurringByBarber[barberId]++;
    });

    console.log('\n📊 Distribuição de agendamentos recorrentes por barbeiro:');
    Object.entries(recurringByBarber).forEach(([barberId, count]) => {
      const barber = barbers.find(b => b.id == barberId);
      console.log(`   Barbeiro ${barber?.name || 'ID ' + barberId}: ${count} agendamentos`);
    });

    // 6. Conclusão
    console.log('\n🎯 DIAGNÓSTICO:');
    console.log('===============');
    
    if (recurringAppointments.length === allRecurring.length) {
      console.log('✅ PERFEITO: Todos os agendamentos recorrentes estão visíveis!');
      console.log('   O problema pode estar na interface ou no processamento dos dados.');
    } else if (recurringAppointments.length > 0) {
      console.log(`⚠️  PARCIAL: ${recurringAppointments.length}/${allRecurring.length} agendamentos recorrentes visíveis`);
      console.log(`   ${hiddenRecurring.length} agendamentos ainda estão fora do período ampliado`);
    } else {
      console.log('❌ PROBLEMA: Nenhum agendamento recorrente está visível!');
      console.log('   Pode haver problema na query ou nos filtros');
    }

    // 7. Testar conversão para eventos do calendário
    console.log('\n4️⃣ Testando conversão para eventos do calendário...');
    
    // Simular a transformação que o frontend faz
    const appointmentsWithServices = frontendAppointments.map(appointment => ({
      ...appointment,
      services: appointment.appointment_services?.map((as) => ({
        id: as.service.id,
        name: as.service.name,
        duration_minutes_normal: as.service.duration_minutes_normal,
        duration_minutes_special: as.service.duration_minutes_special,
        is_chemical: as.service.is_chemical,
        price_at_booking: as.price_at_booking,
        commission_rate_applied: as.commission_rate_applied
      })) || []
    }));

    const recurringWithServices = appointmentsWithServices.filter(apt => apt.recurrence_group_id);
    console.log(`📊 Agendamentos recorrentes após transformação: ${recurringWithServices.length}`);

    if (recurringWithServices.length > 0) {
      console.log('\n📋 Primeiros 5 agendamentos recorrentes processados:');
      recurringWithServices.slice(0, 5).forEach((apt, index) => {
        const date = new Date(apt.appointment_datetime);
        console.log(`   ${index + 1}. ${apt.client_name} - ${date.toLocaleDateString('pt-BR')} - Serviços: ${apt.services.length}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

debugFrontendRecurringVisibility();