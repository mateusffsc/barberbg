const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kdpdgzaygypmqtxmbyqc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkcGRnemF5Z3lwbXF0eG1ieXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NDc2MzQsImV4cCI6MjA2OTAyMzYzNH0.JY4mhKSNOYZc8XecjsgZ9KgX9zvoddrVSva1SMF4pcM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testBlockDeletion() {
  console.log('🔍 Testando carregamento e estrutura dos bloqueios...\n');

  try {
    // Buscar bloqueios existentes
    const { data: blocks, error } = await supabase
      .from('schedule_blocks')
      .select('*')
      .order('block_date', { ascending: true })
      .limit(5);

    if (error) {
      console.error('❌ Erro ao buscar bloqueios:', error);
      return;
    }

    if (!blocks || blocks.length === 0) {
      console.log('⚠️ Nenhum bloqueio encontrado no banco de dados');
      return;
    }

    console.log(`✅ Encontrados ${blocks.length} bloqueios:`);
    
    blocks.forEach((block, index) => {
      console.log(`\n📋 Bloqueio ${index + 1}:`);
      console.log(`   ID: ${block.id}`);
      console.log(`   Data: ${block.block_date}`);
      console.log(`   Horário: ${block.start_time} - ${block.end_time}`);
      console.log(`   Barbeiro ID: ${block.barber_id || 'Todos'}`);
      console.log(`   Motivo: ${block.reason || 'Sem motivo'}`);
      console.log(`   Criado por: ${block.created_by || 'N/A'}`);
    });

    // Simular conversão para CalendarEvent
    console.log('\n🔄 Simulando conversão para CalendarEvent...\n');
    
    const blockEvents = blocks.map(block => {
      const blockDate = new Date(block.block_date + 'T' + block.start_time);
      const blockEndDate = new Date(block.block_date + 'T' + block.end_time);
      
      return {
        id: `block-${block.id}`,
        title: block.reason || 'Período Bloqueado',
        start: blockDate,
        end: blockEndDate,
        resource: {
          status: 'blocked',
          barber: block.barber_id ? 'Barbeiro específico' : 'Todos os barbeiros',
          barberId: block.barber_id?.toString() || '',
          isBlock: true,
          blockData: block
        }
      };
    });

    blockEvents.forEach((event, index) => {
      console.log(`📅 CalendarEvent ${index + 1}:`);
      console.log(`   Event ID: ${event.id}`);
      console.log(`   Block Data ID: ${event.resource.blockData?.id}`);
      console.log(`   Is Block: ${event.resource.isBlock}`);
      console.log(`   Title: ${event.title}`);
      console.log(`   Barber ID: ${event.resource.barberId}`);
      
      // Verificar se o ID está presente no blockData
      if (!event.resource.blockData?.id) {
        console.log('   ❌ PROBLEMA: blockData.id está ausente!');
      } else {
        console.log('   ✅ blockData.id está presente');
      }
      console.log('');
    });

    // Testar se conseguimos "deletar" um bloqueio (simulação)
    if (blocks.length > 0) {
      const firstBlock = blocks[0];
      console.log(`🗑️ Testando exclusão do bloqueio ID: ${firstBlock.id}...\n`);
      
      // Simular a função handleDeleteBlock
      console.log('Simulando handleDeleteBlock:');
      console.log(`   - Recebendo blockId: ${firstBlock.id}`);
      console.log(`   - Chamando deleteScheduleBlock(${firstBlock.id})`);
      
      // Não vamos realmente deletar, apenas simular
      console.log('   ✅ Simulação bem-sucedida - bloqueio seria deletado');
    }

  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

testBlockDeletion();