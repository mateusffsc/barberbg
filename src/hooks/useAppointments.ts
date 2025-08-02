import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Appointment, AppointmentFormData, AppointmentsResponse, CalendarEvent } from '../types/appointment';
import { Service } from '../types/service';
import { Barber } from '../types/barber';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export const useAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const { user } = useAuth();

  const fetchAppointments = async (
    startDate?: Date,
    endDate?: Date,
    barberId?: number
  ): Promise<AppointmentsResponse> => {
    try {
      let query = supabase
        .from('appointments')
        .select(`
          *,
          client:clients(id, name),
          barber:barbers(id, name),
          appointment_services(
            service_id,
            price_at_booking,
            commission_rate_applied,
            service:services(id, name, duration_minutes, is_chemical)
          )
        `, { count: 'exact' })
        .order('appointment_datetime');

      // Filtrar por período se fornecido
      if (startDate) {
        query = query.gte('appointment_datetime', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('appointment_datetime', endDate.toISOString());
      }

      // Filtrar por barbeiro se fornecido ou se usuário é barbeiro
      if (barberId) {
        query = query.eq('barber_id', barberId);
      } else if (user?.role === 'barber' && user.barber?.id) {
        query = query.eq('barber_id', user.barber.id);
      }

      const { data, count, error } = await query;

      if (error) throw error;

      // Transformar dados para incluir serviços
      const appointmentsWithServices = (data || []).map(appointment => ({
        ...appointment,
        services: appointment.appointment_services?.map((as: any) => ({
          id: as.service.id,
          name: as.service.name,
          price: as.price_at_booking,
          duration_minutes: as.service.duration_minutes,
          is_chemical: as.service.is_chemical
        })) || []
      }));

      return {
        appointments: appointmentsWithServices,
        count: count || 0
      };
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      toast.error('Erro ao carregar agendamentos');
      return { appointments: [], count: 0 };
    }
  };

  const createAppointment = async (
    appointmentData: AppointmentFormData,
    selectedServices: Service[],
    selectedBarber: Barber,
    recurrence?: any
  ): Promise<Appointment | null> => {
    try {
      // Calcular total e duração
      const totalPrice = selectedServices.reduce((sum, service) => sum + service.price, 0);
      const totalDuration = selectedServices.reduce((sum, service) => sum + service.duration_minutes, 0);
      
      // Gerar datas dos agendamentos baseado na recorrência
      const appointmentDates = generateRecurrenceDates(
        new Date(appointmentData.appointment_datetime),
        recurrence
      );

      // Verificar conflitos para todas as datas
      for (const date of appointmentDates) {
        const startTime = date;
        const endTime = new Date(startTime.getTime() + totalDuration * 60000);

        const { data: conflicts } = await supabase
          .from('appointments')
          .select('id')
          .eq('barber_id', appointmentData.barber_id)
          .eq('status', 'scheduled')
          .gte('appointment_datetime', startTime.toISOString())
          .lt('appointment_datetime', endTime.toISOString());

        if (conflicts && conflicts.length > 0) {
          toast.error(`Conflito de horário em ${startTime.toLocaleDateString('pt-BR')}`);
          return null;
        }
      }

      // Criar agendamentos para todas as datas
      let firstAppointment = null;
      
      for (const date of appointmentDates) {
        // Criar agendamento
        const { data: appointment, error: appointmentError } = await supabase
          .from('appointments')
          .insert({
            client_id: appointmentData.client_id,
            barber_id: appointmentData.barber_id,
            appointment_datetime: date.toISOString(),
            status: 'scheduled',
            total_price: totalPrice,
            note: appointmentData.note.trim() || null
          })
          .select()
          .single();

        if (appointmentError) throw appointmentError;

        if (!firstAppointment) {
          firstAppointment = appointment;
        }

        // Criar registros de serviços
        const serviceRecords = selectedServices.map(service => {
          const commissionRate = service.is_chemical 
            ? selectedBarber.commission_rate_chemical_service
            : selectedBarber.commission_rate_service;

          return {
            appointment_id: appointment.id,
            service_id: service.id,
            price_at_booking: service.price,
            commission_rate_applied: commissionRate
          };
        });

        const { error: servicesError } = await supabase
          .from('appointment_services')
          .insert(serviceRecords);

        if (servicesError) throw servicesError;
      }

      const message = appointmentDates.length > 1 
        ? `${appointmentDates.length} agendamentos criados com sucesso!`
        : 'Agendamento criado com sucesso!';
      
      toast.success(message);
      return firstAppointment;
    } catch (error: any) {
      console.error('Erro ao criar agendamento:', error);
      toast.error('Erro ao criar agendamento');
      return null;
    }
  };

  // Função para gerar datas baseado na recorrência
  const generateRecurrenceDates = (startDate: Date, recurrence?: any): Date[] => {
    const dates = [startDate];
    
    if (!recurrence || recurrence.type === 'none' || !recurrence.occurrences || recurrence.occurrences <= 1) {
      return dates;
    }

    const interval = recurrence.interval || 1;
    const maxOccurrences = Math.min(recurrence.occurrences, 52); // Limite de 52 ocorrências
    const endDate = recurrence.end_date ? new Date(recurrence.end_date) : null;

    for (let i = 1; i < maxOccurrences; i++) {
      const nextDate = new Date(startDate);
      
      switch (recurrence.type) {
        case 'daily':
          nextDate.setDate(startDate.getDate() + (i * interval));
          break;
        case 'weekly':
          nextDate.setDate(startDate.getDate() + (i * interval * 7));
          break;
        case 'monthly':
          nextDate.setMonth(startDate.getMonth() + (i * interval));
          break;
      }

      // Verificar se não passou da data limite
      if (endDate && nextDate > endDate) {
        break;
      }

      dates.push(nextDate);
    }

    return dates;
  };

  const updateAppointmentStatus = async (id: number, status: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      const statusMessages = {
        completed: 'Agendamento marcado como concluído',
        cancelled: 'Agendamento cancelado',
        no_show: 'Agendamento marcado como não compareceu'
      };

      toast.success(statusMessages[status as keyof typeof statusMessages] || 'Status atualizado');
      return true;
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status do agendamento');
      return false;
    }
  };

  const rescheduleAppointment = async (id: number, newDateTime: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ appointment_datetime: newDateTime })
        .eq('id', id);

      if (error) throw error;

      toast.success('Agendamento reagendado com sucesso!');
      return true;
    } catch (error: any) {
      console.error('Erro ao reagendar:', error);
      toast.error('Erro ao reagendar agendamento');
      return false;
    }
  };

  const deleteAppointment = async (id: number): Promise<boolean> => {
    try {
      // Primeiro deletar os serviços do agendamento
      const { error: servicesError } = await supabase
        .from('appointment_services')
        .delete()
        .eq('appointment_id', id);

      if (servicesError) throw servicesError;

      // Depois deletar o agendamento
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Agendamento excluído com sucesso!');
      return true;
    } catch (error: any) {
      console.error('Erro ao excluir agendamento:', error);
      toast.error('Erro ao excluir agendamento');
      return false;
    }
  };

  // Converter agendamentos para eventos do calendário
  const convertToCalendarEvents = (appointments: Appointment[]): CalendarEvent[] => {
    return appointments.map(appointment => {
      const startTime = new Date(appointment.appointment_datetime);
      const totalDuration = appointment.services?.reduce((sum, service) => sum + service.duration_minutes, 0) || 30;
      const endTime = new Date(startTime.getTime() + totalDuration * 60000);

      const servicesNames = appointment.services?.map(s => s.name) || [];
      const title = `${appointment.client?.name} - ${servicesNames.join(', ')}`;

      return {
        id: appointment.id,
        title,
        start: startTime,
        end: endTime,
        resource: {
          status: appointment.status,
          barber: appointment.barber?.name || '',
          client: appointment.client?.name || '',
          services: servicesNames,
          total: appointment.total_price,
          appointment
        }
      };
    });
  };

  return {
    appointments,
    setAppointments,
    loading,
    setLoading,
    totalCount,
    setTotalCount,
    fetchAppointments,
    createAppointment,
    updateAppointmentStatus,
    rescheduleAppointment,
    deleteAppointment,
    convertToCalendarEvents
  };
};