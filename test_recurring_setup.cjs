const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testRecurringSetup() {
  console.log('🔍 Testando configuração de bloqueios recorrentes...');
  
  try {
    // 1. Verificar se a função existe
    console.log('\n1. Verificando função generate_recurring_blocks...');
    const { data: functions, error: funcError } = await supabase.rpc('exec_sql', {
      sql: "SELECT proname FROM pg_proc WHERE proname = 'generate_recurring_blocks';"
    });
    
    if (funcError) {
      console.log('❌ Erro ao verificar função:', funcError.message);
    } else {
      console.log('✅ Função generate_recurring_blocks:', functions?.length > 0 ? 'EXISTE' : 'NÃO EXISTE');
    }
    
    // 2. Verificar se o trigger existe
    console.log('\n2. Verificando trigger...');
    const { data: triggers, error: triggerError } = await supabase.rpc('exec_sql', {
      sql: "SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_auto_generate_recurring_blocks';"
    });
    
    if (triggerError) {
      console.log('❌ Erro ao verificar trigger:', triggerError.message);
    } else {
      console.log('✅ Trigger auto_generate_recurring_blocks:', triggers?.length > 0 ? 'EXISTE' : 'NÃO EXISTE');
    }
    
    // 3. Testar inserção de bloqueio recorrente
    console.log('\n3. Testando inserção de bloqueio recorrente...');
    
    // Primeiro, buscar um usuário válido
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (userError || !users || users.length === 0) {
      console.log('❌ Erro ao buscar usuário:', userError?.message || 'Nenhum usuário encontrado');
      return;
    }
    
    const userId = users[0].id;
    console.log('👤 Usando usuário ID:', userId);
    
    // Buscar um barbeiro válido
    const { data: barbers, error: barberError } = await supabase
      .from('barbers')
      .select('id')
      .limit(1);
    
    if (barberError || !barbers || barbers.length === 0) {
      console.log('❌ Erro ao buscar barbeiro:', barberError?.message || 'Nenhum barbeiro encontrado');
      return;
    }
    
    const barberId = barbers[0].id;
    console.log('✂️ Usando barbeiro ID:', barberId);
    
    // Criar data futura
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const blockDate = futureDate.toISOString().split('T')[0];
    
    const endDate = new Date(futureDate);
    endDate.setDate(endDate.getDate() + 21); // 3 semanas depois
    const recurrenceEndDate = endDate.toISOString().split('T')[0];
    
    console.log('📅 Data do bloqueio:', blockDate);
    console.log('📅 Data fim recorrência:', recurrenceEndDate);
    
    // Inserir bloqueio recorrente de teste
    const testBlock = {
      barber_id: barberId,
      block_date: blockDate,
      start_time: '09:00:00',
      end_time: '10:00:00',
      reason: 'Teste recorrência',
      is_recurring: true,
      recurrence_type: 'daily',
      recurrence_pattern: { interval: 1 },
      recurrence_end_date: recurrenceEndDate,
      created_by: userId
    };
    
    console.log('\n📝 Inserindo bloqueio recorrente de teste...');
    const { data: insertResult, error: insertError } = await supabase
      .from('schedule_blocks')
      .insert(testBlock)
      .select();
    
    if (insertError) {
      console.log('❌ Erro ao inserir bloqueio:', insertError.message);
      console.log('📋 Detalhes:', insertError);
    } else {
      console.log('✅ Bloqueio pai inserido com sucesso!');
      console.log('🆔 ID do bloqueio pai:', insertResult[0]?.id);
      
      // Aguardar um pouco para o trigger executar
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verificar se bloqueios filhos foram criados
      console.log('\n🔍 Verificando bloqueios filhos...');
      const { data: childBlocks, error: childError } = await supabase
        .from('schedule_blocks')
        .select('*')
        .eq('parent_block_id', insertResult[0].id);
      
      if (childError) {
        console.log('❌ Erro ao buscar bloqueios filhos:', childError.message);
      } else {
        console.log('👶 Bloqueios filhos encontrados:', childBlocks?.length || 0);
        if (childBlocks && childBlocks.length > 0) {
          childBlocks.forEach((block, index) => {
            console.log(`   ${index + 1}. Data: ${block.block_date}, Horário: ${block.start_time}-${block.end_time}`);
          });
        }
      }
      
      // Limpar dados de teste
      console.log('\n🧹 Limpando dados de teste...');
      await supabase
        .from('schedule_blocks')
        .delete()
        .eq('parent_block_id', insertResult[0].id);
      
      await supabase
        .from('schedule_blocks')
        .delete()
        .eq('id', insertResult[0].id);
      
      console.log('✅ Dados de teste removidos');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

testRecurringSetup();