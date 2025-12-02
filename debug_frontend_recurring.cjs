const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kdpdgzaygypmqtxmbyqc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkcGRnemF5Z3lwbXF0eG1ieXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NDc2MzQsImV4cCI6MjA2OTAyMzYzNH0.JY4mhKSNOYZc8XecjsgZ9KgX9zvoddrVSva1SMF4pcM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugFrontendRecurring() {
  console.log('🔍 Iniciando debug do frontend de bloqueios recorrentes...\n');

  try {
    // 1. Verificar se o trigger existe
    console.log('1️⃣ Verificando se o trigger existe...');
    const { data: triggerData, error: triggerError } = await supabase
      .from('information_schema.triggers')
      .select('*')
      .eq('trigger_name', 'trigger_auto_generate_recurring_blocks');

    if (triggerError) {
      console.log('❌ Erro ao verificar trigger:', triggerError);
    } else if (triggerData && triggerData.length > 0) {
      console.log('✅ Trigger encontrado:', triggerData[0].trigger_name);
    } else {
      console.log('❌ Trigger não encontrado');
    }

    // 2. Simular inserção de bloqueio recorrente como o frontend faria
    console.log('\n2️⃣ Simulando inserção de bloqueio recorrente...');
    
    // Usar data de hoje + 1 dia para evitar constraint de data
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const endDate = new Date(tomorrow);
    endDate.setDate(endDate.getDate() + 28); // 4 semanas
    const endDateStr = endDate.toISOString().split('T')[0];
    
    const blockData = {
      barber_id: 1, // Assumindo que existe um barbeiro com ID 1
      block_date: tomorrowStr,
      start_time: '14:00:00',
      end_time: '15:00:00',
      reason: 'Teste Frontend Recorrente',
      is_recurring: true,
      recurrence_type: 'weekly',
      recurrence_pattern: { interval: 1, days_of_week: [tomorrow.getDay()] }, // Dia da semana de amanhã
      recurrence_end_date: endDateStr
    };

    console.log('📋 Dados do bloqueio:', blockData);

    const { data: insertResult, error: insertError } = await supabase
      .from('schedule_blocks')
      .insert(blockData)
      .select();

    if (insertError) {
      console.log('❌ Erro na inserção:', insertError);
      return;
    }

    console.log('✅ Bloqueio inserido:', insertResult[0]);
    const parentId = insertResult[0].id;

    // 3. Aguardar um pouco para o trigger executar
    console.log('\n3️⃣ Aguardando trigger executar...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. Verificar se bloqueios filhos foram criados
    console.log('\n4️⃣ Verificando bloqueios filhos criados...');
    const { data: childBlocks, error: childError } = await supabase
      .from('schedule_blocks')
      .select('*')
      .eq('parent_block_id', parentId)
      .order('block_date');

    if (childError) {
      console.log('❌ Erro ao buscar bloqueios filhos:', childError);
    } else {
      console.log(`✅ Encontrados ${childBlocks.length} bloqueios filhos:`);
      childBlocks.forEach((block, index) => {
        console.log(`   ${index + 1}. Data: ${block.block_date}, Horário: ${block.start_time}-${block.end_time}`);
      });
    }

    // 5. Verificar todos os bloqueios relacionados
    console.log('\n5️⃣ Verificando todos os bloqueios relacionados...');
    const { data: allRelatedBlocks, error: allError } = await supabase
      .from('schedule_blocks')
      .select('*')
      .or(`id.eq.${parentId},parent_block_id.eq.${parentId}`)
      .order('block_date');

    if (allError) {
      console.log('❌ Erro ao buscar todos os bloqueios:', allError);
    } else {
      console.log(`✅ Total de bloqueios relacionados: ${allRelatedBlocks.length}`);
      allRelatedBlocks.forEach((block, index) => {
        const type = block.parent_block_id ? 'Filho' : 'Pai';
        console.log(`   ${index + 1}. ${type} - ID: ${block.id}, Data: ${block.block_date}, Recorrente: ${block.is_recurring}`);
      });
    }

    // 6. Limpar dados de teste
    console.log('\n6️⃣ Limpando dados de teste...');
    const { error: deleteError } = await supabase
      .from('schedule_blocks')
      .delete()
      .or(`id.eq.${parentId},parent_block_id.eq.${parentId}`);

    if (deleteError) {
      console.log('❌ Erro ao limpar dados:', deleteError);
    } else {
      console.log('✅ Dados de teste limpos');
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

debugFrontendRecurring();