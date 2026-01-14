const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function debugRecurringAppointmentsVisibility() {
  console.log('🔍 Debugando visibilidade de agendamentos recorrentes...\n');

  try {
    // 1. Verificar agendamentos recorrentes existentes
    console.log('1️⃣ Verificando agendamentos recorrentes existentes...');
    const { data: recurringAppointments, error: recurringError } = await supabase
      .from('appointments')
      .select('*')
      .not('recurrence_group_id', 'is', null)
      .order('appointment_datetime');

    if (recurringError) {
      console.log('❌ Erro ao buscar agendamentos recorrentes:', recurringError);
      return;
    }

    console.log(`✅ Encontrados ${recurringAppointments.length} agendamentos recorrentes`);
    
    if (recurringAppointments.length > 0) {
      console.log('\n📋 Detalhes dos agendamentos recorrentes:');
      const groupedByRecurrence = {};
      
      recurringAppointments.forEach(apt => {
        const groupId = apt.recurrence_group_id;
        if (!groupedByRecurrence[groupId]) {
          groupedByRecurrence[groupId] = [];
        }
        groupedByRecurrence[groupId].push(apt);
      });

      Object.keys(groupedByRecurrence).forEach((groupId, index) => {
        const group = groupedByRecurrence[groupId];
        console.log(`\n   Grupo ${index + 1} (${groupId}):`);
        console.log(`   📊 Total de agendamentos: ${group.length}`);
        console.log(`   👤 Cliente: ${group[0].client_name}`);
        console.log(`   ✂️ Barbeiro: ${group[0].barber_name}`);
        console.log(`   📅 Datas:`);
        
        group.forEach((apt, i) => {
          const date = new Date(apt.appointment_datetime);
          console.log(`      ${i + 1}. ${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);
        });
      });
    }

    // 2. Simular a busca que o frontend faz
    console.log('\n2️⃣ Simulando busca do frontend...');
    
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    defaultStart.setDate(defaultStart.getDate() - 7); // 7 dias atrás
    
    const defaultEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    defaultEnd.setDate(defaultEnd.getDate() + 60); // 60 dias no futuro
    const effectiveEnd = new Date(defaultEnd.getFullYear(), defaultEnd.getMonth(), defaultEnd.getDate(), 23, 59, 59, 999);

    console.log(`📅 Período de busca: ${defaultStart.toLocaleDateString('pt-BR')} até ${effectiveEnd.toLocaleDateString('pt-BR')}`);

    const { data: visibleAppointments, error: visibleError } = await supabase
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

    if (visibleError) {
      console.log('❌ Erro na busca do frontend:', visibleError);
      return;
    }

    console.log(`✅ Agendamentos visíveis no período: ${visibleAppointments.length}`);

    // 3. Verificar quais agendamentos recorrentes estão visíveis
    const visibleRecurring = visibleAppointments.filter(apt => apt.recurrence_group_id);
    console.log(`📊 Agendamentos recorrentes visíveis: ${visibleRecurring.length}`);

    // 4. Identificar agendamentos recorrentes fora do período
    const hiddenRecurring = recurringAppointments.filter(apt => {
      const aptDate = new Date(apt.appointment_datetime);
      return aptDate < defaultStart || aptDate > effectiveEnd;
    });

    console.log(`🙈 Agendamentos recorrentes OCULTOS (fora do período): ${hiddenRecurring.length}`);
    
    if (hiddenRecurring.length > 0) {
      console.log('\n📋 Agendamentos recorrentes ocultos:');
      hiddenRecurring.forEach((apt, index) => {
        const date = new Date(apt.appointment_datetime);
        const daysFromNow = Math.round((date - now) / (1000 * 60 * 60 * 24));
        console.log(`   ${index + 1}. ${apt.client_name} - ${date.toLocaleDateString('pt-BR')} (${daysFromNow > 0 ? '+' : ''}${daysFromNow} dias)`);
      });
    }

    // 5. Criar um agendamento recorrente de teste para verificar o problema
    console.log('\n3️⃣ Criando agendamento recorrente de teste...');
    
    // Buscar cliente e barbeiro para teste
    const { data: clients } = await supabase.from('clients').select('*').limit(1);
    const { data: barbers } = await supabase.from('barbers').select('*').limit(1);
    const { data: services } = await supabase.from('services').select('*').limit(1);

    if (!clients?.length || !barbers?.length || !services?.length) {
      console.log('❌ Dados insuficientes para teste (cliente, barbeiro ou serviço)');
      return;
    }

    const client = clients[0];
    const barber = barbers[0];
    const service = services[0];

    // Criar agendamento para 90 dias no futuro (fora do período padrão)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 90);
    futureDate.setHours(14, 0, 0, 0); // 14:00

    const recurrenceGroupId = `test-${Date.now()}`;

    console.log(`📅 Criando agendamento para: ${futureDate.toLocaleDateString('pt-BR')} (90 dias no futuro)`);

    const testAppointment = {
      client_id: client.id,
      barber_id: barber.id,
      client_name: client.name,
      client_phone: client.phone,
      barber_name: barber.name,
      barber_phone: barber.phone,
      services_names: service.name,
      services_ids: [service.id],
      appointment_datetime: futureDate.toISOString(),
      appointment_date: futureDate.toISOString().split('T')[0],
      appointment_time: '14:00:00',
      status: 'scheduled',
      total_price: service.price,
      duration_minutes: service.duration_minutes_normal || 30,
      note: 'Teste agendamento recorrente - 90 dias futuro',
      recurrence_group_id: recurrenceGroupId
    };

    const { data: createdAppointment, error: createError } = await supabase
      .from('appointments')
      .insert(testAppointment)
      .select()
      .single();

    if (createError) {
      console.log('❌ Erro ao criar agendamento de teste:', createError);
      return;
    }

    console.log('✅ Agendamento de teste criado:', createdAppointment.id);

    // Criar serviço do agendamento
    await supabase
      .from('appointment_services')
      .insert({
        appointment_id: createdAppointment.id,
        service_id: service.id,
        price_at_booking: service.price,
        commission_rate_applied: barber.commission_rate_service || 0.5
      });

    // 6. Verificar se o agendamento aparece na busca padrão
    console.log('\n4️⃣ Verificando se o agendamento de teste aparece na busca padrão...');
    
    const { data: standardSearch } = await supabase
      .from('appointments')
      .select('*')
      .gte('appointment_datetime', defaultStart.toISOString())
      .lte('appointment_datetime', effectiveEnd.toISOString())
      .eq('id', createdAppointment.id);

    console.log(`📊 Agendamento de teste visível na busca padrão: ${standardSearch?.length > 0 ? 'SIM' : 'NÃO'}`);

    // 7. Verificar se aparece em busca ampliada
    console.log('\n5️⃣ Verificando com período ampliado...');
    
    const extendedEnd = new Date();
    extendedEnd.setDate(extendedEnd.getDate() + 120); // 120 dias no futuro

    const { data: extendedSearch } = await supabase
      .from('appointments')
      .select('*')
      .gte('appointment_datetime', defaultStart.toISOString())
      .lte('appointment_datetime', extendedEnd.toISOString())
      .eq('id', createdAppointment.id);

    console.log(`📊 Agendamento de teste visível com período ampliado: ${extendedSearch?.length > 0 ? 'SIM' : 'NÃO'}`);

    // 8. Limpar dados de teste
    console.log('\n6️⃣ Limpando dados de teste...');
    await supabase.from('appointment_services').delete().eq('appointment_id', createdAppointment.id);
    await supabase.from('appointments').delete().eq('id', createdAppointment.id);
    console.log('✅ Dados de teste removidos');

    // 9. Conclusão e recomendações
    console.log('\n🎯 CONCLUSÃO:');
    console.log('================');
    
    if (hiddenRecurring.length > 0) {
      console.log('❌ PROBLEMA IDENTIFICADO:');
      console.log(`   • ${hiddenRecurring.length} agendamentos recorrentes estão fora do período de busca padrão`);
      console.log('   • O frontend busca apenas agendamentos de -7 a +60 dias');
      console.log('   • Agendamentos recorrentes podem ser criados para datas mais distantes');
      console.log('\n💡 SOLUÇÕES RECOMENDADAS:');
      console.log('   1. Ampliar o período de busca padrão (ex: -30 a +180 dias)');
      console.log('   2. Adicionar filtro específico para agendamentos recorrentes');
      console.log('   3. Implementar paginação por período para agendamentos distantes');
      console.log('   4. Adicionar opção no frontend para "ver todos os agendamentos"');
    } else {
      console.log('✅ Nenhum problema identificado com agendamentos recorrentes ocultos');
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

debugRecurringAppointmentsVisibility();