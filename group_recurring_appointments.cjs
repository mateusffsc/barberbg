const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function groupExistingRecurringAppointments() {
  console.log('🔄 Iniciando agrupamento de agendamentos recorrentes existentes...');

  try {
    // Primeiro, vamos buscar agendamentos que podem ser recorrentes
    const { data: appointments, error: fetchError } = await supabase
      .from('appointments')
      .select('*')
      .is('recurrence_group_id', null)
      .neq('status', 'cancelled')
      .gte('appointment_datetime', new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString()) // Últimos 6 meses
      .order('appointment_datetime');

    if (fetchError) {
      console.error('❌ Erro ao buscar agendamentos:', fetchError);
      return;
    }

    console.log(`📊 Encontrados ${appointments.length} agendamentos para análise`);

    // Agrupar por padrões potenciais
    const patterns = {};
    
    appointments.forEach(appointment => {
      const date = new Date(appointment.appointment_datetime);
      const key = `${appointment.client_id}-${appointment.barber_id}-${JSON.stringify(appointment.services_ids)}-${date.getHours()}-${date.getMinutes()}-${date.getDay()}`;
      
      if (!patterns[key]) {
        patterns[key] = [];
      }
      patterns[key].push(appointment);
    });

    let groupedCount = 0;
    let totalGroups = 0;

    // Processar cada padrão
    for (const [patternKey, appointmentGroup] of Object.entries(patterns)) {
      if (appointmentGroup.length < 3) continue; // Pelo menos 3 agendamentos

      // Verificar se os intervalos são consistentes
      appointmentGroup.sort((a, b) => new Date(a.appointment_datetime) - new Date(b.appointment_datetime));
      
      const intervals = [];
      for (let i = 1; i < appointmentGroup.length; i++) {
        const diff = Math.floor((new Date(appointmentGroup[i].appointment_datetime) - new Date(appointmentGroup[i-1].appointment_datetime)) / (1000 * 60 * 60 * 24));
        intervals.push(diff);
      }

      if (intervals.length < 2) continue;

      // Verificar consistência dos intervalos (variação máxima de 1 dia)
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const isConsistent = intervals.every(interval => Math.abs(interval - avgInterval) <= 1);

      if (!isConsistent) continue;

      // Gerar UUID para o grupo
      const groupId = crypto.randomUUID();

      // Atualizar todos os agendamentos do grupo
      const appointmentIds = appointmentGroup.map(a => a.id);
      
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ recurrence_group_id: groupId })
        .in('id', appointmentIds);

      if (updateError) {
        console.error('❌ Erro ao atualizar grupo:', updateError);
        continue;
      }

      groupedCount += appointmentGroup.length;
      totalGroups++;

      const firstAppointment = appointmentGroup[0];
      console.log(`✅ Grupo criado: ${appointmentGroup.length} agendamentos para cliente ${firstAppointment.client_name}, barbeiro ${firstAppointment.barber_name}, intervalo médio: ${Math.round(avgInterval)} dias`);
    }

    console.log(`\n📈 Resumo:`);
    console.log(`- Agendamentos agrupados: ${groupedCount}`);
    console.log(`- Total de grupos criados: ${totalGroups}`);

    // Verificar resultados
    const { data: withGroup, error: withGroupError } = await supabase
      .from('appointments')
      .select('id')
      .not('recurrence_group_id', 'is', null);

    const { data: withoutGroup, error: withoutGroupError } = await supabase
      .from('appointments')
      .select('id')
      .is('recurrence_group_id', null);

    if (!withGroupError && !withoutGroupError) {
      console.log(`\n📊 Status final:`);
      console.log(`- Agendamentos com recurrence_group_id: ${withGroup.length}`);
      console.log(`- Agendamentos sem recurrence_group_id: ${withoutGroup.length}`);
    }

    // Mostrar alguns exemplos
    const { data: examples, error: examplesError } = await supabase
      .from('appointments')
      .select('id, client_name, barber_name, services_names, appointment_datetime, recurrence_group_id')
      .not('recurrence_group_id', 'is', null)
      .order('recurrence_group_id, appointment_datetime')
      .limit(10);

    if (!examplesError && examples.length > 0) {
      console.log(`\n📋 Exemplos de agendamentos agrupados:`);
      examples.forEach(example => {
        console.log(`- ${example.client_name} com ${example.barber_name} em ${new Date(example.appointment_datetime).toLocaleDateString('pt-BR')} (Grupo: ${example.recurrence_group_id.substring(0, 8)}...)`);
      });
    }

    console.log('\n🎉 Agrupamento concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

// Executar o script
groupExistingRecurringAppointments();