import React, { useState, useCallback } from 'react';
import { Calendar, momentLocalizer, View, Views } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/pt-br';
import 'react-big-calendar/lib/css/react-big-calendar.css';
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
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    event: CalendarEvent | null;
  }>({ show: false, x: 0, y: 0, event: null });

  // Detectar mudanças no tamanho da tela
  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
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
  maxTime.setHours(20, 0, 0);

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
      <div className="h-full">
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        )}

        <div className="mb-4 flex items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setDate(new Date())}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Hoje
            </button>
            <button
              onClick={() => setDate(moment(date).subtract(1, 'week').toDate())}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              ←
            </button>
            <button
              onClick={() => setDate(moment(date).add(1, 'week').toDate())}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              →
            </button>
          </div>
          <span className="text-sm font-medium">
            {moment(date).format('MMM YYYY')}
          </span>
        </div>

        {/* Legenda de cores para mobile */}
        <div className="mb-4 px-4">
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Agendado</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Concluído</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span>Cancelado</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
              <span>Não compareceu</span>
            </div>
          </div>
        </div>

        <AppointmentsList
          events={events}
          onSelectEvent={onSelectEvent}
          onContextMenu={handleContextMenu}
          loading={loading}
        />

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

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setDate(new Date())}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Hoje
          </button>
          <button
            onClick={() => setDate(moment(date).subtract(1, view === Views.MONTH ? 'month' : view === Views.WEEK ? 'week' : 'day').toDate())}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            ←
          </button>
          <button
            onClick={() => setDate(moment(date).add(1, view === Views.MONTH ? 'month' : view === Views.WEEK ? 'week' : 'day').toDate())}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            →
          </button>
          <span className="text-lg font-medium">
            {view === Views.MONTH 
              ? moment(date).format('MMMM YYYY')
              : view === Views.WEEK
              ? `${moment(date).startOf('week').format('DD/MM')} - ${moment(date).endOf('week').format('DD/MM/YYYY')}`
              : moment(date).format('DD/MM/YYYY')
            }
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setView(Views.MONTH)}
            className={`px-3 py-1 text-sm rounded ${view === Views.MONTH ? 'bg-gray-900 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}
          >
            Mês
          </button>
          <button
            onClick={() => setView(Views.WEEK)}
            className={`px-3 py-1 text-sm rounded ${view === Views.WEEK ? 'bg-gray-900 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}
          >
            Semana
          </button>
          <button
            onClick={() => setView(Views.DAY)}
            className={`px-3 py-1 text-sm rounded ${view === Views.DAY ? 'bg-gray-900 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}
          >
            Dia
          </button>
        </div>
      </div>

      {/* Legenda de cores */}
      <div className="mb-4 flex items-center space-x-4 text-sm">
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-blue-500 rounded"></div>
          <span>Agendado</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span>Concluído</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span>Cancelado</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-gray-500 rounded"></div>
          <span>Não compareceu</span>
        </div>
      </div>

      <div style={{ height: 'calc(100vh - 300px)' }}>
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
          resizable
          dragAndDropAccessor={() => true}
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
                className="cursor-pointer"
              >
                <div className="font-medium text-xs truncate">
                  {event.resource.client}
                </div>
                <div className="text-xs opacity-90 truncate">
                  {event.resource.services.join(', ')}
                </div>
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