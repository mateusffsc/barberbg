const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function analyzeDatabaseStructure() {
  console.log('🔍 ANÁLISE COMPLETA DA ESTRUTURA DO BANCO DE DADOS\n');
  console.log('=' .repeat(80));

  try {
    // 1. Listar todas as tabelas
    console.log('\n1️⃣ TABELAS DO SISTEMA');
    console.log('-'.repeat(30));
    
    const tables = [
      'appointments',
      'clients', 
      'barbers',
      'services',
      'appointment_services',
      'schedule_blocks',
      'products',
      'sales',
      'sale_items',
      'users',
      'profiles'
    ];

    const tableInfo = {};

    for (const table of tables) {
      try {
        // Contar registros
        const { count, error: countError } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (countError) {
          console.log(`❌ ${table}: Erro ao acessar (${countError.message})`);
          continue;
        }

        // Buscar estrutura (primeiros registros para análise)
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);

        if (error) {
          console.log(`⚠️  ${table}: ${count} registros (erro ao buscar estrutura)`);
          continue;
        }

        const structure = data && data.length > 0 ? Object.keys(data[0]) : [];
        tableInfo[table] = {
          count,
          structure,
          sample: data[0] || null
        };

        console.log(`✅ ${table}: ${count} registros (${structure.length} campos)`);
        
      } catch (error) {
        console.log(`❌ ${table}: Erro - ${error.message}`);
      }
    }

    // 2. Análise detalhada de cada tabela
    console.log('\n2️⃣ ESTRUTURA DETALHADA DAS TABELAS');
    console.log('-'.repeat(45));

    for (const [tableName, info] of Object.entries(tableInfo)) {
      console.log(`\n📊 TABELA: ${tableName.toUpperCase()}`);
      console.log(`   Registros: ${info.count}`);
      console.log(`   Campos (${info.structure.length}):`);
      
      info.structure.forEach(field => {
        const value = info.sample ? info.sample[field] : null;
        const type = value !== null ? typeof value : 'unknown';
        const sample = value !== null ? 
          (type === 'string' && value.length > 50 ? value.substring(0, 50) + '...' : value) : 
          'NULL';
        console.log(`     - ${field} (${type}): ${sample}`);
      });
    }

    // 3. Análise de relacionamentos
    console.log('\n3️⃣ RELACIONAMENTOS IDENTIFICADOS');
    console.log('-'.repeat(40));

    const relationships = [
      {
        from: 'appointments',
        to: 'clients',
        key: 'client_id',
        description: 'Agendamento pertence a um cliente'
      },
      {
        from: 'appointments',
        to: 'barbers', 
        key: 'barber_id',
        description: 'Agendamento atribuído a um barbeiro'
      },
      {
        from: 'appointment_services',
        to: 'appointments',
        key: 'appointment_id',
        description: 'Serviços de um agendamento'
      },
      {
        from: 'appointment_services',
        to: 'services',
        key: 'service_id',
        description: 'Serviço específico do agendamento'
      },
      {
        from: 'schedule_blocks',
        to: 'barbers',
        key: 'barber_id',
        description: 'Bloqueio de agenda de um barbeiro'
      },
      {
        from: 'sales',
        to: 'clients',
        key: 'client_id',
        description: 'Venda para um cliente'
      },
      {
        from: 'sale_items',
        to: 'sales',
        key: 'sale_id',
        description: 'Itens de uma venda'
      },
      {
        from: 'sale_items',
        to: 'products',
        key: 'product_id',
        description: 'Produto vendido'
      }
    ];

    relationships.forEach(rel => {
      console.log(`🔗 ${rel.from}.${rel.key} → ${rel.to}`);
      console.log(`   ${rel.description}`);
    });

    // 4. Análise de volume de dados por período
    console.log('\n4️⃣ ANÁLISE TEMPORAL DOS DADOS');
    console.log('-'.repeat(35));

    if (tableInfo.appointments && tableInfo.appointments.count > 0) {
      // Agendamentos por mês
      const { data: monthlyData } = await supabase
        .from('appointments')
        .select('appointment_datetime')
        .order('appointment_datetime');

      if (monthlyData && monthlyData.length > 0) {
        const monthlyStats = {};
        monthlyData.forEach(apt => {
          const date = new Date(apt.appointment_datetime);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          monthlyStats[monthKey] = (monthlyStats[monthKey] || 0) + 1;
        });

        console.log('📅 Agendamentos por mês:');
        Object.entries(monthlyStats)
          .sort()
          .slice(-12) // Últimos 12 meses
          .forEach(([month, count]) => {
            console.log(`   ${month}: ${count} agendamentos`);
          });
      }
    }

    // 5. Análise de integridade dos dados
    console.log('\n5️⃣ ANÁLISE DE INTEGRIDADE');
    console.log('-'.repeat(30));

    // Verificar agendamentos órfãos
    if (tableInfo.appointments) {
      const { data: orphanAppointments } = await supabase
        .from('appointments')
        .select('id, client_id, barber_id, client_name, barber_name')
        .or('client_id.is.null,barber_id.is.null')
        .limit(5);

      if (orphanAppointments && orphanAppointments.length > 0) {
        console.log(`⚠️  Agendamentos com referências nulas: ${orphanAppointments.length}`);
        orphanAppointments.forEach(apt => {
          console.log(`   ID ${apt.id}: client_id=${apt.client_id}, barber_id=${apt.barber_id}`);
        });
      } else {
        console.log('✅ Agendamentos: Integridade OK');
      }
    }

    // 6. Análise de performance
    console.log('\n6️⃣ ANÁLISE DE PERFORMANCE');
    console.log('-'.repeat(30));

    const performanceTests = [
      {
        name: 'Busca simples appointments',
        query: () => supabase.from('appointments').select('id').limit(100)
      },
      {
        name: 'Busca com filtro de data',
        query: () => supabase.from('appointments')
          .select('id')
          .gte('appointment_datetime', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .limit(100)
      },
      {
        name: 'Contagem total appointments',
        query: () => supabase.from('appointments').select('*', { count: 'exact', head: true })
      }
    ];

    for (const test of performanceTests) {
      const start = Date.now();
      const { error } = await test.query();
      const duration = Date.now() - start;
      
      if (error) {
        console.log(`❌ ${test.name}: Erro - ${error.message}`);
      } else {
        console.log(`⚡ ${test.name}: ${duration}ms`);
      }
    }

    // 7. Resumo para migração
    console.log('\n7️⃣ RESUMO PARA MIGRAÇÃO');
    console.log('-'.repeat(30));

    const totalRecords = Object.values(tableInfo).reduce((sum, info) => sum + info.count, 0);
    const totalTables = Object.keys(tableInfo).length;

    console.log(`📊 Total de tabelas: ${totalTables}`);
    console.log(`📊 Total de registros: ${totalRecords.toLocaleString()}`);
    console.log(`📊 Tabela maior: ${Object.entries(tableInfo).sort((a, b) => b[1].count - a[1].count)[0]?.[0]} (${Object.entries(tableInfo).sort((a, b) => b[1].count - a[1].count)[0]?.[1].count} registros)`);

    // Estimativa de tamanho
    const avgRecordSize = 1024; // 1KB por registro (estimativa)
    const estimatedSize = totalRecords * avgRecordSize;
    console.log(`📊 Tamanho estimado: ${(estimatedSize / 1024 / 1024).toFixed(2)} MB`);

    console.log('\n' + '='.repeat(80));
    console.log('🎯 ANÁLISE COMPLETA CONCLUÍDA');
    
  } catch (error) {
    console.error('❌ Erro na análise:', error);
  }
}

analyzeDatabaseStructure();