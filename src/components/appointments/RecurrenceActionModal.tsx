import React from 'react';
import { X, Calendar, CalendarDays } from 'lucide-react';

interface RecurrenceActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSingleAction: () => void;
  onAllAction: () => void;
  actionType: 'edit' | 'delete';
  appointmentDate: string;
}

export default function RecurrenceActionModal({
  isOpen,
  onClose,
  onSingleAction,
  onAllAction,
  actionType,
  appointmentDate
}: RecurrenceActionModalProps) {
  if (!isOpen) return null;

  const actionText = actionType === 'edit' ? 'editar' : 'excluir';
  const actionTextCapitalized = actionType === 'edit' ? 'Editar' : 'Excluir';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {actionTextCapitalized} Agendamento Recorrente
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-600 mb-6">
            Este agendamento faz parte de uma série recorrente. Como você gostaria de proceder?
          </p>

          <div className="space-y-3">
            <button
              onClick={onSingleAction}
              className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <Calendar className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium text-gray-900">
                    {actionTextCapitalized} apenas este agendamento
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(appointmentDate).toLocaleDateString('pt-BR', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={onAllAction}
              className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <CalendarDays className="h-5 w-5 text-orange-600" />
                <div>
                  <div className="font-medium text-gray-900">
                    {actionTextCapitalized} toda a série recorrente
                  </div>
                  <div className="text-sm text-gray-500">
                    Todos os agendamentos desta série serão {actionType === 'edit' ? 'editados' : 'excluídos'}
                  </div>
                </div>
              </div>
            </button>
          </div>

          {actionType === 'delete' && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>Atenção:</strong> A exclusão de agendamentos não pode ser desfeita.
              </p>
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-6 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}