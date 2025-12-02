// Script para testar conversão de datas e identificar problemas de timezone

// Simular as funções do dateHelpers
const toLocalDateTimeString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const fromLocalDateTimeString = (dateTimeString) => {
  // Remove qualquer indicação de timezone para forçar interpretação local
  const cleanString = dateTimeString.replace(/[+-]\d{2}:?\d{2}$|Z$/, '');
  
  // Parse manual para garantir interpretação local correta
  const [datePart, timePart] = cleanString.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes, seconds = 0] = timePart.split(':').map(Number);
  
  // Criar data usando construtor que interpreta como horário local
  const date = new Date(year, month - 1, day, hours, minutes, seconds);
  
  return date;
};

const toLocalISOString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

console.log('🔍 Testando conversão de datas para horários noturnos...\n');

// Testar diferentes horários noturnos
const testTimes = [
  '2024-12-20T20:00', // 8 PM
  '2024-12-20T20:30', // 8:30 PM
  '2024-12-20T21:00', // 9 PM
  '2024-12-20T21:30', // 9:30 PM
  '2024-12-20T22:00', // 10 PM
  '2024-12-20T22:30', // 10:30 PM
  '2024-12-20T23:00', // 11 PM
  '2024-12-20T23:30'  // 11:30 PM
];

testTimes.forEach(timeString => {
  console.log(`⏰ Testando: ${timeString}`);
  
  try {
    // Simular o processo do frontend
    const date = fromLocalDateTimeString(timeString);
    
    console.log(`   📅 Data criada: ${date}`);
    console.log(`   🕐 Horário local: ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`);
    
    // Simular o que acontece no useAppointments
    const appointmentDateTime = toLocalISOString(date);
    const appointmentDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const appointmentTime = date.toTimeString().split(' ')[0]; // HH:MM:SS
    
    console.log(`   💾 appointment_datetime: ${appointmentDateTime}`);
    console.log(`   📆 appointment_date: ${appointmentDate}`);
    console.log(`   ⏱️ appointment_time: ${appointmentTime}`);
    
    // Verificar se há mudança de data
    const originalDate = timeString.split('T')[0];
    if (appointmentDate !== originalDate) {
      console.log(`   ⚠️ PROBLEMA: Data mudou de ${originalDate} para ${appointmentDate}!`);
    }
    
    // Verificar se o horário está correto
    const originalTime = timeString.split('T')[1];
    const expectedTime = originalTime + ':00';
    if (appointmentTime !== expectedTime) {
      console.log(`   ⚠️ PROBLEMA: Horário mudou de ${expectedTime} para ${appointmentTime}!`);
    }
    
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
  }
  
  console.log(''); // Linha em branco
});

// Testar timezone offset
console.log('🌍 Informações de timezone:');
console.log(`   Timezone offset: ${new Date().getTimezoneOffset()} minutos`);
console.log(`   Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
console.log(`   Data atual: ${new Date()}`);
console.log(`   Data atual ISO: ${new Date().toISOString()}`);

// Testar conversão específica para 21:00
console.log('\n🎯 Teste específico para 21:00 (problema relatado):');
const testDate21 = fromLocalDateTimeString('2024-12-20T21:00');
console.log(`Data criada: ${testDate21}`);
console.log(`Horário: ${testDate21.getHours()}:${String(testDate21.getMinutes()).padStart(2, '0')}`);
console.log(`Data ISO: ${testDate21.toISOString()}`);
console.log(`Data split: ${testDate21.toISOString().split('T')[0]}`);
console.log(`Time string: ${testDate21.toTimeString()}`);
console.log(`Time split: ${testDate21.toTimeString().split(' ')[0]}`);