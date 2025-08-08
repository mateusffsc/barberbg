import moment from 'moment';

/**
 * Utilitários para trabalhar com data e hora separadas
 */

/**
 * Combina data e hora em um objeto Date
 */
export const combineDateTime = (date: string, time: string): Date => {
  return moment(`${date} ${time}`, 'YYYY-MM-DD HH:mm:ss').toDate();
};

/**
 * Combina data e hora em uma string ISO
 */
export const combineDateTimeString = (date: string, time: string): string => {
  return moment(`${date} ${time}`, 'YYYY-MM-DD HH:mm:ss').toISOString();
};

/**
 * Separa um datetime em data e hora
 */
export const separateDateTime = (datetime: string | Date) => {
  const momentObj = moment(datetime);
  return {
    date: momentObj.format('YYYY-MM-DD'),
    time: momentObj.format('HH:mm:ss')
  };
};

/**
 * Formata data para exibição (DD/MM/YYYY)
 */
export const formatDate = (date: string): string => {
  return moment(date, 'YYYY-MM-DD').format('DD/MM/YYYY');
};

/**
 * Formata hora para exibição (HH:mm)
 */
export const formatTime = (time: string): string => {
  return moment(time, 'HH:mm:ss').format('HH:mm');
};

/**
 * Formata data e hora para exibição
 */
export const formatDateTime = (date: string, time: string): string => {
  const dateFormatted = formatDate(date);
  const timeFormatted = formatTime(time);
  return `${dateFormatted} às ${timeFormatted}`;
};

/**
 * Verifica se uma data/hora está no passado
 */
export const isInPast = (date: string, time: string): boolean => {
  const dateTime = combineDateTime(date, time);
  return moment(dateTime).isBefore(moment());
};

/**
 * Verifica se uma data/hora está no futuro
 */
export const isInFuture = (date: string, time: string): boolean => {
  const dateTime = combineDateTime(date, time);
  return moment(dateTime).isAfter(moment());
};

/**
 * Obtém a data atual no formato YYYY-MM-DD
 */
export const getCurrentDate = (): string => {
  return moment().format('YYYY-MM-DD');
};

/**
 * Obtém a hora atual no formato HH:mm:ss
 */
export const getCurrentTime = (): string => {
  return moment().format('HH:mm:ss');
};

/**
 * Obtém a hora atual no formato HH:mm (para inputs)
 */
export const getCurrentTimeForInput = (): string => {
  return moment().format('HH:mm');
};

/**
 * Converte hora de HH:mm para HH:mm:ss
 */
export const timeInputToTimeString = (timeInput: string): string => {
  return `${timeInput}:00`;
};

/**
 * Converte hora de HH:mm:ss para HH:mm
 */
export const timeStringToTimeInput = (timeString: string): string => {
  return timeString.substring(0, 5);
};

/**
 * Valida se uma data está no formato correto
 */
export const isValidDate = (date: string): boolean => {
  return moment(date, 'YYYY-MM-DD', true).isValid();
};

/**
 * Valida se uma hora está no formato correto
 */
export const isValidTime = (time: string): boolean => {
  return moment(time, 'HH:mm:ss', true).isValid() || moment(time, 'HH:mm', true).isValid();
};

/**
 * Adiciona minutos a uma hora
 */
export const addMinutesToTime = (time: string, minutes: number): string => {
  const [hours, mins] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}:00`;
};

/**
 * Calcula a diferença em minutos entre duas horas
 */
export const getTimeDifferenceInMinutes = (startTime: string, endTime: string): number => {
  const start = moment(startTime, 'HH:mm:ss');
  const end = moment(endTime, 'HH:mm:ss');
  return end.diff(start, 'minutes');
};