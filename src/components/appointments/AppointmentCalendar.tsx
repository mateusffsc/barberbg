import React, { useState, useCallback } from 'react';
import { Calendar, momentLocalizer, View, Views } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/pt-br';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../../styles/calendar-responsive.css';
import { CalendarEvent } from '../../types/appointment';
import { AppointmentContextMenu } from './AppointmentContextMenu';
import { AppointmentsList } from './AppointmentsList';
import { DayViewCalendar } from './DayViewCalendar';
import { DayViewDesktop } from './DayViewDesktop';

// Configurar moment para português brasileiro
moment.locale('pt-br');
moment.updateLocale('pt-br', {
  months: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
  monthsShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  weekdays: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'],
  weekdaysShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  weekdaysMin: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
});
const localizer = momentLocalizer(moment);

interface AppointmentCalendarProps {
  events: CalendarEvent[];
  onSelectSlot: (slotInfo: { start: Date; end: Date }) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onEventDrop: (event: CalendarEvent, start: Date, end: Date) => void;
  onStatusChange: (appointmentId: number, newStatus: string) => void;
  onCompleteWithPayment: (event: CalendarEvent) => void;
  onDeleteAppointment?: (appointmentId: number) => void;
  loading?: boolean;
  barbers?: Array<{ id: string; name: string; avatar?: string }>;
  selectedDate?: Date;
}

