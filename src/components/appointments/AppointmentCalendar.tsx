import React, { useState, useCallback } from 'react';
import { Calendar, momentLocalizer, View, Views } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/pt-br';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../../styles/calendar-responsive.css';
import { CalendarEvent, AppointmentStatus } from '../../types/appointment';
import { AppointmentContextMenu } from './AppointmentContextMenu';
import { AppointmentsList } from './AppointmentsList';

// Configurar moment para português brasileiro
moment.locale('pt-br');
const localizer = momentLocalizer(moment);

interface AppointmentCalendarProps {
  events: CalendarEvent[];
  onSelectSlot: (slotInfo: { start: Date; end: Date }) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onEventDrop: (event: CalendarEvent, start: Date, end: Date) => void;
  loading?: boolean;
}

export const AppointmentCalendar: React.FC<AppointmentCalendarProps> = ({
  events,
  onSelectSlot,
  onSelectEvent,
  onEventDrop,
  loading = false
}) => {
  const [view, setView] = useState<View>(Views.WEEK);
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

  // Configuração de cores por status
  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const colors = {
      scheduled: { backgroundColor: '#3b82f6', borderColor: '#2563eb' }, // Azul
      completed: { backgroundColor: '#10b981', borderColor: '#059669' }, // Verde
      cancelled: { backgroundColor: '#ef4444', borderColor: '#dc2626' }, // Vermelho
      no_show: { backgroundColor: '#6b7280', borderColor: '#4b5563' }     // Cinza
    };

    const color = colors[event.resource.status] || colors.scheduled;

    return {
      style: {
        ...color,
        color: 'white',
        border: `2px solid ${color.borderColor}`,
        borderRadius: '4px',
        fontSize: '12px',
        padding: '2px 4px'
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
    dayHeaderFormat: 'dddd, DD/MM',
    dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
      `${moment(start).format('DD/MM')} - ${moment(end).format('DD/MM/YYYY')}`,
    timeGutterFormat: 'HH:mm',
    eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
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

  // Se for mobile, mostrar lista em vez de calendário
  if (isMobile) {
    return (
      <div className="h-full flex flex-col">
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        )}

        {/* Controles de navegação mobile */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setDate(new Date())}
              className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Hoje
            </button>
            <button
              onClick={() => setDate(moment(date).subtract(1, 'week').toDate())}
              className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              ←
            </button>
            <button
              onClick={() => setDate(moment(date).add(1, 'week').toDate())}
              className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              →
            </button>
          </div>
          <span className="text-sm font-medium text-gray-900">
            {moment(date).format('MMM YYYY')}
          </span>
        </div>

        {/* Legenda de cores para mobile */}
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
              <div className="w-2 h-2 bg-gray-500 rounded-full flex-shrink-0"></div>
              <span className="truncate">Não compareceu</span>
            </div>
          </div>
        </div>

        {/* Lista de agendamentos - área scrollável */}
        <div className="flex-1 overflow-y-auto -mx-3">
          <AppointmentsList
            events={events}
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
            // Implementar mudança de status
            closeContextMenu();
          }}
          onEdit={() => {
            if (contextMenu.event) {
              onSelectEvent(contextMenu.event);
            }
            closeContextMenu();
          }}
          onDelete={() => {
            // Implementar exclusão
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

      <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Navegação e título */}
        <div className="flex items-center space-x-2 overflow-x-auto">
          <button
            onClick={() => setDate(new Date())}
            className="px-2 md:px-3 py-1 text-xs md:text-sm border border-gray-300 rounded hover:bg-gray-50 whitespace-nowrap transition-colors"
          >
            Hoje
          </button>
          <button
            onClick={() => setDate(moment(date).subtract(1, view === Views.MONTH ? 'month' : view === Views.WEEK ? 'week' : 'day').toDate())}
            className="px-2 md:px-3 py-1 text-xs md:text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            ←
          </button>
          <button
            onClick={() => setDate(moment(date).add(1, view === Views.MONTH ? 'month' : view === Views.WEEK ? 'week' : 'day').toDate())}
            className="px-2 md:px-3 py-1 text-xs md:text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            →
          </button>
          <span className="text-sm md:text-lg font-medium text-gray-900 whitespace-nowrap">
            {view === Views.MONTH 
              ? moment(date).format('MMMM YYYY')
              : view === Views.WEEK
              ? isTablet 
                ? `${moment(date).startOf('week').format('DD/MM')} - ${moment(date).endOf('week').format('DD/MM')}`
                : `${moment(date).startOf('week').format('DD/MM')} - ${moment(date).endOf('week').format('DD/MM/YYYY')}`
              : moment(date).format('DD/MM/YYYY')
            }
          </span>
        </div>

        {/* Seletor de visualização */}
        <div className="flex items-center space-x-1 md:space-x-2">
          <button
            onClick={() => setView(Views.MONTH)}
            className={`px-2 md:px-3 py-1 text-xs md:text-sm rounded transition-colors ${
              view === Views.MONTH 
                ? 'bg-gray-900 text-white' 
                : 'border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Mês
          </button>
          <button
            onClick={() => setView(Views.WEEK)}
            className={`px-2 md:px-3 py-1 text-xs md:text-sm rounded transition-colors ${
              view === Views.WEEK 
                ? 'bg-gray-900 text-white' 
                : 'border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => setView(Views.DAY)}
            className={`px-2 md:px-3 py-1 text-xs md:text-sm rounded transition-colors ${
              view === Views.DAY 
                ? 'bg-gray-900 text-white' 
                : 'border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Dia
          </button>
        </div>
      </div>

      {/* Legenda de cores */}
      <div className="mb-4 flex flex-wrap items-center gap-3 md:gap-4 text-xs md:text-sm">
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 md:w-3 md:h-3 bg-blue-500 rounded flex-shrink-0"></div>
          <span className="whitespace-nowrap">Agendado</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 md:w-3 md:h-3 bg-green-500 rounded flex-shrink-0"></div>
          <span className="whitespace-nowrap">Concluído</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 md:w-3 md:h-3 bg-red-500 rounded flex-shrink-0"></div>
          <span className="whitespace-nowrap">Cancelado</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 md:w-3 md:h-3 bg-gray-500 rounded flex-shrink-0"></div>
          <span className="whitespace-nowrap">Não compareceu</span>
        </div>
      </div>

      <div 
        className="flex-1 min-h-0"
        style={{ 
          height: isTablet ? 'calc(100vh - 350px)' : 'calc(100vh - 300px)',
          minHeight: '400px'
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
          step={30}
          timeslots={2}
          popup
          popupOffset={30}
          components={{
            event: ({ event }) => (
              <div
                onContextMenu={(e) => handleContextMenu(event, e)}
                className="cursor-pointer p-1"
              >
                <div className="font-medium text-xs truncate">
                  {event.resource.client}
                </div>
                {!isTablet && (
                  <div className="text-xs opacity-90 truncate">
                    {event.resource.services.join(', ')}
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
          // Implementar mudança de status
          closeContextMenu();
        }}
        onEdit={() => {
          if (contextMenu.event) {
            onSelectEvent(contextMenu.event);
          }
          closeContextMenu();
        }}
        onDelete={() => {
          // Implementar exclusão
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