/**
 * Utilitários para lidar com datas sem problemas de fuso horário
 */

/**
 * Converte uma data para string no formato datetime-local (YYYY-MM-DDTHH:mm)
 * sem conversão de fuso horário
 */
export const toLocalDateTimeString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Converte uma string datetime-local para objeto Date
 * mantendo o horário local (sem conversão UTC)
 */
export const fromLocalDateTimeString = (dateTimeString: string): Date => {
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

/**
 * Converte uma data local para ISO string mantendo o horário local
 * (adiciona o offset do timezone local)
 */
export const toLocalISOString = (date: Date): string => {
  const timezoneOffset = date.getTimezoneOffset() * 60000; // em millisegundos
  const localDate = new Date(date.getTime() - timezoneOffset);
  return localDate.toISOString();
};

/**
 * Cria uma nova data a partir de uma string, garantindo que seja interpretada
 * como horário local do Brasil (UTC-3)
 */
export const createLocalDate = (dateTimeString: string): Date => {
  // Se a string não tem timezone, adiciona o offset do Brasil
  if (!dateTimeString.includes('T')) {
    dateTimeString += 'T00:00:00';
  }
  
  if (!dateTimeString.includes('-03:00') && !dateTimeString.includes('Z')) {
    dateTimeString += '-03:00';
  }
  
  return new Date(dateTimeString);
};

/**
 * Formata uma data para exibição no formato brasileiro
 */
export const formatDateTimeBR = (date: Date): string => {
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};