import React, { useState, useEffect } from 'react';
import { History, Calendar, Clock, User, UserCheck, Scissors, DollarSign, Filter, Search } from 'lucide-react';
import { useAppointments } from '../../hooks/useAppointments';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getPaymentMethodLabel, getPaymentMethodIcon } from '../../types/payment';
import { Appointment } from '../../types/appointment';

interface AppointmentHistoryProps {
  className?: string;
}

type FilterPeriod = 'day' | 'week' | 'month';

export const AppointmentHistory: React.FC<AppointmentHistoryProps> = ({ className }) => {
  const { user } = useAuth();
  const { fetchAppointments } = useAppointments();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<FilterPeriod>('month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  useEffect(() => {
    loadAppointmentHistory();
  }, [selectedPeriod, selectedDate]);

  const loadAppointmentHistory = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(selectedPeriod, selectedDate);
      
      // Para barbeiros, filtrar apenas seus agendamentos
      const barberId = user?.role === 'barber' ? user.barber?.id : undefined;
      const result = await fetchAppointments(startDate, endDate, barberId);
      
      // Filtrar apenas agendamentos concluídos e cancelados para o histórico
      const historyAppointments = result.appointments.filter(apt => 
        apt.status === 'completed' || apt.status === 'cancelled' || apt.status === 'no_show'
      );
      
      setAppointments(historyAppointments);
    } catch (error) {
      console.error('Erro ao carregar histórico de agendamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = (period: FilterPeriod, baseDate: Date) => {
    const start = new Date(baseDate);
    const end = new Date(baseDate);

    switch (period) {
      case 'day':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        const dayOfWeek = start.getDay();
        start.setDate(start.getDate() - dayOfWeek);
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case 'month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
        break;
    }

    return { startDate: start, endDate: end };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'no_show': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluído';
      case 'cancelled': return 'Cancelado';
      case 'no_show': return 'Não compareceu';
      default: return status;
    }
  };

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'day': return selectedDate.toLocaleDateString('pt-BR');
      case 'week': {
        const { startDate, endDate } = getDateRange('week', selectedDate);
        return `${startDate.toLocaleDateString('pt-BR')} - ${endDate.toLocaleDateString('pt-BR')}`;
      }
      case 'month': {
        return selectedDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      }
    }
  };

  const filteredAppointments = appointments.filter(appointment =>
    !searchTerm || 
    appointment.client?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    appointment.barber?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    
    switch (selectedPeriod) {
      case 'day':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
    }
    
    setSelectedDate(newDate);
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <History className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Histórico de Agendamentos</h3>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          {/* Period Filter */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Período:</span>
              <div className="flex items-center space-x-2">
                {(['day', 'week', 'month'] as FilterPeriod[]).map((period) => (
                  <button
                    key={period}
                    onClick={() => setSelectedPeriod(period)}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      selectedPeriod === period
                        ? 'bg-blue-100 text-blue-800 font-medium'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {period === 'day' ? 'Dia' : period === 'week' ? 'Semana' : 'Mês'}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Navigation */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigatePeriod('prev')}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                ←
              </button>
              <span className="text-sm font-medium text-gray-900 min-w-48 text-center">
                {getPeriodLabel()}
              </span>
              <button
                onClick={() => navigatePeriod('next')}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                →
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar por cliente ou barbeiro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* History List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <History className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p>Nenhum agendamento encontrado para o período selecionado</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  {/* Main Info */}
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(appointment.status)}`}>
                        {getStatusText(appointment.status)}
                      </span>
                      {appointment.payment_method && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <span className="mr-1">{getPaymentMethodIcon(appointment.payment_method)}</span>
                          {getPaymentMethodLabel(appointment.payment_method)}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      {/* Date/Time */}
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-900">
                          {formatDate(appointment.appointment_datetime)}
                        </span>
                        <Clock className="h-4 w-4 text-gray-500 ml-2" />
                        <span className="text-sm text-gray-900">
                          {new Date(appointment.appointment_datetime).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      {/* Client */}
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-900">
                          {appointment.client?.name || 'Cliente não informado'}
                        </span>
                      </div>

                      {/* Barber */}
                      <div className="flex items-center space-x-2">
                        <UserCheck className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-900">
                          {appointment.barber?.name}
                        </span>
                      </div>

                      {/* Services */}
                      <div className="flex items-center space-x-2">
                        <Scissors className="h-4 w-4 text-gray-500" />
                        <div className="flex flex-wrap gap-1">
                          {appointment.services?.map((service, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800"
                            >
                              {service.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Note */}
                    {appointment.note && (
                      <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        <span className="font-medium">Observação:</span> {appointment.note}
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  <div className="text-right ml-4">
                    <div className="flex items-center space-x-1 text-lg font-bold text-green-600">
                      <DollarSign className="h-5 w-5" />
                      <span>{formatCurrency(appointment.total_price || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};