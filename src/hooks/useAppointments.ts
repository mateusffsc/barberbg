import { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Appointment, AppointmentFormData, AppointmentsResponse, CalendarEvent } from '../types/appointment';
import { Service } from '../types/service';
import { Barber } from '../types/barber';
import { PaymentMethod } from '../types/payment';
import { useAuth } from '../contexts/AuthContext';
import { fromLocalDateTimeString, toLocalISOString, toLocalDateString, toLocalTimeString } from '../utils/dateHelpers';
import toast from 'react-hot-toast';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import { safeRandomUUID } from '../utils/uuid';
import { logAudit } from '../utils/auditLogger';

const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};

export const useAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const { user } = useAuth();
  const lastFiltersRef = useRef<{ startDate?: Date; endDate?: Date; barberId?: number }>({});
  const broadcastChannelRef = useRef<RealtimeChannel | null>(null);
  const reloadTimerRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeActiveRef = useRef<boolean>(false);
  
  // 🚀 CACHE INTELIGENTE para otimização de performance
  const cacheRef = useRef<Map<string, { data: AppointmentsResponse; timestamp: number; version: string | null; meta: { startIso: string; endIso: string; barberId: number | null } }>>(new Map());
  const CACHE_DURATION = 2 * 60 * 1000; // 2 minutos de TTL
  
  // Função para limpar cache quando dados são modificados
  const clearCache = useCallback(() => {
    devLog('🗑️ Limpando cache de agendamentos');
    cacheRef.current.clear();
  }, []);

  const getCacheKey = useCallback((startDate: Date, endDate: Date, barberId?: number) => {
    return `${startDate.toISOString()}-${endDate.toISOString()}-${barberId || 'all'}`;
  }, []);

  const touchCache = useCallback((cacheKey: string) => {
    const cached = cacheRef.current.get(cacheKey);
    if (!cached) return false;
    cacheRef.current.set(cacheKey, { ...cached, timestamp: Date.now() });
    return true;
  }, []);

  const invalidateCacheKey = useCallback((cacheKey: string) => {
    cacheRef.current.delete(cacheKey);
  }, []);

  const upsertAppointmentInCache = useCallback((appointment: Appointment) => {
    const sortAsc = (list: Appointment[]) => {
      return [...list].sort((a, b) => new Date(a.appointment_datetime).getTime() - new Date(b.appointment_datetime).getTime());
    };

    const appointmentDate = new Date(appointment.appointment_datetime);

    cacheRef.current.forEach((entry, key) => {
      const startDate = new Date(entry.meta.startIso);
      const endDate = new Date(entry.meta.endIso);
      const inRange = appointmentDate >= startDate && appointmentDate <= endDate;
      const barberOk = entry.meta.barberId ? appointment.barber_id === entry.meta.barberId : true;
      const shouldInclude = inRange && barberOk;

      const existing = entry.data.appointments;
      const idx = existing.findIndex(a => a.id === appointment.id);

      if (!shouldInclude) {
        if (idx < 0) return;
        const nextAppointments = existing.filter(a => a.id !== appointment.id);
        const nextCount = Math.max(0, entry.data.count - 1);
        cacheRef.current.set(key, {
          ...entry,
          data: { appointments: nextAppointments, count: nextCount },
          timestamp: Date.now()
        });
        return;
      }

      const nextAppointments = idx >= 0
        ? sortAsc(existing.map(a => (a.id === appointment.id ? appointment : a)))
        : sortAsc([...existing, appointment]);

      const nextCount = idx >= 0 ? entry.data.count : entry.data.count + 1;
      const nextVersion = appointment.updated_at
        ? (entry.version && entry.version > appointment.updated_at ? entry.version : appointment.updated_at)
        : entry.version;

      cacheRef.current.set(key, {
        ...entry,
        data: { appointments: nextAppointments, count: nextCount },
        timestamp: Date.now(),
        version: nextVersion
      });
    });
  }, []);

  const removeAppointmentFromCache = useCallback((appointmentId: number) => {
    cacheRef.current.forEach((entry, key) => {
      const existing = entry.data.appointments;
      const idx = existing.findIndex(a => a.id === appointmentId);
      if (idx < 0) return;
      const nextAppointments = existing.filter(a => a.id !== appointmentId);
      const nextCount = Math.max(0, entry.data.count - 1);
      cacheRef.current.set(key, {
        ...entry,
        data: { appointments: nextAppointments, count: nextCount },
        timestamp: Date.now()
      });
    });
  }, []);

  // Função para recarregar appointments
  const reloadAppointments = useCallback(async (startDate?: Date, endDate?: Date, barberId?: number) => {
    devLog('🔄 useAppointments: Iniciando recarregamento de agendamentos...');
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

      devLog('✅ useAppointments: Agendamentos recarregados com sucesso:', response.appointments.length, 'agendamentos');
    } catch (error) {
      console.error('❌ useAppointments: Erro ao recarregar agendamentos:', error);
    }
  }, []);

  // Debounce OTIMIZADO para evitar corrida entre INSERT do appointment e INSERT de appointment_services
  const debouncedReload = useCallback((delayMs: number = 800) => { // 🚀 AUMENTADO de 400ms para 800ms
    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current);
    }
    reloadTimerRef.current = setTimeout(() => {
      reloadAppointments();
    }, delayMs);
  }, [reloadAppointments]);

  const getEffectiveFilters = useCallback(() => {
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    defaultStart.setDate(defaultStart.getDate() - 15); // OTIMIZADO: apenas 15 dias no passado
    const defaultEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    defaultEnd.setDate(defaultEnd.getDate() + 75); // OTIMIZADO: 75 dias no futuro (total: 90 dias)
    const startDate = lastFiltersRef.current.startDate ?? defaultStart;
    const endDate = lastFiltersRef.current.endDate ?? new Date(defaultEnd.getFullYear(), defaultEnd.getMonth(), defaultEnd.getDate(), 23, 59, 59, 999);
    const barberId = lastFiltersRef.current.barberId ?? (user?.role === 'barber' ? user.barber?.id : undefined);
    return { startDate, endDate, barberId };
  }, [user]);

  const isRowWithinFilters = useCallback((row: any) => {
    if (!row || !row.appointment_datetime) return false;
    const { startDate, endDate, barberId } = getEffectiveFilters();
    const dt = new Date(row.appointment_datetime);
    const inRange = dt >= startDate && dt <= endDate;
    const barberOk = barberId ? row.barber_id === barberId : true;
    return inRange && barberOk;
  }, [getEffectiveFilters]);

  const fetchAppointmentById = useCallback(async (id: number) => {
    // 🚀 QUERY OTIMIZADA - usar dados já disponíveis nos campos
    const { data } = await supabase
      .from('appointments')
      .select(`
        id, client_id, barber_id, client_name, client_phone, barber_name, barber_phone,
        appointment_datetime, appointment_date, appointment_time, status, total_price, final_amount,
        duration_minutes, services_names, services_ids, note, recurrence_group_id,
        created_at, updated_at, payment_method, reminder_sent
      `)
      .eq('id', id)
      .single();
      
    if (!data) return null;
    
    // Criar serviços a partir dos dados já disponíveis
    const services = [];
    if (data.services_names && data.services_ids) {
      const serviceNames = data.services_names.split(', ');
      const serviceIds = data.services_ids || [];
      
      serviceNames.forEach((name, index) => {
        services.push({
          id: serviceIds[index] || index + 1,
          name: name.trim(),
          price_at_booking: data.total_price / serviceNames.length,
          duration_minutes_normal: data.duration_minutes || 30,
          duration_minutes_special: data.duration_minutes || 30,
          is_chemical: false,
          commission_rate_applied: 0.1
        });
      });
    }
    
    return {
      ...data,
      client: data.client_name ? {
        id: data.client_id,
        name: data.client_name
      } : null,
      barber: data.barber_name ? {
        id: data.barber_id,
        name: data.barber_name,
        is_special_barber: false
      } : null,
      services
    };
  }, []);

  const sortAppointmentsAsc = useCallback((list: any[]) => {
    return [...list].sort((a, b) => new Date(a.appointment_datetime).getTime() - new Date(b.appointment_datetime).getTime());
  }, []);

  const handleInsertAppointment = useCallback(async (payload: any) => {
    const row = payload?.new;
    if (!row) return;
    if (!isRowWithinFilters(row)) return;
    const full = await fetchAppointmentById(row.id);
    if (!full) return;
    setAppointments(prev => sortAppointmentsAsc([full, ...prev.filter(a => a.id !== full.id)]));
    setTotalCount(prev => prev + 1);
  }, [isRowWithinFilters, fetchAppointmentById, sortAppointmentsAsc]);

  const handleUpdateAppointment = useCallback(async (payload: any) => {
    const row = payload?.new;
    const oldRow = payload?.old;
    if (!row && !oldRow) return;
    const inFilters = row ? isRowWithinFilters(row) : false;
    if (inFilters) {
      const full = await fetchAppointmentById(row.id);
      if (!full) return;
      setAppointments(prev => {
        const idx = prev.findIndex(a => a.id === row.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = full;
          return sortAppointmentsAsc(next);
        }
        return sortAppointmentsAsc([full, ...prev]);
      });
    } else {
      const idToRemove = row?.id ?? oldRow?.id;
      if (idToRemove) {
        setAppointments(prev => prev.filter(a => a.id !== idToRemove));
        setTotalCount(prev => Math.max(0, prev - 1));
      }
    }
  }, [isRowWithinFilters, fetchAppointmentById, sortAppointmentsAsc]);

  const handleDeleteAppointment = useCallback((payload: any) => {
    const row = payload?.old;
    if (!row || !row.id) return;
    setAppointments(prev => prev.filter(a => a.id !== row.id));
    setTotalCount(prev => Math.max(0, prev - 1));
  }, []);

  // Configurar subscription em tempo real para appointments (SEM FILTRO para melhor sincronização)
  useRealtimeSubscription({
    table: 'appointments',
    onInsert: (payload) => {
      devLog('📥 INSERT detectado:', payload.new?.id);
      clearCache(); // Limpar cache imediatamente
      handleInsertAppointment(payload);
    },
    onUpdate: (payload) => {
      devLog('✏️ UPDATE detectado:', payload.new?.id);
      clearCache(); // Limpar cache imediatamente
      handleUpdateAppointment(payload);
    },
    onDelete: (payload) => {
      devLog('🗑️ DELETE detectado:', payload.old?.id);
      clearCache(); // Limpar cache imediatamente
      handleDeleteAppointment(payload);
    },
    onChange: (payload) => {
      devLog('🔄 Evento genérico detectado:', payload);
      clearCache(); // Limpar cache imediatamente
      debouncedReload(100); // Reduzido de 400ms para 100ms
    },
    showNotifications: false, // Desabilitar notificações automáticas para evitar spam
    filter: undefined // 🚀 REMOVIDO FILTRO para receber TODOS os eventos
  });

  // Assinar mudanças em bloqueios de agenda para refletir imediatamente na visão do calendário
  useRealtimeSubscription({
    table: 'schedule_blocks',
    onInsert: (payload) => {
      devLog('📥 useAppointments: INSERT em schedule_blocks:', payload);
      clearCache(); // Limpar cache imediatamente
      debouncedReload(100); // Reduzido de 400ms para 100ms
    },
    onUpdate: (payload) => {
      devLog('✏️ useAppointments: UPDATE em schedule_blocks:', payload);
      clearCache(); // Limpar cache imediatamente
      debouncedReload(100); // Reduzido de 300ms para 100ms
    },
    onDelete: (payload) => {
      devLog('🗑️ useAppointments: DELETE em schedule_blocks:', payload);
      clearCache(); // Limpar cache imediatamente
      debouncedReload(100); // Reduzido de 300ms para 100ms
    },
    onChange: (payload) => {
      devLog('🔄 useAppointments: Evento genérico em schedule_blocks:', payload);
      clearCache(); // Limpar cache imediatamente
      debouncedReload(100); // Reduzido de 350ms para 100ms
    },
    showNotifications: false
  });

  // Canal de broadcast para sincronização imediata entre sessões (admin/barbeiro)
  useEffect(() => {
    const channel = supabase
      .channel('appointments-sync')
      .on('broadcast', { event: 'appointments_change' }, (payload) => {
        devLog('📡 Broadcast recebido: appointments_change', payload);
        const broadcast = payload?.payload;
        const appointmentId = broadcast?.appointmentId;
        const action = broadcast?.action;

        if (appointmentId !== null && appointmentId !== undefined) {
          const numericId = typeof appointmentId === 'string' ? Number(appointmentId) : appointmentId;
          if (!Number.isFinite(numericId)) {
            clearCache();
            debouncedReload(100);
            return;
          }

          if (action === 'deleted') {
            removeAppointmentFromCache(numericId);
            setAppointments(prev => prev.filter(a => a.id !== numericId));
            return;
          }

          void (async () => {
            try {
              const full = await fetchAppointmentById(numericId);
              if (!full) {
                clearCache();
                debouncedReload(100);
                return;
              }

              upsertAppointmentInCache(full);

              const inFilters = isRowWithinFilters(full);
              setAppointments(prev => {
                const idx = prev.findIndex(a => a.id === full.id);
                if (inFilters) {
                  if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = full;
                    return sortAppointmentsAsc(next);
                  }
                  setTotalCount(c => c + 1);
                  return sortAppointmentsAsc([full, ...prev]);
                }

                if (idx >= 0) {
                  setTotalCount(c => Math.max(0, c - 1));
                  return prev.filter(a => a.id !== full.id);
                }

                return prev;
              });
            } catch (error) {
              console.error('❌ Erro ao processar broadcast appointments_change:', error);
              clearCache();
              debouncedReload(100);
            }
          })();

          return;
        }

        clearCache(); // Fallback para mudanças sem appointmentId
        debouncedReload(100); // Reduzido de 450ms para 100ms
      })
      .on('broadcast', { event: 'heartbeat' }, (payload) => {
        devLog('💓 Heartbeat recebido:', payload.payload?.timestamp);
      })
      .subscribe((status) => {
        devLog('🔌 Broadcast channel status:', status);
        realtimeActiveRef.current = status === 'SUBSCRIBED';
        
        // Reconectar automaticamente em caso de erro
        if (status === 'CHANNEL_ERROR') {
          devLog('🔄 Tentando reconectar broadcast channel...');
          setTimeout(() => {
            channel.subscribe();
          }, 3000);
        }
      });

    broadcastChannelRef.current = channel;

    // 🚀 HEARTBEAT para manter conexão ativa
    const heartbeat = setInterval(() => {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.send({
          type: 'broadcast',
          event: 'heartbeat',
          payload: { timestamp: Date.now(), source: 'desktop' }
        });
      }
    }, 30000); // A cada 30 segundos

    return () => {
      clearInterval(heartbeat);
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.unsubscribe();
        broadcastChannelRef.current = null;
      }
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
    };
  }, [debouncedReload, clearCache, fetchAppointmentById, isRowWithinFilters, removeAppointmentFromCache, sortAppointmentsAsc, upsertAppointmentInCache]);

  // Helper para enviar broadcast após qualquer alteração (COM RETRY)
  const notifyAppointmentsChange = async (action: string = 'change', appointmentId: number | null = null) => {
    try {
      // 🚀 LIMPAR CACHE quando dados são modificados
      clearCache();
      
      if (!broadcastChannelRef.current) {
        broadcastChannelRef.current = supabase.channel('appointments-sync').subscribe();
      }
      
      // 🚀 BROADCAST COM RETRY para maior confiabilidade
      const payload = {
        action,
        appointmentId,
        timestamp: Date.now(),
        source: 'desktop'
      };
      
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await broadcastChannelRef.current?.send({
            type: 'broadcast',
            event: 'appointments_change',
            payload
          });
          devLog(`📣 Broadcast enviado (tentativa ${attempt + 1}):`, payload);
          break; // Sucesso, sair do loop
        } catch (error) {
          console.error(`❌ Erro no broadcast (tentativa ${attempt + 1}):`, error);
          if (attempt === 2) throw error; // Última tentativa
          await new Promise(resolve => setTimeout(resolve, 500)); // Aguardar antes de retry
        }
      }
    } catch (error) {
      console.error('❌ Erro final no broadcast:', error);
    }
  };

  const fetchAppointments = async (
    startDate?: Date,
    endDate?: Date,
    barberId?: number
  ): Promise<AppointmentsResponse> => {
    try {
      const now = new Date();
      const defaultStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      defaultStart.setDate(defaultStart.getDate() - 15); // OTIMIZADO: apenas 15 dias no passado
      const defaultEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      defaultEnd.setDate(defaultEnd.getDate() + 75); // OTIMIZADO: 75 dias no futuro
      const effectiveStart = startDate ?? defaultStart;
      const effectiveEnd = endDate ?? new Date(defaultEnd.getFullYear(), defaultEnd.getMonth(), defaultEnd.getDate(), 23, 59, 59, 999);
      const effectiveBarberId = barberId ?? (user?.role === 'barber' ? user.barber?.id : undefined);
      
      // Persistir filtros efetivos sempre que buscar
      lastFiltersRef.current = { startDate: effectiveStart, endDate: effectiveEnd, barberId: effectiveBarberId };
      
      // 🚀 VERIFICAR CACHE PRIMEIRO
      const cacheKey = getCacheKey(effectiveStart, effectiveEnd, effectiveBarberId);
      const cached = cacheRef.current.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        devLog('📦 Cache HIT - Usando dados do cache:', cacheKey);
        return cached.data;
      }
      
      devLog('🔍 Cache MISS - Buscando dados do servidor:', cacheKey);
      // Função para buscar uma página de agendamentos (OTIMIZADA - sem JOINs)
      const fetchPage = async (from: number, to: number) => {
        let query = supabase
          .from('appointments')
          .select(`
            id, client_id, barber_id, client_name, client_phone, barber_name, barber_phone,
            appointment_datetime, appointment_date, appointment_time, status, total_price, final_amount,
            duration_minutes, services_names, services_ids, note, recurrence_group_id,
            created_at, updated_at, payment_method, reminder_sent
          `, { count: 'exact' })
          .order('appointment_datetime')
          .range(from, to);

        query = query
          .gte('appointment_datetime', effectiveStart.toISOString())
          .lte('appointment_datetime', effectiveEnd.toISOString());

        // Filtrar por barbeiro se fornecido ou se usuário é barbeiro
        if (effectiveBarberId) {
          query = query.eq('barber_id', effectiveBarberId);
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

      // Transformar dados usando informações já disponíveis nos campos (SEM JOINs)
      const appointmentsWithServices = (allData || []).map(appointment => {
        // Criar serviços a partir dos dados já disponíveis
        const services = [];
        if (appointment.services_names && appointment.services_ids) {
          const serviceNames = appointment.services_names.split(', ');
          const serviceIds = appointment.services_ids || [];
          
          serviceNames.forEach((name, index) => {
            services.push({
              id: serviceIds[index] || index + 1,
              name: name.trim(),
              price_at_booking: appointment.total_price / serviceNames.length, // Divisão aproximada
              duration_minutes_normal: appointment.duration_minutes || 30,
              duration_minutes_special: appointment.duration_minutes || 30,
              is_chemical: false, // Valor padrão
              commission_rate_applied: 0.1 // Valor padrão
            });
          });
        }
        
        return {
          ...appointment,
          client: appointment.client_name ? {
            id: appointment.client_id,
            name: appointment.client_name
          } : null,
          barber: appointment.barber_name ? {
            id: appointment.barber_id,
            name: appointment.barber_name,
            is_special_barber: false // Valor padrão, pode ser ajustado se necessário
          } : null,
          services
        };
      });

      const result = {
        appointments: appointmentsWithServices,
        count: count || 0
      };
      
      // 🚀 ARMAZENAR NO CACHE
      const version = appointmentsWithServices.reduce<string | null>((max, a) => {
        if (!a?.updated_at) return max;
        if (!max) return a.updated_at;
        return a.updated_at > max ? a.updated_at : max;
      }, null);
      
      cacheRef.current.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
        version,
        meta: { startIso: effectiveStart.toISOString(), endIso: effectiveEnd.toISOString(), barberId: effectiveBarberId ?? null }
      });
      
      devLog('💾 Dados armazenados no cache:', cacheKey, `(${appointmentsWithServices.length} registros)`);
      return result;
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
      
      devLog('Data original do form:', formData.appointment_datetime);
      devLog('Data convertida:', appointmentDates[0]);
      devLog('Data que será salva:', toLocalISOString(appointmentDates[0]));

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
        const appointmentDate = toLocalDateString(startTime); // YYYY-MM-DD
        const appointmentTime = toLocalTimeString(startTime); // HH:MM:SS
        const appointmentEndTime = toLocalTimeString(endTime); // HH:MM:SS

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
      // Usa fallback compatível com Safari/iMac antigos
      const recurrenceGroupId = appointmentDates.length > 1 ? safeRandomUUID() : null;
      
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
            appointment_date: toLocalDateString(date), // YYYY-MM-DD local
            appointment_time: toLocalTimeString(date), // HH:MM:SS local
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
      await notifyAppointmentsChange('created', firstAppointment.id);
      
      await logAudit(
        user?.id,
        'CREATE',
        'appointment',
        firstAppointment.id,
        `Criou agendamento para o cliente ID ${formData.client_id} com o barbeiro ID ${formData.barber_id}`
      );

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
      
      await logAudit(
        user?.id,
        'STATUS_CHANGE',
        'appointment',
        id,
        `Alterou status do agendamento para ${status}`
      );

      // Notificar e recarregar
      await notifyAppointmentsChange('updated', id);
      debouncedReload(300);
  
      return true;
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status do agendamento');
      return false;
    }
  };

  // Marcar lembrete como enviado para um agendamento
  const markReminderSent = async (id: number): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ reminder_sent: true })
        .eq('id', id);

      if (error) throw error;

      toast.success('Lembrete marcado como enviado');
      // Opcional: recarregar lista para refletir alteração
      await notifyAppointmentsChange('updated', id);
      debouncedReload(300);
      return true;
    } catch (error: any) {
      console.error('Erro ao marcar lembrete como enviado:', error);
      toast.error('Erro ao atualizar status de lembrete');
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
      
      await logAudit(
        user?.id,
        'RESCHEDULE',
        'appointment',
        id,
        `Reagendou agendamento para ${newDateTime}`
      );

      await notifyAppointmentsChange('updated', id);
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
      
      await logAudit(
        user?.id,
        'UPDATE',
        'appointment',
        appointmentId,
        `Atualizou detalhes do agendamento (Cliente: ${updateData.client_id}, Barbeiro: ${updateData.barber_id})`
      );

      await notifyAppointmentsChange('updated', appointmentId);
      // Recarregar agendamentos após atualização bem-sucedida
      debouncedReload(300);
      
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
      devLog('Bloqueio criado:', blockData);
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
    devLog('🚀 createScheduleBlock: Iniciando criação de bloqueio');
    devLog('📋 Dados recebidos:', blockData);
    devLog('👤 Usuário atual:', { id: user?.id, role: user?.role });
    
    try {
      let finalBarberId = blockData.barberId;
      devLog('🎯 barberId inicial:', finalBarberId);

      // Se for barbeiro, forçar o uso do próprio ID
      if (user?.role === 'barber') {
        devLog('👨‍💼 Usuário é barbeiro, buscando ID do barbeiro...');
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
        devLog('✅ ID do barbeiro encontrado:', finalBarberId);
      }

      // Admin pode criar bloqueio geral (para todos os barbeiros) sem especificar barbeiro
      if (user?.role === 'admin' && !finalBarberId) {
        devLog('ℹ️ Admin criando bloqueio geral (sem barbeiro específico)');
      }

      devLog('✅ Validação de barbeiro passou. finalBarberId:', finalBarberId);

      // Validar dados de recorrência
      if (blockData.isRecurring) {
        devLog('🔄 Validando dados de recorrência...');
        if (!blockData.recurrenceType || !blockData.recurrencePattern || !blockData.recurrenceEndDate) {
          console.error('❌ Dados de recorrência incompletos:', {
            recurrenceType: blockData.recurrenceType,
            recurrencePattern: blockData.recurrencePattern,
            recurrenceEndDate: blockData.recurrenceEndDate
          });
          toast.error('Dados de recorrência incompletos');
          return false;
        }
        devLog('✅ Dados de recorrência válidos');
      }

      // Normalizar e validar data/hora
      const normalizeDate = (d?: string) => {
        if (!d || typeof d !== 'string') return null;
        const val = d.trim();
        // Aceitar apenas formato YYYY-MM-DD
        const isValid = /^\d{4}-\d{2}-\d{2}$/.test(val);
        return isValid ? val : null;
      };
      const normalizeTime = (t?: string) => {
        if (!t || typeof t !== 'string') return null;
        const raw = t.trim();
        // Aceitar HH:MM ou HH:MM:SS
        if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
        if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
        return null;
      };

      const normalizedDate = normalizeDate((blockData as any).date) || new Date().toISOString().split('T')[0];
      // Suportar ambos formatos: startTime/endTime (camelCase) e start_time/end_time (snake_case)
      const normalizedStart = normalizeTime((blockData as any).startTime ?? (blockData as any).start_time);
      const normalizedEnd = normalizeTime((blockData as any).endTime ?? (blockData as any).end_time);

      if (!normalizedStart || !normalizedEnd) {
        console.error('❌ Horários inválidos para bloqueio:', { startTime: (blockData as any).startTime ?? (blockData as any).start_time, endTime: (blockData as any).endTime ?? (blockData as any).end_time });
        toast.error('Horários inválidos para bloqueio');
        return false;
      }

      const insertData: any = {
        barber_id: finalBarberId ?? null,
        block_date: normalizedDate,
        start_time: normalizedStart,
        end_time: normalizedEnd,
        reason: blockData.reason || null,
        created_by: user?.id || null,
        is_recurring: blockData.isRecurring || false,
        // Se não for recorrente, todos os campos de recorrência devem ser NULL
        recurrence_type: blockData.isRecurring ? blockData.recurrenceType : null,
        recurrence_pattern: blockData.isRecurring ? blockData.recurrencePattern : null,
        recurrence_end_date: blockData.isRecurring ? blockData.recurrenceEndDate : null
      };

      devLog('💾 Dados para inserção no banco:', insertData);
      devLog('🔄 Executando insert na tabela schedule_blocks...');

      const { error } = await supabase
        .from('schedule_blocks')
        .insert(insertData);

      if (error) {
        console.error('❌ Erro no insert:', error);
        throw error;
      }

      devLog('✅ Bloqueio inserido com sucesso no banco!');

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
      
      await logAudit(
        user?.id,
        'DELETE',
        'appointment',
        id,
        'Excluiu agendamento'
      );

      const numericId = Number(id);
      await notifyAppointmentsChange('deleted', Number.isFinite(numericId) ? numericId : null);
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
    devLog('🗑️ Iniciando exclusão de agendamentos recorrentes:', recurrenceGroupId);
    try {
      // Buscar todos os agendamentos da série recorrente
      devLog('🔍 Buscando agendamentos do grupo recorrente...');
      const { data: appointments, error: fetchError } = await supabase
        .from('appointments')
        .select('id')
        .eq('recurrence_group_id', recurrenceGroupId);

      if (fetchError) {
        console.error('❌ Erro ao buscar agendamentos:', fetchError);
        throw fetchError;
      }

      devLog(`📊 Agendamentos encontrados: ${appointments?.length || 0}`);

      if (!appointments || appointments.length === 0) {
        devLog('⚠️ Nenhum agendamento encontrado na série recorrente');
        toast.error('Nenhum agendamento encontrado na série recorrente');
        return false;
      }

      const appointmentIds = appointments.map(app => app.id);
      devLog(`🎯 IDs dos agendamentos a serem excluídos: ${appointmentIds.join(', ')}`);

      // Primeiro deletar todos os serviços dos agendamentos
      devLog('🗑️ Deletando serviços dos agendamentos...');
      const { error: servicesError } = await supabase
        .from('appointment_services')
        .delete()
        .in('appointment_id', appointmentIds);

      if (servicesError) {
        console.error('❌ Erro ao deletar serviços:', servicesError);
        throw servicesError;
      }

      devLog('✅ Serviços deletados com sucesso');

      // Depois deletar todos os agendamentos
      devLog('🗑️ Deletando agendamentos...');
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('recurrence_group_id', recurrenceGroupId);

      if (error) {
        console.error('❌ Erro ao deletar agendamentos:', error);
        throw error;
      }

      devLog('✅ Agendamentos deletados com sucesso');

      // Verificar se realmente foram deletados
      const { data: remainingAppointments } = await supabase
        .from('appointments')
        .select('id')
        .eq('recurrence_group_id', recurrenceGroupId);

      devLog(`📊 Agendamentos restantes após exclusão: ${remainingAppointments?.length || 0}`);

      toast.success(`${appointments.length} agendamentos da série recorrente excluídos com sucesso!`);
      await notifyAppointmentsChange();
      return true;
    } catch (error: any) {
      console.error('❌ Erro ao excluir agendamentos recorrentes:', error);
      toast.error(`Erro ao excluir agendamentos recorrentes: ${error.message || 'Erro desconhecido'}`);
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
      const { startDate, endDate } = getEffectiveFilters();
      let query = supabase
        .from('schedule_blocks')
        .select('*')
        .gte('block_date', toLocalDateString(startDate))
        .lte('block_date', toLocalDateString(endDate))
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

  // 🚀 FALLBACK com polling para garantir sincronização
  useEffect(() => {
    const POLL_INTERVAL_MS = 5 * 60 * 1000;
    let cancelled = false;
    let inFlight = false;

    const fetchHeartbeat = async (startDate: Date, endDate: Date, barberId?: number) => {
      let query = supabase
        .from('appointments')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .range(0, 0);

      query = query
        .gte('appointment_datetime', startDate.toISOString())
        .lte('appointment_datetime', endDate.toISOString());

      if (barberId) {
        query = query.eq('barber_id', barberId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data?.[0]?.updated_at ?? null;
    };

    const tick = async () => {
      if (cancelled) return;
      if (inFlight) return;
      inFlight = true;

      try {
        if (realtimeActiveRef.current) return;

        const { startDate, endDate, barberId } = getEffectiveFilters();
        const cacheKey = getCacheKey(startDate, endDate, barberId);
        const cached = cacheRef.current.get(cacheKey);

        const heartbeatVersion = await fetchHeartbeat(startDate, endDate, barberId);
        const cachedVersion = cached?.version ?? null;

        if (cached && heartbeatVersion === cachedVersion) {
          touchCache(cacheKey);
          return;
        }

        if (!cached && heartbeatVersion === null) {
          invalidateCacheKey(cacheKey);
          await reloadAppointments(startDate, endDate, barberId);
          return;
        }

        if (heartbeatVersion !== cachedVersion) {
          invalidateCacheKey(cacheKey);
          await reloadAppointments(startDate, endDate, barberId);
          return;
        }

        if (cached) {
          touchCache(cacheKey);
        } else {
          invalidateCacheKey(cacheKey);
          await reloadAppointments(startDate, endDate, barberId);
        }
      } catch (error) {
        console.error('❌ Erro no polling de backup:', error);
      } finally {
        inFlight = false;
      }
    };

    const pollInterval = setInterval(() => {
      void tick();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [getEffectiveFilters, getCacheKey, touchCache, invalidateCacheKey, reloadAppointments]);

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
    markReminderSent,
    reloadAppointments
  };
};
