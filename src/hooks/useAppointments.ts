import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Appointment, AppointmentFormData, AppointmentsResponse, CalendarEvent } from '../types/appointment';
import { Service } from '../types/service';
import { Barber } from '../types/barber';
import { PaymentMethod } from '../types/payment';
import { useAuth } from '../contexts/AuthContext';
import { fromLocalDateTimeString, toLocalISOString } from '../utils/dateHelpers';
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
          barber:barbers(id, name, is_special_barber),
          appointment_services(
            service_id,
            price_at_booking,
            commission_rate_applied,
            service:services(id, name, duration_minutes_normal, duration_minutes_special, is_chemical)
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
          duration_minutes_normal: as.service.duration_minutes_normal,
          duration_minutes_special: as.service.duration_minutes_special,
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
    formData: AppointmentFormData,
    selectedServices: Service[],
    selectedBarber: Barber,
    recurrence?: any,
    allowOverlap?: boolean // Novo parâmetro para permitir sobreposição
  ): Promise<Appointment | null> => {
    try {
      // Calcular total e duração
      const totalPrice = selectedServices.reduce((sum, service) => sum + service.price, 0);
      
      // Verificar se há duração customizada
      let totalDuration = 0;
      
      if (formData.custom_duration && formData.custom_duration > 0) {
        // Usar duração customizada
        totalDuration = formData.custom_duration;
      } else {
        // Calcular duração total baseada no tipo de barbeiro
        
        // Buscar informações do barbeiro
        const { data: barberData, error: barberError } = await supabase
          .from('barbers')
          .select('is_special_barber')
          .eq('id', formData.barber_id)
          .single();
        
        if (barberError) {
          console.error('❌ Erro ao buscar barbeiro:', barberError);
          // Fallback: usar duração padrão
          totalDuration = selectedServices.reduce((sum, service) => sum + (service.duration_minutes_normal || 30), 0);
        } else {
          const isSpecialBarber = barberData?.is_special_barber || false;
          
          // Calcular duração para cada serviço
          for (const service of selectedServices) {
            let serviceDuration;
            
            if (isSpecialBarber) {
              // Barbeiro especial usa duration_minutes_special
              serviceDuration = service.duration_minutes_special || service.duration_minutes_normal || 30;
            } else {
              // Barbeiro normal usa duration_minutes_normal
              serviceDuration = service.duration_minutes_normal || 30;
            }
            
            totalDuration += serviceDuration;
          }
        }
      }
      
      // Gerar datas dos agendamentos baseado na recorrência
      // Usar função que não converte timezone
      const appointmentDates = generateRecurrenceDates(
        fromLocalDateTimeString(formData.appointment_datetime),
        recurrence
      );
      
      console.log('Data original do form:', formData.appointment_datetime);
      console.log('Data convertida:', appointmentDates[0]);
      console.log('Data que será salva:', toLocalISOString(appointmentDates[0]));

      // Buscar dados do cliente
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('name, phone')
        .eq('id', formData.client_id)
        .single();

      if (clientError) throw clientError;

      // Verificar conflitos para todas as datas (apenas se não permitir sobreposição)
      const conflictingAppointments = [];
      
      for (const date of appointmentDates) {
        const startTime = date;
        const endTime = new Date(startTime.getTime() + totalDuration * 60000);

        // Verificar conflitos com outros agendamentos
        const { data: conflicts } = await supabase
          .from('appointments')
          .select('id, client_name, appointment_datetime, duration_minutes')
          .eq('barber_id', formData.barber_id)
          .eq('status', 'scheduled')
          .gte('appointment_datetime', toLocalISOString(startTime))
          .lt('appointment_datetime', toLocalISOString(endTime));

        // Verificar conflitos com bloqueios de agenda
        const appointmentDate = startTime.toISOString().split('T')[0]; // YYYY-MM-DD
        const appointmentTime = startTime.toTimeString().split(' ')[0]; // HH:MM:SS
        const appointmentEndTime = endTime.toTimeString().split(' ')[0]; // HH:MM:SS

        const { data: blocks } = await supabase
          .from('schedule_blocks')
          .select('id, reason, start_time, end_time, barber_id')
          .eq('block_date', appointmentDate)
          .or(`barber_id.eq.${formData.barber_id},barber_id.is.null`) // Bloqueio específico ou geral
          .or(`and(start_time.lte.${appointmentTime},end_time.gt.${appointmentTime}),and(start_time.lt.${appointmentEndTime},end_time.gte.${appointmentEndTime}),and(start_time.gte.${appointmentTime},end_time.lte.${appointmentEndTime})`);

        if (blocks && blocks.length > 0) {
          const blockInfo = {
            date: startTime,
            blocks: blocks.map(b => ({
              id: b.id,
              reason: b.reason || 'Período bloqueado',
              start_time: b.start_time,
              end_time: b.end_time,
              is_general: b.barber_id === null
            }))
          };
          conflictingAppointments.push(blockInfo);
        }

        if (conflicts && conflicts.length > 0) {
          if (!allowOverlap) {
            // Se não permitir sobreposição, retornar informações do conflito
            const conflictInfo = {
              date: startTime,
              conflicts: conflicts.map(c => ({
                id: c.id,
                client_name: c.client_name,
                appointment_datetime: c.appointment_datetime,
                duration_minutes: c.duration_minutes
              }))
            };
            conflictingAppointments.push(conflictInfo);
          }
          // Se permitir sobreposição, continuar normalmente
        }
      }

      // Se houver conflitos e não permitir sobreposição, retornar erro com detalhes
      if (conflictingAppointments.length > 0 && !allowOverlap) {
        const error = new Error('Conflitos de agenda encontrados - conflitos encontrados');
        (error as any).conflicts = conflictingAppointments;
        throw error;
      }

      // Criar agendamentos para todas as datas
      let firstAppointment = null;
      
      // Gerar UUID para agrupar agendamentos recorrentes (apenas se houver mais de um)
      const recurrenceGroupId = appointmentDates.length > 1 ? crypto.randomUUID() : null;
      
      for (const date of appointmentDates) {
        // Criar agendamento
        const { data: appointment, error: appointmentError } = await supabase
          .from('appointments')
          .insert({
            client_id: formData.client_id,
            barber_id: formData.barber_id,
            client_name: clientData.name,
            client_phone: clientData.phone,
            barber_name: selectedBarber.name,
            barber_phone: selectedBarber.phone,
            services_names: selectedServices.map(s => s.name).join(', '),
            services_ids: selectedServices.map(s => s.id),
            appointment_datetime: toLocalISOString(date),
            appointment_date: date.toISOString().split('T')[0], // YYYY-MM-DD
            appointment_time: date.toTimeString().split(' ')[0], // HH:MM:SS
            status: 'scheduled',
            total_price: totalPrice,
            duration_minutes: totalDuration, // Salvar duração calculada (customizada ou padrão)
            note: formData.note?.trim() || null,
            recurrence_group_id: recurrenceGroupId
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
    
    if (!recurrence || recurrence.type === 'none') {
      return dates;
    }

    const interval = recurrence.interval || 1;
    const endDate = recurrence.end_date ? new Date(recurrence.end_date) : null;
    
    // Se há data limite, calcular automaticamente até essa data
    // Se há número de ocorrências, usar esse limite (máximo 52)
    let maxOccurrences = 52; // Limite padrão de segurança
    
    if (recurrence.occurrences && recurrence.occurrences > 1) {
      maxOccurrences = Math.min(recurrence.occurrences, 52);
    } else if (endDate) {
      // Calcular automaticamente quantas ocorrências cabem até a data limite
      maxOccurrences = calculateMaxOccurrences(startDate, endDate, recurrence.type, interval);
    } else if (!recurrence.occurrences || recurrence.occurrences <= 1) {
      return dates; // Sem recorrência se não há limite nem ocorrências
    }

    for (let i = 1; i < maxOccurrences; i++) {
      const nextDate = new Date(startDate);
      
      switch (recurrence.type) {
        case 'weekly':
          nextDate.setDate(startDate.getDate() + (i * 7 * interval));
          break;
        case 'biweekly':
          nextDate.setDate(startDate.getDate() + (i * 14)); // Quinzenal (14 dias)
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

  // Função auxiliar para calcular o número máximo de ocorrências até uma data limite
  const calculateMaxOccurrences = (startDate: Date, endDate: Date, type: string, interval: number = 1): number => {
    let count = 1; // Incluir a data inicial
    const currentDate = new Date(startDate);
    
    while (currentDate < endDate && count < 52) { // Limite de segurança
      switch (type) {
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + (7 * interval));
          break;
        case 'biweekly':
          currentDate.setDate(currentDate.getDate() + 14);
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + interval);
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

  const updateAppointmentStatus = async (id: number, status: string, paymentMethod?: PaymentMethod, finalAmount?: number): Promise<boolean> => {
    try {
      const updateData: any = { status };
      
      // Adicionar forma de pagamento se o status for completed e paymentMethod for fornecido
      if (status === 'completed' && paymentMethod) {
        updateData.payment_method = paymentMethod;
        
        // Adicionar valor final se fornecido e diferente do valor original
        if (finalAmount !== undefined) {
          updateData.final_amount = finalAmount;
        }
      }

      const { error } = await supabase
        .from('appointments')
        .update(updateData)
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

  const updateAppointment = async (
    appointmentId: number,
    updateData: {
      client_id: number;
      barber_id: number;
      service_ids: number[];
      appointment_date: string;
      appointment_time: string;
      custom_duration?: number | null;
      note?: string;
    }
  ): Promise<boolean> => {
    try {
      // Buscar serviços selecionados
      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select('*')
        .in('id', updateData.service_ids);

      if (servicesError) throw servicesError;

      // Buscar barbeiro
      const { data: barber, error: barberError } = await supabase
        .from('barbers')
        .select('*')
        .eq('id', updateData.barber_id)
        .single();

      if (barberError) throw barberError;

      // Calcular total e duração
      const totalPrice = services.reduce((sum, service) => sum + service.price, 0);
      
      let totalDuration = 0;
      if (updateData.custom_duration && updateData.custom_duration > 0) {
        totalDuration = updateData.custom_duration;
      } else {
        const isSpecialBarber = barber.is_special_barber || false;
        totalDuration = services.reduce((sum, service) => {
          const serviceDuration = isSpecialBarber 
            ? (service.duration_minutes_special || service.duration_minutes_normal || 30)
            : (service.duration_minutes_normal || 30);
          return sum + serviceDuration;
        }, 0);
      }

      // Criar datetime combinando data e hora mantendo o horário local
      const appointmentDateTime = `${updateData.appointment_date}T${updateData.appointment_time}:00`;

      // Atualizar agendamento
      const { error: appointmentError } = await supabase
        .from('appointments')
        .update({
          client_id: updateData.client_id,
          barber_id: updateData.barber_id,
          appointment_datetime: appointmentDateTime,
          total_price: totalPrice,
          duration_minutes: updateData.custom_duration || totalDuration,
          note: updateData.note || null
        })
        .eq('id', appointmentId);

      if (appointmentError) throw appointmentError;

      // Remover serviços antigos
      const { error: deleteServicesError } = await supabase
        .from('appointment_services')
        .delete()
        .eq('appointment_id', appointmentId);

      if (deleteServicesError) throw deleteServicesError;

      // Adicionar novos serviços
      const appointmentServices = services.map(service => {
        const commissionRate = service.is_chemical 
          ? barber.commission_rate_chemical_service
          : barber.commission_rate_service;

        return {
          appointment_id: appointmentId,
          service_id: service.id,
          price_at_booking: service.price,
          commission_rate_applied: commissionRate
        };
      });

      const { error: insertServicesError } = await supabase
        .from('appointment_services')
        .insert(appointmentServices);

      if (insertServicesError) throw insertServicesError;

      toast.success('Agendamento atualizado com sucesso!');
      return true;
    } catch (error: any) {
      console.error('Erro ao atualizar agendamento:', error);
      toast.error('Erro ao atualizar agendamento');
      return false;
    }
  };

  // Função para lidar com bloqueio de agenda
  const handleBlockSchedule = async (blockData: { date: string; startTime: string; endTime: string; reason?: string }) => {
    try {
      // Aqui implementaremos a lógica para salvar o bloqueio no banco de dados
      console.log('Bloqueio criado:', blockData);
      toast.success('Período bloqueado com sucesso!');
      setShowBlockModal(false);
      // Recarregar agendamentos para refletir o bloqueio
      await loadAppointments();
    } catch (error) {
      console.error('Erro ao criar bloqueio:', error);
      toast.error('Erro ao bloquear período');
    }
  };

  const createScheduleBlock = async (blockData: {
    date: string;
    startTime: string;
    endTime: string;
    reason?: string;
    barberId?: number;
  }): Promise<boolean> => {
    try {
      let finalBarberId = blockData.barberId;

      // Se for barbeiro, forçar o uso do próprio ID
      if (user?.role === 'barber') {
        // Buscar o barbeiro correspondente ao usuário logado
        const { data: barberData, error: barberError } = await supabase
          .from('barbers')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (barberError || !barberData) {
          toast.error('Erro ao identificar barbeiro');
          return false;
        }

        finalBarberId = barberData.id;
      }

      // Se for admin e não especificou barbeiro, erro
      if (user?.role === 'admin' && !finalBarberId) {
        toast.error('Selecione um barbeiro para o bloqueio');
        return false;
      }

      const { error } = await supabase
        .from('schedule_blocks')
        .insert({
          barber_id: finalBarberId,
          block_date: blockData.date,
          start_time: blockData.startTime,
          end_time: blockData.endTime,
          reason: blockData.reason || null,
          created_by: user?.id || null
        });

      if (error) throw error;

      toast.success('Período bloqueado com sucesso!');
      return true;
    } catch (error: any) {
      console.error('Erro ao criar bloqueio:', error);
      toast.error('Erro ao bloquear período');
      return false;
    }
  };

  const deleteAppointment = async (id: string) => {
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

  const deleteRecurringAppointments = async (recurrenceGroupId: string) => {
    try {
      // Buscar todos os agendamentos da série recorrente
      const { data: appointments, error: fetchError } = await supabase
        .from('appointments')
        .select('id')
        .eq('recurrence_group_id', recurrenceGroupId);

      if (fetchError) throw fetchError;

      if (!appointments || appointments.length === 0) {
        toast.error('Nenhum agendamento encontrado na série recorrente');
        return false;
      }

      const appointmentIds = appointments.map(app => app.id);

      // Primeiro deletar todos os serviços dos agendamentos
      const { error: servicesError } = await supabase
        .from('appointment_services')
        .delete()
        .in('appointment_id', appointmentIds);

      if (servicesError) throw servicesError;

      // Depois deletar todos os agendamentos
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('recurrence_group_id', recurrenceGroupId);

      if (error) throw error;

      toast.success(`${appointments.length} agendamentos da série recorrente excluídos com sucesso!`);
      return true;
    } catch (error: any) {
      console.error('Erro ao excluir agendamentos recorrentes:', error);
      toast.error('Erro ao excluir agendamentos recorrentes');
      return false;
    }
  };

  const updateRecurringAppointments = async (
    recurrenceGroupId: string,
    updateData: {
      client_id?: number;
      barber_id?: number;
      service_ids?: number[];
      note?: string;
    }
  ) => {
    try {
      // Buscar todos os agendamentos da série recorrente
      const { data: appointments, error: fetchError } = await supabase
        .from('appointments')
        .select('*')
        .eq('recurrence_group_id', recurrenceGroupId);

      if (fetchError) throw fetchError;

      if (!appointments || appointments.length === 0) {
        toast.error('Nenhum agendamento encontrado na série recorrente');
        return false;
      }

      // Se há mudança nos serviços, precisamos recalcular preços e durações
      if (updateData.service_ids && updateData.service_ids.length > 0) {
        // Buscar serviços selecionados
        const { data: services, error: servicesError } = await supabase
          .from('services')
          .select('*')
          .in('id', updateData.service_ids);

        if (servicesError) throw servicesError;

        // Buscar barbeiro (usar o novo ou o atual)
        const barberId = updateData.barber_id || appointments[0].barber_id;
        const { data: barber, error: barberError } = await supabase
          .from('barbers')
          .select('*')
          .eq('id', barberId)
          .single();

        if (barberError) throw barberError;

        // Calcular novo total e duração
        const totalPrice = services.reduce((sum, service) => sum + service.price, 0);
        
        const isSpecialBarber = barber.is_special_barber || false;
        const totalDuration = services.reduce((sum, service) => {
          const serviceDuration = isSpecialBarber 
            ? (service.duration_minutes_special || service.duration_minutes_normal || 30)
            : (service.duration_minutes_normal || 30);
          return sum + serviceDuration;
        }, 0);

        // Atualizar todos os agendamentos da série
        const appointmentUpdates: any = {
          ...(updateData.client_id && { client_id: updateData.client_id }),
          ...(updateData.barber_id && { barber_id: updateData.barber_id }),
          total_price: totalPrice,
          duration_minutes: totalDuration,
          ...(updateData.note !== undefined && { note: updateData.note })
        };

        const { error: updateError } = await supabase
          .from('appointments')
          .update(appointmentUpdates)
          .eq('recurrence_group_id', recurrenceGroupId);

        if (updateError) throw updateError;

        // Remover todos os serviços antigos
        const appointmentIds = appointments.map(app => app.id);
        const { error: deleteServicesError } = await supabase
          .from('appointment_services')
          .delete()
          .in('appointment_id', appointmentIds);

        if (deleteServicesError) throw deleteServicesError;

        // Adicionar novos serviços para todos os agendamentos
        const allAppointmentServices = [];
        for (const appointment of appointments) {
          for (const service of services) {
            const commissionRate = service.is_chemical 
              ? barber.commission_rate_chemical_service
              : barber.commission_rate_service;

            allAppointmentServices.push({
              appointment_id: appointment.id,
              service_id: service.id,
              price_at_booking: service.price,
              commission_rate_applied: commissionRate
            });
          }
        }

        const { error: insertServicesError } = await supabase
          .from('appointment_services')
          .insert(allAppointmentServices);

        if (insertServicesError) throw insertServicesError;
      } else {
        // Atualizar apenas campos básicos sem mudança de serviços
        const appointmentUpdates: any = {
          ...(updateData.client_id && { client_id: updateData.client_id }),
          ...(updateData.barber_id && { barber_id: updateData.barber_id }),
          ...(updateData.note !== undefined && { note: updateData.note })
        };

        const { error: updateError } = await supabase
          .from('appointments')
          .update(appointmentUpdates)
          .eq('recurrence_group_id', recurrenceGroupId);

        if (updateError) throw updateError;
      }

      toast.success(`${appointments.length} agendamentos da série recorrente atualizados com sucesso!`);
      return true;
    } catch (error: any) {
      console.error('Erro ao atualizar agendamentos recorrentes:', error);
      toast.error('Erro ao atualizar agendamentos recorrentes');
      return false;
    }
  };

  // Buscar bloqueios de agenda
  const loadScheduleBlocks = async (barberId?: number) => {
    try {
      let query = supabase
        .from('schedule_blocks')
        .select('*')
        .order('block_date', { ascending: true });

      // Se um barbeiro específico foi selecionado, filtrar bloqueios
      if (barberId) {
        query = query.or(`barber_id.eq.${barberId},barber_id.is.null`);
      } else if (user?.role === 'barber') {
        // Se for barbeiro sem filtro específico, mostrar apenas seus bloqueios
        const { data: barberData } = await supabase
          .from('barbers')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        if (barberData) {
          query = query.or(`barber_id.eq.${barberData.id},barber_id.is.null`);
        }
      }
      // Se for admin sem filtro, mostrar todos os bloqueios (comportamento atual)

      const { data: blocks, error } = await query;

      if (error) throw error;
      return blocks || [];
    } catch (error) {
      console.error('Erro ao carregar bloqueios:', error);
      return [];
    }
  };

  // Converter agendamentos e bloqueios para eventos do calendário
  const convertToCalendarEvents = async (appointments: Appointment[], barberId?: number): Promise<CalendarEvent[]> => {
    // Buscar bloqueios de agenda
    const blocks = await loadScheduleBlocks(barberId);
    
    // Converter agendamentos
    const appointmentEvents = appointments.map(appointment => {
      const startTime = new Date(appointment.appointment_datetime);
      
      // Usar duração salva no banco ou calcular baseada no tipo de barbeiro
      let totalDuration = 0;
      
      if (appointment.duration_minutes && appointment.duration_minutes > 0) {
        // Usar duração salva no banco (customizada ou padrão)
        totalDuration = appointment.duration_minutes;
      } else if (appointment.services && appointment.services.length > 0) {
        // Fallback: calcular duração baseada no tipo de barbeiro
        const isSpecialBarber = appointment.barber?.is_special_barber || false;
        
        totalDuration = appointment.services.reduce((sum, service) => {
          let serviceDuration;
          
          if (isSpecialBarber) {
            // Barbeiro especial usa duration_minutes_special
            serviceDuration = service.duration_minutes_special || service.duration_minutes_normal || 30;
          } else {
            // Barbeiro normal usa duration_minutes_normal
            serviceDuration = service.duration_minutes_normal || 30;
          }
          
          return sum + serviceDuration;
        }, 0);
      } else {
        totalDuration = 30; // Fallback
      }
      
      const endTime = new Date(startTime.getTime() + totalDuration * 60000);

      const servicesNames = appointment.services?.map(s => s.name) || [];
      const title = `${appointment.client?.name || appointment.client_name || 'Cliente'} - ${servicesNames.length > 0 ? servicesNames.join(', ') : appointment.services_names || 'Serviços'}`;

      const barberId = appointment.barber_id?.toString() || appointment.barber?.id?.toString() || '';

      return {
        id: appointment.id,
        title,
        start: startTime,
        end: endTime,
        resource: {
          status: appointment.status,
          barber: appointment.barber?.name || appointment.barber_name || '',
          barberId,
          client: appointment.client?.name || appointment.client_name || '',
          services: servicesNames.length > 0 ? servicesNames : (appointment.services_names ? appointment.services_names.split(', ') : []),
          total: appointment.final_amount || appointment.total_price,
          appointment
        }
      };
    });

    // Converter bloqueios para eventos do calendário
    const blockEvents = blocks.map(block => {
      const blockDate = new Date(block.block_date + 'T' + block.start_time);
      const blockEndDate = new Date(block.block_date + 'T' + block.end_time);
      
      return {
        id: `block-${block.id}`,
        title: block.reason || 'Período Bloqueado',
        start: blockDate,
        end: blockEndDate,
        resource: {
          status: 'blocked',
          barber: block.barber_id ? 'Barbeiro específico' : 'Todos os barbeiros',
          barberId: block.barber_id?.toString() || '',
          isBlock: true,
          blockData: block
        }
      };
    });

    // Retornar agendamentos e bloqueios juntos
    return [...appointmentEvents, ...blockEvents];
  };

  const deleteScheduleBlock = async (blockId: number): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('schedule_blocks')
        .delete()
        .eq('id', blockId);

      if (error) throw error;

      toast.success('Bloqueio excluído com sucesso!');
      return true;
    } catch (error: any) {
      console.error('Erro ao excluir bloqueio:', error);
      toast.error('Erro ao excluir bloqueio');
      return false;
    }
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
    updateAppointment,
    updateAppointmentStatus,
    rescheduleAppointment,
    deleteAppointment,
    deleteRecurringAppointments,
    updateRecurringAppointments,
    loadScheduleBlocks,
    convertToCalendarEvents,
    createScheduleBlock,
    deleteScheduleBlock
  };
};