import React, { useState, useEffect } from 'react';
import { Calendar, Plus, RefreshCw, CheckCircle2, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppointments } from '../hooks/useAppointments';
import { useClients } from '../hooks/useClients';
import { useBarbers } from '../hooks/useBarbers';
import { useServices } from '../hooks/useServices';
import { AppointmentCalendar } from '../components/appointments/AppointmentCalendar';
import { AppointmentModal } from '../components/appointments/AppointmentModal';
import { AppointmentDetailsModal } from '../components/appointments/AppointmentDetailsModal';
import { PaymentMethodModal } from '../components/ui/PaymentMethodModal';
import { ConflictModal } from '../components/appointments/ConflictModal';
import { BlockScheduleModal } from '../components/appointments/BlockScheduleModal';
import { CalendarEvent } from '../types/appointment';
import { PaymentMethod } from '../types/payment';
import { Product } from '../types/product';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';
import { fromLocalDateTimeString, toLocalISOString, toLocalDateString, toLocalTimeString } from '../utils/dateHelpers';

export const Appointments: React.FC = () => {
  const { user } = useAuth();
  const {
    appointments,
    setAppointments,
    fetchAppointments,
    createAppointment,
    updateAppointment,
    updateAppointmentStatus,
    deleteAppointment,
    deleteRecurringAppointments,
    updateRecurringAppointments,
    convertToCalendarEvents,
    createScheduleBlock,
    deleteScheduleBlock,
    reloadAppointments
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

  // Exibir todos os barbeiros cadastrados, exceto o barbeiro "rose"
  const filteredBarbers = barbers.filter(b => (b.name || '').toLowerCase() !== 'rose');

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
  const [showBlockModal, setShowBlockModal] = useState(false);
  
  // Estados para modal de conflito
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictData, setConflictData] = useState<any>(null);
  const [pendingAppointmentData, setPendingAppointmentData] = useState<any>(null);
  const [pendingSelectedServices, setPendingSelectedServices] = useState<any[]>([]);
  const [pendingSelectedBarber, setPendingSelectedBarber] = useState<any>(null);
  const [pendingRecurrence, setPendingRecurrence] = useState<any>(null);

  // Estados para o calendário mensal
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date());

  // Funções para o calendário mensal
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Adicionar dias do mês anterior
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      days.push({ date: prevDate, isCurrentMonth: false });
    }
    
    // Adicionar dias do mês atual
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push({ date, isCurrentMonth: true });
    }
    
    // Adicionar dias do próximo mês para completar a grade
    const remainingDays = 42 - days.length; // 6 semanas * 7 dias
    for (let day = 1; day <= remainingDays; day++) {
      const nextDate = new Date(year, month + 1, day);
      days.push({ date: nextDate, isCurrentMonth: false });
    }
    
    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return date1.toDateString() === date2.toDateString();
  };

  const hasAppointments = (date: Date) => {
    return appointments.some(apt => {
      const aptDate = new Date(apt.appointment_datetime);
      return isSameDay(aptDate, date);
    });
  };

  const handleCalendarDateClick = (date: Date) => {
    setSelectedCalendarDate(date);
    setSelectedDate(date);
  };

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
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadAppointments = async () => {
    try {
      const response = await fetchAppointments(undefined, undefined, selectedBarberId || undefined);
      setAppointments(response.appointments);
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
      toast.error('Erro ao carregar agendamentos');
    }
  };

  // Função para recarregar com filtros atuais
  const reloadAppointmentsWithFilters = async () => {
    await reloadAppointments(undefined, undefined, selectedBarberId || undefined);
  };

  const loadClients = async () => {
    try {
      const response = await fetchClients(1, '', 1000); // Buscar todos os clientes
      setClients(response.clients);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      toast.error('Erro ao carregar clientes');
    }
  };

  const loadBarbers = async () => {
    try {
      const response = await fetchBarbers(1, '', 1000); // Buscar todos os barbeiros
      setBarbers(response.barbers);
    } catch (error) {
      console.error('Erro ao carregar barbeiros:', error);
      toast.error('Erro ao carregar barbeiros');
    }
  };

  const loadServices = async () => {
    try {
      const response = await fetchServices(1, '', 1000); // Buscar todos os serviços
      setServices(response.services);
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
      toast.error('Erro ao carregar serviços');
    }
  };

  const handleSelectSlot = (slotInfo: any) => {
    setSelectedDate(slotInfo.start);
    setIsModalOpen(true);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsDetailsModalOpen(true);
  };

  const handleNewAppointment = () => {
    setSelectedDate(undefined);
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (appointmentData: any, selectedServices: any[], selectedBarber: any, recurrence?: any) => {
    setModalLoading(true);
    try {
      // Verificar conflitos antes de criar
      const conflictCheck = await checkForConflicts(appointmentData, selectedServices, recurrence);
      
      if (conflictCheck.hasConflict) {
        setConflictData(conflictCheck);
        setPendingAppointmentData(appointmentData);
        setPendingSelectedServices(selectedServices);
        setPendingSelectedBarber(selectedBarber);
        setPendingRecurrence(recurrence);
        setConflictModalOpen(true);
        setIsModalOpen(false);
        return;
      }

      const created = await createAppointment(appointmentData, selectedServices, selectedBarber, recurrence);
      if (created) {
        setAppointments(prev => [created, ...prev.filter(a => a.id !== created.id)]);
      }
      setIsModalOpen(false);
      toast.success('Agendamento criado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao criar agendamento:', error);
      // Se a API retornou detalhes de conflitos (recorrente ou bloqueios), abrir modal de conflito
      if ((error as any)?.conflicts) {
        const conflicts = (error as any).conflicts;

        // Montar estrutura esperada pelo ConflictModal
        const firstDate = conflicts[0]?.date || new Date(appointmentData.appointment_datetime);

        // Buscar nomes dos serviços para o novo agendamento
        let servicesNames = '';
        if (appointmentData.service_ids && appointmentData.service_ids.length > 0) {
          const { data: servicesData } = await supabase
            .from('services')
            .select('name')
            .in('id', appointmentData.service_ids);
          servicesNames = servicesData?.map((s: any) => s.name).join(', ') || '';
        }

        // Buscar dados do cliente e barbeiro
        const [clientData, barberData] = await Promise.all([
          supabase
            .from('clients')
            .select('name')
            .eq('id', appointmentData.client_id)
            .single(),
          supabase
            .from('barbers')
            .select('name')
            .eq('id', appointmentData.barber_id)
            .single()
        ]);

        setConflictData({
          hasConflict: true,
          conflictingAppointments: conflicts.flatMap((c: any) => c.conflicts || []).map((c: any) => ({
            id: c.id,
            appointment_datetime: c.appointment_datetime,
            client_name: c.client_name,
            barber_name: barberData.data?.name || '',
            services_names: servicesNames,
            duration_minutes: c.duration_minutes || 30
          })),
          newAppointment: {
            ...appointmentData,
            appointment_datetime: firstDate instanceof Date ? firstDate.toISOString() : appointmentData.appointment_datetime,
            client_name: clientData.data?.name || 'Cliente não informado',
            barber_name: barberData.data?.name || 'Barbeiro não informado',
            services_names: servicesNames,
            duration_minutes: appointmentData.duration_minutes || 30
          }
        });

        setPendingAppointmentData(appointmentData);
        setPendingSelectedServices(selectedServices);
        setPendingSelectedBarber(selectedBarber);
        setPendingRecurrence(recurrence);
        setConflictModalOpen(true);
        setIsModalOpen(false);
      } else if (error.message?.includes('conflito')) {
        toast.error(error.message);
      } else {
        toast.error('Erro ao criar agendamento');
      }
    } finally {
      setModalLoading(false);
    }
  };

  // Gerar datas baseado na recorrência (cópia simplificada da lógica usada na criação)
  const generateRecurrenceDates = (startDate: Date, recurrence?: any): Date[] => {
    const dates = [startDate];
    if (!recurrence || recurrence.type === 'none') return dates;

    const interval = recurrence.interval || 1;
    const endDate = recurrence.end_date ? new Date(recurrence.end_date) : null;
    let maxOccurrences = 52;
    if (recurrence.occurrences && recurrence.occurrences > 1) {
      maxOccurrences = Math.min(recurrence.occurrences, 52);
    } else if (endDate) {
      // Calcular quantidade aproximada até a data limite
      // Mantemos lógica simples: limite por tipo
      maxOccurrences = 52;
    } else {
      return dates;
    }

    for (let i = 1; i < maxOccurrences; i++) {
      const nextDate = new Date(startDate);
      switch (recurrence.type) {
        case 'weekly':
          nextDate.setDate(startDate.getDate() + (i * 7 * interval));
          break;
        case 'biweekly':
          nextDate.setDate(startDate.getDate() + (i * 14));
          break;
        case 'monthly':
          nextDate.setMonth(startDate.getMonth() + (i * interval));
          break;
      }
      if (endDate && nextDate > endDate) break;
      dates.push(nextDate);
    }
    return dates;
  };

  const checkForConflicts = async (appointmentData: any, selectedServices?: any[], recurrence?: any) => {
    try {
      // Validar se appointment_datetime existe e é válido
      if (!appointmentData.appointment_datetime) {
        console.error('appointment_datetime não fornecido');
        return { hasConflict: false };
      }

      const initialStart = new Date(appointmentData.appointment_datetime);
      
      // Verificar se a data é válida
      if (isNaN(initialStart.getTime())) {
        console.error('Data inválida:', appointmentData.appointment_datetime);
        return { hasConflict: false };
      }

      // Calcular duração correta
      let durationMinutes = appointmentData.duration_minutes && appointmentData.duration_minutes > 0
        ? appointmentData.duration_minutes
        : 0;

      if (!durationMinutes) {
        // Buscar se o barbeiro é especial para escolher a duração correta dos serviços
        const { data: barberInfo } = await supabase
          .from('barbers')
          .select('is_special_barber')
          .eq('id', appointmentData.barber_id)
          .single();

        const isSpecialBarber = barberInfo?.is_special_barber || false;

        if (selectedServices && selectedServices.length > 0) {
          durationMinutes = selectedServices.reduce((sum: number, service: any) => {
            const normal = service.duration_minutes_normal ?? 30;
            const special = service.duration_minutes_special ?? normal;
            const use = isSpecialBarber ? special : normal;
            return sum + use;
          }, 0);
        } else {
          // Fallback caso nada venha informado
          durationMinutes = 30;
        }
      }

      const appointmentDates = generateRecurrenceDates(fromLocalDateTimeString(appointmentData.appointment_datetime), recurrence);
      const minDate = new Date(Math.min(...appointmentDates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...appointmentDates.map(d => d.getTime())));
      const rangeStart = new Date(minDate); rangeStart.setHours(0,0,0,0);
      const rangeEnd = new Date(maxDate); rangeEnd.setHours(23,59,59,999);

      const { data: dayAppointments, error: apErr } = await supabase
        .from('appointments')
        .select('id, appointment_datetime, duration_minutes, client_name, services_names')
        .eq('barber_id', appointmentData.barber_id)
        .eq('status', 'scheduled')
        .gte('appointment_datetime', rangeStart.toISOString())
        .lte('appointment_datetime', rangeEnd.toISOString());
      if (apErr) throw apErr;

      const { data: dayBlocks, error: blErr } = await supabase
        .from('schedule_blocks')
        .select('id, reason, start_time, end_time, barber_id, block_date')
        .gte('block_date', toLocalDateString(rangeStart))
        .lte('block_date', toLocalDateString(rangeEnd))
        .or(`barber_id.eq.${appointmentData.barber_id},barber_id.is.null`);
      if (blErr) throw blErr;

      const allConflicts: any[] = [];
      for (const date of appointmentDates) {
        const appointmentStart = date;
        const appointmentEnd = new Date(appointmentStart.getTime() + (durationMinutes * 60000));
        const dateStr = toLocalDateString(appointmentStart);

        const sameDayAppointments = (dayAppointments || []).filter(a => {
          const d = new Date(a.appointment_datetime);
          return d.toDateString() === appointmentStart.toDateString();
        });
        const conflictingAppointments = sameDayAppointments.filter(existing => {
          const existingStart = new Date(existing.appointment_datetime);
          const existingDuration = existing.duration_minutes || 30;
          const existingEnd = new Date(existingStart.getTime() + (existingDuration * 60000));
          return (appointmentStart < existingEnd && appointmentEnd > existingStart);
        });
        if (conflictingAppointments.length > 0) {
          allConflicts.push(...conflictingAppointments.map(c => ({
            id: c.id,
            client_name: c.client_name,
            appointment_datetime: c.appointment_datetime,
            duration_minutes: c.duration_minutes
          })));
        }

        const blocksForDay = (dayBlocks || []).filter(b => b.block_date === dateStr);
        const conflictsFromBlocks = blocksForDay.filter(b => {
          const blockStartStr = b.start_time;
          const blockEndStr = b.end_time;
          const blockStart = new Date(`${dateStr}T${blockStartStr}`);
          const blockEnd = new Date(`${dateStr}T${blockEndStr}`);
          return (appointmentStart < blockEnd && appointmentEnd > blockStart);
        });
        if (conflictsFromBlocks.length > 0) {
          allConflicts.push(...conflictsFromBlocks.map(b => ({
            id: b.id,
            client_name: `[Bloqueio] ${b.reason || 'Período bloqueado'}`,
            appointment_datetime: `${dateStr}T${b.start_time}`,
            duration_minutes: 0
          })));
        }
      }

      if (allConflicts.length > 0) {
        // Buscar dados do cliente e barbeiro para o novo agendamento
        const [clientData, barberData] = await Promise.all([
          supabase
            .from('clients')
            .select('name')
            .eq('id', appointmentData.client_id)
            .single(),
          supabase
            .from('barbers')
            .select('name')
            .eq('id', appointmentData.barber_id)
            .single()
        ]);

        // Buscar nomes dos serviços
        let servicesNames = '';
        if (appointmentData.service_ids && appointmentData.service_ids.length > 0) {
          const { data: servicesData } = await supabase
            .from('services')
            .select('name')
            .in('id', appointmentData.service_ids);
          
          servicesNames = servicesData?.map(s => s.name).join(', ') || '';
        }

        return {
          hasConflict: true,
          conflictingAppointments: allConflicts,
          newAppointment: {
            ...appointmentData,
            client_name: clientData.data?.name || 'Cliente não informado',
            barber_name: barberData.data?.name || 'Barbeiro não informado',
            services_names: servicesNames,
            duration_minutes: durationMinutes
          }
        };
      }

      return { hasConflict: false };
    } catch (error) {
      console.error('Erro ao verificar conflitos:', error);
      return { hasConflict: false };
    }
  };

  const handleConflictConfirm = async () => {
    if (!pendingAppointmentData) return;

    setModalLoading(true);
    try {
      const created = await createAppointment(
        pendingAppointmentData, 
        pendingSelectedServices, 
        pendingSelectedBarber, 
        pendingRecurrence,
        true // allowOverlap = true para permitir sobreposição
      );
      if (created) {
        setAppointments(prev => [created, ...prev.filter(a => a.id !== created.id)]);
      }
      setConflictModalOpen(false);
      setPendingAppointmentData(null);
      setPendingSelectedServices([]);
      setPendingSelectedBarber(null);
      setPendingRecurrence(null);
      setConflictData(null);
      toast.success('Agendamento criado com sucesso!');
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      toast.error('Erro ao criar agendamento');
    } finally {
      setModalLoading(false);
    }
  };

  const handleConflictCancel = () => {
    setConflictModalOpen(false);
    setPendingAppointmentData(null);
    setPendingSelectedServices([]);
    setPendingSelectedBarber(null);
    setPendingRecurrence(null);
    setConflictData(null);
    setIsModalOpen(true);
  };

  const handleEventDrop = async (info: any) => {
    try {
      const event = info.event;
      const newStart = info.event.start;
      
      if (event.extendedProps.type === 'appointment') {
        await updateAppointment(event.extendedProps.appointment.id, {
          appointment_datetime: newStart.toISOString()
        });
        await reloadAppointmentsWithFilters();
        toast.success('Agendamento reagendado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao reagendar:', error);
      toast.error('Erro ao reagendar agendamento');
      info.revert();
    }
  };

  // Função para registrar venda de produtos
  const registerProductSale = async (appointmentId: number, soldProducts: { product: Product; quantity: number }[], paymentMethod?: PaymentMethod) => {
    try {
      // Buscar dados do agendamento para obter barbeiro e cliente
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .select('barber_id, client_id, barbers(commission_rate_product)')
        .eq('id', appointmentId)
        .single();

      if (appointmentError) throw appointmentError;

      // Calcular total da venda de produtos
      const total = soldProducts.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

      // Criar registro de venda
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          client_id: appointment.client_id,
          barber_id: appointment.barber_id,
          sale_datetime: new Date().toISOString(),
          total_amount: total,
          payment_method: paymentMethod || 'money',
          appointment_id: appointmentId
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Registrar produtos vendidos e atualizar estoque
      for (const item of soldProducts) {
        // Inserir item vendido
        const { error: itemError } = await supabase
          .from('sale_products')
          .insert({
            sale_id: sale.id,
            product_id: item.product.id,
            quantity: item.quantity,
            price_at_sale: item.product.price,
            commission_rate_applied: appointment.barbers?.commission_rate_product || 0
          });

        if (itemError) throw itemError;

        // Atualizar estoque
        const { error: stockError } = await supabase
          .from('products')
          .update({ 
            stock_quantity: item.product.stock_quantity - item.quantity 
          })
          .eq('id', item.product.id);

        if (stockError) throw stockError;
      }

      console.log('Venda de produtos registrada com sucesso:', sale.id);
    } catch (error) {
      console.error('Erro ao registrar venda de produtos:', error);
      throw error;
    }
  };

  const handleStatusChange = async (appointmentId: number, status: string, paymentMethod?: PaymentMethod, finalAmount?: number, soldProducts?: { product: Product; quantity: number }[]) => {
    try {
      await updateAppointmentStatus(appointmentId, status, paymentMethod, finalAmount);
      
      // Nota: O registro de produtos vendidos agora é feito automaticamente pelo PaymentConfirmationModal
      // quando há produtos selecionados durante a finalização do agendamento
      
      await reloadAppointmentsWithFilters();
      
      if (status === 'completed') {
        toast.success('Agendamento finalizado com sucesso!');
      } else if (status === 'cancelled') {
        toast.success('Agendamento cancelado');
      } else {
        toast.success('Status atualizado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status do agendamento');
    }
  };

  const handleCompleteWithPayment = (event: CalendarEvent) => {
    setAppointmentToComplete(event);
    setPaymentModalOpen(true);
  };

  const handlePaymentSelection = async (paymentMethod: PaymentMethod) => {
    if (!appointmentToComplete) return;

    setModalLoading(true);
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

      await reloadAppointmentsWithFilters();
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

  const handleBlockSchedule = async (blockData: any) => {
    console.log('🚀 handleBlockSchedule: Recebido blockData:', blockData);
    // Guardar contra payload inesperado (ex.: apenas string com data)
    const payload = typeof blockData === 'string' ? { date: blockData } : blockData;
    if (!payload) {
      toast.error('Payload de bloqueio inválido');
      return;
    }
    // Verificar presença de horários em qualquer convenção
    const hasStart = !!(payload.startTime ?? payload.start_time);
    const hasEnd = !!(payload.endTime ?? payload.end_time);
    if (!hasStart || !hasEnd) {
      console.error('❌ handleBlockSchedule: horários ausentes', { startTime: payload.startTime ?? payload.start_time, endTime: payload.endTime ?? payload.end_time });
      toast.error('Informe horário de início e fim');
      return;
    }
    try {
      const success = await createScheduleBlock(payload);
      console.log('📊 Resultado do createScheduleBlock:', success);
      
      if (success) {
        console.log('✅ Bloqueio criado com sucesso, recarregando appointments...');
        await reloadAppointmentsWithFilters();
        setShowBlockModal(false);
      } else {
        console.error('❌ createScheduleBlock retornou false');
      }
    } catch (error) {
      console.error('❌ Erro ao bloquear horário:', error);
      toast.error('Erro ao bloquear horário');
    }
  };

  const handleDeleteBlock = async (blockId: number) => {
    console.log('🔍 Appointments.handleDeleteBlock chamado com ID:', blockId);
    try {
      console.log('🗑️ Chamando deleteScheduleBlock...');
      await deleteScheduleBlock(blockId);
      console.log('✅ deleteScheduleBlock executado com sucesso');
      
      console.log('🔄 Recarregando agendamentos...');
      await reloadAppointmentsWithFilters();
      console.log('✅ Agendamentos recarregados');
      
      console.log('🚪 Fechando modal...');
      setIsDetailsModalOpen(false);
      console.log('✅ Modal fechado');
      
      toast.success('Bloqueio removido com sucesso!');
      console.log('✅ Toast de sucesso exibido');
    } catch (error) {
      console.error('❌ Erro ao remover bloqueio:', error);
      toast.error('Erro ao remover bloqueio');
    }
  };

  const handleDeleteAppointment = async (appointmentId: number) => {
    try {
      const success = await deleteAppointment(appointmentId.toString());
      if (success) {
        await reloadAppointmentsWithFilters();
        toast.success('Agendamento excluído com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao excluir agendamento:', error);
      toast.error('Erro ao excluir agendamento');
    }
  };

  const isLoading = loading;

  return (
    <div className="h-full" style={{ minHeight: '100vh', paddingBottom: '1rem' }}>
      <Toaster position="top-right" />

      {/* Layout Desktop (≥1024px) - com sidebar */}
      <div className="hidden lg:flex lg:space-x-4">
        {/* Sidebar esquerda com calendário mensal e botões */}
        <div className="w-56 flex-shrink-0 space-y-2">
          {/* Calendário Mensal */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-gray-900">
                {currentMonth.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
              </h2>
              <div className="flex space-x-0.5">
                <button
                  onClick={() => navigateMonth('prev')}
                  className="p-0.5 hover:bg-gray-100 rounded transition-colors"
                >
                  <ChevronLeft className="h-3 w-3 text-gray-600" />
                </button>
                <button
                  onClick={() => navigateMonth('next')}
                  className="p-0.5 hover:bg-gray-100 rounded transition-colors"
                >
                  <ChevronRight className="h-3 w-3 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Cabeçalho dos dias da semana */}
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => (
                <div key={index} className="text-center text-xs font-medium text-gray-500 py-0.5">
                  {day}
                </div>
              ))}
            </div>

            {/* Grade do calendário */}
            <div className="grid grid-cols-7 gap-0.5">
              {getDaysInMonth(currentMonth).map((dayInfo, index) => {
                const { date, isCurrentMonth } = dayInfo;
                const isSelected = isSameDay(date, selectedCalendarDate);
                const isCurrentDay = isToday(date);
                const hasApts = hasAppointments(date);

                return (
                  <button
                    key={index}
                    onClick={() => handleCalendarDateClick(date)}
                    className={`
                      relative p-1 text-xs rounded transition-all duration-200 hover:bg-gray-100 h-6 w-6
                      ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-900'}
                      ${isSelected ? 'bg-blue-500 text-white hover:bg-blue-600' : ''}
                      ${isCurrentDay && !isSelected ? 'bg-blue-50 text-blue-600 font-semibold' : ''}
                    `}
                  >
                    {date.getDate()}
                    {hasApts && (
                      <div className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-0.5 h-0.5 rounded-full ${
                        isSelected ? 'bg-white' : 'bg-blue-500'
                      }`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 space-y-1.5">
            <h3 className="text-xs font-semibold text-gray-900 mb-1">Ações</h3>
            
            <button
              onClick={handleNewAppointment}
              className="w-full inline-flex items-center justify-center px-2 py-1.5 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-gray-900 transition-colors"
            >
              <Plus className="h-3 w-3 mr-1" />
              Novo
            </button>

            <>
              <button
                onClick={() => setShowBlockModal(true)}
                className="w-full inline-flex items-center justify-center px-2 py-1.5 border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-gray-900 transition-colors"
              >
                <Lock className="h-3 w-3 mr-1" />
                Bloquear
              </button>

              {/* Botão de concluir todos removido conforme solicitado */}
              {false && getTodayScheduledCount() > 0 && (
                <button
                  onClick={handleCompleteAllToday}
                  disabled={completingAll || isLoading}
                  className="w-full inline-flex items-center justify-center px-2 py-1.5 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <CheckCircle2 className={`h-3 w-3 mr-1 ${completingAll ? 'animate-spin' : ''}`} />
                  Concluir ({getTodayScheduledCount()})
                </button>
              )}
            </>
          </div>

          {/* Filtro de Barbeiro (apenas para admin) */}
          {user?.role === 'admin' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
              <h3 className="text-xs font-semibold text-gray-900 mb-1">Filtros</h3>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                  Barbeiro:
                </label>
                <select
                  value={selectedBarberId || ''}
                  onChange={(e) => setSelectedBarberId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-2 py-1 border border-gray-300 rounded bg-white text-xs focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-transparent"
                >
                  <option value="">Todos</option>
                  {filteredBarbers.map((barber) => (
                    <option key={barber.id} value={barber.id}>
                      {barber.name}
                    </option>
                  ))}
                </select>
                {selectedBarberId && (
                  <button
                    onClick={() => setSelectedBarberId(null)}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Conteúdo principal - Desktop */}
        <div className="flex-1 flex flex-col space-y-3 min-w-0">
          {/* Content */}
          <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-2 min-h-0 relative overflow-hidden" style={{ height: 'calc(100vh - 120px)', maxHeight: 'calc(100vh - 120px)' }}>
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
                onDeleteAppointment={handleDeleteAppointment}
                onDeleteBlock={handleDeleteBlock}
                loading={isLoading}
                barbers={filteredBarbers}
                selectedDate={selectedCalendarDate}
                instantBlockDeletion={true}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Layout Mobile/Tablet (<1024px) - otimizado para ocupar toda a largura */}
      <div className="lg:hidden">
        <div className="px-2 py-2 space-y-3">
          {/* Botões de Ação Mobile */}
          <div className="bg-white rounded-md border border-gray-200 px-3 py-3">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Ações</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleNewAppointment}
                className="inline-flex items-center justify-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo
              </button>

              <button
                onClick={() => setShowBlockModal(true)}
                className="inline-flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-colors"
              >
                <Lock className="h-4 w-4 mr-2" />
                Bloquear
              </button>
            </div>
          </div>

          {/* Filtro de Barbeiro Mobile (apenas para admin) */}
          {user?.role === 'admin' && (
            <div className="bg-white rounded-md border border-gray-200 px-3 py-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Filtros</h3>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Barbeiro:
                </label>
                <select
                  value={selectedBarberId || ''}
                  onChange={(e) => setSelectedBarberId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  <option value="">Todos os barbeiros</option>
                  {filteredBarbers.map((barber) => (
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

          {/* Content Mobile - sem bordas e sem padding para preencher a tela */}
          <div className="min-h-0 relative overflow-hidden" style={{ height: 'calc(100vh - 120px)', maxHeight: 'calc(100vh - 120px)' }}>
            <div className="relative z-10 h-full">
              <AppointmentCalendar
                events={events}
                onSelectSlot={handleSelectSlot}
                onSelectEvent={handleSelectEvent}
                onEventDrop={handleEventDrop}
                onStatusChange={handleStatusChange}
                onCompleteWithPayment={handleCompleteWithPayment}
                onDeleteAppointment={handleDeleteAppointment}
                onDeleteBlock={handleDeleteBlock}
                loading={isLoading}
                barbers={filteredBarbers}
                selectedDate={selectedCalendarDate}
                instantBlockDeletion={true}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        clients={clients}
        setClients={setClients}
        barbers={filteredBarbers}
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
        onDeleteBlock={handleDeleteBlock}
        onDeleteAppointment={handleDeleteAppointment}
        onDeleteRecurringAppointments={deleteRecurringAppointments}
        onUpdateRecurringAppointments={updateRecurringAppointments}
        canChangeStatus={true}
        clients={clients}
        barbers={filteredBarbers}
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

const updateAppointment = async (appointmentId: number, updateData: any) => {
  try {
    const success = await updateAppointment(appointmentId, updateData);
    if (success) {
      await reloadAppointmentsWithFilters();
      toast.success('Agendamento atualizado com sucesso!');
    }
  } catch (error) {
    console.error('Erro ao atualizar agendamento:', error);
    toast.error('Erro ao atualizar agendamento');
  }
};
