const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testRealtimeSync() {
  console.log('🔄 TESTE DE SINCRONIZAÇÃO EM TEMPO REAL\n');
  console.log('=' .repeat(60));

  try {
    // 1. Verificar configuração do Supabase Realtime
    console.log('\n1️⃣ VERIFICAÇÃO DA CONFIGURAÇÃO REALTIME');
    console.log('-'.repeat(45));
    
    console.log('📡 URL Supabase:', process.env.VITE_SUPABASE_URL);
    console.log('🔑 Anon Key configurada:', process.env.VITE_SUPABASE_ANON_KEY ? 'Sim' : 'Não');

    // 2. Testar conexão com subscription
    console.log('\n2️⃣ TESTE DE SUBSCRIPTION');
    console.log('-'.repeat(30));
    
    let eventCount = 0;
    const events = [];
    
    // Criar subscription de teste
    const channel = supabase
      .channel('test-appointments-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments'
        },
        (payload) => {
          eventCount++;
          events.push({
            event: payload.eventType,
            timestamp: new Date().toISOString(),
            id: payload.new?.id || payload.old?.id
          });
          console.log(`📥 Evento ${eventCount}: ${payload.eventType} - ID: ${payload.new?.id || payload.old?.id}`);
        }
      )
      .subscribe((status) => {
        console.log(`🔌 Status da subscription: ${status}`);
      });

    // Aguardar conexão
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. Testar broadcast channel
    console.log('\n3️⃣ TESTE DE BROADCAST CHANNEL');
    console.log('-'.repeat(35));
    
    let broadcastCount = 0;
    const broadcasts = [];
    
    const broadcastChannel = supabase
      .channel('appointments-sync')
      .on('broadcast', { event: 'appointments_change' }, (payload) => {
        broadcastCount++;
        broadcasts.push({
          timestamp: new Date().toISOString(),
          payload: payload.payload
        });
        console.log(`📡 Broadcast ${broadcastCount} recebido:`, payload.payload);
      })
      .subscribe((status) => {
        console.log(`📻 Status do broadcast: ${status}`);
      });

    // Aguardar conexão do broadcast
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. Simular criação de agendamento
    console.log('\n4️⃣ SIMULAÇÃO DE CRIAÇÃO DE AGENDAMENTO');
    console.log('-'.repeat(45));
    
    console.log('🔄 Criando agendamento de teste...');
    
    const testAppointment = {
      client_id: 1,
      barber_id: 1,
      client_name: 'Teste Sync',
      barber_name: 'Barbeiro Teste',
      appointment_datetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Amanhã
      appointment_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      appointment_time: '10:00',
      status: 'confirmed',
      total_price: 50,
      duration_minutes: 30,
      services_names: 'Teste de Sincronização',
      services_ids: [1],
      note: 'Teste de sincronização em tempo real',
      payment_method: 'cash'
    };

    const { data: newAppointment, error: insertError } = await supabase
      .from('appointments')
      .insert([testAppointment])
      .select()
      .single();

    if (insertError) {
      console.log('❌ Erro ao criar agendamento:', insertError);
    } else {
      console.log('✅ Agendamento criado:', newAppointment.id);
      
      // Enviar broadcast manual
      console.log('📡 Enviando broadcast manual...');
      await broadcastChannel.send({
        type: 'broadcast',
        event: 'appointments_change',
        payload: { 
          action: 'created',
          id: newAppointment.id,
          timestamp: Date.now()
        }
      });
    }

    // Aguardar eventos
    console.log('\n⏳ Aguardando eventos por 5 segundos...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 5. Testar atualização
    if (newAppointment) {
      console.log('\n5️⃣ TESTE DE ATUALIZAÇÃO');
      console.log('-'.repeat(25));
      
      console.log('🔄 Atualizando agendamento...');
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ 
          note: 'Teste de sincronização - ATUALIZADO',
          status: 'completed'
        })
        .eq('id', newAppointment.id);

      if (updateError) {
        console.log('❌ Erro ao atualizar:', updateError);
      } else {
        console.log('✅ Agendamento atualizado');
        
        // Broadcast da atualização
        await broadcastChannel.send({
          type: 'broadcast',
          event: 'appointments_change',
          payload: { 
            action: 'updated',
            id: newAppointment.id,
            timestamp: Date.now()
          }
        });
      }

      // Aguardar eventos
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 6. Testar exclusão
      console.log('\n6️⃣ TESTE DE EXCLUSÃO');
      console.log('-'.repeat(20));
      
      console.log('🗑️ Excluindo agendamento de teste...');
      const { error: deleteError } = await supabase
        .from('appointments')
        .delete()
        .eq('id', newAppointment.id);

      if (deleteError) {
        console.log('❌ Erro ao excluir:', deleteError);
      } else {
        console.log('✅ Agendamento excluído');
        
        // Broadcast da exclusão
        await broadcastChannel.send({
          type: 'broadcast',
          event: 'appointments_change',
          payload: { 
            action: 'deleted',
            id: newAppointment.id,
            timestamp: Date.now()
          }
        });
      }

      // Aguardar eventos finais
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // 7. Relatório final
    console.log('\n7️⃣ RELATÓRIO DE SINCRONIZAÇÃO');
    console.log('-'.repeat(35));
    
    console.log(`📊 Total de eventos postgres_changes: ${eventCount}`);
    console.log(`📡 Total de broadcasts recebidos: ${broadcastCount}`);
    
    if (events.length > 0) {
      console.log('\n📋 Eventos postgres_changes detectados:');
      events.forEach((event, index) => {
        console.log(`   ${index + 1}. ${event.event} - ID: ${event.id} (${event.timestamp})`);
      });
    }
    
    if (broadcasts.length > 0) {
      console.log('\n📻 Broadcasts recebidos:');
      broadcasts.forEach((broadcast, index) => {
        console.log(`   ${index + 1}. ${broadcast.payload.action} - ID: ${broadcast.payload.id}`);
      });
    }

    // Análise de problemas
    console.log('\n8️⃣ ANÁLISE DE PROBLEMAS');
    console.log('-'.repeat(30));
    
    const issues = [];
    
    if (eventCount === 0) {
      issues.push('🚨 CRÍTICO: Nenhum evento postgres_changes detectado');
      issues.push('   - Realtime pode não estar habilitado na tabela appointments');
      issues.push('   - Verificar configuração RLS (Row Level Security)');
    }
    
    if (broadcastCount === 0) {
      issues.push('⚠️  ATENÇÃO: Nenhum broadcast recebido');
      issues.push('   - Canal de broadcast pode não estar funcionando');
    }
    
    if (eventCount < 3) {
      issues.push('⚠️  Eventos insuficientes detectados (esperado: 3 - INSERT/UPDATE/DELETE)');
    }
    
    if (issues.length === 0) {
      console.log('✅ Sincronização funcionando corretamente!');
    } else {
      issues.forEach(issue => console.log(issue));
    }

    // Cleanup
    channel.unsubscribe();
    broadcastChannel.unsubscribe();

    console.log('\n' + '='.repeat(60));
    console.log('🎯 TESTE DE SINCRONIZAÇÃO CONCLUÍDO');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testRealtimeSync();