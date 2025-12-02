// Teste para verificar se a correção do problema de timezone funcionou
import { toLocalDateString, toLocalTimeString } from './src/utils/dateHelpers.js';

console.log('🧪 Testando correção do problema de timezone...\n');

// Simular horários noturnos problemáticos
const testTimes = [
  '2024-12-20T20:00', // 8 PM
  '2024-12-20T21:00', // 9 PM (problema original)
  '2024-12-20T22:00', // 10 PM
  '2024-12-20T23:00', // 11 PM
  '2024-12-20T23:30', // 11:30 PM
];

testTimes.forEach(timeStr => {
  const date = new Date(timeStr);
  
  console.log(`⏰ Testando: ${timeStr}`);
  console.log(`   📅 Data original: ${date.toDateString()}`);
  console.log(`   📆 Data corrigida: ${toLocalDateString(date)}`);
  console.log(`   ⏱️ Hora corrigida: ${toLocalTimeString(date)}`);
  
  // Verificar se a data permanece a mesma
  const originalDate = timeStr.split('T')[0];
  const correctedDate = toLocalDateString(date);
  
  if (originalDate === correctedDate) {
    console.log(`   ✅ SUCESSO: Data mantida corretamente!`);
  } else {
    console.log(`   ❌ ERRO: Data mudou de ${originalDate} para ${correctedDate}!`);
  }
  console.log('');
});

console.log('🎯 Teste específico para o problema relatado (21:00):');
const problemTime = new Date('2024-12-20T21:00');
console.log(`Data: ${toLocalDateString(problemTime)}`);
console.log(`Hora: ${toLocalTimeString(problemTime)}`);
console.log(`Esperado: 2024-12-20 e 21:00:00`);

if (toLocalDateString(problemTime) === '2024-12-20' && toLocalTimeString(problemTime) === '21:00:00') {
  console.log('✅ PROBLEMA CORRIGIDO COM SUCESSO!');
} else {
  console.log('❌ Problema ainda existe!');
}