import React, { useState, useEffect } from 'react';
import { X, User, Phone, Mail, Calendar, DollarSign, Clock, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface ClientHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: number | null;
}

interface ClientDetails {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  created_at: string;
}

interface AppointmentHistory {
  id: number;
  appointment_datetime: string;
  status: string;
  total_price: number;
  final_amount?: number;
  barber: {
    name: string;
  };
  services: Array<{
    name: string;
    price: number;
  }>;
}

interface ClientStats {
  totalAppointments: number;
  totalSpent: number;
  completedAppointments: number;
  cancelledAppointments: number;
  averageTicket: number;
}

export const ClientHistoryModal: React.FC<ClientHistoryModalProps> = ({
  isOpen,
  onClose,
  clientId
}) => {
  const [client, setClient] = useState<ClientDetails | null>(null);
  const [appointments, setAppointments] = useState<AppointmentHistory[]>([]);
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && clientId) {
      loadClientData();
    }
  }, [isOpen, clientId]);

  const loadClientData = async () => {
    if (!clientId) return;
    
    setLoading(true);
    try {
      // Buscar dados do cliente
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (clientError) throw clientError;
      setClient(clientData);

      // Buscar histórico de agendamentos
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_datetime,
          status,
          total_price,
          final_amount,
          barber:barbers(name),
          appointment_services(
            service:services(name, price)
          )
        `)
        .eq('client_id', clientId)
        .order('appointment_datetime', { ascending: false });

      if (appointmentsError) throw appointmentsError;

      // Transformar dados dos agendamentos
      const formattedAppointments = appointmentsData.map(apt => ({
        ...apt,
        services: apt.appointment_services?.map((as: any) => ({
          name: as.service.name,
          price: as.service.price
        })) || []
      }));

      setAppointments(formattedAppointments);

      // Calcular estatísticas
      const totalAppointments = appointmentsData.length;
      const completedAppointments = appointmentsData.filter(apt => apt.status === 'completed').length;
      const cancelledAppointments = appointmentsData.filter(apt => apt.status === 'cancelled').length;
      const totalSpent = appointmentsData
        .filter(apt => apt.status === 'completed')
        .reduce((sum, apt) => sum + (apt.final_amount || apt.total_price), 0);
      const averageTicket = completedAppointments > 0 ? totalSpent / completedAppointments : 0;

      setStats({
        totalAppointments,
        totalSpent,
        completedAppointments,
        cancelledAppointments,
        averageTicket
      });

    } catch (error) {
      console.error('Erro ao carregar dados do cliente:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'no_show': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900">
                Histórico do Cliente
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : client ? (
              <div className="space-y-6">
                {/* Informações do Cliente */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="h-16 w-16 bg-gray-900 rounded-full flex items-center justify-center">
                      <User className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-900">{client.name}</h4>
                      <p className="text-sm text-gray-500">
                        Cliente desde {formatDate(client.created_at)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {client.phone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-700">{client.phone}</span>
                      </div>
                    )}
                    {client.email && (
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-700">{client.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Estatísticas */}
                {stats && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-blue-600">{stats.totalAppointments}</div>
                      <div className="text-sm text-blue-800">Total de Agendamentos</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-green-600">{stats.completedAppointments}</div>
                      <div className="text-sm text-green-800">Concluídos</div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-red-600">{stats.cancelledAppointments}</div>
                      <div className="text-sm text-red-800">Cancelados</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-purple-600">{formatCurrency(stats.totalSpent)}</div>
                      <div className="text-sm text-purple-800">Total Gasto</div>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-yellow-600">{formatCurrency(stats.averageTicket)}</div>
                      <div className="text-sm text-yellow-800">Ticket Médio</div>
                    </div>
                  </div>
                )}

                {/* Histórico de Agendamentos */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Histórico de Agendamentos</h4>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {appointments.length > 0 ? (
                      appointments.map((appointment) => (
                        <div key={appointment.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <Calendar className="h-4 w-4 text-gray-500" />
                              <span className="font-medium text-gray-900">
                                {new Date(appointment.appointment_datetime).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })}
                              </span>
                              <span className="text-gray-500">
                                {new Date(appointment.appointment_datetime).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                              {getStatusText(appointment.status)}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">
                              Barbeiro: {appointment.barber.name}
                            </span>
                            <div className="flex items-center space-x-1">
                              <DollarSign className="h-4 w-4 text-green-600" />
                              <span className="font-medium text-green-600">
                                {formatCurrency(appointment.final_amount || appointment.total_price)}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-1">
                            {appointment.services.map((service, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800"
                              >
                                {service.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        Nenhum agendamento encontrado
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Cliente não encontrado
              </div>
            )}
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={onClose}
              className="w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 sm:mt-0 sm:w-auto sm:text-sm"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};