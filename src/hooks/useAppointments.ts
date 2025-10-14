import { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Appointment, AppointmentFormData, AppointmentsResponse, CalendarEvent } from '../types/appointment';
import { Service } from '../types/service';
import { Barber } from '../types/barber';
import { PaymentMethod } from '../types/payment';
import { useAuth } from '../contexts/AuthContext';
import { fromLocalDateTimeString, toLocalISOString } from '../utils/dateHelpers';
import toast from 'react-hot-toast';
import { useRealtimeSubscription } from './useRealtimeSubscription';

export const useAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const { user } = useAuth();
  const lastFiltersRef = useRef<{ startDate?: Date; endDate?: Date; barberId?: number }>({});
  const broadcastChannelRef = useRef<RealtimeChannel | null>(null);
  const reloadTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Função para recarregar appointments
  const reloadAppointments = useCallback(async (startDate?: Date, endDate?: Date, barberId?: number) => {
    console.log('🔄 useAppointments: Iniciando recarregamento de agendamentos...');
    try {
      const effectiveStart = startDate ?? lastFiltersRef.current.startDate;
      const effectiveEnd = endDate ?? lastFiltersRef.current.endDate;
      const effectiveBarberId = barberId ?? lastFiltersRef.current.barberId;

      const response = await fetchAppointments(effectiveStart, effectiveEnd, effectiveBarberId);
      setAppointments(response.appointments);
      setTotalCount(response.count);

      // Persistir filtros usados para próximos reloads em tempo real
      lastFiltersRef.current = {
        startDate: effectiveStart,
        endDate: effectiveEnd,
        barberId: effectiveBarberId
      };

      console.log('✅ useAppointments: Agendamentos recarregados com sucesso:', response.appointments.length, 'agendamentos');
    } catch (error) {
      console.error('❌ useAppointments: Erro ao recarregar agendamentos:', error);
    }
  }, []);

  // Debounce para evitar corrida entre INSERT do appointment e INSERT de appointment_services
  const debouncedReload = useCallback((delayMs: number = 400) => {
    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current);
    }
    reloadTimerRef.current = setTimeout(() => {
      reloadAppointments();
    }, delayMs);
  }, [reloadAppointments]);

  // Configurar subscription em tempo real para appointments
  useRealtimeSubscription({
    table: 'appointments',
    onInsert: (payload) => {
      console.log('📥 useAppointments: INSERT em appointments:', payload);
      debouncedReload(500);
    },
    onUpdate: (payload) => {
      console.log('✏️ useAppointments: UPDATE em appointments:', payload);
      debouncedReload(300);
    },
    onDelete: (payload) => {
      console.log('🗑️ useAppointments: DELETE em appointments:', payload);
      debouncedReload(300);
    },
    onChange: (payload) => {
      // Fallback genérico
      console.log('🔄 useAppointments: Evento genérico em appointments:', payload);
      debouncedReload(400);
    },
    showNotifications: false // Desabilitar notificações automáticas para evitar spam
  });

  // Assinar mudanças em bloqueios de agenda para refletir imediatamente na visão do calendário
  useRealtimeSubscription({
    table: 'schedule_blocks',
    onInsert: (payload) => {
      console.log('📥 useAppointments: INSERT em schedule_blocks:', payload);
      debouncedReload(400);
    },
    onUpdate: (payload) => {
      console.log('✏️ useAppointments: UPDATE em schedule_blocks:', payload);
      debouncedReload(300);
    },
    onDelete: (payload) => {
      console.log('🗑️ useAppointments: DELETE em schedule_blocks:', payload);
      debouncedReload(300);
    },
    onChange: (payload) => {
      console.log('🔄 useAppointments: Evento genérico em schedule_blocks:', payload);
      debouncedReload(350);
    },
    showNotifications: false
  });

  // Canal de broadcast para sincronização imediata entre sessões (admin/barbeiro)
  useEffect(() => {
    const channel = supabase
      .channel('appointments-sync')
      .on('broadcast', { event: 'appointments_change' }, (payload) => {
        console.log('📡 Broadcast recebido: appointments_change', payload);
        debouncedReload(450);
      })
      .subscribe((status) => {
        console.log('🔌 Broadcast channel status:', status);
      });

    broadcastChannelRef.current = channel;

    return () => {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.unsubscribe();
        broadcastChannelRef.current = null;
      }
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
    };
  }, [debouncedReload]);

  // Helper para enviar broadcast após qualquer alteração
  const notifyAppointmentsChange = async () => {
    try {
      if (!broadcastChannelRef.current) {
        broadcastChannelRef.current = supabase.channel('appointments-sync').subscribe();
      }
      await broadcastChannelRef.current?.send({
        type: 'broadcast',
        event: 'appointments_change',
        payload: { ts: Date.now() }
      });
      console.log('📣 Broadcast enviado: appointments_change');
    } catch (error) {
      console.error('❌ Erro ao enviar broadcast:', error);
    }
  };

  const fetchAppointments = async (
    startDate?: Date,
    endDate?: Date,
    barberId?: number
  ): Promise<AppointmentsResponse> => {
    try {
      // Persistir filtros atuais sempre que buscar
      lastFiltersRef.current = { startDate, endDate, barberId };
      // Função para buscar uma página de agendamentos
      const fetchPage = async (from: number, to: number) => {
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
          .order('appointment_datetime')
          .range(from, to);

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

        return await query;
      };

      // Primeira consulta para obter o count total
      const { data: firstPage, count, error: firstError } = await fetchPage(0, 999);
      
      if (firstError) throw firstError;

      let allData = firstPage || [];
      
      // Se há mais de 1000 registros, buscar as páginas restantes
      if (count && count > 1000) {
        const totalPages = Math.ceil(count / 1000);
        
        for (let page = 1; page < totalPages; page++) {
          const from = page * 1000;
          const to = from + 999;
          
          const { data: pageData, error: pageError } = await fetchPage(from, to);
          
          if (pageError) {
            console.error(`Erro ao buscar página ${page + 1}:`, pageError);
            continue; // Continua com as outras páginas mesmo se uma falhar
          }
          
          if (pageData) {
            allData = [...allData, ...pageData];
          }
        }
      }

      // Transformar dados para incluir serviços
      const appointmentsWithServices = (allData || []).map(appointment => ({
        ...appointment,
        services: appointment.appointment_services?.map((as: any) => ({
          id: as.service.id,
          name: as.service.name,
          duration_minutes_normal: as.service.duration_minutes_normal,
          duration_minutes_special: as.service.duration_minutes_special,
          is_chemical: as.service.is_chemical,
          price_at_booking: as.price_at_booking,
          commission_rate_applied: as.commission_rate_applied
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
      // Notificar outras sessões (admin/barbeiro)
      await notifyAppointmentsChange();
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
      // Notificar e recarregar
      await notifyAppointmentsChange();
      await reloadAppointments();
  
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
      await notifyAppointmentsChange();
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
      await notifyAppointmentsChange();
      // Recarregar agendamentos após atualização bem-sucedida
      await reloadAppointments();
      
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
    isRecurring?: boolean;
    recurrenceType?: 'daily' | 'weekly' | 'monthly';
    recurrencePattern?: any;
    recurrenceEndDate?: string;
  }): Promise<boolean> => {
    console.log('🚀 createScheduleBlock: Iniciando criação de bloqueio');
    console.log('📋 Dados recebidos:', blockData);
    console.log('👤 Usuário atual:', { id: user?.id, role: user?.role });
    
    try {
      let finalBarberId = blockData.barberId;
      console.log('🎯 barberId inicial:', finalBarberId);

      // Se for barbeiro, forçar o uso do próprio ID
      if (user?.role === 'barber') {
        console.log('👨‍💼 Usuário é barbeiro, buscando ID do barbeiro...');
        // Buscar o barbeiro correspondente ao usuário logado
        const { data: barberData, error: barberError } = await supabase
          .from('barbers')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (barberError || !barberData) {
          console.error('❌ Erro ao buscar barbeiro:', barberError);
          toast.error('Erro ao identificar barbeiro');
          return false;
        }

        finalBarberId = barberData.id;
        console.log('✅ ID do barbeiro encontrado:', finalBarberId);
      }

      // Admin pode criar bloqueio geral (para todos os barbeiros) sem especificar barbeiro
      if (user?.role === 'admin' && !finalBarberId) {
        console.log('ℹ️ Admin criando bloqueio geral (sem barbeiro específico)');
      }

      console.log('✅ Validação de barbeiro passou. finalBarberId:', finalBarberId);

      // Validar dados de recorrência
      if (blockData.isRecurring) {
        console.log('🔄 Validando dados de recorrência...');
        if (!blockData.recurrenceType || !blockData.recurrencePattern || !blockData.recurrenceEndDate) {
          console.error('❌ Dados de recorrência incompletos:', {
            recurrenceType: blockData.recurrenceType,
            recurrencePattern: blockData.recurrencePattern,
            recurrenceEndDate: blockData.recurrenceEndDate
          });
          toast.error('Dados de recorrência incompletos');
          return false;
        }
        console.log('✅ Dados de recorrência válidos');
      }

      const insertData: any = {
        barber_id: finalBarberId ?? null,
        block_date: blockData.date,
        start_time: blockData.startTime,
        end_time: blockData.endTime,
        reason: blockData.reason || null,
        created_by: user?.id || null,
        is_recurring: blockData.isRecurring || false,
        // Se não for recorrente, todos os campos de recorrência devem ser NULL
        recurrence_type: blockData.isRecurring ? blockData.recurrenceType : null,
        recurrence_pattern: blockData.isRecurring ? blockData.recurrencePattern : null,
        recurrence_end_date: blockData.isRecurring ? blockData.recurrenceEndDate : null
      };

      console.log('💾 Dados para inserção no banco:', insertData);
      console.log('🔄 Executando insert na tabela schedule_blocks...');

      const { error } = await supabase
        .from('schedule_blocks')
        .insert(insertData);

      if (error) {
        console.error('❌ Erro no insert:', error);
        throw error;
      }

      console.log('✅ Bloqueio inserido com sucesso no banco!');

      if (blockData.isRecurring) {
        toast.success('Bloqueio recorrente criado com sucesso!');
      } else {
        toast.success('Período bloqueado com sucesso!');
      }
      await notifyAppointmentsChange();
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
      await notifyAppointmentsChange();
      // Recarregar agendamentos após exclusão bem-sucedida
      await reloadAppointments();
      
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
      await notifyAppointmentsChange();
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
      await notifyAppointmentsChange();
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
    
    // Converter agendamentos (filtrar por barbeiro quando barberId informado)
    const appointmentEvents = appointments
      .filter(appointment => {
        if (!barberId) return true;
        const aptBarberId = appointment.barber_id || appointment.barber?.id;
        return aptBarberId === barberId;
      })
      .map(appointment => {
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

  const deleteScheduleBlock = async (blockId: number, deleteRecurringOptions?: {
    deleteType: 'single' | 'future' | 'all';
  }): Promise<boolean> => {
    try {
      // Se não especificou opções de recorrência, deletar apenas o bloqueio único
      if (!deleteRecurringOptions) {
        const { error } = await supabase
          .from('schedule_blocks')
          .delete()
          .eq('id', blockId);

        if (error) throw error;
        toast.success('Bloqueio excluído com sucesso!');
        await notifyAppointmentsChange();
        return true;
      }

      // Buscar informações do bloqueio para verificar se é recorrente
      const { data: blockInfo, error: fetchError } = await supabase
        .from('schedule_blocks')
        .select('is_recurring, parent_block_id')
        .eq('id', blockId)
        .single();

      if (fetchError) throw fetchError;

      const { deleteType } = deleteRecurringOptions;

      if (deleteType === 'single') {
        // Deletar apenas este bloqueio específico
        const { error } = await supabase
          .from('schedule_blocks')
          .delete()
          .eq('id', blockId);

        if (error) throw error;
        toast.success('Bloqueio excluído com sucesso!');
      } else if (deleteType === 'future') {
        // Deletar bloqueios futuros da série
        const parentId = blockInfo.parent_block_id || blockId;
        
        const { error } = await supabase
          .rpc('delete_recurring_blocks', {
            p_parent_block_id: parentId,
            p_delete_future_only: true
          });

        if (error) throw error;
        toast.success('Bloqueios futuros excluídos com sucesso!');
        await notifyAppointmentsChange();
      } else if (deleteType === 'all') {
        // Deletar toda a série de bloqueios
        const parentId = blockInfo.parent_block_id || blockId;
        
        const { error } = await supabase
          .rpc('delete_recurring_blocks', {
            p_parent_block_id: parentId,
            p_delete_future_only: false
          });

        if (error) throw error;
        toast.success('Série de bloqueios excluída com sucesso!');
        await notifyAppointmentsChange();
      }

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
    deleteScheduleBlock,
    reloadAppointments
  };
};