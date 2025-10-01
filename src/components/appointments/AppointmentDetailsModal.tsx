import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, UserCheck, Scissors, FileText, DollarSign, CheckCircle, XCircle, AlertCircle, Edit3, Save, RotateCcw, Trash2 } from 'lucide-react';
import { CalendarEvent } from '../../types/appointment';
import { PaymentMethod } from '../../types/payment';
import { PaymentConfirmationModal } from '../ui/PaymentConfirmationModal';
import { formatCurrency } from '../../utils/formatters';
import { Client } from '../../types/client';
import { Barber } from '../../types/barber';
import { Service } from '../../types/service';
import toast from 'react-hot-toast';
import RecurrenceActionModal from './RecurrenceActionModal';

interface AppointmentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
  onStatusChange?: (appointmentId: number, newStatus: string, paymentMethod?: PaymentMethod, finalAmount?: number) => Promise<void>;
  onUpdateAppointment?: (appointmentId: number, updateData: any) => Promise<void>;
  onDeleteBlock?: (blockId: number) => Promise<void>;
  onDeleteAppointment?: (appointmentId: number) => Promise<void>;
  onDeleteRecurringAppointments?: (recurrenceGroupId: string) => Promise<void>;
  onUpdateRecurringAppointments?: (recurrenceGroupId: string, updateData: any) => Promise<void>;
  canChangeStatus?: boolean;
  clients: Client[];
  barbers: Barber[];
  services: Service[];
}

