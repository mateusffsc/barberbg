/**
 * Converte uma data para string no formato YYYY-MM-DD mantendo o horário local
 * (sem conversão de timezone)
 */
export const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Converte uma data para string no formato HH:MM:SS mantendo o horário local
 * (sem conversão de timezone)
 */
export const toLocalTimeString = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${hours}:${minutes}:${seconds}`;
};

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
 * (sem conversão de timezone)
 */
export const toLocalISOString = (date: Date): string => {
  // Usar toISOString() diretamente sem ajustes de timezone
  // para manter o horário exato que foi inserido
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}Z`;
};

/**
 * Cria uma nova data a partir de uma string, garantindo que seja interpretada
 * como horário local do Brasil (UTC-3)
 */
export const fromLocalISOString = (isoString: string): Date => {
  // Se a string já tem timezone, usar diretamente
  if (isoString.includes('+') || isoString.includes('Z')) {
    return new Date(isoString);
  }
  
  // Se não tem timezone, assumir que é local
  return new Date(isoString + 'Z');
};

/**
 * Formata um horário de uma string ISO para exibição local
 * corrigindo problemas de timezone
 */
export const formatTimeFromISO = (isoString: string): string => {
  // Parse manual da string ISO para evitar conversões de timezone
  const cleanString = isoString.replace('Z', '').replace(/\.\d{3}/, '');
  const [datePart, timePart] = cleanString.split('T');
  
  if (timePart) {
    const [hours, minutes] = timePart.split(':');
    return `${hours}:${minutes}`;
  }
  
  // Fallback para o método padrão
  return new Date(isoString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
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