import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Service, ServiceFormData, ServicesResponse } from '../types/service';
import { parseCurrency } from '../utils/formatters';
import toast from 'react-hot-toast';

export const useServices = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

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
        .select('*', { count: 'exact' })
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
      const duration = parseInt(serviceData.duration_minutes);

      if (price < 0) {
        toast.error('O preço não pode ser negativo');
        return null;
      }

      if (duration < 15) {
        toast.error('A duração mínima é de 15 minutos');
        return null;
      }

      const { data, error } = await supabase
        .from('services')
        .insert({
          name: serviceData.name.trim(),
          description: serviceData.description.trim() || null,
          price,
          duration_minutes: duration,
          is_chemical: serviceData.is_chemical
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Serviço cadastrado com sucesso!');
      return data;
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
      const duration = parseInt(serviceData.duration_minutes);

      if (price < 0) {
        toast.error('O preço não pode ser negativo');
        return null;
      }

      if (duration < 15) {
        toast.error('A duração mínima é de 15 minutos');
        return null;
      }

      const { data, error } = await supabase
        .from('services')
        .update({
          name: serviceData.name.trim(),
          description: serviceData.description.trim() || null,
          price,
          duration_minutes: duration,
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