export const AppointmentDetailsModal: React.FC<AppointmentDetailsModalProps> = ({
  isOpen,
  onClose,
  event,
  onStatusChange,
  onUpdateAppointment,
  onDeleteBlock,
  onDeleteAppointment,
  onDeleteRecurringAppointments,
  onUpdateRecurringAppointments,
  canChangeStatus = true,
  clients,
  barbers,
  services
}) => {
  const [updating, setUpdating] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const [recurrenceAction, setRecurrenceAction] = useState<'edit' | 'delete'>('delete');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    client_id: 0,
    barber_id: 0,
    service_ids: [] as number[],
    appointment_date: '',
    appointment_time: '',
    custom_duration: '',
    note: ''
  });
  
  // Inicializar dados de edição quando o evento mudar
  useEffect(() => {
    if (event && event.resource && !event.resource.isBlock) {
      const appointmentDate = new Date(event.start);
      setEditData({
        client_id: event.resource.appointment?.client_id || 0,
        barber_id: event.resource.appointment?.barber_id || 0,
        service_ids: event.resource.appointment?.services?.map(s => s.id) || [],
        appointment_date: appointmentDate.toISOString().split('T')[0],
        appointment_time: appointmentDate.toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        }),
        custom_duration: event.resource.appointment?.duration_minutes?.toString() || '',
        note: event.resource.appointment?.note || ''
      });
    }
  }, [event]);
  
  const handleDeleteBlock = async () => {
    if (!event?.resource.blockData?.id || !onDeleteBlock) return;
    
    try {
      await onDeleteBlock(event.resource.blockData.id);
      setShowDeleteConfirmation(false);
      onClose();
    } catch (error) {
      console.error('Erro ao excluir bloqueio:', error);
    }
  };

  const handleDeleteAppointment = async () => {
    if (!event?.resource.appointment?.id || !onDeleteAppointment) return;
    
    // Verificar se é um agendamento recorrente
    if (event.resource.appointment.recurrence_group_id) {
      setRecurrenceAction('delete');
      setShowRecurrenceModal(true);
      setShowDeleteConfirmation(false);
      return;
    }
    
    try {
      await onDeleteAppointment(event.resource.appointment.id);
      setShowDeleteConfirmation(false);
      onClose();
      toast.success('Agendamento excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir agendamento:', error);
      toast.error('Erro ao excluir agendamento');
    }
  };

  const handleRecurrenceAction = async (action: 'single' | 'all') => {
    if (!event?.resource.appointment) return;

    try {
      if (recurrenceAction === 'delete') {
        if (action === 'single') {
          // Excluir apenas este agendamento
          if (onDeleteAppointment) {
            await onDeleteAppointment(event.resource.appointment.id);
            toast.success('Agendamento excluído com sucesso!');
          }
        } else {
          // Excluir toda a série recorrente
          if (onDeleteRecurringAppointments && event.resource.appointment.recurrence_group_id) {
            await onDeleteRecurringAppointments(event.resource.appointment.recurrence_group_id);
          }
        }
      } else if (recurrenceAction === 'edit') {
        if (action === 'single') {
          // Editar apenas este agendamento
          if (onUpdateAppointment) {
            await onUpdateAppointment(event.resource.appointment.id, {
              client_id: editData.client_id,
              barber_id: editData.barber_id,
              service_ids: editData.service_ids,
              appointment_date: editData.appointment_date,
              appointment_time: editData.appointment_time,
              custom_duration: editData.custom_duration ? parseInt(editData.custom_duration) : null,
              note: editData.note
            });
            toast.success('Agendamento atualizado com sucesso!');
          }
        } else {
          // Editar toda a série recorrente
          if (onUpdateRecurringAppointments && event.resource.appointment.recurrence_group_id) {
            await onUpdateRecurringAppointments(event.resource.appointment.recurrence_group_id, {
              client_id: editData.client_id,
              barber_id: editData.barber_id,
              service_ids: editData.service_ids,
              note: editData.note
            });
          }
        }
        setIsEditing(false);
      }

      setShowRecurrenceModal(false);
      onClose();
    } catch (error) {
      console.error('Erro na ação de recorrência:', error);
      toast.error('Erro ao processar ação');
    }
  };
  
  if (!isOpen || !event) return null;

  // Se for um evento de bloqueio, mostrar modal específico
  if (event.resource.isBlock) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Bloqueio de Agenda</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="text-lg font-medium text-gray-900">Período Bloqueado</span>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">
                  {event.start.toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">
                  {event.start.toLocaleTimeString('pt-BR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })} - {event.end.toLocaleTimeString('pt-BR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <UserCheck className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">
                  {event.resource.barber}
                </span>
              </div>
              
              {event.resource.blockData?.reason && (
                <div className="flex items-start space-x-2">
                  <FileText className="h-4 w-4 text-gray-500 mt-0.5" />
                  <span className="text-sm text-gray-600">
                    {event.resource.blockData.reason}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-between p-6 border-t border-gray-200">
            <button
              onClick={() => setShowDeleteConfirmation(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 flex items-center space-x-2"
            >
              <Trash2 className="h-4 w-4" />
              <span>Excluir</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Fechar
            </button>
          </div>
        </div>
        
      </div>
    );
  }

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

  const handleStatusChange = async (newStatus: string, paymentMethod?: PaymentMethod, finalAmount?: number) => {
    if (!onStatusChange || !event) return;
    
    setUpdating(true);
    try {
      await onStatusChange(event.resource.appointment.id, newStatus, paymentMethod, finalAmount);
      toast.success(`Status alterado para ${getStatusText(newStatus)}`);
      onClose();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status do agendamento');
    } finally {
      setUpdating(false);
    }
  };

  const handleCompleteClick = () => {
    setShowPaymentModal(true);
  };

  const handlePaymentMethodSelect = (paymentMethod: PaymentMethod, finalAmount: number) => {
    setShowPaymentModal(false);
    handleStatusChange('completed', paymentMethod, finalAmount);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Resetar dados de edição
    if (event) {
      const appointmentDate = new Date(event.start);
      setEditData({
        client_id: event.resource.appointment.client_id || 0,
        barber_id: event.resource.appointment.barber_id || 0,
        service_ids: event.resource.appointment.services?.map(s => s.id) || [],
        appointment_date: appointmentDate.toISOString().split('T')[0],
        appointment_time: appointmentDate.toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        }),
        custom_duration: event.resource.appointment.duration_minutes?.toString() || '',
        note: event.resource.appointment.note || ''
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!onUpdateAppointment) return;
    
    // Validações
    if (!editData.client_id) {
      toast.error('Selecione um cliente');
      return;
    }
    
    if (!editData.barber_id) {
      toast.error('Selecione um barbeiro');
      return;
    }
    
    if (editData.service_ids.length === 0) {
      toast.error('Selecione pelo menos um serviço');
      return;
    }
    
    if (!editData.appointment_date) {
      toast.error('Selecione uma data');
      return;
    }
    
    if (!editData.appointment_time) {
      toast.error('Selecione um horário');
      return;
    }
    
    // Validação de data passada removida - permitindo edição para horários passados
    
    // Validar duração personalizada se fornecida
    if (editData.custom_duration && (parseInt(editData.custom_duration) < 5 || parseInt(editData.custom_duration) > 480)) {
      toast.error('Duração personalizada deve estar entre 5 e 480 minutos');
      return;
    }
    
    // Verificar se é um agendamento recorrente
    if (event?.resource.appointment?.recurrence_group_id) {
      setRecurrenceAction('edit');
      setShowRecurrenceModal(true);
      return;
    }
    
    setUpdating(true);
    try {
      const updateData = {
        client_id: editData.client_id,
        barber_id: editData.barber_id,
        service_ids: editData.service_ids,
        appointment_date: editData.appointment_date,
        appointment_time: editData.appointment_time,
        custom_duration: editData.custom_duration ? parseInt(editData.custom_duration) : null,
        note: editData.note
      };
      
      await onUpdateAppointment(event.resource.appointment.id, updateData);
      toast.success('Agendamento atualizado com sucesso!');
      setIsEditing(false);
      onClose();
    } catch (error) {
      toast.error('Erro ao atualizar agendamento');
    } finally {
      setUpdating(false);
    }
  };

  const handleServiceToggle = (serviceId: number) => {
    setEditData(prev => ({
      ...prev,
      service_ids: prev.service_ids.includes(serviceId)
        ? prev.service_ids.filter(id => id !== serviceId)
        : [...prev.service_ids, serviceId]
    }));
  };

  const calculateTotal = () => {
    return editData.service_ids.reduce((total, serviceId) => {
      const service = services.find(s => s.id === serviceId);
      return total + (service?.price || 0);
    }, 0);
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
                {isEditing ? 'Editar Agendamento' : 'Detalhes do Agendamento'}
              </h3>
              <div className="flex items-center gap-2">
                {!isEditing && onUpdateAppointment && (
                  <button
                    onClick={handleEdit}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Editar agendamento"
                  >
                    <Edit3 size={18} />
                  </button>
                )}
                {!isEditing && onDeleteAppointment && (
                  <button
                    onClick={() => setShowDeleteConfirmation(true)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Excluir agendamento"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {isEditing ? (
                /* Formulário de Edição */
                <div className="space-y-4">
                  {/* Cliente */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <User className="inline w-4 h-4 mr-1" />
                      Cliente
                    </label>
                    <select
                      value={editData.client_id}
                      onChange={(e) => setEditData(prev => ({ ...prev, client_id: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={0}>Selecione um cliente</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.name} - {client.phone}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Barbeiro */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <UserCheck className="inline w-4 h-4 mr-1" />
                      Barbeiro
                    </label>
                    <select
                      value={editData.barber_id}
                      onChange={(e) => setEditData(prev => ({ ...prev, barber_id: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={0}>Selecione um barbeiro</option>
                      {barbers.map(barber => (
                        <option key={barber.id} value={barber.id}>
                          {barber.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Data e Hora */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Calendar className="inline w-4 h-4 mr-1" />
                        Data
                      </label>
                      <input
                        type="date"
                        value={editData.appointment_date}
                        onChange={(e) => setEditData(prev => ({ ...prev, appointment_date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Clock className="inline w-4 h-4 mr-1" />
                        Horário
                      </label>
                      <input
                        type="time"
                        value={editData.appointment_time}
                        onChange={(e) => setEditData(prev => ({ ...prev, appointment_time: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Serviços */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Scissors className="inline w-4 h-4 mr-1" />
                      Serviços
                    </label>
                    <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                      {services.map(service => (
                        <label key={service.id} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editData.service_ids.includes(service.id)}
                            onChange={() => handleServiceToggle(service.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 flex-1">{service.name}</span>
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(service.price)}
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-2 text-right">
                      <span className="text-sm font-medium text-gray-900">
                        Total: {formatCurrency(calculateTotal())}
                      </span>
                    </div>
                  </div>

                  {/* Duração Personalizada */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Clock className="inline w-4 h-4 mr-1" />
                      Duração Personalizada (minutos)
                    </label>
                    <input
                      type="number"
                      value={editData.custom_duration}
                      onChange={(e) => setEditData(prev => ({ ...prev, custom_duration: e.target.value }))}
                      placeholder="Deixe vazio para usar duração padrão dos serviços"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Observações */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FileText className="inline w-4 h-4 mr-1" />
                      Observações
                    </label>
                    <textarea
                      value={editData.note}
                      onChange={(e) => setEditData(prev => ({ ...prev, note: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Observações sobre o agendamento..."
                    />
                  </div>
                </div>
              ) : (
                /* Visualização dos Detalhes */
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
                      {event.resource.appointment.barber?.is_special_barber && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Horário Especial
                        </span>
                      )}
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0 h-10 w-10 bg-gray-900 rounded-full flex items-center justify-center">
                          <UserCheck className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{event.resource.barber}</div>
                        </div>
                      </div>
                      {event.resource.appointment.barber?.is_special_barber && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Barbeiro Especial
                        </span>
                      )}
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
              )}
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6">
            {isEditing ? (
              /* Botões de Edição */
              <div className="flex justify-between">
                <button
                  onClick={handleCancelEdit}
                  disabled={updating}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={updating || editData.service_ids.length === 0}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updating ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            ) : (
              /* Botões de Visualização */
              <div>
                {canShowStatusButtons && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Alterar Status:</h4>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={handleCompleteClick}
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
            )}
          </div>
        </div>
      </div>

      <PaymentConfirmationModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onConfirm={handlePaymentMethodSelect}
        title="Finalizar Agendamento"
        originalAmount={event.resource.appointment.total_price}
        loading={updating}
      />

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <AlertCircle className="h-6 w-6 text-red-500" />
                <h3 className="text-lg font-semibold text-gray-900">Confirmar Exclusão</h3>
              </div>
              <p className="text-gray-600 mb-6">
                {event.resource.isBlock 
                  ? 'Tem certeza que deseja excluir este bloqueio? Esta ação não pode ser desfeita.'
                  : 'Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.'
                }
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirmation(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={event.resource.isBlock ? handleDeleteBlock : handleDeleteAppointment}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-red-600 rounded-md hover:bg-red-700 flex items-center space-x-2"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Excluir</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ação de Recorrência */}
      <RecurrenceActionModal
        isOpen={showRecurrenceModal}
        onClose={() => setShowRecurrenceModal(false)}
        onSingleAction={() => handleRecurrenceAction('single')}
        onAllAction={() => handleRecurrenceAction('all')}
        actionType={recurrenceAction}
        appointmentDate={event?.start ? new Date(event.start).toLocaleDateString('pt-BR') : ''}
      />
    </div>
  );
};