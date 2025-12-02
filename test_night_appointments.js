const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = 'https://ixqhqvqzqzqzqzqzqzqz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Substitua pela sua chave
const supabase = createClient(supabaseUrl, supabaseKey);

async function testNightAppointments() {
  console.log('🌙 Testando agendamentos noturnos...\n');

  try {
    // 1. Buscar um cliente e barbeiro para teste
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .limit(1);

    const { data: barbers } = await supabase
      .from('barbers')
      .select('id, name')
      .limit(1);

    if (!clients?.length || !barbers?.length) {
      console.log('❌ Não há clientes ou barbeiros cadastrados para teste');
      return;
    }

    const client = clients[0];
    const barber = barbers[0];

    console.log(`👤 Cliente: ${client.name} (ID: ${client.id})`);
    console.log(`✂️ Barbeiro: ${barber.name} (ID: ${barber.id})\n`);

    // 2. Testar diferentes horários noturnos
    const testTimes = [
      '20:00:00', // 8 PM
      '20:30:00', // 8:30 PM
      '21:00:00', // 9 PM
      '21:30:00', // 9:30 PM
      '22:00:00', // 10 PM
      '22:30:00', // 10:30 PM
      '23:00:00', // 11 PM
      '23:30:00'  // 11:30 PM
    ];

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const testDate = tomorrow.toISOString().split('T')[0];

    console.log(`📅 Data de teste: ${testDate}\n`);

    for (const time of testTimes) {
      const appointmentDateTime = `${testDate}T${time}`;
      
      console.log(`⏰ Testando horário: ${time} (${appointmentDateTime})`);

      try {
        // Verificar constraint do banco
        const { data: constraintTest, error: constraintError } = await supabase
          .from('appointments')
          .select('appointment_time')
          .eq('appointment_time', time)
          .limit(1);

        if (constraintError) {
          console.log(`   ❌ Erro de constraint: ${constraintError.message}`);
          continue;
        }

        // Tentar criar agendamento de teste
        const { data: appointment, error: appointmentError } = await supabase
          .from('appointments')
          .insert({
            client_id: client.id,
            barber_id: barber.id,
            appointment_datetime: appointmentDateTime,
            appointment_date: testDate,
            appointment_time: time,
            status: 'scheduled',
            total_price: 30.00,
            duration_minutes: 30,
            note: `Teste noturno - ${time}`
          })
          .select()
          .single();

        if (appointmentError) {
          console.log(`   ❌ Erro ao criar agendamento: ${appointmentError.message}`);
          
          // Verificar se é erro de constraint de horário
          if (appointmentError.message.includes('chk_appointment_time_business_hours')) {
            console.log(`   🚫 Constraint de horário comercial violada!`);
          }
        } else {
          console.log(`   ✅ Agendamento criado com sucesso! ID: ${appointment.id}`);
          
          // Limpar o agendamento de teste
          await supabase
            .from('appointments')
            .delete()
            .eq('id', appointment.id);
          
          console.log(`   🧹 Agendamento de teste removido`);
        }
      } catch (error) {
        console.log(`   ❌ Erro inesperado: ${error.message}`);
      }

      console.log(''); // Linha em branco
    }

    // 3. Verificar constraints atuais da tabela
    console.log('🔍 Verificando constraints da tabela appointments...\n');
    
    const { data: constraints, error: constraintsError } = await supabase
      .rpc('get_table_constraints', { table_name: 'appointments' });

    if (constraintsError) {
      console.log('❌ Erro ao buscar constraints:', constraintsError.message);
    } else if (constraints) {
      constraints.forEach(constraint => {
        if (constraint.constraint_name.includes('time') || constraint.constraint_name.includes('hour')) {
          console.log(`📋 Constraint: ${constraint.constraint_name}`);
          console.log(`   Definição: ${constraint.constraint_definition}`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

// Executar teste
testNightAppointments()
  .then(() => {
    console.log('\n✅ Teste concluído!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Erro no teste:', error);
    process.exit(1);
  });