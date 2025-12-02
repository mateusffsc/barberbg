const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kdpdgzaygypmqtxmbyqc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkcGRnemF5Z3lwbXF0eG1ieXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NDc2MzQsImV4cCI6MjA2OTAyMzYzNH0.JY4mhKSNOYZc8XecjsgZ9KgX9zvoddrVSva1SMF4pcM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugFrontendSimple() {
  console.log('🔍 Debug simples do frontend de bloqueios recorrentes...\n');

  try {
    // 1. Verificar barbeiros existentes
    console.log('1️⃣ Verificando barbeiros existentes...');
    const { data: barbers, error: barbersError } = await supabase
      .from('barbers')
      .select('id, name')
      .limit(5);

    if (barbersError) {
      console.log('❌ Erro ao buscar barbeiros:', barbersError);
      return;
    }

    if (!barbers || barbers.length === 0) {
      console.log('❌ Nenhum barbeiro encontrado');
      return;
    }

    console.log('✅ Barbeiros encontrados:');
    barbers.forEach(barber => {
      console.log(`   - ID: ${barber.id}, Nome: ${barber.name}`);
    });

    const barberId = barbers[0].id;
    console.log(`\n🎯 Usando barbeiro ID: ${barberId}`);

    // 2. Testar inserção de bloqueio simples (não recorrente)
    console.log('\n2️⃣ Testando bloqueio simples...');
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const simpleBlockData = {
      barber_id: barberId,
      block_date: tomorrowStr,
      start_time: '14:00:00',
      end_time: '15:00:00',
      reason: 'Teste Simples',
      is_recurring: false
    };

    console.log('📋 Dados do bloqueio simples:', simpleBlockData);

    const { data: simpleResult, error: simpleError } = await supabase
      .from('schedule_blocks')
      .insert(simpleBlockData)
      .select();

    if (simpleError) {
      console.log('❌ Erro no bloqueio simples:', simpleError);
      return;
    }

    console.log('✅ Bloqueio simples criado:', simpleResult[0]);
    const simpleBlockId = simpleResult[0].id;

    // 3. Testar inserção de bloqueio recorrente
    console.log('\n3️⃣ Testando bloqueio recorrente...');
    
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    const dayAfterTomorrowStr = dayAfterTomorrow.toISOString().split('T')[0];
    
    const endDate = new Date(dayAfterTomorrow);
    endDate.setDate(endDate.getDate() + 21); // 3 semanas
    const endDateStr = endDate.toISOString().split('T')[0];
    
    const recurringBlockData = {
      barber_id: barberId,
      block_date: dayAfterTomorrowStr,
      start_time: '16:00:00',
      end_time: '17:00:00',
      reason: 'Teste Recorrente',
      is_recurring: true,
      recurrence_type: 'weekly',
      recurrence_pattern: { interval: 1, days_of_week: [dayAfterTomorrow.getDay()] },
      recurrence_end_date: endDateStr
    };

    console.log('📋 Dados do bloqueio recorrente:', recurringBlockData);

    const { data: recurringResult, error: recurringError } = await supabase
      .from('schedule_blocks')
      .insert(recurringBlockData)
      .select();

    if (recurringError) {
      console.log('❌ Erro no bloqueio recorrente:', recurringError);
    } else {
      console.log('✅ Bloqueio recorrente criado:', recurringResult[0]);
      const parentId = recurringResult[0].id;

      // 4. Aguardar trigger executar
      console.log('\n4️⃣ Aguardando trigger executar...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 5. Verificar bloqueios filhos
      console.log('\n5️⃣ Verificando bloqueios filhos...');
      const { data: childBlocks, error: childError } = await supabase
        .from('schedule_blocks')
        .select('*')
        .eq('parent_block_id', parentId)
        .order('block_date');

      if (childError) {
        console.log('❌ Erro ao buscar filhos:', childError);
      } else {
        console.log(`✅ Encontrados ${childBlocks.length} bloqueios filhos:`);
        childBlocks.forEach((block, index) => {
          console.log(`   ${index + 1}. Data: ${block.block_date}, Horário: ${block.start_time}-${block.end_time}`);
        });
      }

      // 6. Limpar bloqueio recorrente
      console.log('\n6️⃣ Limpando bloqueio recorrente...');
      const { error: deleteRecurringError } = await supabase
        .from('schedule_blocks')
        .delete()
        .or(`id.eq.${parentId},parent_block_id.eq.${parentId}`);

      if (deleteRecurringError) {
        console.log('❌ Erro ao limpar recorrente:', deleteRecurringError);
      } else {
        console.log('✅ Bloqueio recorrente limpo');
      }
    }

    // 7. Limpar bloqueio simples
    console.log('\n7️⃣ Limpando bloqueio simples...');
    const { error: deleteSimpleError } = await supabase
      .from('schedule_blocks')
      .delete()
      .eq('id', simpleBlockId);

    if (deleteSimpleError) {
      console.log('❌ Erro ao limpar simples:', deleteSimpleError);
    } else {
      console.log('✅ Bloqueio simples limpo');
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

debugFrontendSimple();