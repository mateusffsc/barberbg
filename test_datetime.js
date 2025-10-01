// Simulação das funções de conversão de horário
function fromLocalDateTimeString(dateTimeString) {
  const cleanString = dateTimeString.replace(/[+-]\d{2}:?\d{2}$|Z$/, '');
  
  const [datePart, timePart] = cleanString.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes, seconds = 0] = timePart.split(':').map(Number);
  
  const date = new Date(year, month - 1, day, hours, minutes, seconds);
  
  return date;
}

function toLocalISOString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}Z`;
}

function formatTimeFromISO(isoString) {
  const cleanString = isoString.replace('Z', '').replace(/\.\d{3}/, '');
  const [datePart, timePart] = cleanString.split('T');
  
  if (timePart) {
    const [hours, minutes] = timePart.split(':');
    return `${hours}:${minutes}`;
  }
  
  return new Date(isoString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Teste do fluxo completo
console.log('=== TESTE DE CONVERSÃO DE HORÁRIO ===');

const userInput = '2024-01-15T11:00';
console.log('1. Horário inserido pelo usuário:', userInput);

const convertedDate = fromLocalDateTimeString(userInput);
console.log('2. Data convertida:', convertedDate.toISOString());
console.log('3. Horário da data convertida:', convertedDate.toLocaleTimeString('pt-BR'));

const isoStringToSave = toLocalISOString(convertedDate);
console.log('4. ISO string que será salva:', isoStringToSave);

// Simular leitura do banco
const readFromDB = new Date(isoStringToSave);
console.log('5. Data lida do banco:', readFromDB.toISOString());
console.log('6. Horário lido do banco (método antigo):', readFromDB.toLocaleTimeString('pt-BR'));
console.log('7. Horário formatado (método novo):', formatTimeFromISO(isoStringToSave));

console.log('8. Timezone offset (minutos):', readFromDB.getTimezoneOffset());
console.log('9. Timezone atual:', Intl.DateTimeFormat().resolvedOptions().timeZone);