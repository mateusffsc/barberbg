import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Barber, BarberFormData, BarberUpdateData, BarbersResponse } from '../types/barber';
import toast from 'react-hot-toast';

export const useBarbers = () => {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const fetchBarbers = async (
    page: number = 1,
    search: string = '',
    pageSize: number = 10
  ): Promise<BarbersResponse> => {
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('barbers')
        .select(`
          *,
          user:users(id, username, role)
        `, { count: 'exact' })
        .range(from, to)
        .order('name');

      if (search.trim()) {
        query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, count, error } = await query;

      if (error) throw error;

      return {
        barbers: data || [],
        count: count || 0
      };
    } catch (error) {
      console.error('Erro ao buscar barbeiros:', error);
      toast.error('Erro ao carregar barbeiros');
      return { barbers: [], count: 0 };
    }
  };

  const createBarber = async (barberData: BarberFormData): Promise<Barber | null> => {
    try {
      // Validações
      if (barberData.password.length < 6) {
        toast.error('A senha deve ter pelo menos 6 caracteres');
        return null;
      }

      if (barberData.commission_rate_service < 0 || barberData.commission_rate_service > 100) {
        toast.error('Comissão de serviços deve estar entre 0% e 100%');
        return null;
      }

      if (barberData.commission_rate_product < 0 || barberData.commission_rate_product > 100) {
        toast.error('Comissão de produtos deve estar entre 0% e 100%');
        return null;
      }

      if (barberData.commission_rate_chemical_service < 0 || barberData.commission_rate_chemical_service > 100) {
        toast.error('Comissão de serviços químicos deve estar entre 0% e 100%');
        return null;
      }

      // Primeiro, criar o usuário
      const { data: user, error: userError } = await supabase
        .from('users')
        .insert({
          username: barberData.username.trim(),
          password_hash: barberData.password, // Em produção, fazer hash da senha
          role: 'barber'
        })
        .select()
        .single();

      if (userError) throw userError;

      if (!user) {
        throw new Error('Erro ao criar usuário');
      }

      // Depois, criar o barbeiro
      const { data: barber, error: barberError } = await supabase
        .from('barbers')
        .insert({
          user_id: user.id,
          name: barberData.name.trim(),
          phone: barberData.phone.trim() || null,
          email: barberData.email.trim() || null,
          commission_rate_service: barberData.commission_rate_service / 100,
          commission_rate_product: barberData.commission_rate_product / 100,
          commission_rate_chemical_service: barberData.commission_rate_chemical_service / 100
        })
        .select(`
          *,
          user:users(id, username, role)
        `)
        .single();

      if (barberError) {
        // Se falhar ao criar barbeiro, tentar deletar o usuário criado
        await supabase.from('users').delete().eq('id', user.id);
        throw barberError;
      }

      toast.success('Barbeiro cadastrado com sucesso!');
      return barber;
    } catch (error: any) {
      console.error('Erro ao criar barbeiro:', error);
      
      if (error.code === '23505') {
        if (error.message.includes('username')) {
          toast.error('Nome de usuário já está em uso');
        } else if (error.message.includes('email')) {
          toast.error('Email já está em uso por outro barbeiro');
        } else {
          toast.error('Dados já estão em uso');
        }
      } else {
        toast.error('Erro ao cadastrar barbeiro');
      }
      
      return null;
    }
  };

  const updateBarber = async (id: number, barberData: BarberUpdateData): Promise<Barber | null> => {
    try {
      // Validações
      if (barberData.commission_rate_service < 0 || barberData.commission_rate_service > 100) {
        toast.error('Comissão de serviços deve estar entre 0% e 100%');
        return null;
      }

      if (barberData.commission_rate_product < 0 || barberData.commission_rate_product > 100) {
        toast.error('Comissão de produtos deve estar entre 0% e 100%');
        return null;
      }

      if (barberData.commission_rate_chemical_service < 0 || barberData.commission_rate_chemical_service > 100) {
        toast.error('Comissão de serviços químicos deve estar entre 0% e 100%');
        return null;
      }

      const { data, error } = await supabase
        .from('barbers')
        .update({
          name: barberData.name.trim(),
          phone: barberData.phone.trim() || null,
          email: barberData.email.trim() || null,
          commission_rate_service: barberData.commission_rate_service / 100,
          commission_rate_product: barberData.commission_rate_product / 100,
          commission_rate_chemical_service: barberData.commission_rate_chemical_service / 100
        })
        .eq('id', id)
        .select(`
          *,
          user:users(id, username, role)
        `)
        .single();

      if (error) throw error;

      toast.success('Barbeiro atualizado com sucesso!');
      return data;
    } catch (error: any) {
      console.error('Erro ao atualizar barbeiro:', error);
      
      if (error.code === '23505') {
        toast.error('Email já está em uso por outro barbeiro');
      } else {
        toast.error('Erro ao atualizar barbeiro');
      }
      
      return null;
    }
  };

  const toggleBarberStatus = async (barberId: number, userId: number, currentStatus: boolean): Promise<boolean> => {
    try {
      // Para "desativar", podemos alterar o role do usuário ou adicionar um campo is_active
      // Por simplicidade, vamos apenas mostrar uma mensagem
      toast.info('Funcionalidade de ativar/desativar será implementada');
      return true;
    } catch (error: any) {
      console.error('Erro ao alterar status do barbeiro:', error);
      toast.error('Erro ao alterar status do barbeiro');
      return false;
    }
  };

  const deleteBarber = async (id: number, userId: number): Promise<boolean> => {
    try {
      // Primeiro deletar o barbeiro
      const { error: barberError } = await supabase
        .from('barbers')
        .delete()
        .eq('id', id);

      if (barberError) throw barberError;

      // Depois deletar o usuário
      const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (userError) throw userError;

      toast.success('Barbeiro excluído com sucesso!');
      return true;
    } catch (error: any) {
      console.error('Erro ao excluir barbeiro:', error);
      
      if (error.code === '23503') {
        toast.error('Não é possível excluir barbeiro com agendamentos ou vendas');
      } else {
        toast.error('Erro ao excluir barbeiro');
      }
      
      return false;
    }
  };

  return {
    barbers,
    setBarbers,
    loading,
    setLoading,
    totalCount,
    setTotalCount,
    fetchBarbers,
    createBarber,
    updateBarber,
    toggleBarberStatus,
    deleteBarber
  };
};