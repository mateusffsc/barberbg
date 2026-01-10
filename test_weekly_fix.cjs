const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kdpdgzaygypmqtxmbyqc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkcGRnemF5Z3lwbXF0eG1ieXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NDc2MzQsImV4cCI6MjA2OTAyMzYzNH0.JY4mhKSNOYZc8XecjsgZ9KgX9zvoddrVSva1SMF4pcM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testWeeklyFix() {
  console.log('🧪 Testando correção de bloqueios semanais...\n');

  try {
    // 1. Primeiro, aplicar a correção diretamente via SQL
    console.log('1️⃣ Aplicando correção da função...');
    
    const fixSQL = `
      CREATE OR REPLACE FUNCTION generate_recurring_blocks(
          p_parent_block_id INTEGER
      )
      RETURNS INTEGER AS $$
      DECLARE
          parent_block RECORD;
          block_date_iter DATE;
          end_date DATE;
          generated_count INTEGER := 0;
          days_of_week INTEGER[];
          day_of_month INTEGER;
          interval_days INTEGER;
          target_day_of_week INTEGER;
      BEGIN
          -- Buscar o bloqueio pai
          SELECT * INTO parent_block 
          FROM schedule_blocks 
          WHERE id = p_parent_block_id AND is_recurring = TRUE;
          
          IF NOT FOUND THEN
              RAISE EXCEPTION 'Bloqueio pai não encontrado ou não é recorrente';
          END IF;
          
          block_date_iter := parent_block.block_date;
          end_date := parent_block.recurrence_end_date;
          
          -- Processar baseado no tipo de recorrência
          CASE parent_block.recurrence_type
              WHEN 'daily' THEN
                  interval_days := COALESCE((parent_block.recurrence_pattern->>'interval')::INTEGER, 1);
                  block_date_iter := block_date_iter + interval_days;
                  
                  WHILE block_date_iter <= end_date LOOP
                      INSERT INTO schedule_blocks (
                          barber_id, block_date, start_time, end_time, reason,
                          is_recurring, recurrence_type, recurrence_pattern, 
                          recurrence_end_date, parent_block_id, created_by
                      ) VALUES (
                          parent_block.barber_id, block_date_iter, parent_block.start_time, 
                          parent_block.end_time, parent_block.reason,
                          FALSE, NULL, NULL, NULL, p_parent_block_id, parent_block.created_by
                      );
                      
                      generated_count := generated_count + 1;
                      block_date_iter := block_date_iter + interval_days;
                  END LOOP;
                  
              WHEN 'weekly' THEN
                  -- Extrair dias da semana do padrão JSON
                  SELECT array_agg(value::INTEGER) INTO days_of_week
                  FROM jsonb_array_elements_text(parent_block.recurrence_pattern->'days_of_week');
                  
                  -- Para recorrência semanal simples (mesmo dia da semana)
                  target_day_of_week := days_of_week[1];
                  
                  -- Começar da próxima semana (mesmo dia da semana + 7 dias)
                  block_date_iter := block_date_iter + 7;
                  
                  WHILE block_date_iter <= end_date LOOP
                      -- Verificar se é o dia da semana correto
                      IF EXTRACT(DOW FROM block_date_iter)::INTEGER = target_day_of_week THEN
                          INSERT INTO schedule_blocks (
                              barber_id, block_date, start_time, end_time, reason,
                              is_recurring, recurrence_type, recurrence_pattern, 
                              recurrence_end_date, parent_block_id, created_by
                          ) VALUES (
                              parent_block.barber_id, block_date_iter, parent_block.start_time, 
                              parent_block.end_time, parent_block.reason,
                              FALSE, NULL, NULL, NULL, p_parent_block_id, parent_block.created_by
                          );
                          
                          generated_count := generated_count + 1;
                      END IF;
                      
                      -- Pular para a próxima semana (+ 7 dias)
                      block_date_iter := block_date_iter + 7;
                  END LOOP;
                  
              WHEN 'monthly' THEN
                  day_of_month := (parent_block.recurrence_pattern->>'day_of_month')::INTEGER;
                  block_date_iter := (DATE_TRUNC('month', block_date_iter) + INTERVAL '1 month' + (day_of_month - 1 || ' days')::INTERVAL)::DATE;
                  
                  WHILE block_date_iter <= end_date LOOP
                      IF EXTRACT(DAY FROM block_date_iter) = day_of_month THEN
                          INSERT INTO schedule_blocks (
                              barber_id, block_date, start_time, end_time, reason,
                              is_recurring, recurrence_type, recurrence_pattern, 
                              recurrence_end_date, parent_block_id, created_by
                          ) VALUES (
                              parent_block.barber_id, block_date_iter, parent_block.start_time, 
                              parent_block.end_time, parent_block.reason,
                              FALSE, NULL, NULL, NULL, p_parent_block_id, parent_block.created_by
                          );
                          
                          generated_count := generated_count + 1;
                      END IF;
                      
                      block_date_iter := (DATE_TRUNC('month', block_date_iter) + INTERVAL '1 month' + (day_of_month - 1 || ' days')::INTERVAL)::DATE;
                  END LOOP;
          END CASE;
          
          RETURN generated_count;
      END;
      $$ LANGUAGE plpgsql;
    `;

    const { error: fixError } = await supabase.rpc('exec', { sql: fixSQL });
    if (fixError) {
      console.log('❌ Erro ao aplicar correção:', fixError);
      return;
    }
    console.log('✅ Função corrigida aplicada');

    // 2. Buscar um barbeiro existente
    console.log('\n2️⃣ Buscando barbeiro...');
    const { data: barbers, error: barbersError } = await supabase
      .from('barbers')
      .select('id')
      .limit(1);

    if (barbersError || !barbers || barbers.length === 0) {
      console.log('❌ Erro ao buscar barbeiros:', barbersError);
      return;
    }

    const barberId = barbers[0].id;
    console.log('✅ Usando barbeiro ID:', barberId);

    // 3. Criar um bloqueio semanal de teste
    console.log('\n3️⃣ Criando bloqueio semanal de teste...');
    
    // Usar uma segunda-feira específica para teste
    const testDate = new Date('2024-12-16'); // Segunda-feira
    const testDateStr = testDate.toISOString().split('T')[0];
    
    const endDate = new Date(testDate);
    endDate.setDate(endDate.getDate() + 21); // 3 semanas
    const endDateStr = endDate.toISOString().split('T')[0];
    
    const weeklyBlockData = {
      barber_id: barberId,
      block_date: testDateStr,
      start_time: '14:00:00',
      end_time: '15:00:00',
      reason: 'Teste Semanal Corrigido',
      is_recurring: true,
      recurrence_type: 'weekly',
      recurrence_pattern: { interval: 1, days_of_week: [testDate.getDay()] }, // 1 = Segunda-feira
      recurrence_end_date: endDateStr
    };

    console.log('📋 Dados do bloqueio:', {
      ...weeklyBlockData,
      dia_da_semana_original: testDate.getDay(),
      data_original: testDateStr,
      data_fim: endDateStr
    });

    const { data: insertResult, error: insertError } = await supabase
      .from('schedule_blocks')
      .insert(weeklyBlockData)
      .select();

    if (insertError) {
      console.log('❌ Erro na inserção:', insertError);
      return;
    }

    console.log('✅ Bloqueio pai criado:', insertResult[0]);
    const parentId = insertResult[0].id;

    // 4. Aguardar trigger executar
    console.log('\n4️⃣ Aguardando trigger executar...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 5. Verificar bloqueios filhos
    console.log('\n5️⃣ Verificando bloqueios filhos...');
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
        const blockDate = new Date(block.block_date);
        const dayOfWeek = blockDate.getDay();
        const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        
        console.log(`   ${index + 1}. Data: ${block.block_date} (${dayNames[dayOfWeek]}) - Dia da semana: ${dayOfWeek}`);
      });

      // Verificar se todos os bloqueios são na segunda-feira (dia 1)
      const allMondays = childBlocks.every(block => new Date(block.block_date).getDay() === 1);
      if (allMondays) {
        console.log('✅ SUCESSO: Todos os bloqueios foram criados na segunda-feira!');
      } else {
        console.log('❌ ERRO: Alguns bloqueios não estão na segunda-feira');
      }
    }

    // 6. Limpeza
    console.log('\n6️⃣ Limpando dados de teste...');
    
    // Deletar bloqueios filhos
    if (childBlocks && childBlocks.length > 0) {
      const childIds = childBlocks.map(b => b.id);
      await ('schedule_blocks').delete().in('id', childIds);
    }
    
    // Deletar bloqueio pai
    await supabase.from('schedule_blocks').delete().eq('id', parentId);
    
    console.log('✅ Limpeza concluída');

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testWeeklyFix();