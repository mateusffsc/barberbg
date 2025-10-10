import React from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';

interface DeleteRecurringBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: (deleteType: 'single' | 'future' | 'all') => Promise<void>;
  blockInfo: {
    date: string;
    startTime: string;
    endTime: string;
    reason?: string;
    isRecurring: boolean;
  };
  loading: boolean;
}

export const DeleteRecurringBlockModal: React.FC<DeleteRecurringBlockModalProps> = ({
  isOpen,
  onClose,
  onDelete,
  blockInfo,
  loading
}) => {
  const handleDelete = async (deleteType: 'single' | 'future' | 'all') => {
    await onDelete(deleteType);
  };

  if (!isOpen) return null;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const formatTime = (timeStr: string) => {
    return timeStr.substring(0, 5);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Trash2 className="h-5 w-5 mr-2 text-red-600" />
                Excluir Bloqueio
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={loading}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Informações do bloqueio */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-gray-900 mb-2">Detalhes do bloqueio:</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p><strong>Data:</strong> {formatDate(blockInfo.date)}</p>
                <p><strong>Horário:</strong> {formatTime(blockInfo.startTime)} - {formatTime(blockInfo.endTime)}</p>
                {blockInfo.reason && <p><strong>Motivo:</strong> {blockInfo.reason}</p>}
                <p><strong>Tipo:</strong> {blockInfo.isRecurring ? 'Bloqueio recorrente' : 'Bloqueio único'}</p>
              </div>
            </div>

            {blockInfo.isRecurring ? (
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <div className="flex">
                    <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-yellow-800">
                        Este é um bloqueio recorrente
                      </h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        Escolha como deseja proceder com a exclusão:
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => handleDelete('single')}
                    disabled={loading}
                    className="w-full text-left p-4 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="font-medium text-gray-900">Excluir apenas este bloqueio</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Remove apenas o bloqueio de {formatDate(blockInfo.date)}. Os outros bloqueios da série permanecerão.
                    </div>
                  </button>

                  <button
                    onClick={() => handleDelete('future')}
                    disabled={loading}
                    className="w-full text-left p-4 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="font-medium text-gray-900">Excluir este e bloqueios futuros</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Remove este bloqueio e todos os bloqueios futuros da série. Bloqueios passados permanecerão.
                    </div>
                  </button>

                  <button
                    onClick={() => handleDelete('all')}
                    disabled={loading}
                    className="w-full text-left p-4 border border-red-300 rounded-lg hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="font-medium text-red-900">Excluir toda a série</div>
                    <div className="text-sm text-red-700 mt-1">
                      Remove todos os bloqueios desta série recorrente (passados, presente e futuros).
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex">
                    <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-red-800">
                        Confirmar exclusão
                      </h4>
                      <p className="text-sm text-red-700 mt-1">
                        Esta ação não pode ser desfeita. O bloqueio será removido permanentemente.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => handleDelete('single')}
                    disabled={loading}
                    className="flex-1 inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {loading ? 'Excluindo...' : 'Excluir Bloqueio'}
                  </button>
                  <button
                    onClick={onClose}
                    disabled={loading}
                    className="flex-1 inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};