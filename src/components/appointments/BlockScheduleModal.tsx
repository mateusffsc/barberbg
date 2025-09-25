import React, { useState, useEffect } from 'react';
import { X, Lock, Calendar, Clock, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useBarbers } from '../../hooks/useBarbers';

interface BlockScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBlock: (blockData: BlockData) => Promise<void>;
}

interface BlockData {
  date: string;
  start_time: string;
  end_time: string;
  reason?: string;
  barber_id?: number;
}

export const BlockScheduleModal: React.FC<BlockScheduleModalProps> = ({
  isOpen,
  onClose,
  onBlock
}) => {
  const { user } = useAuth();
  const { fetchBarbers } = useBarbers();
  const [barbers, setBarbers] = useState<any[]>([]);
  const [blockData, setBlockData] = useState<BlockData>({
    date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '10:00',
    reason: '',
    barber_id: undefined
  });
  const [loading, setLoading] = useState(false);

  // Carregar barbeiros quando o modal abrir
  useEffect(() => {
    if (isOpen) {
      loadBarbers();
    }
  }, [isOpen]);

  // Definir barbeiro automaticamente para usuários barbeiros
  useEffect(() => {
    if (isOpen && user?.role === 'barber' && barbers.length > 0) {
      const currentBarber = barbers.find(barber => barber.user_id === user.id);
      if (currentBarber) {
        setBlockData(prev => ({
          ...prev,
          barber_id: currentBarber.id
        }));
      }
    }
  }, [isOpen, user, barbers]);

  const loadBarbers = async () => {
    try {
      const result = await fetchBarbers(1, '', 1000);
      
      // Atualizar o estado local com os barbeiros carregados
      if (result.barbers && result.barbers.length > 0) {
        setBarbers(result.barbers);
      }
    } catch (error) {
      console.error('Erro ao carregar barbeiros:', error);
      toast.error('Erro ao carregar barbeiros');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!blockData.date || !blockData.start_time || !blockData.end_time) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (blockData.start_time >= blockData.end_time) {
      toast.error('O horário de início deve ser anterior ao horário de fim');
      return;
    }

    // Validar seleção de barbeiro para admins
    if (user?.role === 'admin' && !blockData.barber_id) {
      toast.error('Selecione um barbeiro para o bloqueio');
      return;
    }

    setLoading(true);
    try {
      await onBlock(blockData);
      toast.success('Período bloqueado com sucesso!');
      onClose();
      // Reset form
      setBlockData({
        date: new Date().toISOString().split('T')[0],
        start_time: '09:00',
        end_time: '10:00',
        reason: '',
        barber_id: user?.role === 'barber' ? blockData.barber_id : undefined
      });
    } catch (error) {
      console.error('Erro ao bloquear período:', error);
      toast.error('Erro ao bloquear período');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof BlockData, value: string | number | undefined) => {
    setBlockData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Lock className="h-5 w-5 mr-2 text-red-600" />
                Bloquear Agenda
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={loading}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Seleção de Barbeiro (apenas para admins) */}
              {user?.role === 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <User className="h-4 w-4 inline mr-1" />
                    Barbeiro *
                  </label>
                  <select
                    value={blockData.barber_id || ''}
                    onChange={(e) => handleInputChange('barber_id', e.target.value ? parseInt(e.target.value) : undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    required
                  >
                    <option value="">Selecione um barbeiro</option>
                    {barbers.map((barber) => (
                      <option key={barber.id} value={barber.id}>
                        {barber.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Informação para barbeiros */}
              {user?.role === 'barber' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex">
                    <User className="h-5 w-5 text-blue-400 flex-shrink-0" />
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-blue-800">
                        Bloqueio pessoal
                      </h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Este bloqueio será aplicado apenas à sua agenda.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Data */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Data *
                </label>
                <input
                  type="date"
                  value={blockData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>

              {/* Horário de Início */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Clock className="h-4 w-4 inline mr-1" />
                  Horário de Início *
                </label>
                <input
                  type="time"
                  value={blockData.start_time}
                  onChange={(e) => handleInputChange('start_time', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>

              {/* Horário de Fim */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Clock className="h-4 w-4 inline mr-1" />
                  Horário de Fim *
                </label>
                <input
                  type="time"
                  value={blockData.end_time}
                  onChange={(e) => handleInputChange('end_time', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>

              {/* Motivo (opcional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo do Bloqueio (opcional)
                </label>
                <textarea
                  value={blockData.reason}
                  onChange={(e) => handleInputChange('reason', e.target.value)}
                  placeholder="Ex: Almoço, Reunião, Manutenção..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                />
              </div>

              {/* Informação sobre o bloqueio */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex">
                  <Lock className="h-5 w-5 text-red-400 flex-shrink-0" />
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-red-800">
                      Sobre o bloqueio de agenda
                    </h4>
                    <p className="text-sm text-red-700 mt-1">
                      Este período ficará indisponível para novos agendamentos. 
                      Agendamentos já existentes não serão afetados.
                    </p>
                  </div>
                </div>
              </div>
            </form>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Lock className="h-4 w-4 mr-2" />
              {loading ? 'Bloqueando...' : 'Bloquear Período'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};