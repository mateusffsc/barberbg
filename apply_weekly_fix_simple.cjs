const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://kdpdgzaygypmqtxmbyqc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkcGRnemF5Z3lwbXF0eG1ieXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NDc2MzQsImV4cCI6MjA2OTAyMzYzNH0.JY4mhKSNOYZc8XecjsgZ9KgX9zvoddrVSva1SMF4pcM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyWeeklyFix() {
  console.log('🔧 Aplicando correção para bloqueios semanais...\n');

  try {
    // Ler o arquivo SQL
    const sqlContent = fs.readFileSync('fix_recurring_blocks_function.sql', 'utf8');
    
    console.log('📄 Arquivo SQL lido com sucesso');
    console.log('📤 Tentando aplicar correção no banco de dados...');

    // Como não temos acesso direto ao exec_sql, vamos mostrar o conteúdo
    console.log('❌ Não foi possível aplicar automaticamente');
    console.log('💡 A correção precisa ser aplicada manualmente no Supabase Dashboard');
    console.log('\n📋 Instruções:');
    console.log('1. Acesse o Supabase Dashboard');
    console.log('2. Vá para SQL Editor');
    console.log('3. Cole e execute o seguinte SQL:');
    console.log('\n--- INÍCIO DO SQL ---');
    console.log(sqlContent);
    console.log('--- FIM DO SQL ---\n');
    
    console.log('✅ Após aplicar o SQL, os bloqueios semanais serão criados corretamente!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

applyWeeklyFix();