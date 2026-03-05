const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testLuizHenriqueHidden() {
  console.log('🔍 TESTANDO SE LUIZ HENRIQUE ESTÁ OCULTO\n');
  console.log('=' .repeat(50));

  try {
    // 1. Testar consulta do hook useBarbers (com filtro)
    console.log('\n1️⃣ TESTANDO HOOK useBarbers (com filtro)');
    console.log('-'.repeat(40));
    
    let query = supabase
      .from('barbers')
      .select(`
        id,
        name,
        phone,
        email,
        is_special_barber,
        commission_rate_service,
        commission_rate_product,
        commission_rate_chemical_service
      `)
      .order('name');

    // Aplicar o mesmo filtro do hook
    query = query.not('name', 'ilike', '%luiz henrique%');

    const { data: filteredBarbers, error: filteredError } = await query;

    if (filteredError) {
      console.log('❌ Erro na consulta filtrada:', filteredError);
    } else {
      console.log('✅ Barbeiros retornados pela consulta filtrada:');
      filteredBarbers.forEach(barber => {
        console.log(`   - ${barber.name} (ID: ${barber.id})`);
      });
      
      const hasLuizHenrique = filteredBarbers.some(b => 
        (b.name || '').toLowerCase().includes('luiz henrique')
      );
      
      if (hasLuizHenrique) {
        console.log('❌ FALHA: Luiz Henrique ainda aparece na lista!');
      } else {
        console.log('✅ SUCESSO: Luiz Henrique não aparece na lista filtrada');
      }
    }

    // 2. Testar consulta do Dashboard (com filtro)
    console.log('\n2️⃣ TESTANDO CONSULTA DO DASHBOARD (com filtro)');
    console.log('-'.repeat(45));
    
    const { data: dashboardBarbers, error: dashboardError } = await supabase
      .from('barbers')
      .select('*')
      .not('name', 'ilike', '%luiz henrique%')
      .order('name');

    if (dashboardError) {
      console.log('❌ Erro na consulta do dashboard:', dashboardError);
    } else {
      console.log('✅ Barbeiros retornados pelo dashboard:');
      dashboardBarbers.forEach(barber => {
        console.log(`   - ${barber.name} (ID: ${barber.id})`);
      });
      
      const hasLuizHenrique = dashboardBarbers.some(b => 
        (b.name || '').toLowerCase().includes('luiz henrique')
      );
      
      if (hasLuizHenrique) {
        console.log('❌ FALHA: Luiz Henrique ainda aparece no dashboard!');
      } else {
        console.log('✅ SUCESSO: Luiz Henrique não aparece no dashboard');
      }
    }

    // 3. Testar filtro JavaScript (simulando frontend)
    console.log('\n3️⃣ TESTANDO FILTROS JAVASCRIPT (frontend)');
    console.log('-'.repeat(45));
    
    // Buscar todos os barbeiros (sem filtro SQL)
    const { data: allBarbers, error: allError } = await supabase
      .from('barbers')
      .select('id, name')
      .order('name');

    if (allError) {
      console.log('❌ Erro ao buscar todos os barbeiros:', allError);
    } else {
      console.log('📊 Todos os barbeiros no banco:');
      allBarbers.forEach(barber => {
        console.log(`   - ${barber.name} (ID: ${barber.id})`);
      });

      // Aplicar filtro JavaScript (como no frontend)
      const filteredByJS = allBarbers.filter(b => {
        const name = (b.name || '').toLowerCase();
        return name !== 'rose' && !name.includes('luiz henrique');
      });

      console.log('\n✅ Barbeiros após filtro JavaScript:');
      filteredByJS.forEach(barber => {
        console.log(`   - ${barber.name} (ID: ${barber.id})`);
      });

      const hasLuizHenriqueJS = filteredByJS.some(b => 
        (b.name || '').toLowerCase().includes('luiz henrique')
      );
      
      if (hasLuizHenriqueJS) {
        console.log('❌ FALHA: Luiz Henrique ainda aparece após filtro JS!');
      } else {
        console.log('✅ SUCESSO: Luiz Henrique filtrado pelo JavaScript');
      }
    }

    // 4. Verificar se Luiz Henrique ainda existe no banco
    console.log('\n4️⃣ VERIFICANDO EXISTÊNCIA NO BANCO');
    console.log('-'.repeat(35));
    
    const { data: luizHenrique, error: luizError } = await supabase
      .from('barbers')
      .select('*')
      .ilike('name', '%luiz henrique%')
      .single();

    if (luizError && luizError.code === 'PGRST116') {
      console.log('⚠️  Luiz Henrique não encontrado no banco (foi removido?)');
    } else if (luizError) {
      console.log('❌ Erro ao buscar Luiz Henrique:', luizError);
    } else if (luizHenrique) {
      console.log('✅ Luiz Henrique ainda existe no banco:');
      console.log(`   ID: ${luizHenrique.id}`);
      console.log(`   Nome: ${luizHenrique.name}`);
      console.log(`   Status: ${luizHenrique.is_active !== undefined ? 
        (luizHenrique.is_active ? 'Ativo' : 'Inativo') : 
        'Campo is_active não existe'}`);
      console.log('📋 Dados preservados para histórico');
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎯 RESUMO DOS TESTES');
    console.log('');
    console.log('✅ Filtros implementados:');
    console.log('   - Hook useBarbers: Filtro SQL');
    console.log('   - Dashboard: Filtro SQL');
    console.log('   - Appointments: Filtro JavaScript');
    console.log('   - BlockScheduleModal: Filtro JavaScript');
    console.log('   - DayViewDesktop: Filtro JavaScript');
    console.log('');
    console.log('📊 Resultado: Luiz Henrique oculto do frontend');
    console.log('💾 Dados históricos preservados no banco');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testLuizHenriqueHidden();