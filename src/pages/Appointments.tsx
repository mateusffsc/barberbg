import React, { useState, useEffect } from 'react';
import { Calendar, Plus, RefreshCw, Search } from 'lucide-react';
import { useAppointments } from '../hooks/useAppointments';
import { useClients } from '../hooks/useClients';
import { useBarbers } from '../hooks/useBarbers';
import { useServices } from '../hooks/useServices';
import { AppointmentCalendar } from '../components/appointments/AppointmentCalendar';
import { AppointmentModal } from '../components/appointments/AppointmentModal';
import { AppointmentDetailsModal } from '../components/appointments/AppointmentDetailsModal';
import { CalendarEvent } from '../types/appointment';
import { useAuth } from '../contexts/AuthContext';
import toast, { Toaster } from 'react-hot-toast';

export const Appointments: React.FC = () => {
  const { user } = useAuth();
  const {
    appointments,
    setAppointments,
    loading: appointmentsLoading,
    fetchAppointments,
    createAppointment,
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
    loading: servicesLoading,
    fetchServices
  } = useServices();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    // Converter agendamentos para eventos do calendário
    const calendarEvents = convertToCalendarEvents(appointments);
    setEvents(calendarEvents);
  }, [appointments, convertToCalendarEvents]);

  const loadInitialData = async () => {
    try {
      await Promise.all([
        loadAppointments(),
        loadClients(),
        loadBarbers(),
        loadServices()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
      toast.error('Erro ao carregar dados');
    }
  };

  const loadAppointments = async () => {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const result = await fetchAppointments(startDate, endDate);
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

  const isLoading = appointmentsLoading || clientsLoading || barbersLoading || servicesLoading;

  return (
    <div className="h-full flex flex-col space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
          <button
            onClick={loadAppointments}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          
          <button
            onClick={handleNewAppointment}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Agendamento
          </button>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
      />
    </div>
  );
};