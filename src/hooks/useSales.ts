import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Sale, SaleFormData, SalesResponse } from '../types/sale';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { useRealtimeSubscription } from './useRealtimeSubscription';

export const useSales = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const { user } = useAuth();

  // Função para recarregar vendas
  const reloadSales = async () => {
    try {
      const response = await fetchSales();
      setSales(response.sales);
      setTotalCount(response.count);
    } catch (error) {
      console.error('Erro ao recarregar vendas:', error);
    }
  };

  // Configurar subscription em tempo real para vendas
  useRealtimeSubscription({
    table: 'sales',
    onChange: () => {
      // Recarregar dados quando houver qualquer mudança
      reloadSales();
    },
    showNotifications: false,
    filter: user?.role === 'barber' && user.barber?.id ? `barber_id=eq.${user.barber.id}` : undefined
  });

  const fetchSales = async (
    page: number = 1,
    search: string = '',
    pageSize: number = 10
  ): Promise<SalesResponse> => {
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('sales')
        .select(`
          *,
          client:clients(id, name),
          barber:barbers(id, name),
          sale_products(
            quantity,
            price_at_sale,
            product:products(id, name)
          )
        `, { count: 'exact' })
        .range(from, to)
        .order('sale_datetime', { ascending: false });

      // Filtrar por barbeiro se usuário for barbeiro
      if (user?.role === 'barber' && user.barber?.id) {
        query = query.eq('barber_id', user.barber.id);
      }

      {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        query = query
          .gte('sale_datetime', startOfMonth.toISOString())
          .lte('sale_datetime', endOfMonth.toISOString());
      }

      if (search.trim()) {
        // Para busca, precisamos fazer uma query mais complexa
        const { data: clientIds } = await supabase
          .from('clients')
          .select('id')
          .ilike('name', `%${search}%`);
        
        const { data: barberIds } = await supabase
          .from('barbers')
          .select('id')
          .ilike('name', `%${search}%`);
        
        const clientIdList = clientIds?.map(c => c.id) || [];
        const barberIdList = barberIds?.map(b => b.id) || [];
        
        if (clientIdList.length > 0 || barberIdList.length > 0) {
          const filters = [];
          if (clientIdList.length > 0) {
            filters.push(`client_id.in.(${clientIdList.join(',')})`);
          }
          if (barberIdList.length > 0) {
            filters.push(`barber_id.in.(${barberIdList.join(',')})`);
          }
          query = query.or(filters.join(','));
        } else {
          // Se não encontrou nenhum cliente ou barbeiro, retornar vazio
          return { sales: [], count: 0 };
        }
      }

      const { data, count, error } = await query;

      if (error) throw error;

      // Transformar dados
      const salesWithProducts = (data || []).map(sale => ({
        ...sale,
        products: sale.sale_products?.map((sp: any) => ({
          id: sp.product.id,
          name: sp.product.name,
          quantity: sp.quantity,
          price: sp.price_at_sale
        })) || []
      }));

      return {
        sales: salesWithProducts,
        count: count || 0
      };
    } catch (error) {
      console.error('Erro ao buscar vendas:', error);
      toast.error('Erro ao carregar vendas');
      return { sales: [], count: 0 };
    }
  };

  const createSale = async (
    cartItems: CartItem[],
    selectedClient: number | null,
    selectedBarber: Barber,
    paymentMethod: PaymentMethod
  ): Promise<Sale | null> => {
    try {
      if (cartItems.length === 0) {
        toast.error('Carrinho está vazio');
        return null;
      }

      // Verificar estoque antes de processar
      for (const item of cartItems) {
        if (item.quantity > item.product.stock_quantity) {
          toast.error(`Estoque insuficiente para ${item.product.name}`);
          return null;
        }
      }

      const total = cartItems.reduce((sum, item) => sum + item.subtotal, 0);

      // 1. Criar venda
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          client_id: selectedClient,
          barber_id: selectedBarber.id,
          sale_datetime: new Date().toISOString(),
          total_amount: total,
          payment_method: paymentMethod
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // 2. Processar cada item do carrinho
      for (const item of cartItems) {
        // Inserir item vendido
        const { error: itemError } = await supabase
          .from('sale_products')
          .insert({
            sale_id: sale.id,
            product_id: item.product.id,
            quantity: item.quantity,
            price_at_sale: item.product.price,
            commission_rate_applied: selectedBarber.commission_rate_product
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

      toast.success('Venda realizada com sucesso!');
      return sale;
    } catch (error: any) {
      console.error('Erro ao criar venda:', error);
      toast.error('Erro ao processar venda');
      return null;
    }
  };

  const updateSaleItemsAmounts = async (
    saleId: number,
    updates: Array<{ productId: number; newSubtotal: number }>
  ): Promise<Sale | null> => {
    try {
      if (!updates || updates.length === 0) {
        toast.error('Nenhuma alteração informada');
        return null;
      }

      // Buscar venda atual no estado para obter quantidades
      const existing = sales.find(s => s.id === saleId);
      if (!existing) {
        toast.error('Venda não encontrada');
        return null;
      }

      const qtyMap = new Map<number, number>();
      (existing.products || []).forEach(p => qtyMap.set(p.id, p.quantity));

      // Validar e calcular preços unitários novos
      const unitUpdates = updates.map(u => {
        const qty = qtyMap.get(u.productId) || 0;
        if (qty <= 0) {
          throw new Error('Quantidade inválida para algum produto');
        }
        if (u.newSubtotal <= 0) {
          throw new Error('Subtotal deve ser maior que zero');
        }
        const unitPrice = Number((u.newSubtotal / qty).toFixed(2));
        return { productId: u.productId, unitPrice };
      });

      // Atualizar cada item em sale_products
      for (const upd of unitUpdates) {
        const { error: upErr } = await supabase
          .from('sale_products')
          .update({ price_at_sale: upd.unitPrice })
          .eq('sale_id', saleId)
          .eq('product_id', upd.productId);
        if (upErr) throw upErr;
      }

      // Calcular novo total
      const newTotal = updates.reduce((sum, u) => sum + u.newSubtotal, 0);

      // Atualizar total em sales e retornar venda atualizada
      const { data, error } = await supabase
        .from('sales')
        .update({ total_amount: newTotal })
        .eq('id', saleId)
        .select(`
          *,
          client:clients(id, name),
          barber:barbers(id, name),
          sale_products(
            quantity,
            price_at_sale,
            product:products(id, name)
          )
        `)
        .single();

      if (error) throw error;

      const updatedSale: Sale = {
        ...data,
        products: (data?.sale_products || []).map((sp: any) => ({
          id: sp.product.id,
          name: sp.product.name,
          quantity: sp.quantity,
          price: sp.price_at_sale
        }))
      };

      setSales(prev => prev.map(s => (s.id === saleId ? updatedSale : s)));
      toast.success('Valores por produto atualizados com sucesso!');
      return updatedSale;
    } catch (error: any) {
      console.error('Erro ao atualizar itens da venda:', error);
      toast.error(error?.message || 'Erro ao atualizar itens da venda');
      return null;
    }
  };

  const deleteSale = async (saleId: number): Promise<boolean> => {
    try {
      // Excluir itens vinculados primeiro (seguro caso não exista CASCADE)
      const { error: spErr } = await supabase
        .from('sale_products')
        .delete()
        .eq('sale_id', saleId);
      if (spErr) throw spErr;

      // Excluir a venda
      const { error: sErr } = await supabase
        .from('sales')
        .delete()
        .eq('id', saleId);
      if (sErr) throw sErr;

      // Atualizar estado local
      setSales(prev => prev.filter(s => s.id !== saleId));
      setTotalCount(prev => Math.max(0, prev - 1));
      toast.success('Venda excluída com sucesso');
      return true;
    } catch (error: any) {
      console.error('Erro ao excluir venda:', error);
      toast.error(error?.message || 'Erro ao excluir venda');
      return false;
    }
  };

  const updateSaleAmount = async (saleId: number, newAmount: number): Promise<Sale | null> => {
    try {
      if (newAmount <= 0) {
        toast.error('O valor da venda deve ser maior que zero');
        return null;
      }

      const { data, error } = await supabase
        .from('sales')
        .update({ total_amount: newAmount })
        .eq('id', saleId)
        .select(`
          *,
          client:clients(id, name),
          barber:barbers(id, name),
          sale_products(
            quantity,
            price_at_sale,
            product:products(id, name)
          )
        `)
        .single();

      if (error) throw error;

      const updatedSale: Sale = {
        ...data,
        products: (data?.sale_products || []).map((sp: any) => ({
          id: sp.product.id,
          name: sp.product.name,
          quantity: sp.quantity,
          price: sp.price_at_sale
        }))
      };

      // Atualizar estado local
      setSales(prev => prev.map(s => (s.id === saleId ? updatedSale : s)));
      toast.success('Valor da venda atualizado com sucesso!');
      return updatedSale;
    } catch (error) {
      console.error('Erro ao atualizar valor da venda:', error);
      toast.error('Erro ao atualizar valor da venda');
      return null;
    }
  };

  return {
    sales,
    setSales,
    loading,
    setLoading,
    totalCount,
    setTotalCount,
    fetchSales,
    createSale,
    updateSaleItemsAmounts,
    deleteSale,
    updateSaleAmount
  };
};
