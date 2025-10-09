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
    console.log(`🔄 Realtime: Mudança detectada na tabela ${table}:`, payload);
    console.log(`🔄 Realtime: Tipo de evento: ${payload.eventType}`);
    console.log(`🔄 Realtime: Dados do payload:`, payload.new || payload.old);

    // Chamar callback específico baseado no tipo de evento
    switch (payload.eventType) {
      case 'INSERT':
        console.log(`✅ Realtime: Executando onInsert para tabela ${table}`);
        onInsert?.(payload);
        if (showNotifications) {
          toast.success('Novo registro criado!');
        }
        break;
      case 'UPDATE':
        console.log(`🔄 Realtime: Executando onUpdate para tabela ${table}`);
        onUpdate?.(payload);
        if (showNotifications) {
          toast.success('Registro atualizado!');
        }
        break;
      case 'DELETE':
        console.log(`❌ Realtime: Executando onDelete para tabela ${table}`);
        onDelete?.(payload);
        if (showNotifications) {
          toast.success('Registro removido!');
        }
        break;
    }

    // Chamar callback genérico se fornecido
    if (onChange) {
      console.log(`🔄 Realtime: Executando onChange callback para tabela ${table}`);
      onChange(payload);
    } else {
      console.log(`⚠️ Realtime: Nenhum onChange callback definido para tabela ${table}`);
    }
  }, [table, onInsert, onUpdate, onDelete, onChange, showNotifications]);

  const setupSubscription = useCallback(() => {
    console.log(`🚀 Realtime: Configurando subscription para tabela ${table}`);
    
    // Limpar timeout de reconexão anterior se existir
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Remover subscription anterior se existir
    if (channelRef.current) {
      console.log(`🔄 Realtime: Removendo subscription anterior para tabela ${table}`);
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
        console.log(`📡 Realtime: Status da subscription para ${table}:`, status);
        
        // Implementar reconexão automática em caso de erro
        if (status === 'CHANNEL_ERROR') {
          console.log(`❌ Realtime: Erro na subscription da tabela ${table}, tentando reconectar em 3 segundos...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`🔄 Realtime: Reconectando subscription para tabela ${table}`);
            setupSubscription();
          }, 3000);
        } else if (status === 'SUBSCRIBED') {
          console.log(`✅ Realtime: Subscription ativa para tabela ${table}`);
        }
      });

    channelRef.current = channel;
    console.log(`✅ Realtime: Subscription configurada para tabela ${table}`);
  }, [table, handleRealtimeEvent]);

  const unsubscribe = useCallback(() => {
    console.log(`🛑 Realtime: Desconectando subscription para tabela ${table}`);
    
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