export const AppointmentCalendar: React.FC<AppointmentCalendarProps> = ({
  events,
  onSelectSlot,
  onSelectEvent,
  onEventDrop,
  onStatusChange,
  onCompleteWithPayment,
  onDeleteAppointment,
  loading = false,
  barbers = [],
  selectedDate
}) => {
  const [view, setView] = useState<View>(Views.DAY);
  const [date, setDate] = useState(new Date());
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth >= 768 && window.innerWidth < 1024);
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    event: CalendarEvent | null;
  }>({ show: false, x: 0, y: 0, event: null });

  // Detectar mudanças no tamanho da tela
  React.useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sincronizar data interna com selectedDate
  React.useEffect(() => {
    if (selectedDate) {
      setDate(selectedDate);
    }
  }, [selectedDate]);

  // Configuração de cores por status
  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const colors = {
      scheduled: { 
        backgroundColor: '#3b82f6', 
        borderColor: '#2563eb',
        textColor: 'white'
      }, // Azul
      completed: { 
        backgroundColor: '#10b981', 
        borderColor: '#059669',
        textColor: 'white'
      }, // Verde
      cancelled: { 
        backgroundColor: '#ef4444', 
        borderColor: '#dc2626',
        textColor: 'white'
      }, // Vermelho
      blocked: { 
        backgroundColor: '#dc2626', 
        borderColor: '#b91c1c',
        textColor: 'white'
      }, // Vermelho escuro para bloqueios
      'no-show': { 
        backgroundColor: '#f59e0b', 
        borderColor: '#d97706',
        textColor: 'white'
      } // Amarelo
    };

    const status = event.resource?.status || 'scheduled';
    const style = colors[status as keyof typeof colors] || colors.scheduled;
    const color = style;

    return {
      style: {
        backgroundColor: color.backgroundColor,
        borderColor: color.borderColor,
        color: color.textColor,
        border: `1px solid ${color.borderColor}`,
        borderRadius: '6px',
        fontSize: '12px',
        padding: '4px 6px',
        fontWeight: '500',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        opacity: '1'
      }
    };
  }, []);

  // Configuração de horário comercial
  const minTime = new Date();
  minTime.setHours(8, 0, 0);

  const maxTime = new Date();
  maxTime.setHours(23, 59, 59); // 23:59h (quase meia-noite)

  // Mensagens em português
  const messages = {
    allDay: 'Dia todo',
    previous: 'Anterior',
    next: 'Próximo',
    today: 'Hoje',
    month: 'Mês',
    week: 'Semana',
    day: 'Dia',
    agenda: 'Agenda',
    date: 'Data',
    time: 'Hora',
    event: 'Evento',
    noEventsInRange: 'Não há agendamentos neste período',
    showMore: (total: number) => `+ ${total} mais`
  };

  // Formatos de data em português
  const formats = {
    monthHeaderFormat: 'MMMM YYYY',
    dayHeaderFormat: (date: Date) => moment(date).format('ddd'),
    weekdayFormat: (date: Date) => moment(date).format('ddd'),
    dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
      `${moment(start).format('DD/MM')} - ${moment(end).format('DD/MM/YYYY')}`,
    timeGutterFormat: 'HH:mm',
    eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
      `${moment(start).format('HH:mm')} - ${moment(end).format('HH:mm')}`,
    dayFormat: 'DD',
    dateFormat: 'DD',
    agendaDateFormat: 'DD/MM/YYYY',
    agendaTimeFormat: 'HH:mm',
    agendaTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
      `${moment(start).format('HH:mm')} - ${moment(end).format('HH:mm')}`
  };

  const handleSelectEvent = (event: CalendarEvent, e: React.SyntheticEvent) => {
    e.preventDefault();
    onSelectEvent(event);
  };

  const handleContextMenu = (event: CalendarEvent, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      event
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ show: false, x: 0, y: 0, event: null });
  };

  const handleEventDrop = ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) => {
    onEventDrop(event, start, end);
  };

  // Não filtrar eventos - mostrar todos os agendamentos independente do período
  const getFilteredEvents = () => {
    // Retornar todos os eventos sem filtro de data
    return events;
  };

  // Se for mobile ou visualização de semana/dia, mostrar lista em vez de calendário
  if (isMobile || view === Views.WEEK || view === Views.DAY) {
    // Para visualização do dia, usar componente específico baseado no dispositivo
    if (view === Views.DAY) {
      return (
        <div className="h-full flex flex-col">
          {loading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          )}

          {/* Controles de navegação */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setDate(new Date())}
                className="px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                Hoje
              </button>
              <button
                onClick={() => setDate(moment(date).subtract(1, 'day').toDate())}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => setDate(moment(date).add(1, 'day').toDate())}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setView(Views.MONTH)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${view === Views.MONTH
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
              >
                Mês
              </button>
              <button
                onClick={() => setView(Views.WEEK)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${view === Views.WEEK
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
              >
                Semana
              </button>
              <button
                onClick={() => setView(Views.DAY)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${view === Views.DAY
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
              >
                Dia
              </button>
            </div>
          </div>

          {/* Componente de visualização para o dia - Desktop ou Mobile */}
          <div className="flex-1 overflow-hidden">
            {isMobile ? (
              <DayViewCalendar
                events={events}
                date={date}
                onSelectEvent={onSelectEvent}
                onSelectSlot={onSelectSlot}
              />
            ) : (
              <DayViewDesktop
                events={events}
                date={date}
                onSelectEvent={onSelectEvent}
                onSelectSlot={onSelectSlot}
                barbers={barbers}
              />
            )}
          </div>

          {/* Menu de contexto */}
          <AppointmentContextMenu
            show={contextMenu.show}
            x={contextMenu.x}
            y={contextMenu.y}
            event={contextMenu.event}
            onClose={closeContextMenu}
            onStatusChange={(status) => {
              if (contextMenu.event) {
                onStatusChange(contextMenu.event.resource.appointment.id, status);
              }
              closeContextMenu();
            }}
            onCompleteWithPayment={() => {
              if (contextMenu.event) {
                onCompleteWithPayment(contextMenu.event);
              }
              closeContextMenu();
            }}
            onEdit={() => {
              if (contextMenu.event) {
                onSelectEvent(contextMenu.event);
              }
              closeContextMenu();
            }}
            onDelete={() => {
              if (contextMenu.event && onDeleteAppointment) {
                onDeleteAppointment(contextMenu.event.resource.appointment.id);
              }
              closeContextMenu();
            }}
          />

          {/* Overlay para fechar menu de contexto */}
          {contextMenu.show && (
            <div
              className="fixed inset-0 z-40"
              onClick={closeContextMenu}
            />
          )}
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col">
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        )}

        {/* Controles de navegação */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setDate(new Date())}
              className="px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              Hoje
            </button>
            <button
              onClick={() => setDate(moment(date).subtract(1, view === Views.DAY ? 'day' : 'week').toDate())}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setDate(moment(date).add(1, view === Views.DAY ? 'day' : 'week').toDate())}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView(Views.MONTH)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${view === Views.MONTH
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
            >
              Mês
            </button>
            <button
              onClick={() => setView(Views.WEEK)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${view === Views.WEEK
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
            >
              Semana
            </button>
            <button
              onClick={() => setView(Views.DAY)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${view === Views.DAY
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
            >
              Dia
            </button>
          </div>
        </div>

        {/* Título do período */}
        <div className="mb-4 text-center">
          <h2 className="text-lg font-bold text-gray-900">
            {view === Views.DAY
              ? moment(date).format('dddd, DD [de] MMMM [de] YYYY')
              : view === Views.WEEK
                ? `${moment(date).startOf('week').format('DD/MM')} - ${moment(date).endOf('week').format('DD/MM/YYYY')}`
                : moment(date).format('MMMM YYYY')
            }
          </h2>
        </div>

        {/* Legenda de cores */}
        <div className="mb-4">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
              <span className="truncate">Agendado</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
              <span className="truncate">Concluído</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></div>
              <span className="truncate">Cancelado</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-red-600 rounded-full flex-shrink-0"></div>
              <span className="truncate">Bloqueio</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-gray-500 rounded-full flex-shrink-0"></div>
              <span className="truncate">Não compareceu</span>
            </div>
          </div>
        </div>

        {/* Lista de agendamentos - área scrollável */}
        <div className="flex-1 overflow-y-auto -mx-3">
          <AppointmentsList
            events={getFilteredEvents()}
            onSelectEvent={onSelectEvent}
            onContextMenu={handleContextMenu}
            loading={loading}
          />
        </div>

        {/* Menu de contexto */}
        <AppointmentContextMenu
          show={contextMenu.show}
          x={contextMenu.x}
          y={contextMenu.y}
          event={contextMenu.event}
          onClose={closeContextMenu}
          onStatusChange={(status) => {
            if (contextMenu.event) {
              onStatusChange(contextMenu.event.resource.appointment.id, status);
            }
            closeContextMenu();
          }}
          onCompleteWithPayment={() => {
            if (contextMenu.event) {
              onCompleteWithPayment(contextMenu.event);
            }
            closeContextMenu();
          }}
          onEdit={() => {
            if (contextMenu.event) {
              onSelectEvent(contextMenu.event);
            }
            closeContextMenu();
          }}
          onDelete={() => {
            if (contextMenu.event && onDeleteAppointment) {
              onDeleteAppointment(contextMenu.event.resource.appointment.id);
            }
            closeContextMenu();
          }}
        />

        {/* Overlay para fechar menu de contexto */}
        {contextMenu.show && (
          <div
            className="fixed inset-0 z-10"
            onClick={closeContextMenu}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-full relative">
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      )}

      <div className="mb-1 flex flex-col md:flex-row md:items-center md:justify-between gap-1">
        {/* Navegação e título */}
        <div className="flex items-center space-x-3 overflow-x-auto">
          <button
            onClick={() => setDate(new Date())}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 whitespace-nowrap transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            Hoje
          </button>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setDate(moment(date).subtract(1, view === Views.MONTH ? 'month' : view === Views.WEEK ? 'week' : 'day').toDate())}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setDate(moment(date).add(1, view === Views.MONTH ? 'month' : view === Views.WEEK ? 'week' : 'day').toDate())}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <div className="flex-1 text-center">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 whitespace-nowrap">
              {view === Views.MONTH
                ? moment(date).format('MMMM YYYY')
                : view === Views.WEEK
                  ? isTablet
                    ? `${moment(date).startOf('week').format('DD/MM')} - ${moment(date).endOf('week').format('DD/MM')}`
                    : `${moment(date).startOf('week').format('DD/MM')} - ${moment(date).endOf('week').format('DD/MM/YYYY')}`
                  : moment(date).format('DD/MM/YYYY')
              }
            </h2>
          </div>
        </div>

        {/* Seletor de visualização */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView(Views.MONTH)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${view === Views.MONTH
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
          >
            Mês
          </button>
          <button
            onClick={() => setView(Views.WEEK)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${view === Views.WEEK
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
          >
            Semana
          </button>
          <button
            onClick={() => setView(Views.DAY)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${view === Views.DAY
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
          >
            Dia
          </button>
        </div>
      </div>

      {/* Legenda de cores */}
      <div className="mb-1 bg-gray-50 rounded-lg p-1.5">
        <div className="flex flex-wrap items-center justify-center gap-1.5 md:gap-2 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full shadow-sm"></div>
            <span className="font-medium text-gray-700">Agendado</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-gradient-to-r from-green-500 to-green-600 rounded-full shadow-sm"></div>
            <span className="font-medium text-gray-700">Concluído</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-gradient-to-r from-red-500 to-red-600 rounded-full shadow-sm"></div>
            <span className="font-medium text-gray-700">Cancelado</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-gradient-to-r from-red-600 to-red-700 rounded-full shadow-sm"></div>
            <span className="font-medium text-gray-700">Bloqueado</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-full shadow-sm"></div>
            <span className="font-medium text-gray-700">Não compareceu</span>
          </div>
        </div>
      </div>

      <div
        className="flex-1 min-h-0"
        style={{
          height: isTablet ? 'calc(100vh - 220px)' : 'calc(100vh - 200px)',
          minHeight: isTablet ? '350px' : '400px',
          maxHeight: isTablet ? 'calc(100vh - 220px)' : 'calc(100vh - 200px)'
        }}
      >
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          view={view}
          date={date}
          onView={setView}
          onNavigate={setDate}
          onSelectSlot={onSelectSlot}
          onSelectEvent={handleSelectEvent}
          onEventDrop={handleEventDrop}
          eventPropGetter={eventStyleGetter}
          selectable
          resizable={!isTablet}
          dragAndDropAccessor={() => !isTablet}
          messages={messages}
          formats={formats}
          min={minTime}
          max={maxTime}
          step={15}
          timeslots={4}
          popup
          popupOffset={30}
          components={{
            event: ({ event }) => (
              <div
                onContextMenu={(e) => handleContextMenu(event, e)}
                className="cursor-pointer p-1 h-full"
                data-status={event.resource.status}
              >
                <div className="font-semibold text-xs truncate leading-tight">
                  {event.resource.client}
                </div>
                {!isTablet && (
                  <div className="text-xs opacity-90 truncate leading-tight mt-0.5">
                    {event.resource.services ? event.resource.services.join(', ') : 
                     event.resource.isBlock ? (event.resource.blockData?.reason || 'Período Bloqueado') : 
                     'Sem serviços'}
                  </div>
                )}
              </div>
            )
          }}
        />
      </div>

      {/* Menu de contexto */}
      <AppointmentContextMenu
        show={contextMenu.show}
        x={contextMenu.x}
        y={contextMenu.y}
        event={contextMenu.event}
        onClose={closeContextMenu}
        onStatusChange={(status) => {
          if (contextMenu.event) {
            onStatusChange(contextMenu.event.resource.appointment.id, status);
          }
          closeContextMenu();
        }}
        onCompleteWithPayment={() => {
          if (contextMenu.event) {
            onCompleteWithPayment(contextMenu.event);
          }
          closeContextMenu();
        }}
        onEdit={() => {
          if (contextMenu.event) {
            onSelectEvent(contextMenu.event);
          }
          closeContextMenu();
        }}
        onDelete={() => {
          if (contextMenu.event && onDeleteAppointment) {
            onDeleteAppointment(contextMenu.event.resource.appointment.id);
          }
          closeContextMenu();
        }}
      />

      {/* Overlay para fechar menu de contexto */}
      {contextMenu.show && (
        <div
          className="fixed inset-0 z-10"
          onClick={closeContextMenu}
        />
      )}
    </div>
  );
};