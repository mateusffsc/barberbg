import React, { useState, useEffect } from 'react';
import { X, Calendar, User, UserCheck, Scissors, FileText, DollarSign, Plus, Search } from 'lucide-react';
import { AppointmentFormData } from '../../types/appointment';
import { Client } from '../../types/client';
import { Barber } from '../../types/barber';
import { Service } from '../../types/service';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { supabase } from '../../lib/supabase';
import { formatPhone, validateEmail } from '../../utils/formatters';
import { toLocalDateTimeString, fromLocalDateTimeString } from '../../utils/dateHelpers';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AppointmentFormData, services: Service[], barber: Barber, recurrence?: any) => Promise<void>;
  clients: Client[];
  setClients: (clients: Client[]) => void;
  barbers: Barber[];
  services: Service[];
  selectedDate?: Date;
  loading?: boolean;
}

export const AppointmentModal: React.FC<AppointmentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  clients,
  setClients,
  barbers,
  services,
  selectedDate,
  loading = false
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<AppointmentFormData>({
    client_id: 0,
    barber_id: user?.role === 'barber' ? user.barber?.id || 0 : 0,
    appointment_datetime: '',
    service_ids: [],
    note: '',
    recurrence: {
      type: 'none',
      interval: 1,
      end_date: '',
      occurrences: 1
    }
  });
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [errors, setErrors] = useState<Partial<AppointmentFormData>>({});
  const [clientSearch, setClientSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientData, setNewClientData] = useState({
    name: '',
    phone: '',
    email: ''
  });
  const [newClientErrors, setNewClientErrors] = useState<any>({});
  const [creatingClient, setCreatingClient] = useState(false);

  useEffect(() => {
    if (selectedDate) {
      const dateStr = toLocalDateTimeString(selectedDate);
      setFormData(prev => ({ ...prev, appointment_datetime: dateStr }));
    }
  }, [selectedDate]);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        client_id: 0,
        barber_id: user?.role === 'barber' ? user.barber?.id || 0 : 0,
        appointment_datetime: selectedDate ? toLocalDateTimeString(selectedDate) : '',
        service_ids: [],
        note: '',
        recurrence: {
          type: 'none',
          interval: 1,
          end_date: '',
          occurrences: 1
        }
      });
      setSelectedServices([]);
      setClientSearch('');
      setServiceSearch('');
      setShowNewClientForm(false);
      setNewClientData({ name: '', phone: '', email: '' });
      setNewClientErrors({});
      setErrors({});
    }
  }, [isOpen, selectedDate, user]);

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  const selectedClient = clients.find(c => c.id === formData.client_id);
  const selectedBarber = barbers.find(b => b.id === formData.barber_id);

  const calculateTotal = () => {
    return selectedServices.reduce((sum, service) => sum + service.price, 0);
  };

  const calculateDuration = () => {
    if (!selectedBarber) {
      return selectedServices.reduce((sum, service) => sum + (service.duration_minutes_normal || 30), 0);
    }

    return selectedServices.reduce((sum, service) => {
      let serviceDuration;
      
      if (selectedBarber.is_special_barber) {
        // Barbeiro especial usa duration_minutes_special
        serviceDuration = service.duration_minutes_special || service.duration_minutes_normal || 30;
      } else {
        // Barbeiro normal usa duration_minutes_normal
        serviceDuration = service.duration_minutes_normal || 30;
      }
      
      return sum + serviceDuration;
    }, 0);
  };

  const handleServiceToggle = (service: Service) => {
    const isSelected = selectedServices.some(s => s.id === service.id);
    
    if (isSelected) {
      setSelectedServices(prev => prev.filter(s => s.id !== service.id));
      setFormData(prev => ({
        ...prev,
        service_ids: prev.service_ids.filter(id => id !== service.id)
      }));
    } else {
      setSelectedServices(prev => [...prev, service]);
      setFormData(prev => ({
        ...prev,
        service_ids: [...prev.service_ids, service.id]
      }));
    }
  };

  const validateNewClient = (): boolean => {
    const newErrors: any = {};

    if (!newClientData.name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    if (!newClientData.phone.trim()) {
      newErrors.phone = 'Telefone é obrigatório';
    }

    if (newClientData.email && !validateEmail(newClientData.email)) {
      newErrors.email = 'Email inválido';
    }

    setNewClientErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateNewClient()) {
      return;
    }

    setCreatingClient(true);
    
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert([{
          name: newClientData.name.trim(),
          phone: newClientData.phone.trim(),
          email: newClientData.email.trim() || null
        }])
        .select()
        .single();

      if (error) throw error;

      // Atualizar lista de clientes
      const newClient = data as Client;
      setClients([...clients, newClient]);

      // Selecionar o novo cliente automaticamente
      setFormData(prev => ({ ...prev, client_id: newClient.id }));
      setClientSearch(newClient.name);
      setShowClientDropdown(false);

      // Resetar formulário e fechar modal
      setNewClientData({ name: '', phone: '', email: '' });
      setNewClientErrors({});
      setShowNewClientForm(false);
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      setNewClientErrors({ general: 'Erro ao criar cliente. Tente novamente.' });
    } finally {
      setCreatingClient(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<AppointmentFormData> = {};

    if (!formData.client_id) {
      newErrors.client_id = 'Cliente é obrigatório' as any;
    }

    if (!formData.barber_id) {
      newErrors.barber_id = 'Barbeiro é obrigatório' as any;
    }

    if (!formData.appointment_datetime) {
      newErrors.appointment_datetime = 'Data e hora são obrigatórias' as any;
    }

    if (selectedServices.length === 0) {
      newErrors.service_ids = 'Selecione pelo menos um serviço' as any;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !selectedBarber) return;

    try {
      await onSubmit(formData, selectedServices, selectedBarber, formData.recurrence);
      onClose();
    } catch (error) {
      console.error('Erro ao salvar agendamento:', error);
    }
  };

  const handleClientSelect = (client: Client) => {
    setFormData(prev => ({ ...prev, client_id: client.id }));
    setClientSearch(client.name);
    setShowClientDropdown(false);
  };

  const getRecurrencePreview = () => {
    const rec = formData.recurrence;
    if (!rec || rec.type === 'none') return 'Sem recorrência';

    let preview = '';
    switch (rec.type) {
      case 'weekly':
        preview = 'Toda semana';
        break;
      case 'biweekly':
        preview = 'A cada 15 dias (quinzenal)';
        break;
      case 'monthly':
        preview = 'Todo mês';
        break;
    }

    // Calcular quantos agendamentos serão criados
    let totalAppointments = 1; // Incluir o agendamento inicial
    
    if (rec.occurrences && rec.occurrences > 1) {
      totalAppointments = Math.min(rec.occurrences, 52);
      preview += `, por ${rec.occurrences} vezes`;
    } else if (rec.end_date && formData.appointment_datetime) {
      // Calcular automaticamente quantos agendamentos até a data limite
      const startDate = new Date(formData.appointment_datetime);
      const endDate = new Date(rec.end_date);
      totalAppointments = calculateAppointmentsUntilDate(startDate, endDate, rec.type);
      preview += `, até ${new Date(rec.end_date).toLocaleDateString('pt-BR')}`;
    }

    preview += ` (${totalAppointments} agendamento${totalAppointments > 1 ? 's' : ''} no total)`;

    return preview;
  };

  // Função auxiliar para calcular agendamentos até data limite (para preview)
  const calculateAppointmentsUntilDate = (startDate: Date, endDate: Date, type: string): number => {
    let count = 1;
    const currentDate = new Date(startDate);
    
    while (currentDate < endDate && count < 52) {
      switch (type) {
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'biweekly':
          currentDate.setDate(currentDate.getDate() + 14);
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        default:
          return count;
      }
      
      if (currentDate <= endDate) {
        count++;
      }
    }
    
    return count;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full mx-4">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Novo Agendamento
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={loading}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Cliente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cliente *
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        setShowClientDropdown(true);
                        if (!e.target.value) {
                          setFormData(prev => ({ ...prev, client_id: 0 }));
                        }
                      }}
                      onFocus={() => setShowClientDropdown(true)}
                      className={`block w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent ${
                        errors.client_id ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Buscar cliente..."
                      disabled={loading}
                    />
                  
                  {showClientDropdown && clientSearch && (
                      <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto">
                        {filteredClients.length > 0 ? (
                          filteredClients.map((client) => (
                            <div
                              key={client.id}
                              className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100"
                              onClick={() => handleClientSelect(client)}
                            >
                              <span className="block truncate font-medium">{client.name}</span>
                              {client.phone && (
                                <span className="block text-sm text-gray-500">{client.phone}</span>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="py-2 pl-3 pr-9 text-gray-500">
                            Nenhum cliente encontrado
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setShowNewClientForm(true)}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2 whitespace-nowrap"
                    disabled={loading}
                  >
                    <Plus className="h-4 w-4" />
                    Novo Cliente
                  </button>
                </div>
                {errors.client_id && (
                  <p className="mt-1 text-sm text-red-600">{errors.client_id}</p>
                )}
              </div>

              {/* Barbeiro */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Barbeiro *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserCheck className="h-5 w-5 text-gray-400" />
                  </div>
                  <select
                    value={formData.barber_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, barber_id: parseInt(e.target.value) }))}
                    className={`block w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent ${
                      errors.barber_id ? 'border-red-300' : 'border-gray-300'
                    }`}
                    disabled={loading || user?.role === 'barber'}
                  >
                    <option value={0}>Selecione um barbeiro</option>
                    {barbers.map((barber) => (
                      <option key={barber.id} value={barber.id}>
                        {barber.name}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.barber_id && (
                  <p className="mt-1 text-sm text-red-600">{errors.barber_id}</p>
                )}
              </div>

              {/* Data e Hora */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data e Hora *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="datetime-local"
                    value={formData.appointment_datetime}
                    onChange={(e) => setFormData(prev => ({ ...prev, appointment_datetime: e.target.value }))}
                    className={`block w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent ${
                      errors.appointment_datetime ? 'border-red-300' : 'border-gray-300'
                    }`}
                    disabled={loading}
                  />
                </div>
                {errors.appointment_datetime && (
                  <p className="mt-1 text-sm text-red-600">{errors.appointment_datetime}</p>
                )}
              </div>

              {/* Serviços */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Serviços *
                </label>
                
                {/* Barra de pesquisa de serviços */}
                <div className="relative mb-3">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Pesquisar serviços..."
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
                
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {filteredServices.length > 0 ? (
                    filteredServices.map((service) => (
                      <label key={service.id} className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={selectedServices.some(s => s.id === service.id)}
                          onChange={() => handleServiceToggle(service)}
                          className="h-4 w-4 text-gray-900 focus:ring-gray-900 border-gray-300 rounded"
                          disabled={loading}
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">{service.name}</span>
                            <span className="text-sm text-gray-600">{formatCurrency(service.price)}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-xs text-gray-500">
                            {service.is_chemical && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                                Química
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    ))
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <Scissors className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">Nenhum serviço encontrado</p>
                    </div>
                  )}
                </div>
                {errors.service_ids && (
                  <p className="mt-1 text-sm text-red-600">{errors.service_ids}</p>
                )}
              </div>

              {/* Resumo */}
              {selectedServices.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Resumo</h4>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Duração total:</span>
                      <div className="flex items-center space-x-2">
                        <span>{calculateDuration()} minutos</span>
                        {selectedBarber?.is_special_barber && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Horário Especial
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between font-medium text-gray-900">
                      <span>Total:</span>
                      <span>{formatCurrency(calculateTotal())}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Observações */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <div className="relative">
                  <div className="absolute top-3 left-3 pointer-events-none">
                    <FileText className="h-5 w-5 text-gray-400" />
                  </div>
                  <textarea
                    value={formData.note}
                    onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                    rows={3}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    placeholder="Observações sobre o agendamento..."
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Recorrência */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Recorrência</h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de recorrência
                    </label>
                    <select
                      value={formData.recurrence?.type || 'none'}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        recurrence: {
                          ...prev.recurrence!,
                          type: e.target.value as any,
                          interval: e.target.value === 'biweekly' ? 2 : 1 // Define intervalo automático para quinzenal
                        }
                      }))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      disabled={loading}
                    >
                      <option value="none">Sem recorrência</option>
                      <option value="weekly">Semanal</option>
                      <option value="biweekly">Quinzenal</option>
                      <option value="monthly">Mensal</option>
                    </select>
                  </div>

                  {formData.recurrence?.type !== 'none' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Número de ocorrências
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="52"
                          value={formData.recurrence?.occurrences || 1}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            recurrence: {
                              ...prev.recurrence!,
                              occurrences: parseInt(e.target.value) || 1
                            }
                          }))}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                          placeholder="1"
                          disabled={loading || (formData.recurrence?.end_date ? true : false)}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {formData.recurrence?.end_date 
                            ? 'Será calculado automaticamente até a data limite' 
                            : 'Quantas vezes repetir este agendamento'
                          }
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Data limite (opcional)
                        </label>
                        <input
                          type="date"
                          value={formData.recurrence?.end_date || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            recurrence: {
                              ...prev.recurrence!,
                              end_date: e.target.value
                            }
                          }))}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                          disabled={loading}
                        />
                      </div>

                      {/* Preview da recorrência */}
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm text-blue-800">
                          <strong>Preview:</strong> {getRecurrencePreview()}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </form>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-gray-900 text-base font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                'Agendar'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
      
      {/* Modal de Novo Cliente */}
      {showNewClientForm && (
        <div className="fixed inset-0 z-60 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowNewClientForm(false)} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full mx-4">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Novo Cliente
                  </h3>
                  <button
                    onClick={() => setShowNewClientForm(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    disabled={creatingClient}
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <form onSubmit={handleCreateClient} className="space-y-4">
                  {/* Nome */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome *
                    </label>
                    <input
                      type="text"
                      value={newClientData.name}
                      onChange={(e) => setNewClientData(prev => ({ ...prev, name: e.target.value }))}
                      className={`block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent ${
                        newClientErrors.name ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Nome completo"
                      disabled={creatingClient}
                    />
                    {newClientErrors.name && (
                      <p className="mt-1 text-sm text-red-600">{newClientErrors.name}</p>
                    )}
                  </div>

                  {/* Telefone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telefone *
                    </label>
                    <input
                      type="tel"
                      value={newClientData.phone}
                      onChange={(e) => setNewClientData(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                      className={`block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent ${
                        newClientErrors.phone ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="(11) 99999-9999"
                      disabled={creatingClient}
                    />
                    {newClientErrors.phone && (
                      <p className="mt-1 text-sm text-red-600">{newClientErrors.phone}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email (opcional)
                    </label>
                    <input
                      type="email"
                      value={newClientData.email}
                      onChange={(e) => setNewClientData(prev => ({ ...prev, email: e.target.value }))}
                      className={`block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent ${
                        newClientErrors.email ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="email@exemplo.com"
                      disabled={creatingClient}
                    />
                    {newClientErrors.email && (
                      <p className="mt-1 text-sm text-red-600">{newClientErrors.email}</p>
                    )}
                  </div>
                </form>
                
                {newClientErrors.general && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{newClientErrors.general}</p>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="submit"
                  onClick={handleCreateClient}
                  disabled={creatingClient}
                  className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-gray-900 text-base font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingClient ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    'Criar Cliente'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewClientForm(false)}
                  disabled={creatingClient}
                  className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};