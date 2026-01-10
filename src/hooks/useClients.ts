import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Client, ClientFormData, ClientsResponse } from '../types/client';
import toast from 'react-hot-toast';
import { useRealtimeSubscription } from './useRealtimeSubscription';

export const useClients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Função para recarregar clientes
  const reloadClients = async () => {
    try {
      const response = await fetchClients();
      setClients(response.clients);
      setTotalCount(response.count);
    } catch (error) {
      console.error('Erro ao recarregar clientes:', error);
    }
  };

  // Configurar subscription em tempo real para clientes
  useRealtimeSubscription({
    table: 'clients',
    onChange: () => {
      // Recarregar dados quando houver qualquer mudança
      reloadClients();
    },
    showNotifications: false
  });

  const fetchClients = async (
    page: number = 1,
    search: string = '',
    pageSize: number = 10
  ): Promise<ClientsResponse> => {
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('clients')
        .select('id, name, phone, email, created_at', { count: 'exact' })
        .range(from, to)
        .order('name');

      if (search.trim()) {
        query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      const { data, count, error } = await query;

      if (error) throw error;

      return {
        clients: data || [],
        count: count || 0
      };
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      toast.error('Erro ao carregar clientes');
      return { clients: [], count: 0 };
    }
  };

  const createClient = async (clientData: ClientFormData): Promise<Client | null> => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          name: clientData.name.trim(),
          phone: clientData.phone.trim() || null,
          email: clientData.email.trim() || null
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Cliente cadastrado com sucesso!');
      return data;
    } catch (error: any) {
      console.error('Erro ao criar cliente:', error);
      
      if (error.code === '23505') {
        toast.error('Email já está em uso por outro cliente');
      } else {
        toast.error('Erro ao cadastrar cliente');
      }
      
      return null;
    }
  };

  const updateClient = async (id: number, clientData: ClientFormData): Promise<Client | null> => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .update({
          name: clientData.name.trim(),
          phone: clientData.phone.trim() || null,
          email: clientData.email.trim() || null
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      toast.success('Cliente atualizado com sucesso!');
      return data;
    } catch (error: any) {
      console.error('Erro ao atualizar cliente:', error);
      
      if (error.code === '23505') {
        toast.error('Email já está em uso por outro cliente');
      } else {
        toast.error('Erro ao atualizar cliente');
      }
      
      return null;
    }
  };

  const deleteClient = async (id: number): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Cliente excluído com sucesso!');
      return true;
    } catch (error: any) {
      console.error('Erro ao excluir cliente:', error);
      
      if (error.code === '23503') {
        toast.error('Não é possível excluir cliente com agendamentos');
      } else {
        toast.error('Erro ao excluir cliente');
      }
      
      return false;
    }
  };

  return {
    clients,
    setClients,
    loading,
    setLoading,
    totalCount,
    setTotalCount,
    fetchClients,
    createClient,
    updateClient,
    deleteClient
  };
};
