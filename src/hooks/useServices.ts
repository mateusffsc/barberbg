import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Service, ServiceFormData, ServicesResponse } from '../types/service';
import { parseCurrency } from '../utils/formatters';
import toast from 'react-hot-toast';
import { useRealtimeSubscription } from './useRealtimeSubscription';

export const useServices = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Função para recarregar serviços
  const reloadServices = async () => {
    try {
      const response = await fetchServices();
      setServices(response.services);
      setTotalCount(response.count);
    } catch (error) {
      console.error('Erro ao recarregar serviços:', error);
    }
  };

  // Configurar subscription em tempo real para serviços
  useRealtimeSubscription({
    table: 'services',
    onChange: () => {
      // Recarregar dados quando houver qualquer mudança
      reloadServices();
    },
    showNotifications: false
  });

  const fetchServices = async (
    page: number = 1,
    search: string = '',
    pageSize: number = 10
  ): Promise<ServicesResponse> => {
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('services')
        .select('id, name, description, price, duration_minutes_normal, duration_minutes_special, is_chemical, created_at, updated_at', { count: 'exact' })
        .range(from, to)
        .order('name');

      if (search.trim()) {
        query = query.ilike('name', `%${search}%`);
      }

      const { data, count, error } = await query;

      if (error) throw error;

      return {
        services: data || [],
        count: count || 0
      };
    } catch (error) {
      console.error('Erro ao buscar serviços:', error);
      toast.error('Erro ao carregar serviços');
      return { services: [], count: 0 };
    }
  };

  const createService = async (serviceData: ServiceFormData): Promise<Service | null> => {
    try {
      const price = parseCurrency(serviceData.price);

      if (price < 0) {
        toast.error('O preço não pode ser negativo');
        return null;
      }

      if (serviceData.duration_minutes_normal < 15) {
        toast.error('A duração normal mínima é de 15 minutos');
        return null;
      }

      if (serviceData.duration_minutes_special < 15) {
        toast.error('A duração especial mínima é de 15 minutos');
        return null;
      }

      const { data: service, error } = await supabase
        .from('services')
        .insert({
          name: serviceData.name.trim(),
          description: serviceData.description.trim() || null,
          price: price,
          duration_minutes_normal: serviceData.duration_minutes_normal,
          duration_minutes_special: serviceData.duration_minutes_special,
          is_chemical: serviceData.is_chemical
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Serviço cadastrado com sucesso!');
      return service;
    } catch (error: any) {
      console.error('Erro ao criar serviço:', error);
      
      if (error.code === '23505') {
        toast.error('Já existe um serviço com este nome');
      } else {
        toast.error('Erro ao cadastrar serviço');
      }
      
      return null;
    }
  };

  const updateService = async (id: number, serviceData: ServiceFormData): Promise<Service | null> => {
    try {
      const price = parseCurrency(serviceData.price);

      if (price < 0) {
        toast.error('O preço não pode ser negativo');
        return null;
      }

      if (serviceData.duration_minutes_normal < 15) {
        toast.error('A duração normal mínima é de 15 minutos');
        return null;
      }

      if (serviceData.duration_minutes_special < 15) {
        toast.error('A duração especial mínima é de 15 minutos');
        return null;
      }

      const { data, error } = await supabase
        .from('services')
        .update({
          name: serviceData.name.trim(),
          description: serviceData.description.trim() || null,
          price,
          duration_minutes_normal: serviceData.duration_minutes_normal,
          duration_minutes_special: serviceData.duration_minutes_special,
          is_chemical: serviceData.is_chemical
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      toast.success('Serviço atualizado com sucesso!');
      return data;
    } catch (error: any) {
      console.error('Erro ao atualizar serviço:', error);
      
      if (error.code === '23505') {
        toast.error('Já existe um serviço com este nome');
      } else {
        toast.error('Erro ao atualizar serviço');
      }
      
      return null;
    }
  };

  const deleteService = async (id: number): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Serviço excluído com sucesso!');
      return true;
    } catch (error: any) {
      console.error('Erro ao excluir serviço:', error);
      
      if (error.code === '23503') {
        toast.error('Não é possível excluir serviço com agendamentos');
      } else {
        toast.error('Erro ao excluir serviço');
      }
      
      return false;
    }
  };

  return {
    services,
    setServices,
    loading,
    setLoading,
    totalCount,
    setTotalCount,
    fetchServices,
    createService,
    updateService,
    deleteService
  };
};
