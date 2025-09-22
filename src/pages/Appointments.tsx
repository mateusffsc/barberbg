import React, { useState, useEffect } from 'react';
import { Calendar, Plus, RefreshCw, CheckCircle2, History, Lock } from 'lucide-react';
import { useAppointments } from '../hooks/useAppointments';
import { useClients } from '../hooks/useClients';
import { useBarbers } from '../hooks/useBarbers';
import { useServices } from '../hooks/useServices';
import { AppointmentCalendar } from '../components/appointments/AppointmentCalendar';
import { AppointmentModal } from '../components/appointments/AppointmentModal';
import { AppointmentDetailsModal } from '../components/appointments/AppointmentDetailsModal';
import { AppointmentHistory } from '../components/appointments/AppointmentHistory';
import { PaymentMethodModal } from '../components/ui/PaymentMethodModal';
import { ConflictModal } from '../components/appointments/ConflictModal';
import { BlockScheduleModal } from '../components/appointments/BlockScheduleModal';
import { CalendarEvent } from '../types/appointment';
import { PaymentMethod } from '../types/payment';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';

export const Appointments: React.FC = () => {
  const { user } = useAuth();
  const {
    appointments,
    setAppointments,
    fetchAppointments,
    createAppointment,
    updateAppointment,
    updateAppointmentStatus,
    convertToCalendarEvents,
    createScheduleBlock
  } = useAppointments();

  const {
    clients,
    setClients,
    fetchClients
  } = useClients();

  const {
    barbers,
    setBarbers,
    fetchBarbers
  } = useBarbers();

  const {
    services,
    setServices,
    fetchServices
  } = useServices();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [modalLoading, setModalLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completingAll, setCompletingAll] = useState(false);
  const [selectedBarberId, setSelectedBarberId] = useState<number | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [appointmentToComplete, setAppointmentToComplete] = useState<CalendarEvent | null>(null);
  const [activeTab, setActiveTab] = useState<'calendar' | 'history'>('calendar');
  const [showBlockModal, setShowBlockModal] = useState(false);
  
  // Estados para modal de conflito
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictData, setConflictData] = useState<any>(null);
  const [pendingAppointmentData, setPendingAppointmentData] = useState<any>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    // Converter agendamentos para eventos do calendário
    const convertEvents = async () => {
      const calendarEvents = await convertToCalendarEvents(appointments, selectedBarberId || undefined);
      setEvents(calendarEvents);
    };
    
    convertEvents();
  }, [appointments, selectedBarberId]);

  useEffect(() => {
    // Recarregar agendamentos quando o filtro de barbeiro mudar
    if (!loading) {
      loadAppointments();
    }
  }, [selectedBarberId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadAppointments(),
        loadClients(),
        loadBarbers(),
        loadServices()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // Funções para modal de conflito
  const handleConflictConfirm = async () => {
    if (!pendingAppointmentData) return;
    
    setModalLoading(true);
    try {
      const { formData, selectedServices, selectedBarber, recurrence } = pendingAppointmentData;
      
      // Criar agendamento com allowOverlap = true
      const appointment = await createAppointment(formData, selectedServices, selectedBarber, recurrence, true);
      
      if (appointment) {
        await loadAppointments();
        setIsModalOpen(false);
        setConflictModalOpen(false);
        toast.success('Agendamento criado com encaixe!');
      }
    } catch (error) {
      console.error('Erro ao criar agendamento com encaixe:', error);
      toast.error('Erro ao criar agendamento com encaixe');
    } finally {
      setModalLoading(false);
      setPendingAppointmentData(null);
      setConflictData(null);
    }
  };

  const handleConflictCancel = () => {
    setConflictModalOpen(false);
    setPendingAppointmentData(null);
    setConflictData(null);
  };

  // Função para lidar com bloqueio de agenda
  const handleBlockSchedule = async (blockData: { date: string; start_time: string; end_time: string; reason?: string; barber_id?: number }) => {
    try {
      const success = await createScheduleBlock({
        date: blockData.date,
        startTime: blockData.start_time,
        endTime: blockData.end_time,
        reason: blockData.reason,
        barberId: blockData.barber_id
      });
      
      if (success) {
        setShowBlockModal(false);
        // Recarregar agendamentos para refletir o bloqueio
        await loadAppointments();
      }
    } catch (error) {
      console.error('Erro ao criar bloqueio:', error);
      toast.error('Erro ao bloquear período');
    }
  };

  const loadAppointments = async () => {
    try {
      // Remover limitação de 30 dias - buscar todos os agendamentos
      // Passar o barbeiro selecionado para o filtro (apenas para admin)
      const barberId = user?.role === 'admin' ? selectedBarberId : undefined;
      const result = await fetchAppointments(undefined, undefined, barberId || undefined);
      setAppointments(result.appointments);
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
    }
  };

  const loadClients = async () => {
    try {
      const result = await fetchClients(1, '', 1000);
      setClients(result.clients);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const loadBarbers = async () => {
    try {
      const result = await fetchBarbers(1, '', 1000);
      setBarbers(result.barbers);
    } catch (error) {
      console.error('Erro ao carregar barbeiros:', error);
    }
  };

  const loadServices = async () => {
    try {
      const result = await fetchServices(1, '', 1000);
      setServices(result.services);
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
    }
  };

  const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
    setSelectedDate(slotInfo.start);
    setIsModalOpen(true);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsDetailsModalOpen(true);
  };

  const handleEventDrop = async (event: CalendarEvent, start: Date, end: Date) => {
    // Implementar reagendamento por drag & drop
    console.log('Reagendar:', event, start, end);
  };

  const handleNewAppointment = () => {
    setSelectedDate(undefined);
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (formData: any, selectedServices: any[], selectedBarber: any, recurrence?: any) => {
    setModalLoading(true);
    try {
      const appointment = await createAppointment(formData, selectedServices, selectedBarber, recurrence);
      if (appointment) {
        await loadAppointments();
        setIsModalOpen(false);
        toast.success('Agendamento criado com sucesso!');
      }
    } catch (error: any) {
      console.error('Erro ao criar agendamento:', error);
      
      // Verificar se é um erro de conflito
      if (error.message && error.message.includes('conflitos encontrados')) {
        // Extrair dados dos conflitos do erro
        const conflictInfo = error.conflicts || [];
        setConflictData({
          newAppointment: {
            client: selectedServices[0] ? `Cliente ID: ${formData.client_id}` : 'Cliente não identificado',
            barber: selectedBarber.name,
            datetime: formData.appointment_datetime,
            services: selectedServices.map(s => s.name).join(', '),
            duration: formData.custom_duration || selectedServices.reduce((total, service) => total + (service.duration || 30), 0)
          },
          conflicts: conflictInfo
        });
        
        // Salvar dados do agendamento pendente
        setPendingAppointmentData({ formData, selectedServices, selectedBarber, recurrence });
        
        // Abrir modal de conflito
        setConflictModalOpen(true);
      } else {
        toast.error('Erro ao criar agendamento');
      }
    } finally {
      setModalLoading(false);
    }
  };

  const handleStatusChange = async (appointmentId: number, newStatus: string, paymentMethod?: PaymentMethod, finalAmount?: number) => {
    try {
      const success = await updateAppointmentStatus(appointmentId, newStatus, paymentMethod, finalAmount);
      if (success) {
        await loadAppointments();
        // Atualizar o evento selecionado se for o mesmo
        if (selectedEvent?.resource.appointment.id === appointmentId) {
          setSelectedEvent(null);
          setIsDetailsModalOpen(false);
        }
      }
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      throw error;
    }
  };

  const handleCompleteWithPayment = (event: CalendarEvent) => {
    setAppointmentToComplete(event);
    setPaymentModalOpen(true);
  };

  const handlePaymentSelection = async (paymentMethod: PaymentMethod) => {
    if (!appointmentToComplete) return;

    try {
      await handleStatusChange(appointmentToComplete.resource.appointment.id, 'completed', paymentMethod);
      toast.success('Agendamento finalizado com sucesso!');
    } catch (error) {
      toast.error('Erro ao finalizar agendamento');
    } finally {
      setPaymentModalOpen(false);
      setAppointmentToComplete(null);
    }
  };

  const handleCompleteAllToday = async () => {
    setCompletingAll(true);
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      // Buscar agendamentos de hoje que estão como 'scheduled'
      let query = supabase
        .from('appointments')
        .select('id')
        .eq('status', 'scheduled')
        .gte('appointment_datetime', startOfDay.toISOString())
        .lte('appointment_datetime', endOfDay.toISOString());

      // Filtrar por barbeiro se usuário for barbeiro
      if (user?.role === 'barber' && user.barber?.id) {
        query = query.eq('barber_id', user.barber.id);
      }

      const { data: todayAppointments, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      if (!todayAppointments || todayAppointments.length === 0) {
        toast.error('Nenhum agendamento pendente encontrado para hoje');
        return;
      }

      // Atualizar todos para 'completed'
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ status: 'completed' })
        .in('id', todayAppointments.map(apt => apt.id));

      if (updateError) throw updateError;

      await loadAppointments();
      toast.success(`${todayAppointments.length} agendamentos marcados como concluídos!`);
    } catch (error) {
      console.error('Erro ao concluir agendamentos:', error);
      toast.error('Erro ao concluir agendamentos');
    } finally {
      setCompletingAll(false);
    }
  };

  const getTodayScheduledCount = () => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    return appointments.filter(apt => {
      const aptDate = new Date(apt.appointment_datetime);
      return apt.status === 'scheduled' &&
        aptDate >= startOfDay &&
        aptDate <= endOfDay;
    }).length;
  };

  const isLoading = loading;

  return (
    <div className="h-full flex flex-col space-y-2" style={{ minHeight: '100vh', paddingBottom: '1rem' }}>
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Calendar className="h-6 w-6 mr-2" />
            {user?.role === 'admin' ? 'Agendamentos' : 'Meus Agendamentos'}
          </h1>
          <p className="text-gray-600">
            {user?.role === 'admin'
              ? 'Gerencie todos os agendamentos da barbearia'
              : 'Seus agendamentos e horários'
            }
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {activeTab === 'calendar' && (
            <>
              <button
                onClick={() => setShowBlockModal(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
              >
                <Lock className="h-4 w-4 mr-2" />
                Bloquear Agenda
              </button>

              {getTodayScheduledCount() > 0 && (
                <button
                  onClick={handleCompleteAllToday}
                  disabled={completingAll || isLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className={`h-4 w-4 mr-2 ${completingAll ? 'animate-spin' : ''}`} />
                  Concluir Todos Hoje ({getTodayScheduledCount()})
                </button>
              )}

              <button
                onClick={handleNewAppointment}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Agendamento
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <nav className="flex space-x-8 px-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'calendar'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Agenda</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <History className="h-4 w-4" />
              <span>Histórico</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Filtro de Barbeiro (apenas para admin e tab agenda) */}
      {user?.role === 'admin' && activeTab === 'calendar' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
          <div className="flex items-center space-x-3">
            <label className="text-sm font-medium text-gray-700">
              Filtrar por barbeiro:
            </label>
            <select
              value={selectedBarberId || ''}
              onChange={(e) => setSelectedBarberId(e.target.value ? parseInt(e.target.value) : null)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="">Todos os barbeiros</option>
              {barbers.map((barber) => (
                <option key={barber.id} value={barber.id}>
                  {barber.name}
                </option>
              ))}
            </select>
            {selectedBarberId && (
              <button
                onClick={() => setSelectedBarberId(null)}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Limpar filtro
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {activeTab === 'calendar' ? (
        <div className="flex-1 bg-white rounded-xl shadow-lg border border-gray-100 p-4 min-h-0 relative overflow-hidden" style={{ minHeight: '700px', height: 'calc(100vh - 120px)' }}>
          {/* Decorative background */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 to-purple-50 rounded-full -translate-y-16 translate-x-16 opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-indigo-50 to-blue-50 rounded-full translate-y-12 -translate-x-12 opacity-50"></div>

          <div className="relative z-10 h-full">
            <AppointmentCalendar
              events={events}
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              onEventDrop={handleEventDrop}
              onStatusChange={handleStatusChange}
              onCompleteWithPayment={handleCompleteWithPayment}
              loading={isLoading}
            />
          </div>
        </div>
      ) : (
        <AppointmentHistory className="flex-1" />
      )}

      {/* Modals */}
      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        clients={clients}
        setClients={setClients}
        barbers={barbers}
        services={services}
        selectedDate={selectedDate}
        loading={modalLoading}
      />

      <AppointmentDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        event={selectedEvent}
        onStatusChange={handleStatusChange}
        onUpdateAppointment={updateAppointment}
        canChangeStatus={true}
        clients={clients}
        barbers={barbers}
        services={services}
      />

      <PaymentMethodModal
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setAppointmentToComplete(null);
        }}
        onSelect={handlePaymentSelection}
        title="Finalizar Agendamento"
        amount={appointmentToComplete?.resource.total || 0}
        loading={modalLoading}
      />

      <ConflictModal
        isOpen={conflictModalOpen}
        onClose={handleConflictCancel}
        onConfirm={handleConflictConfirm}
        conflictData={conflictData}
        loading={modalLoading}
      />

      <BlockScheduleModal
        isOpen={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        onBlock={handleBlockSchedule}
      />
    </div>
  );
};