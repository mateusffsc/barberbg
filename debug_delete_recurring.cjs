const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function debugDeleteRecurring() {
  console.log('🔍 Debugando exclusão de agendamentos recorrentes...\n');

  try {
    // 1. Verificar agendamentos recorrentes existentes
    console.log('1️⃣ Verificando agendamentos recorrentes existentes...');
    
    const { data: allRecurring, error: allError } = await supabase
      .from('appointments')
      .select('id, recurrence_group_id, client_name, appointment_datetime')
      .not('recurrence_group_id', 'is', null)
      .order('recurrence_group_id, appointment_datetime');

    if (allError) {
      console.log('❌ Erro ao buscar agendamentos recorrentes:', allError);
      return;
    }

    console.log(`📊 Total de agendamentos recorrentes: ${allRecurring.length}`);

    // Agrupar por recurrence_group_id
    const groupedByRecurrence = {};
    allRecurring.forEach(apt => {
      const groupId = apt.recurrence_group_id;
      if (!groupedByRecurrence[groupId]) {
        groupedByRecurrence[groupId] = [];
      }
      groupedByRecurrence[groupId].push(apt);
    });

    const groupIds = Object.keys(groupedByRecurrence);
    console.log(`📊 Total de grupos recorrentes: ${groupIds.length}`);

    if (groupIds.length === 0) {
      console.log('ℹ️  Nenhum grupo recorrente encontrado para testar');
      return;
    }

    // 2. Mostrar alguns grupos para análise
    console.log('\n2️⃣ Primeiros 5 grupos recorrentes:');
    groupIds.slice(0, 5).forEach((groupId, index) => {
      const group = groupedByRecurrence[groupId];
      console.log(`   ${index + 1}. Grupo ${groupId}: ${group.length} agendamentos`);
      console.log(`      Cliente: ${group[0].client_name}`);
      console.log(`      Datas: ${group[0].appointment_datetime.split('T')[0]} até ${group[group.length - 1].appointment_datetime.split('T')[0]}`);
    });

    // 3. Testar exclusão de um grupo pequeno (criar um grupo de teste)
    console.log('\n3️⃣ Criando grupo de teste para exclusão...');
    
    // Buscar dados necessários para criar agendamento de teste
    const { data: clients } = await supabase.from('clients').select('*').limit(1);
    const { data: barbers } = await supabase.from('barbers').select('*').limit(1);
    const { data: services } = await supabase.from('services').select('*').limit(1);

    if (!clients?.length || !barbers?.length || !services?.length) {
      console.log('❌ Dados insuficientes para criar teste');
      return;
    }

    const testGroupId = `test-delete-${Date.now()}`;
    const client = clients[0];
    const barber = barbers[0];
    const service = services[0];

    // Criar 3 agendamentos de teste
    const testAppointments = [];
    for (let i = 0; i < 3; i++) {
      const testDate = new Date();
      testDate.setDate(testDate.getDate() + i + 1);
      testDate.setHours(14, 0, 0, 0);

      const appointmentData = {
        client_id: client.id,
        barber_id: barber.id,
        client_name: client.name,
        client_phone: client.phone,
        barber_name: barber.name,
        barber_phone: barber.phone,
        services_names: service.name,
        services_ids: [service.id],
        appointment_datetime: testDate.toISOString(),
        appointment_date: testDate.toISOString().split('T')[0],
        appointment_time: '14:00:00',
        status: 'scheduled',
        total_price: service.price,
        duration_minutes: service.duration_minutes_normal || 30,
        note: `Teste exclusão recorrente ${i + 1}`,
        recurrence_group_id: testGroupId
      };

      const { data: createdAppointment, error: createError } = await supabase
        .from('appointments')
        .insert(appointmentData)
        .select()
        .single();

      if (createError) {
        console.log(`❌ Erro ao criar agendamento de teste ${i + 1}:`, createError);
        continue;
      }

      testAppointments.push(createdAppointment);

      // Criar serviço do agendamento
      await supabase
        .from('appointment_services')
        .insert({
          appointment_id: createdAppointment.id,
          service_id: service.id,
          price_at_booking: service.price,
          commission_rate_applied: barber.commission_rate_service || 0.5
        });
    }

    console.log(`✅ Criados ${testAppointments.length} agendamentos de teste com grupo ID: ${testGroupId}`);

    // 4. Testar a função de exclusão
    console.log('\n4️⃣ Testando exclusão do grupo de teste...');

    // Simular a função deleteRecurringAppointments
    try {
      // Buscar todos os agendamentos da série recorrente
      const { data: appointmentsToDelete, error: fetchError } = await supabase
        .from('appointments')
        .select('id')
        .eq('recurrence_group_id', testGroupId);

      if (fetchError) throw fetchError;

      console.log(`📊 Agendamentos encontrados para exclusão: ${appointmentsToDelete?.length || 0}`);

      if (!appointmentsToDelete || appointmentsToDelete.length === 0) {
        console.log('❌ Nenhum agendamento encontrado na série recorrente');
        return;
      }

      const appointmentIds = appointmentsToDelete.map(app => app.id);
      console.log(`🎯 IDs dos agendamentos: ${appointmentIds.join(', ')}`);

      // Primeiro deletar todos os serviços dos agendamentos
      console.log('🗑️  Deletando serviços dos agendamentos...');
      const { error: servicesError } = await supabase
        .from('appointment_services')
        .delete()
        .in('appointment_id', appointmentIds);

      if (servicesError) {
        console.log('❌ Erro ao deletar serviços:', servicesError);
        throw servicesError;
      }

      console.log('✅ Serviços deletados com sucesso');

      // Depois deletar todos os agendamentos
      console.log('🗑️  Deletando agendamentos...');
      const { error: appointmentsError } = await supabase
        .from('appointments')
        .delete()
        .eq('recurrence_group_id', testGroupId);

      if (appointmentsError) {
        console.log('❌ Erro ao deletar agendamentos:', appointmentsError);
        throw appointmentsError;
      }

      console.log('✅ Agendamentos deletados com sucesso');

      // Verificar se realmente foram deletados
      const { data: remainingAppointments } = await supabase
        .from('appointments')
        .select('id')
        .eq('recurrence_group_id', testGroupId);

      console.log(`📊 Agendamentos restantes: ${remainingAppointments?.length || 0}`);

      if (remainingAppointments?.length === 0) {
        console.log('🎉 SUCESSO: Todos os agendamentos foram deletados corretamente!');
      } else {
        console.log('❌ PROBLEMA: Alguns agendamentos não foram deletados');
      }

    } catch (error) {
      console.log('❌ Erro durante o teste de exclusão:', error);
    }

    // 5. Verificar possíveis problemas comuns
    console.log('\n5️⃣ Verificando possíveis problemas...');

    // Verificar se há constraints ou triggers que podem estar impedindo a exclusão
    const { data: constraints, error: constraintsError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT 
            tc.constraint_name,
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY' 
            AND (tc.table_name = 'appointments' OR ccu.table_name = 'appointments');
        `
      });

    if (!constraintsError && constraints) {
      console.log('🔗 Constraints relacionadas a appointments:');
      constraints.forEach(constraint => {
        console.log(`   ${constraint.table_name}.${constraint.column_name} -> ${constraint.foreign_table_name}.${constraint.foreign_column_name}`);
      });
    }

    // 6. Testar exclusão de um grupo real pequeno (se houver)
    const smallGroups = groupIds.filter(groupId => groupedByRecurrence[groupId].length <= 3);
    
    if (smallGroups.length > 0) {
      console.log(`\n6️⃣ Testando exclusão de grupo real pequeno...`);
      const smallGroupId = smallGroups[0];
      const smallGroup = groupedByRecurrence[smallGroupId];
      
      console.log(`🎯 Testando grupo ${smallGroupId} com ${smallGroup.length} agendamentos`);
      console.log(`   Cliente: ${smallGroup[0].client_name}`);
      
      // Perguntar se deve prosseguir (simulado - sempre sim para teste)
      console.log('⚠️  ATENÇÃO: Este teste irá deletar agendamentos reais!');
      console.log('   Para segurança, pulando este teste...');
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

debugDeleteRecurring();