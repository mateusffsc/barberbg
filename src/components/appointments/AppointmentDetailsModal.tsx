import React, { useState } from 'react';
import { X, Calendar, Clock, User, UserCheck, Scissors, FileText, DollarSign, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { CalendarEvent } from '../../types/appointment';
import { formatCurrency } from '../../utils/formatters';
import toast from 'react-hot-toast';

interface AppointmentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
  onStatusChange?: (appointmentId: number, newStatus: string) => Promise<void>;
  canChangeStatus?: boolean;
}

export const AppointmentDetailsModal: React.FC<AppointmentDetailsModalProps> = ({
  isOpen,
  onClose,
  event,
  onStatusChange,
  canChangeStatus = true
}) => {
  const [updating, setUpdating] = useState(false);
  if (!isOpen || !event) return null;

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

  const handleStatusChange = async (newStatus: string) => {
    if (!onStatusChange || !event) return;
    
    setUpdating(true);
    try {
      await onStatusChange(event.resource.appointment.id, newStatus);
      toast.success(`Status alterado para ${getStatusText(newStatus)}`);
      onClose();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status do agendamento');
    } finally {
      setUpdating(false);
    }
  };

  const canShowStatusButtons = canChangeStatus && event?.resource.status === 'scheduled';

  const duration = Math.round((event.end.getTime() - event.start.getTime()) / 60000);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900">
                Detalhes do Agendamento
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Status:</span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(event.resource.status)}`}>
                  {getStatusText(event.resource.status)}
                </span>
              </div>

              {/* Data e Hora */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Calendar className="h-5 w-5 text-gray-500" />
                  <span className="font-medium text-gray-900">
                    {event.start.toLocaleDateString('pt-BR', {
                      weekday: 'long',
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-gray-500" />
                  <span className="text-gray-700">
                    {formatTime(event.start)} - {formatTime(event.end)} ({duration} min)
                  </span>
                </div>
              </div>

              {/* Cliente */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">Cliente:</label>
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0 h-10 w-10 bg-gray-900 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{event.resource.client}</div>
                  </div>
                </div>
              </div>

              {/* Barbeiro */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">Barbeiro:</label>
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0 h-10 w-10 bg-gray-900 rounded-full flex items-center justify-center">
                    <UserCheck className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{event.resource.barber}</div>
                  </div>
                </div>
              </div>

              {/* Serviços */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Serviços:</label>
                <div className="space-y-2">
                  {event.resource.appointment.services?.map((service, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Scissors className="h-4 w-4 text-gray-500" />
                        <span className="font-medium text-gray-900">{service.name}</span>
                        {service.is_chemical && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Química
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-900">{formatCurrency(service.price)}</div>
                        <div className="text-xs text-gray-500">{service.duration_minutes} min</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Observações */}
              {event.resource.appointment.note && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Observações:</label>
                  <div className="flex items-start space-x-2 p-3 bg-gray-50 rounded-lg">
                    <FileText className="h-4 w-4 text-gray-500 mt-0.5" />
                    <span className="text-gray-700">{event.resource.appointment.note}</span>
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-medium text-gray-900">Total:</span>
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(event.resource.total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6">
            {canShowStatusButtons && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Alterar Status:</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleStatusChange('completed')}
                    disabled={updating}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Concluído
                  </button>
                  <button
                    onClick={() => handleStatusChange('cancelled')}
                    disabled={updating}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancelado
                  </button>
                  <button
                    onClick={() => handleStatusChange('no_show')}
                    disabled={updating}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Não Compareceu
                  </button>
                </div>
              </div>
            )}
            
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 sm:text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};