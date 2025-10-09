import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'react-hot-toast';

interface RealtimeSubscriptionOptions {
  table: string;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
  onChange?: (payload: any) => void; // Callback genérico para qualquer mudança
  showNotifications?: boolean;
}

export const useRealtimeSubscription = (options: RealtimeSubscriptionOptions) => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const {
    table,
    onInsert,
    onUpdate,
    onDelete,
    onChange,
    showNotifications = true
  } = options;

  const handleRealtimeEvent = useCallback((payload: any) => {
    // Chamar callback específico baseado no tipo de evento
    switch (payload.eventType) {
      case 'INSERT':
        onInsert?.(payload);
        if (showNotifications) {
          toast.success('Novo registro criado!');
        }
        break;
      case 'UPDATE':
        onUpdate?.(payload);
        if (showNotifications) {
          toast.success('Registro atualizado!');
        }
        break;
      case 'DELETE':
        onDelete?.(payload);
        if (showNotifications) {
          toast.success('Registro removido!');
        }
        break;
    }

    // Chamar callback genérico se fornecido
    if (onChange) {
      onChange(payload);
    }
  }, [table, onInsert, onUpdate, onDelete, onChange, showNotifications]);

  const setupSubscription = useCallback(() => {
    // Limpar timeout de reconexão anterior se existir
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Remover subscription anterior se existir
    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }

    // Criar nova subscription
    const channel = supabase
      .channel(`${table}-changes-${Date.now()}`) // Adicionar timestamp para evitar conflitos
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table
        },
        handleRealtimeEvent
      )
      .subscribe((status) => {
        // Implementar reconexão automática em caso de erro
        if (status === 'CHANNEL_ERROR') {
          reconnectTimeoutRef.current = setTimeout(() => {
            setupSubscription();
          }, 3000);
        }
      });

    channelRef.current = channel;
  }, [table, handleRealtimeEvent]);

  const unsubscribe = useCallback(() => {
    // Limpar timeout de reconexão se existir
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
  }, [table]);

  useEffect(() => {
    setupSubscription();

    // Cleanup
    return () => {
      unsubscribe();
    };
  }, [setupSubscription, unsubscribe]);

  return {
    unsubscribe,
    setupSubscription
  };
};