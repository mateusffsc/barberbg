const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kdpdgzaygypmqtxmbyqc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkcGRnemF5Z3lwbXF0eG1ieXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NDc2MzQsImV4cCI6MjA2OTAyMzYzNH0.JY4mhKSNOYZc8XecjsgZ9KgX9zvoddrVSva1SMF4pcM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRealBlockDeletion() {
  console.log('🔍 Testando exclusão real de bloqueio...\n');

  try {
    // Primeiro, criar um bloqueio de teste
    console.log('📝 Criando bloqueio de teste...');
    
    const testBlock = {
      barber_id: 5, // Usando um barbeiro existente
      block_date: '2025-12-31', // Data futura para não interferir
      start_time: '23:00:00',
      end_time: '23:30:00',
      reason: 'Teste de exclusão',
      created_by: null // Permitir null para evitar problema de foreign key
    };

    const { data: createdBlock, error: createError } = await supabase
      .from('schedule_blocks')
      .insert(testBlock)
      .select()
      .single();

    if (createError) {
      console.error('❌ Erro ao criar bloqueio de teste:', createError);
      return;
    }

    console.log(`✅ Bloqueio de teste criado com ID: ${createdBlock.id}`);
    console.log(`   Data: ${createdBlock.block_date}`);
    console.log(`   Horário: ${createdBlock.start_time} - ${createdBlock.end_time}`);
    console.log(`   Motivo: ${createdBlock.reason}\n`);

    // Agora testar a exclusão
    console.log(`🗑️ Testando exclusão do bloqueio ID: ${createdBlock.id}...`);

    const deleteScheduleBlock = async (blockId) => {
      try {
        const { error } = await supabase
          .from('schedule_blocks')
          .delete()
          .eq('id', blockId);

        if (error) throw error;

        console.log('✅ Bloqueio excluído com sucesso!');
        return true;
      } catch (error) {
        console.error('❌ Erro ao excluir bloqueio:', error);
        return false;
      }
    };

    const success = await deleteScheduleBlock(createdBlock.id);

    if (success) {
      // Verificar se realmente foi excluído
      const { data: checkBlock, error: checkError } = await supabase
        .from('schedule_blocks')
        .select('*')
        .eq('id', createdBlock.id)
        .single();

      if (checkError && checkError.code === 'PGRST116') {
        console.log('✅ Confirmado: Bloqueio foi excluído do banco de dados');
      } else if (checkBlock) {
        console.log('❌ PROBLEMA: Bloqueio ainda existe no banco de dados');
        console.log('   Dados encontrados:', checkBlock);
      } else {
        console.log('⚠️ Erro ao verificar exclusão:', checkError);
      }
    }

    console.log('\n🔍 Testando cenário de erro...');
    
    // Testar exclusão de ID inexistente
    const fakeSuccess = await deleteScheduleBlock(99999);
    if (!fakeSuccess) {
      console.log('✅ Função handleDeleteBlock trata corretamente IDs inexistentes');
    }

  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

testRealBlockDeletion();