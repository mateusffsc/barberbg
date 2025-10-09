import React from 'react';
import { Calendar, Clock, User, UserCheck, Phone, DollarSign, MoreVertical } from 'lucide-react';
import { CalendarEvent } from '../../types/appointment';
import { formatCurrency } from '../../utils/formatters';

interface AppointmentsListProps {
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onContextMenu: (event: CalendarEvent, e: React.MouseEvent) => void;
  loading?: boolean;
}

export const AppointmentsList: React.FC<AppointmentsListProps> = ({
  events,
  onSelectEvent,
  onContextMenu,
  loading = false
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'no_show': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Agendado';
      case 'completed': return 'Concluído';
      case 'cancelled': return 'Cancelado';
      case 'no_show': return 'Não compareceu';
      default: return 'Agendado';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="animate-pulse">
              <div className="flex items-center justify-between mb-3">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
                <div className="h-6 bg-gray-200 rounded-full w-20"></div>
              </div>
              <div className="h-5 bg-gray-200 rounded w-32 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-48 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-36"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum agendamento</h3>
        <p className="mt-1 text-sm text-gray-500">
          Não há agendamentos para o período selecionado.
        </p>
      </div>
    );
  }

  // Agrupar eventos por data
  const eventsByDate = events.reduce((acc, event) => {
    const dateKey = event.start.toDateString();
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  // Ordenar datas
  const sortedDates = Object.keys(eventsByDate).sort((a, b) => 
    new Date(a).getTime() - new Date(b).getTime()
  );

  return (
    <div className="space-y-6">
      {sortedDates.map(dateKey => {
        const dateEvents = eventsByDate[dateKey].sort((a, b) => 
          a.start.getTime() - b.start.getTime()
        );
        const date = new Date(dateKey);

        return (
          <div key={dateKey}>
            {/* Cabeçalho da data */}
            <div className="sticky top-0 bg-gray-50 px-3 py-2 border-b border-gray-200 mb-3 rounded-t-lg">
              <h3 className="text-sm font-medium text-gray-900 capitalize">
                {date.toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long'
                })}
              </h3>
              <p className="text-xs text-gray-500">
                {dateEvents.length} agendamento{dateEvents.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Cards dos agendamentos */}
            <div className="space-y-3 px-3">
              {dateEvents.map(event => (
                <div
                  key={event.id}
                  className={`rounded-lg border shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98] ${
                    event.resource.isBlock 
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-white border-gray-200'
                  }`}
                  onClick={() => onSelectEvent(event)}
                >
                  <div className="p-3">
                    {/* Header do card */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <Clock className="h-4 w-4 text-gray-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {formatTime(event.start)} - {formatTime(event.end)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          event.resource.isBlock 
                            ? 'bg-red-100 text-red-800 border-red-200'
                            : getStatusColor(event.resource.status)
                        }`}>
                          {event.resource.isBlock ? 'Bloqueio' : getStatusText(event.resource.status)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onContextMenu(event, e);
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Informações principais */}
                    <div className="space-y-2 mb-3">
                      {/* Cliente ou Título do Bloqueio */}
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {event.resource.isBlock ? event.title : event.resource.client}
                        </span>
                      </div>

                      {/* Barbeiro */}
                      <div className="flex items-center space-x-2">
                        <UserCheck className="h-4 w-4 text-gray-500 flex-shrink-0" />
                        <span className="text-sm text-gray-600 truncate">
                          {event.resource.barber}
                        </span>
                      </div>
                    </div>

                    {/* Serviços ou Motivo do Bloqueio */}
                    {!event.resource.isBlock ? (
                      <div className="mb-3">
                        <div className="flex flex-wrap gap-1">
                          {(event.resource.services || []).map((service, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 max-w-full truncate"
                            >
                              {service}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : event.resource.blockData?.reason && (
                      <div className="mb-3">
                        <div className="flex items-start space-x-2">
                          <span className="text-xs text-gray-500">Motivo:</span>
                          <span className="text-xs text-gray-700 flex-1">
                            {event.resource.blockData.reason}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Footer com total e duração */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      {!event.resource.isBlock ? (
                        <div className="flex items-center space-x-1">
                          <DollarSign className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="text-sm font-medium text-green-600">
                            {formatCurrency(event.resource.total)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1">
                          <span className="text-sm font-medium text-red-600">
                            Horário Bloqueado
                          </span>
                        </div>
                      )}
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {Math.round((event.end.getTime() - event.start.getTime()) / 60000)} min
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};