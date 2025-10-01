import React from 'react';
import { X, Clock, User, AlertTriangle } from 'lucide-react';

interface ConflictInfo {
  date: Date;
  conflicts: Array<{
    id: number;
    client_name: string;
    appointment_datetime: string;
    duration_minutes: number;
  }>;
}

import { formatTimeFromISO } from '../../utils/dateHelpers';

interface ConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  conflictData: {
    hasConflict: boolean;
    conflictingAppointments: Array<{
      id: number;
      appointment_datetime: string;
      client_name: string;
      barber_name: string;
      service_names: string;
      duration_minutes: number;
    }>;
    newAppointment: {
      appointment_datetime: string;
      client_name: string;
      barber_name: string;
      service_names: string;
      duration_minutes: number;
    };
  } | null;
  loading?: boolean;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  conflictData,
  loading = false
}) => {
  if (!isOpen || !conflictData || !conflictData.hasConflict) return null;

  const formatTime = (dateString: string) => {
    return formatTimeFromISO(dateString);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Conflito de Horário Detectado
              </h2>
              <p className="text-sm text-gray-500">
                Há agendamentos que se sobrepõem ao horário solicitado
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Novo Agendamento */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-medium text-blue-900 mb-3 flex items-center">
              <User className="w-5 h-5 mr-2" />
              Novo Agendamento
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-blue-800">Cliente:</span>
                <span className="ml-2 text-blue-700">{conflictData.newAppointment.client_name || 'Cliente não informado'}</span>
              </div>
              <div>
                <span className="font-medium text-blue-800">Barbeiro:</span>
                <span className="ml-2 text-blue-700">{conflictData.newAppointment.barber_name || 'Barbeiro não informado'}</span>
              </div>
              <div>
                <span className="font-medium text-blue-800">Serviços:</span>
                <span className="ml-2 text-blue-700">{conflictData.newAppointment.services_names || 'Serviços não informados'}</span>
              </div>
              <div>
                <span className="font-medium text-blue-800">Horário:</span>
                <span className="ml-2 text-blue-700">
                  {formatTime(conflictData.newAppointment.appointment_datetime)} 
                  ({conflictData.newAppointment.duration_minutes || 60} min)
                </span>
              </div>
            </div>
          </div>

          {/* Conflitos */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-red-500" />
              Agendamentos em Conflito
            </h3>
            
            <div className="space-y-3">
              {conflictData.conflictingAppointments.map((conflict, index) => (
                <div key={conflict.id} className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="font-medium text-red-800">Cliente:</span>
                      <span className="ml-2 text-red-700">{conflict.client_name || 'Cliente não informado'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-red-800">Horário:</span>
                      <span className="ml-2 text-red-700">
                        {formatTime(conflict.appointment_datetime)}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-red-800">Duração:</span>
                      <span className="ml-2 text-red-700">
                        {conflict.duration_minutes || 30} min
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Aviso */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Atenção:</p>
                <p>
                  Ao confirmar este encaixe, os horários irão se sobrepor. 
                  Certifique-se de que há tempo suficiente para atender ambos os clientes 
                  ou considere reagendar um dos atendimentos.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors disabled:opacity-50"
          >
            {loading ? 'Confirmando...' : 'Confirmar Encaixe'}
          </button>
        </div>
      </div>
    </div>
  );
};