import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Sale, CartItem, SalesResponse } from '../types/sale';
import { Product } from '../types/product';
import { Barber } from '../types/barber';
import { PaymentMethod } from '../types/payment';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export const useSales = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const { user } = useAuth();

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

  return {
    sales,
    setSales,
    loading,
    setLoading,
    totalCount,
    setTotalCount,
    fetchSales,
    createSale
  };
};