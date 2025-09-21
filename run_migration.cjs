const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function runMigration() {
  try {
    console.log('🔄 Executando migração para adicionar colunas de duração...');
    
    // 1. Adicionar colunas se não existirem
    console.log('1. Adicionando colunas duration_minutes_normal e duration_minutes_special...');
    const { error: alterError } = await supabase.rpc('exec_sql', { 
      sql: `
        ALTER TABLE services 
        ADD COLUMN IF NOT EXISTS duration_minutes_normal INTEGER DEFAULT 30,
        ADD COLUMN IF NOT EXISTS duration_minutes_special INTEGER DEFAULT 40;
      `
    });
    
    if (alterError) {
      console.log('⚠️ Colunas já existem ou erro:', alterError.message);
    } else {
      console.log('✅ Colunas adicionadas com sucesso');
    }
    
    // 2. Migrar dados existentes
    console.log('2. Migrando dados existentes...');
    const { error: updateError1 } = await supabase.rpc('exec_sql', { 
      sql: `
        UPDATE services 
        SET duration_minutes_normal = duration_minutes
        WHERE duration_minutes_normal IS NULL;
      `
    });
    
    if (updateError1) {
      console.error('❌ Erro ao migrar dados:', updateError1);
    } else {
      console.log('✅ Dados migrados para duration_minutes_normal');
    }
    
    // 3. Definir duração especial para serviços de corte
    console.log('3. Definindo duração especial para serviços de corte...');
    const { error: updateError2 } = await supabase.rpc('exec_sql', { 
      sql: `
        UPDATE services 
        SET duration_minutes_special = 30
        WHERE LOWER(name) LIKE '%corte%';
      `
    });
    
    if (updateError2) {
      console.error('❌ Erro ao definir duração especial:', updateError2);
    } else {
      console.log('✅ Duração especial definida como 30 minutos para serviços de corte');
    }
    
    // 4. Para outros serviços, manter o mesmo tempo
    console.log('4. Definindo duração especial para outros serviços...');
    const { error: updateError3 } = await supabase.rpc('exec_sql', { 
      sql: `
        UPDATE services 
        SET duration_minutes_special = duration_minutes_normal
        WHERE LOWER(name) NOT LIKE '%corte%' AND duration_minutes_special IS NULL;
      `
    });
    
    if (updateError3) {
      console.error('❌ Erro ao definir duração para outros serviços:', updateError3);
    } else {
      console.log('✅ Duração especial definida para outros serviços');
    }
    
    console.log('🎉 Migração concluída!');
    
    // Verificar resultados
    console.log('📊 Verificando resultados...');
    const { data, error } = await supabase
      .from('services')
      .select('id, name, duration_minutes, duration_minutes_normal, duration_minutes_special')
      .order('name');
      
    if (error) {
      console.error('❌ Erro ao verificar:', error);
    } else {
      console.log('📋 Serviços atualizados:');
      console.table(data);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

runMigration();