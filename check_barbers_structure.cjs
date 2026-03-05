const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkBarbersStructure() {
  console.log('🔍 VERIFICANDO ESTRUTURA DA TABELA BARBERS\n');
  console.log('=' .repeat(50));

  try {
    // 1. Buscar todos os barbeiros para ver a estrutura
    console.log('\n1️⃣ ESTRUTURA ATUAL');
    console.log('-'.repeat(20));
    
    const { data: barbers, error } = await supabase
      .from('barbers')
      .select('*')
      .limit(3);

    if (error) {
      console.log('❌ Erro ao buscar barbeiros:', error);
      return;
    }

    if (barbers && barbers.length > 0) {
      console.log('📋 Campos disponíveis na tabela barbers:');
      const fields = Object.keys(barbers[0]);
      fields.forEach(field => {
        console.log(`   - ${field}: ${typeof barbers[0][field]} (${barbers[0][field]})`);
      });
      
      console.log('\n📊 Barbeiros atuais:');
      barbers.forEach(barber => {
        console.log(`   ID: ${barber.id} | Nome: ${barber.name}`);
      });
    }

    // 2. Buscar especificamente Luiz Henrique
    console.log('\n2️⃣ LUIZ HENRIQUE');
    console.log('-'.repeat(15));
    
    const { data: luizHenrique } = await supabase
      .from('barbers')
      .select('*')
      .ilike('name', '%luiz henrique%')
      .single();

    if (luizHenrique) {
      console.log('✅ Luiz Henrique encontrado:');
      Object.entries(luizHenrique).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    }

    // 3. Verificar se podemos "ocultar" de outra forma
    console.log('\n3️⃣ OPÇÕES PARA OCULTAR');
    console.log('-'.repeat(25));
    
    console.log('📋 Estratégias possíveis:');
    console.log('   1. Adicionar campo is_active à tabela');
    console.log('   2. Usar campo existente (ex: name com prefixo)');
    console.log('   3. Filtrar no código frontend');
    console.log('   4. Mover para tabela de barbeiros inativos');

    console.log('\n' + '='.repeat(50));
    console.log('🎯 ANÁLISE CONCLUÍDA');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

checkBarbersStructure();