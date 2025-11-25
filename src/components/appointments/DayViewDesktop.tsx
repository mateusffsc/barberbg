import React, { useState, useEffect } from 'react';
import moment from 'moment';
import { CalendarEvent } from '../../types/appointment';
import { formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';

interface DayViewDesktopProps {
  events: CalendarEvent[];
  date: Date;
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectSlot?: (slotInfo: { start: Date; end: Date; barberId?: string }) => void;
  barbers: Array<{ id: string; name: string; avatar?: string }>;
}

export const DayViewDesktop: React.FC<DayViewDesktopProps> = ({
  events,
  date,
  onSelectEvent,
  onSelectSlot,
  barbers
}) => {
  const { user } = useAuth();
  
  // Horários de funcionamento (7h às 00h)
  const startHour = 7;
  const endHour = 24; // 24h = 00:00 (meia-noite)
  const hoursRange = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  // Filtrar eventos do dia selecionado
  const dayEvents = events.filter(event => 
    moment(event.start).format('YYYY-MM-DD') === moment(date).format('YYYY-MM-DD')
  );

  // Filtrar barbeiros baseado no tipo de usuário e remover o barbeiro "rose"
  const filteredBarbers = (
    user?.role === 'barber'
      ? barbers.filter(barber => barber.id === user.barber?.id?.toString())
      : barbers
  ).filter(b => (b.name || '').toLowerCase() !== 'rose');

  // Agrupar eventos por barbeiro
  const eventsByBarber = filteredBarbers.reduce((acc, barber) => {
    const barberEvents = dayEvents.filter(event => {
      const eventBarberId = event.resource.barberId;
      const barberIdString = barber.id.toString();
      
      // Para agendamentos normais - comparar como string
      if (!event.resource.isBlock) {
        return eventBarberId === barberIdString;
      }
      
      // Para bloqueios
      if (event.resource.isBlock) {
        const blockBarberId = event.resource.blockData?.barber_id?.toString();
        // Se não tem barberId específico, mostrar em todas as colunas
        if (!blockBarberId) {
          return true;
        }
        // Se tem barberId específico, mostrar apenas na coluna correspondente
        return blockBarberId === barberIdString;
      }
      
      return false;
    });
    
    acc[barber.id] = barberEvents;
    return acc;
  }, {} as { [key: string]: CalendarEvent[] });

  // Função para calcular a posição e altura do evento
  const getEventStyle = (event: CalendarEvent) => {
    const startMinutes = event.start.getHours() * 60 + event.start.getMinutes();
    const endMinutes = event.end.getHours() * 60 + event.end.getMinutes();
    const duration = endMinutes - startMinutes;
    
    // Calcular posição relativa ao horário de início (8h = 480 minutos)
    const dayStartMinutes = startHour * 60;
    const hourHeight = 80; // 80px por hora para acomodar os intervalos de 30min
    const top = ((startMinutes - dayStartMinutes) / 60) * hourHeight;
    const height = (duration / 60) * hourHeight;

    return {
      top: `${top}px`,
      height: `${Math.max(height, 40)}px`, // Altura mínima de 40px para melhor visualização
    };
  };

  // Função para obter cor do evento
  const getEventColor = (status: string, isBlock: boolean = false) => {
    if (isBlock) {
      return 'bg-gradient-to-r from-red-500 to-red-600 text-white border-red-600';
    }
    
    switch (status) {
      case 'confirmed':
        return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-600';
      case 'completed':
        return 'bg-gradient-to-r from-green-500 to-green-600 text-white border-green-600';
      case 'cancelled':
        return 'bg-gradient-to-r from-red-500 to-red-600 text-white border-red-600';
      case 'no_show':
        return 'bg-gradient-to-r from-orange-500 to-orange-600 text-white border-orange-600';
      default:
        return 'bg-gradient-to-r from-gray-500 to-gray-600 text-white border-gray-600';
    }
  };

  // Função para lidar com clique em slot vazio
  const handleSlotClick = (hour: number, barberId: string) => {
    if (onSelectSlot) {
      const slotStart = new Date(date);
      slotStart.setHours(hour, 0, 0, 0);
      const slotEnd = new Date(slotStart);
      slotEnd.setHours(hour + 1, 0, 0, 0);
      onSelectSlot({ start: slotStart, end: slotEnd, barberId });
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header com data */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <h2 className="text-xl font-bold text-gray-900 text-center">
          {moment(date).format('dddd, DD [de] MMMM [de] YYYY')}
        </h2>
        <p className="text-sm text-gray-600 text-center mt-1">
          {dayEvents.length} agendamento{dayEvents.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Grid principal */}
      <div className="flex-1 overflow-auto">
        <div className="flex min-h-full">
          {/* Coluna de horários */}
          <div className="w-16 flex-shrink-0 border-r border-gray-200 bg-gray-50">
            <div className="h-16 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50 flex items-center justify-center">
              <span className="text-xs font-semibold text-gray-700">Horário</span>
            </div>
            {hoursRange.map(hour => (
              <div key={hour} className="h-20 border-b border-gray-100 flex items-center justify-center relative">
                <span className="text-sm font-medium text-gray-600">
                  {hour === 24 ? '00:00' : `${String(hour).padStart(2, '0')}:00`}
                </span>
                {/* Linha de meia hora na coluna de horários */}
                <div className="absolute top-1/2 left-2 right-2 border-t border-gray-200 border-dashed opacity-40"></div>
              </div>
            ))}
          </div>

          {/* Colunas dos barbeiros */}
          <div className="flex-1 flex">
            {filteredBarbers.map((barber, index) => (
              <div key={barber.id} className="min-w-[114px] flex-1 border-r border-gray-200 last:border-r-0" style={{boxSizing: 'border-box'}}>
                {/* Header do barbeiro */}
                <div className="h-16 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50 flex flex-col items-center justify-center p-1">
                  {barber.avatar ? (
                    <img 
                      src={barber.avatar} 
                      alt={barber.name}
                      className="w-6 h-6 rounded-full object-cover mb-0.5"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center mb-0.5">
                      <span className="text-white text-xs font-bold">
                        {barber.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="text-xs font-medium text-gray-900 text-center truncate w-full leading-tight">
                    {barber.name}
                  </span>
                </div>

                {/* Grid de horários do barbeiro */}
                <div className="relative">
                  {hoursRange.map(hour => (
                    <div 
                      key={hour} 
                      className="h-20 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors relative group"
                      onClick={() => handleSlotClick(hour, barber.id)}
                    >
                      {/* Linha de meia hora */}
                      <div className="absolute top-1/2 left-0 right-0 border-t border-gray-100 border-dashed opacity-30"></div>
                      
                      {/* Indicador de hover */}
                      <div className="absolute inset-0 bg-blue-100 opacity-0 group-hover:opacity-20 transition-opacity"></div>
                    </div>
                  ))}

                  {/* Eventos do barbeiro */}
                  <div className="absolute inset-0 pointer-events-none">
                    {eventsByBarber[barber.id]?.map(event => {
                      const style = getEventStyle(event);
                      const colorClass = getEventColor(event.resource.status, event.resource.isBlock);
                      
                      return (
                        <div
                          key={event.id}
                          className={`absolute rounded-lg border-l-4 shadow-md cursor-pointer pointer-events-auto mx-0.5 ${colorClass} hover:shadow-lg transition-all duration-200 hover:scale-105`}
                          style={style}
                          onClick={() => onSelectEvent(event)}
                        >
                          <div className="p-1 h-full overflow-hidden flex flex-col justify-start">
                            {/* Horário */}
                            <div className="text-xs font-bold opacity-95 mb-0.5 leading-tight flex-shrink-0">
                              {moment(event.start).format('HH:mm')} - {moment(event.end).format('HH:mm')}
                            </div>
                            
                            {/* Cliente ou Título do Bloqueio - sempre visível */}
                            <div className="text-xs font-semibold mb-0.5 leading-tight flex-shrink-0 break-words">
                              {event.resource.isBlock ? event.title : event.resource.client}
                            </div>
                            
                            {/* Serviços ou Motivo do Bloqueio - sempre visível */}
                            <div className="text-xs opacity-90 mb-0.5 leading-tight flex-1 break-words overflow-hidden">
                              {event.resource.isBlock 
                                ? event.resource.blockData?.reason || 'Bloqueio'
                                : event.resource.services?.join(', ') || 'Sem serviços'
                              }
                            </div>
                            
                            {/* Valor - apenas se houver espaço suficiente e não for bloqueio */}
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
            ))}
          </div>
        </div>
      </div>

      {/* Linha do horário atual (se for hoje) */}
      {moment(date).format('YYYY-MM-DD') === moment().format('YYYY-MM-DD') && (
        <div 
          className="absolute left-20 right-0 border-t-2 border-red-500 z-20 pointer-events-none"
          style={{
            top: `${((moment().hours() * 60 + moment().minutes() - startHour * 60) / 60) * 64 + 64}px` // Ajustado para altura do header (64px) + altura por hora (64px)
          }}
        >
          <div className="absolute -left-1 -top-1 w-2 h-2 bg-red-500 rounded-full shadow-sm"></div>
          <div className="absolute -right-2 -top-2 bg-red-500 text-white text-xs px-2 py-1 rounded shadow-sm">
            {moment().format('HH:mm')}
          </div>
        </div>
      )}
    </div>
  );
};