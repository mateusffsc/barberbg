import React, { useState, useEffect } from 'react';
import { Calendar, Plus, RefreshCw, Search, CheckCircle2 } from 'lucide-react';
import { useAppointments } from '../hooks/useAppointments';
import { useClients } from '../hooks/useClients';
import { useBarbers } from '../hooks/useBarbers';
import { useServices } from '../hooks/useServices';
import { AppointmentCalendar } from '../components/appointments/AppointmentCalendar';
import { AppointmentModal } from '../components/appointments/AppointmentModal';
import { AppointmentDetailsModal } from '../components/appointments/AppointmentDetailsModal';
import { CalendarEvent } from '../types/appointment';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';

export const Appointments: React.FC = () => {
  const { user } = useAuth();
  const {
    appointments,
    setAppointments,
    loading: appointmentsLoading,
    fetchAppointments,
    createAppointment,
    updateAppointmentStatus,
    convertToCalendarEvents
  } = useAppointments();

  const {
    clients,
    setClients,
    loading: clientsLoading,
    fetchClients
  } = useClients();

  const {
    barbers,
    setBarbers,
    loading: barbersLoading,
    fetchBarbers
  } = useBarbers();

  const {
    services,
    setServices,
    loading: servicesLoading,
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

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    // Converter agendamentos para eventos do calendário
    const calendarEvents = convertToCalendarEvents(appointments);
    setEvents(calendarEvents);
  }, [appointments]);

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

  const loadAppointments = async () => {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      // Passar o barbeiro selecionado para o filtro (apenas para admin)
      const barberId = user?.role === 'admin' ? selectedBarberId : undefined;
      const result = await fetchAppointments(startDate, endDate, barberId || undefined);
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
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      toast.error('Erro ao criar agendamento');
    } finally {
      setModalLoading(false);
    }
  };

  const handleStatusChange = async (appointmentId: number, newStatus: string) => {
    try {
      const success = await updateAppointmentStatus(appointmentId, newStatus);
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
        toast.info('Nenhum agendamento pendente encontrado para hoje');
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
    <div className="h-full flex flex-col space-y-4 md:space-y-6 p-4 md:p-0">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center">
            <Calendar className="h-5 w-5 md:h-6 md:w-6 mr-2" />
            {user?.role === 'admin' ? 'Agendamentos' : 'Meus Agendamentos'}
          </h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">
            {user?.role === 'admin' 
              ? 'Gerencie todos os agendamentos da barbearia'
              : 'Seus agendamentos e horários'
            }
          </p>
        </div>
        
        {/* Botões de ação - Layout responsivo */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="flex gap-2">
            <button
              onClick={loadAppointments}
              disabled={isLoading}
              className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 md:px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
              <span className="sm:hidden">Sync</span>
            </button>
            
            <button
              onClick={handleNewAppointment}
              className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 md:px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Novo Agendamento</span>
              <span className="sm:hidden">Novo</span>
            </button>
          </div>
          
          {getTodayScheduledCount() > 0 && (
            <button
              onClick={handleCompleteAllToday}
              disabled={completingAll || isLoading}
              className="inline-flex items-center justify-center px-3 md:px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCircle2 className={`h-4 w-4 mr-2 ${completingAll ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Concluir Todos Hoje ({getTodayScheduledCount()})</span>
              <span className="md:hidden">Concluir Hoje ({getTodayScheduledCount()})</span>
            </button>
          )}
        </div>
      </div>

      {/* Filtro de Barbeiro (apenas para admin) */}
      {user?.role === 'admin' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Filtrar por barbeiro:
            </label>
            <div className="flex flex-1 items-center gap-2">
              <select
                value={selectedBarberId || ''}
                onChange={(e) => setSelectedBarberId(e.target.value ? parseInt(e.target.value) : null)}
                className="flex-1 sm:flex-none sm:min-w-48 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
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
                  className="text-sm text-gray-500 hover:text-gray-700 underline whitespace-nowrap"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-6 min-h-0">
        <AppointmentCalendar
          events={events}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          onEventDrop={handleEventDrop}
          loading={isLoading}
        />
      </div>

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
        canChangeStatus={true}
      />
    </div>
  );
};