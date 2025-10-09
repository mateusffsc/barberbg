const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Criar cliente com as mesmas configurações do frontend
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  {
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'Prefer': 'count=exact'
      }
    }
  }
);

async function testPaginationFix() {
  console.log('📄 Testando implementação de paginação...');
  
  try {
    // Simular a nova lógica de paginação
    const fetchPage = async (from, to) => {
      let query = supabase
        .from('appointments')
        .select(`
          *,
          client:clients(id, name),
          barber:barbers(id, name, is_special_barber),
          appointment_services(
            service_id,
            price_at_booking,
            commission_rate_applied,
            service:services(id, name, duration_minutes_normal, duration_minutes_special, is_chemical)
          )
        `, { count: 'exact' })
        .order('appointment_datetime')
        .range(from, to);

      return await query;
    };

    // Primeira consulta para obter o count total
    console.log('📡 Buscando primeira página (0-999)...');
    const { data: firstPage, count, error: firstError } = await fetchPage(0, 999);
    
    if (firstError) {
      console.error('❌ Erro na primeira página:', firstError);
      return;
    }

    console.log('✅ Primeira página obtida com sucesso!');
    console.log('📊 Total de agendamentos no banco:', count);
    console.log('📋 Registros na primeira página:', firstPage?.length);

    let allData = firstPage || [];
    
    // Se há mais de 1000 registros, buscar as páginas restantes
    if (count && count > 1000) {
      const totalPages = Math.ceil(count / 1000);
      console.log('📄 Total de páginas necessárias:', totalPages);
      
      for (let page = 1; page < totalPages; page++) {
        const from = page * 1000;
        const to = from + 999;
        
        console.log(`📡 Buscando página ${page + 1} (${from}-${to})...`);
        const { data: pageData, error: pageError } = await fetchPage(from, to);
        
        if (pageError) {
          console.error(`❌ Erro na página ${page + 1}:`, pageError);
          continue;
        }
        
        if (pageData) {
          allData = [...allData, ...pageData];
          console.log(`✅ Página ${page + 1} adicionada. Total acumulado: ${allData.length}`);
        }
      }
    }

    console.log('\n🎉 RESULTADO FINAL:');
    console.log('📊 Total no banco:', count);
    console.log('📋 Total coletado:', allData.length);
    
    // Verificar agendamentos após 04/11/2025
    const futureAppointments = allData.filter(apt => 
      new Date(apt.appointment_datetime) >= new Date('2025-11-04T00:00:00')
    );
    
    console.log('📅 Agendamentos após 04/11/2025:', futureAppointments.length);
    
    if (allData.length > 1000) {
      console.log('🎉 SUCESSO! Conseguimos mais de 1000 registros com paginação!');
    } else {
      console.log('⚠️ Ainda limitado a 1000 registros ou menos');
    }
    
    // Mostrar alguns agendamentos futuros
    if (futureAppointments.length > 0) {
      console.log('\n📋 Primeiros 5 agendamentos após 04/11/2025:');
      futureAppointments.slice(0, 5).forEach((apt, index) => {
        console.log(`  ${index + 1}. ${apt.appointment_datetime} | ${apt.client_name || 'Cliente'} com ${apt.barber_name || 'Barbeiro'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testPaginationFix();