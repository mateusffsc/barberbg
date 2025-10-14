import React from 'react';
import moment from 'moment';
import { CalendarEvent } from '../../types/appointment';
import { formatCurrency } from '../../utils/formatters';

interface DayViewCalendarProps {
  events: CalendarEvent[];
  date: Date;
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectSlot?: (slotInfo: { start: Date; end: Date }) => void;
}

export const DayViewCalendar: React.FC<DayViewCalendarProps> = ({
  events,
  date,
  onSelectEvent,
  onSelectSlot
}) => {
  // Horários de funcionamento (8h às 22h)
  const startHour = 8;
  const endHour = 22;
  const hoursRange = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  // Filtrar eventos do dia selecionado
  const dayEvents = events.filter(event => 
    moment(event.start).format('YYYY-MM-DD') === moment(date).format('YYYY-MM-DD')
  );

  // Função para detectar sobreposições entre eventos
  const detectOverlaps = (events: CalendarEvent[]) => {
    const overlaps: { [key: string]: { column: number; totalColumns: number } } = {};
    
    // Ordenar eventos por horário de início
    const sortedEvents = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
    
    for (let i = 0; i < sortedEvents.length; i++) {
      const currentEvent = sortedEvents[i];
      const currentStart = currentEvent.start.getTime();
      const currentEnd = currentEvent.end.getTime();
      
      // Encontrar eventos que se sobrepõem
      const overlappingEvents = sortedEvents.filter(event => {
        const eventStart = event.start.getTime();
        const eventEnd = event.end.getTime();
        
        return (
          (eventStart < currentEnd && eventEnd > currentStart) || // Sobreposição parcial
          (eventStart >= currentStart && eventEnd <= currentEnd) || // Evento dentro do atual
          (eventStart <= currentStart && eventEnd >= currentEnd) // Evento engloba o atual
        );
      });
      
      if (overlappingEvents.length > 1) {
        // Organizar em colunas
        overlappingEvents.forEach((event, index) => {
          if (!overlaps[event.id]) {
            overlaps[event.id] = {
              column: index,
              totalColumns: overlappingEvents.length
            };
          }
        });
      } else {
        // Evento sem sobreposição
        overlaps[currentEvent.id] = {
          column: 0,
          totalColumns: 1
        };
      }
    }
    
    return overlaps;
  };

  // Detectar sobreposições dos eventos do dia
  const eventOverlaps = detectOverlaps(dayEvents);

  // Função para calcular a posição e altura do evento
  const getEventStyle = (event: CalendarEvent) => {
    const startMinutes = event.start.getHours() * 60 + event.start.getMinutes();
    const endMinutes = event.end.getHours() * 60 + event.end.getMinutes();
    const duration = endMinutes - startMinutes;
    
    // Calcular posição relativa ao horário de início (8h = 480 minutos)
    const dayStartMinutes = startHour * 60;
    // Pequeno espaçamento entre eventos para evitar que fiquem "embolados" no mobile
    const EVENT_GAP_PX = 4; // gap discreto
    const top = ((startMinutes - dayStartMinutes) / 60) * 50; // manter posição exata do horário
    const rawHeight = (duration / 60) * 50; // altura base
    const height = Math.max(rawHeight - EVENT_GAP_PX, 2); // remover altura mínima para não causar sobreposição

    // Obter informações de sobreposição
    const overlap = eventOverlaps[event.id] || { column: 0, totalColumns: 1 };
    
    // Calcular largura e posição horizontal para eventos sobrepostos
    const width = 100 / overlap.totalColumns;
    const left = (overlap.column * width);

    return {
      top: `${top}px`,
      height: `${height}px`,
      width: `${width}%`,
      left: `${left}%`,
    };
  };

  // Função para obter cor do evento baseado no status
  const getEventColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500 border-blue-600 text-white';
      case 'completed': return 'bg-green-500 border-green-600 text-white';
      case 'cancelled': return 'bg-red-500 border-red-600 text-white';
      case 'blocked': return 'bg-red-600 border-red-700 text-white';
      case 'no_show': return 'bg-gray-500 border-gray-600 text-white';
      default: return 'bg-blue-500 border-blue-600 text-white';
    }
  };

  // Função para lidar com clique em slot vazio
  const handleSlotClick = (hour: number) => {
    if (onSelectSlot) {
      const slotStart = new Date(date);
      slotStart.setHours(hour, 0, 0, 0);
      const slotEnd = new Date(slotStart);
      slotEnd.setHours(hour + 1, 0, 0, 0);
      onSelectSlot({ start: slotStart, end: slotEnd });
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm">
      {/* Header com data - otimizado para mobile */}
      <div className="flex-shrink-0 p-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <h2 className="text-base font-semibold text-gray-900 text-center">
          {moment(date).format('dddd, DD [de] MMMM')}
        </h2>
        <p className="text-xs text-gray-600 text-center mt-1">
          {dayEvents.length} agendamento{dayEvents.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Grid de horários - otimizado para mobile */}
      <div className="flex-1 overflow-y-auto">
        <div className="relative">
          {/* Linhas de horário */}
          {hoursRange.map(hour => (
            <div key={hour} className="relative border-b border-gray-100">
              {/* Linha do horário */}
              <div 
                className="flex items-start min-h-[50px] cursor-pointer hover:bg-gray-50 transition-colors active:bg-gray-100"
                onClick={() => handleSlotClick(hour)}
              >
                {/* Coluna do horário - reduzida para mobile */}
                <div className="w-12 flex-shrink-0 p-1.5 text-right border-r border-gray-200">
                  <span className="text-xs font-medium text-gray-600">
                    {String(hour).padStart(2, '0')}:00
                  </span>
                </div>
                
                {/* Área do conteúdo */}
                <div className="flex-1 relative min-h-[50px]">
                  {/* Linha de meia hora */}
                  <div className="absolute top-1/2 left-0 right-0 border-t border-gray-100 border-dashed opacity-50"></div>
                </div>
              </div>
            </div>
          ))}

          {/* Eventos sobrepostos */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="relative ml-12"> {/* Offset reduzido para mobile */}
              {dayEvents.map(event => {
                const style = getEventStyle(event);
                const colorClass = getEventColor(event.resource.status);
                const primaryService = !event.resource.isBlock ? (event.resource.services?.[0] || null) : null;
                
                return (
                  <div
                    key={event.id}
                    className={`absolute rounded-md border-l-3 shadow-sm cursor-pointer pointer-events-auto ${colorClass} hover:shadow-md transition-all duration-200 active:scale-95`}
                    style={{
                      ...style
                    }}
                    onClick={() => onSelectEvent(event)}
                  >
                    <div className="p-1 h-full overflow-hidden flex flex-col">
                      {/* Horário + Cliente (se não for bloqueio) */}
                      <div className="text-xs font-medium opacity-95 mb-0.5 leading-tight flex-shrink-0 truncate">
                        {moment(event.start).format('HH:mm')} - {moment(event.end).format('HH:mm')}
                        {!event.resource.isBlock && ` - ${event.resource.client}${primaryService ? ` - ${primaryService}` : ''}`}
                      </div>

                      {/* Título do Bloqueio - apenas para bloqueios */}
                      {event.resource.isBlock && (
                        <div className="text-xs font-semibold mb-0.5 leading-tight flex-shrink-0 break-words">
                          {event.title}
                        </div>
                      )}
                      
                      {/* Serviços ou Motivo do Bloqueio - sempre visível */}
                      <div className="text-xs opacity-80 mb-0.5 leading-tight flex-1 break-words overflow-hidden">
                        {event.resource.isBlock 
                          ? event.resource.blockData?.reason || 'Bloqueio'
                          : event.resource.services?.join(', ') || 'Sem serviços'
                        }
                      </div>
                      
                      {/* Barbeiro - apenas se houver espaço */}
                      {parseInt(style.height) > 60 && (
                        <div className="text-xs opacity-90 mb-0.5 leading-tight flex-shrink-0">
                          {event.resource.barber}
                        </div>
                      )}
                      
                      {/* Valor - apenas se houver bastante espaço e não for bloqueio */}
                      {parseInt(style.height) > 80 && !event.resource.isBlock && (
                        <div className="text-xs font-medium opacity-95 leading-tight flex-shrink-0 mt-auto">
                          {formatCurrency(event.resource.total)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Linha do horário atual (se for hoje) - otimizada para mobile */}
      {moment(date).format('YYYY-MM-DD') === moment().format('YYYY-MM-DD') && (
        <div 
          className="absolute left-12 right-0 border-t-2 border-red-500 z-20 pointer-events-none"
          style={{
            top: `${((moment().hours() * 60 + moment().minutes() - startHour * 60) / 60) * 50 + 56}px` // Ajustado para altura reduzida
          }}
        >
          <div className="absolute -left-1 -top-1 w-2 h-2 bg-red-500 rounded-full shadow-sm"></div>
          <div className="absolute -right-2 -top-2 bg-red-500 text-white text-xs px-1 py-0.5 rounded text-center shadow-sm">
            {moment().format('HH:mm')}
          </div>
        </div>
      )}
    </div>
  );
};