const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function removeBarberLuizHenrique() {
  console.log('🔍 REMOÇÃO DO BARBEIRO LUIZ HENRIQUE\n');
  console.log('=' .repeat(50));

  try {
    // 1. Verificar se o barbeiro existe
    console.log('\n1️⃣ VERIFICANDO BARBEIRO');
    console.log('-'.repeat(25));
    
    const { data: barbers, error: barbersError } = await supabase
      .from('barbers')
      .select('*')
      .ilike('name', '%luiz henrique%');

    if (barbersError) {
      console.log('❌ Erro ao buscar barbeiros:', barbersError);
      return;
    }

    if (!barbers || barbers.length === 0) {
      console.log('⚠️  Barbeiro "Luiz Henrique" não encontrado');
      
      // Listar todos os barbeiros para referência
      const { data: allBarbers } = await supabase
        .from('barbers')
        .select('id, name, is_active')
        .order('name');
      
      if (allBarbers && allBarbers.length > 0) {
        console.log('\n📋 Barbeiros cadastrados:');
        allBarbers.forEach(barber => {
          console.log(`   ID: ${barber.id} | Nome: ${barber.name} | Ativo: ${barber.is_active}`);
        });
      }
      return;
    }

    const luizHenrique = barbers[0];
    console.log(`✅ Barbeiro encontrado:`);
    console.log(`   ID: ${luizHenrique.id}`);
    console.log(`   Nome: ${luizHenrique.name}`);
    console.log(`   Ativo: ${luizHenrique.is_active}`);
    console.log(`   Email: ${luizHenrique.email || 'N/A'}`);
    console.log(`   Telefone: ${luizHenrique.phone || 'N/A'}`);

    // 2. Verificar agendamentos associados
    console.log('\n2️⃣ VERIFICANDO AGENDAMENTOS');
    console.log('-'.repeat(30));
    
    const { data: appointments, count: appointmentsCount, error: appointmentsError } = await supabase
      .from('appointments')
      .select('*', { count: 'exact' })
      .eq('barber_id', luizHenrique.id);

    if (appointmentsError) {
      console.log('❌ Erro ao buscar agendamentos:', appointmentsError);
      return;
    }

    console.log(`📊 Total de agendamentos: ${appointmentsCount}`);

    if (appointmentsCount > 0) {
      // Analisar agendamentos por status
      const statusCount = {};
      const futureAppointments = [];
      const today = new Date();

      appointments.forEach(apt => {
        const status = apt.status || 'unknown';
        statusCount[status] = (statusCount[status] || 0) + 1;
        
        const aptDate = new Date(apt.appointment_datetime);
        if (aptDate > today) {
          futureAppointments.push(apt);
        }
      });

      console.log('\n📋 Agendamentos por status:');
      Object.entries(statusCount).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });

      console.log(`\n⏰ Agendamentos futuros: ${futureAppointments.length}`);
      
      if (futureAppointments.length > 0) {
        console.log('\n🚨 ATENÇÃO: Há agendamentos futuros!');
        futureAppointments.slice(0, 5).forEach(apt => {
          console.log(`   - ${new Date(apt.appointment_datetime).toLocaleDateString('pt-BR')} às ${apt.appointment_time} - ${apt.client_name}`);
        });
        if (futureAppointments.length > 5) {
          console.log(`   ... e mais ${futureAppointments.length - 5} agendamentos`);
        }
      }
      
      // 5. Executar ação baseada na situação
      console.log('\n5️⃣ AÇÃO RECOMENDADA');
      console.log('-'.repeat(25));
      
      if (futureAppointments.length === 0) {
        console.log('⚠️ SITUAÇÃO MODERADA: Apenas agendamentos passados');
        console.log('🎯 Recomendação: Desativar barbeiro');
        
        // Desativar barbeiro
        console.log('\n🔒 Desativando barbeiro...');
        const { error: updateError } = await supabase
          .from('barbers')
          .update({ is_active: false })
          .eq('id', luizHenrique.id);

        if (updateError) {
          console.log('❌ Erro ao desativar barbeiro:', updateError);
        } else {
          console.log('✅ Barbeiro desativado com sucesso!');
          console.log('📋 O barbeiro não aparecerá mais em novos agendamentos');
          console.log('📊 Histórico de agendamentos preservado');
        }
        
      } else {
        console.log('🚨 SITUAÇÃO COMPLEXA: Há agendamentos futuros');
        console.log('🎯 Recomendação: Transferir agendamentos primeiro');
        console.log('');
        console.log('📋 Próximos passos sugeridos:');
        console.log('   1. Transferir agendamentos futuros para outro barbeiro');
        console.log('   2. Notificar clientes sobre a mudança');
        console.log('   3. Desativar ou remover o barbeiro');
        console.log('');
        console.log('⚠️ AÇÃO MANUAL NECESSÁRIA - Não removendo automaticamente');
      }
    } else {
      console.log('\n5️⃣ AÇÃO RECOMENDADA');
      console.log('-'.repeat(25));
      console.log('✅ SITUAÇÃO IDEAL: Nenhum agendamento encontrado');
      console.log('🎯 Recomendação: Remoção segura possível');
      
      // Remover barbeiro
      console.log('\n🗑️ Removendo barbeiro...');
      const { error: deleteError } = await supabase
        .from('barbers')
        .delete()
        .eq('id', luizHenrique.id);

      if (deleteError) {
        console.log('❌ Erro ao remover barbeiro:', deleteError);
      } else {
        console.log('✅ Barbeiro removido com sucesso!');
      }
    }

    // 3. Verificar usuário associado
    console.log('\n3️⃣ VERIFICANDO USUÁRIO ASSOCIADO');
    console.log('-'.repeat(35));
    
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .eq('barber_id', luizHenrique.id);

    if (usersError) {
      console.log('❌ Erro ao buscar usuários:', usersError);
    } else if (users && users.length > 0) {
      console.log(`👤 Usuário encontrado:`);
      users.forEach(user => {
        console.log(`   ID: ${user.id} | Email: ${user.email} | Role: ${user.role}`);
      });
    } else {
      console.log('✅ Nenhum usuário associado encontrado');
    }

    // 4. Opções de remoção
    console.log('\n4️⃣ OPÇÕES DE REMOÇÃO');
    console.log('-'.repeat(25));
    
    console.log('📋 Você tem as seguintes opções:');
    console.log('');
    console.log('🔸 OPÇÃO 1: DESATIVAR (Recomendado)');
    console.log('   - Mantém histórico de agendamentos');
    console.log('   - Barbeiro não aparece em novos agendamentos');
    console.log('   - Dados preservados para relatórios');
    console.log('');
    console.log('🔸 OPÇÃO 2: TRANSFERIR AGENDAMENTOS');
    console.log('   - Move agendamentos futuros para outro barbeiro');
    console.log('   - Depois desativa ou remove o barbeiro');
    console.log('');
    console.log('🔸 OPÇÃO 3: REMOÇÃO COMPLETA (Não recomendado)');
    console.log('   - Remove todos os dados do barbeiro');
    console.log('   - Perde histórico de agendamentos');
    console.log('   - Pode quebrar relatórios');

    // 5. Executar ação baseada na situação
    console.log('\n5️⃣ AÇÃO RECOMENDADA');
    console.log('-'.repeat(25));
    
    if (appointmentsCount === 0) {
      console.log('✅ SITUAÇÃO IDEAL: Nenhum agendamento encontrado');
      console.log('🎯 Recomendação: Remoção segura possível');
      
      // Remover barbeiro
      console.log('\n🗑️ Removendo barbeiro...');
      const { error: deleteError } = await supabase
        .from('barbers')
        .delete()
        .eq('id', luizHenrique.id);

      if (deleteError) {
        console.log('❌ Erro ao remover barbeiro:', deleteError);
      } else {
        console.log('✅ Barbeiro removido com sucesso!');
        
        // Remover usuário associado se existir
        if (users && users.length > 0) {
          console.log('🗑️ Removendo usuário associado...');
          const { error: userDeleteError } = await supabase
            .from('users')
            .delete()
            .eq('barber_id', luizHenrique.id);

          if (userDeleteError) {
            console.log('❌ Erro ao remover usuário:', userDeleteError);
          } else {
            console.log('✅ Usuário associado removido!');
          }
        }
      }
      
    } else if (futureAppointments.length === 0) {
      console.log('⚠️ SITUAÇÃO MODERADA: Apenas agendamentos passados');
      console.log('🎯 Recomendação: Desativar barbeiro');
      
      // Desativar barbeiro
      console.log('\n🔒 Desativando barbeiro...');
      const { error: updateError } = await supabase
        .from('barbers')
        .update({ is_active: false })
        .eq('id', luizHenrique.id);

      if (updateError) {
        console.log('❌ Erro ao desativar barbeiro:', updateError);
      } else {
        console.log('✅ Barbeiro desativado com sucesso!');
        console.log('📋 O barbeiro não aparecerá mais em novos agendamentos');
        console.log('📊 Histórico de agendamentos preservado');
      }
      
    } else {
      console.log('🚨 SITUAÇÃO COMPLEXA: Há agendamentos futuros');
      console.log('🎯 Recomendação: Transferir agendamentos primeiro');
      console.log('');
      console.log('📋 Próximos passos sugeridos:');
      console.log('   1. Transferir agendamentos futuros para outro barbeiro');
      console.log('   2. Notificar clientes sobre a mudança');
      console.log('   3. Desativar ou remover o barbeiro');
      console.log('');
      console.log('⚠️ AÇÃO MANUAL NECESSÁRIA - Não removendo automaticamente');
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎯 PROCESSO CONCLUÍDO');
    
  } catch (error) {
    console.error('❌ Erro no processo:', error);
  }
}

removeBarberLuizHenrique();