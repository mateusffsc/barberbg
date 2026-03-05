const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function deactivateLuizHenrique() {
  console.log('🔒 DESATIVANDO BARBEIRO LUIZ HENRIQUE\n');
  console.log('=' .repeat(50));

  try {
    // 1. Encontrar o barbeiro
    console.log('\n1️⃣ LOCALIZANDO BARBEIRO');
    console.log('-'.repeat(25));
    
    const { data: barbers, error: findError } = await supabase
      .from('barbers')
      .select('*')
      .ilike('name', '%luiz henrique%');

    if (findError) {
      console.log('❌ Erro ao buscar barbeiro:', findError);
      return;
    }

    if (!barbers || barbers.length === 0) {
      console.log('⚠️  Barbeiro "Luiz Henrique" não encontrado');
      return;
    }

    const luizHenrique = barbers[0];
    console.log(`✅ Barbeiro encontrado:`);
    console.log(`   ID: ${luizHenrique.id}`);
    console.log(`   Nome: ${luizHenrique.name}`);
    console.log(`   Status atual: ${luizHenrique.is_active ? 'Ativo' : 'Inativo'}`);

    // 2. Desativar o barbeiro
    console.log('\n2️⃣ DESATIVANDO BARBEIRO');
    console.log('-'.repeat(25));
    
    const { data: updatedBarber, error: updateError } = await supabase
      .from('barbers')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', luizHenrique.id)
      .select()
      .single();

    if (updateError) {
      console.log('❌ Erro ao desativar barbeiro:', updateError);
      return;
    }

    console.log('✅ Barbeiro desativado com sucesso!');
    console.log(`   Status: ${updatedBarber.is_active ? 'Ativo' : 'Inativo'}`);

    // 3. Verificar agendamentos futuros
    console.log('\n3️⃣ VERIFICANDO AGENDAMENTOS FUTUROS');
    console.log('-'.repeat(35));
    
    const today = new Date();
    const { data: futureAppointments, count: futureCount, error: appointmentsError } = await supabase
      .from('appointments')
      .select('*', { count: 'exact' })
      .eq('barber_id', luizHenrique.id)
      .gte('appointment_datetime', today.toISOString())
      .order('appointment_datetime');

    if (appointmentsError) {
      console.log('❌ Erro ao verificar agendamentos:', appointmentsError);
    } else {
      console.log(`📊 Agendamentos futuros encontrados: ${futureCount}`);
      
      if (futureCount > 0) {
        console.log('\n⚠️  ATENÇÃO: Há agendamentos futuros que precisam ser tratados:');
        futureAppointments.slice(0, 10).forEach(apt => {
          const date = new Date(apt.appointment_datetime).toLocaleDateString('pt-BR');
          const time = apt.appointment_time || 'N/A';
          console.log(`   - ${date} às ${time} - ${apt.client_name || 'Cliente N/A'}`);
        });
        
        if (futureCount > 10) {
          console.log(`   ... e mais ${futureCount - 10} agendamentos`);
        }
        
        console.log('\n📋 Recomendações:');
        console.log('   1. Entrar em contato com os clientes');
        console.log('   2. Reagendar para outros barbeiros');
        console.log('   3. Ou cancelar os agendamentos se necessário');
      } else {
        console.log('✅ Nenhum agendamento futuro encontrado');
      }
    }

    // 4. Verificar histórico
    console.log('\n4️⃣ VERIFICANDO HISTÓRICO');
    console.log('-'.repeat(25));
    
    const { count: totalCount } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('barber_id', luizHenrique.id);

    const { count: completedCount } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('barber_id', luizHenrique.id)
      .eq('status', 'completed');

    console.log(`📊 Total de agendamentos históricos: ${totalCount}`);
    console.log(`✅ Agendamentos concluídos: ${completedCount}`);
    console.log('📋 Histórico preservado para relatórios');

    console.log('\n' + '='.repeat(50));
    console.log('🎯 DESATIVAÇÃO CONCLUÍDA');
    console.log('');
    console.log('✅ Barbeiro Luiz Henrique desativado');
    console.log('📊 Histórico de agendamentos preservado');
    console.log('🚫 Não aparecerá mais em novos agendamentos');
    console.log('📋 Dados disponíveis para relatórios');
    
  } catch (error) {
    console.error('❌ Erro no processo:', error);
  }
}

deactivateLuizHenrique();