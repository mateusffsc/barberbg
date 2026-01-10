import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Product, ProductFormData, ProductsResponse } from '../types/product';
import { parseCurrency } from '../utils/formatters';
import toast from 'react-hot-toast';

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const fetchProducts = async (
    page: number = 1,
    search: string = '',
    pageSize: number = 10
  ): Promise<ProductsResponse> => {
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('products')
        .select('id, name, description, price, stock_quantity, created_at, updated_at', { count: 'exact' })
        .range(from, to)
        .order('name');

      if (search.trim()) {
        query = query.ilike('name', `%${search}%`);
      }

      const { data, count, error } = await query;

      if (error) throw error;

      return {
        products: data || [],
        count: count || 0
      };
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      toast.error('Erro ao carregar produtos');
      return { products: [], count: 0 };
    }
  };

  const createProduct = async (productData: ProductFormData): Promise<Product | null> => {
    try {
      const price = parseCurrency(productData.price);
      const stock = parseInt(productData.stock_quantity);

      if (price < 0) {
        toast.error('O preço não pode ser negativo');
        return null;
      }

      if (stock < 0) {
        toast.error('O estoque não pode ser negativo');
        return null;
      }

      const { data, error } = await supabase
        .from('products')
        .insert({
          name: productData.name.trim(),
          description: productData.description.trim() || null,
          price,
          stock_quantity: stock
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Produto cadastrado com sucesso!');
      return data;
    } catch (error: any) {
      console.error('Erro ao criar produto:', error);
      
      if (error.code === '23505') {
        toast.error('Já existe um produto com este nome');
      } else {
        toast.error('Erro ao cadastrar produto');
      }
      
      return null;
    }
  };

  const updateProduct = async (id: number, productData: ProductFormData): Promise<Product | null> => {
    try {
      const price = parseCurrency(productData.price);
      const stock = parseInt(productData.stock_quantity);

      if (price < 0) {
        toast.error('O preço não pode ser negativo');
        return null;
      }

      if (stock < 0) {
        toast.error('O estoque não pode ser negativo');
        return null;
      }

      const { data, error } = await supabase
        .from('products')
        .update({
          name: productData.name.trim(),
          description: productData.description.trim() || null,
          price,
          stock_quantity: stock
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      toast.success('Produto atualizado com sucesso!');
      return data;
    } catch (error: any) {
      console.error('Erro ao atualizar produto:', error);
      
      if (error.code === '23505') {
        toast.error('Já existe um produto com este nome');
      } else {
        toast.error('Erro ao atualizar produto');
      }
      
      return null;
    }
  };

  const deleteProduct = async (id: number): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Produto excluído com sucesso!');
      return true;
    } catch (error: any) {
      console.error('Erro ao excluir produto:', error);
      
      if (error.code === '23503') {
        toast.error('Não é possível excluir produto com vendas');
      } else {
        toast.error('Erro ao excluir produto');
      }
      
      return false;
    }
  };

  return {
    products,
    setProducts,
    loading,
    setLoading,
    totalCount,
    setTotalCount,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct
  };
};
