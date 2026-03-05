const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function addIsActiveField() {
  console.log('🔧 ADICIONANDO CAMPO is_active À TABELA BARBERS\n');
  console.log('=' .repeat(50));

  try {
    // 1. Verificar se o campo já existe
    console.log('\n1️⃣ VERIFICANDO ESTRUTURA ATUAL');
    console.log('-'.repeat(30));
    
    const { data: currentBarbers, error: checkError } = await supabase
      .from('barbers')
      .select('*')
      .limit(1);

    if (checkError) {
      console.log('❌ Erro ao verificar estrutura:', checkError);
      return;
    }

    if (currentBarbers && currentBarbers.length > 0) {
      const fields = Object.keys(currentBarbers[0]);
      console.log('📋 Campos atuais:', fields.join(', '));
      
      if (fields.includes('is_active')) {
        console.log('✅ Campo is_active já existe!');
      } else {
        console.log('⚠️  Campo is_active não existe - será necessário adicionar via SQL');
      }
    }

    // 2. Tentar adicionar o campo via SQL (se não existir)
    console.log('\n2️⃣ TENTANDO ADICIONAR CAMPO');
    console.log('-'.repeat(30));
    
    // Como não podemos executar DDL diretamente via Supabase client,
    // vamos simular a adição do campo atualizando um registro de teste
    
    // 3. Desativar Luiz Henrique (assumindo que o campo existe)
    console.log('\n3️⃣ DESATIVANDO LUIZ HENRIQUE');
    console.log('-'.repeat(30));
    
    // Primeiro, encontrar Luiz Henrique
    const { data: luizHenrique, error: findError } = await supabase
      .from('barbers')
      .select('*')
      .ilike('name', '%luiz henrique%')
      .single();

    if (findError) {
      console.log('❌ Erro ao buscar Luiz Henrique:', findError);
      return;
    }

    if (!luizHenrique) {
      console.log('⚠️  Luiz Henrique não encontrado');
      return;
    }

    console.log(`✅ Luiz Henrique encontrado: ID ${luizHenrique.id}`);

    // Tentar atualizar com is_active = false
    const { data: updatedBarber, error: updateError } = await supabase
      .from('barbers')
      .update({ is_active: false })
      .eq('id', luizHenrique.id)
      .select()
      .single();

    if (updateError) {
      console.log('❌ Erro ao desativar (campo is_active pode não existir):', updateError);
      console.log('\n📋 INSTRUÇÕES MANUAIS:');
      console.log('1. Execute no SQL Editor do Supabase:');
      console.log('   ALTER TABLE barbers ADD COLUMN is_active BOOLEAN DEFAULT true;');
      console.log('2. Depois execute:');
      console.log(`   UPDATE barbers SET is_active = false WHERE id = ${luizHenrique.id};`);
    } else {
      console.log('✅ Luiz Henrique desativado com sucesso!');
      console.log(`   is_active: ${updatedBarber.is_active}`);
    }

    // 4. Verificar todos os barbeiros
    console.log('\n4️⃣ VERIFICANDO TODOS OS BARBEIROS');
    console.log('-'.repeat(35));
    
    const { data: allBarbers, error: allError } = await supabase
      .from('barbers')
      .select('id, name, is_active')
      .order('name');

    if (allError) {
      console.log('❌ Erro ao buscar barbeiros:', allError);
    } else if (allBarbers) {
      console.log('📊 Status dos barbeiros:');
      allBarbers.forEach(barber => {
        const status = barber.is_active !== undefined ? 
          (barber.is_active ? '✅ Ativo' : '🚫 Inativo') : 
          '❓ Campo is_active não existe';
        console.log(`   ${barber.name}: ${status}`);
      });
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎯 PROCESSO CONCLUÍDO');
    
  } catch (error) {
    console.error('❌ Erro no processo:', error);
  }
}

addIsActiveField();