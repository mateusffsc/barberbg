import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, ShoppingCart } from 'lucide-react';
import { useSales } from '../hooks/useSales';
import { useProducts } from '../hooks/useProducts';
import { useClients } from '../hooks/useClients';
import { useBarbers } from '../hooks/useBarbers';
import { ProductGrid } from '../components/sales/ProductGrid';
import { ShoppingCart as Cart } from '../components/sales/ShoppingCart';
import { SalesTable } from '../components/sales/SalesTable';
import EditSaleItemsModal from '../components/sales/EditSaleItemsModal';
import ConfirmDeleteSaleModal from '../components/sales/ConfirmDeleteSaleModal';
import { Pagination } from '../components/ui/Pagination';
import { CartItem, Sale } from '../types/sale';
import { Product } from '../types/product';
import { Client } from '../types/client';
import { Barber } from '../types/barber';
import { PaymentMethod } from '../types/payment';
import { useAuth } from '../contexts/AuthContext';
import toast, { Toaster } from 'react-hot-toast';

export const Sales: React.FC = () => {
  const { user } = useAuth();
  const { 
    sales, 
    setSales, 
    loading: salesLoading, 
    setLoading: setSalesLoading,
    totalCount, 
    setTotalCount,
    fetchSales, 
    createSale,
    updateSaleAmount,
    updateSaleItemsAmounts,
    deleteSale
  } = useSales();
  const { 
    products, 
    setProducts,
    loading: productsLoading,
    setLoading: setProductsLoading,
    fetchProducts 
  } = useProducts();
  const { 
    clients, 
    setClients,
    loading: clientsLoading,
    fetchClients 
  } = useClients();
  const { 
    barbers, 
    setBarbers,
    loading: barbersLoading,
    fetchBarbers 
  } = useBarbers();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [search, setSearch] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [saleLoading, setSaleLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pdv' | 'historico'>('pdv');
  const [currentPage, setCurrentPage] = useState(1);
  const [salesSearch, setSalesSearch] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pageSize = 10;
  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'historico') {
      loadSales();
    }
  }, [activeTab, currentPage, salesSearch]);

  useEffect(() => {
    // Filtrar produtos por busca
    if (search.trim()) {
      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(search.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  }, [products, search]);

  const loadInitialData = async () => {
    try {
      await Promise.all([
        loadProducts(),
        loadClients(),
        loadBarbers()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
    }
  };

  const loadProducts = async () => {
    setProductsLoading(true);
    try {
      const result = await fetchProducts(1, '', 1000);
      setProducts(result.products);
      setFilteredProducts(result.products);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    } finally {
      setProductsLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const result = await fetchClients(1, '', 1000);
      setClients(result.clients);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const loadBarbers = async () => {
    try {
      const result = await fetchBarbers(1, '', 1000);
      setBarbers(result.barbers);
      
      // Se for barbeiro, selecionar automaticamente
      if (user?.role === 'barber' && user.barber?.id) {
        const currentBarber = result.barbers.find(b => b.id === user.barber?.id);
        if (currentBarber) {
          setSelectedBarber(currentBarber);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar barbeiros:', error);
    }
  };

  const loadSales = async () => {
    setSalesLoading(true);
    try {
      const result = await fetchSales(currentPage, salesSearch, pageSize);
      setSales(result.sales);
      setTotalCount(result.count);
    } finally {
      setSalesLoading(false);
    }
  };

  const handleSalesSearch = (value: string) => {
    setSalesSearch(value);
    setCurrentPage(1);
  };

  const handleOpenEdit = (sale: Sale) => {
    setSaleToEdit(sale);
    setEditOpen(true);
  };

  const handleOpenDelete = (sale: Sale) => {
    setSaleToDelete(sale);
    setDeleteOpen(true);
  };

  const handleSubmitEdit = async (updates: Array<{ productId: number; newSubtotal: number }>) => {
    if (!saleToEdit) return;
    try {
      setSavingEdit(true);
      const updated = await updateSaleItemsAmounts(saleToEdit.id, updates);
      if (updated) {
        setEditOpen(false);
        setSaleToEdit(null);
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!saleToDelete) return;
    try {
      setDeleting(true);
      const ok = await deleteSale(saleToDelete.id);
      if (ok) {
        setDeleteOpen(false);
        setSaleToDelete(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleAddToCart = (product: Product) => {
    if (product.stock_quantity === 0) {
      toast.error('Produto sem estoque');
      return;
    }

    setCartItems(prev => {
      const existingItem = prev.find(item => item.product.id === product.id);
      
      if (existingItem) {
        if (existingItem.quantity >= product.stock_quantity) {
          toast.error('Quantidade máxima atingida');
          return prev;
        }
        
        return prev.map(item =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * product.price
              }
            : item
        );
      } else {
        return [...prev, {
          product,
          quantity: 1,
          subtotal: product.price
        }];
      }
    });

    toast.success(`${product.name} adicionado ao carrinho`);
  };

  const handleUpdateQuantity = (productId: number, quantity: number) => {
    if (quantity < 1) return;

    setCartItems(prev =>
      prev.map(item =>
        item.product.id === productId
          ? {
              ...item,
              quantity,
              subtotal: quantity * item.product.price
            }
          : item
      )
    );
  };

  const handleRemoveItem = (productId: number) => {
    setCartItems(prev => prev.filter(item => item.product.id !== productId));
    toast.success('Item removido do carrinho');
  };

  const handleFinalizeSale = async (paymentMethod: PaymentMethod) => {
    if (cartItems.length === 0) {
      toast.error('Carrinho está vazio');
      return;
    }

    if (!selectedBarber) {
      toast.error('Selecione um barbeiro');
      return;
    }

    setSaleLoading(true);
    try {
      const sale = await createSale(
        cartItems,
        selectedClient?.id || null,
        selectedBarber,
        paymentMethod
      );

      if (sale) {
        // Limpar carrinho
        setCartItems([]);
        setSelectedClient(null);
        
        // Recarregar produtos para atualizar estoque
        await loadProducts();
        
        toast.success('Venda finalizada com sucesso!');
      }
    } catch (error) {
      toast.error('Erro ao finalizar venda');
    } finally {
      setSaleLoading(false);
    }
  };


  const total = cartItems.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <div className="h-full flex flex-col space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <ShoppingCart className="h-6 w-6 mr-2" />
            Vendas
          </h1>
          <p className="text-gray-600">Ponto de venda e histórico de vendas</p>
        </div>
        
        {/* Tabs */}
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('pdv')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'pdv'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            PDV
          </button>
          <button
            onClick={() => setActiveTab('historico')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'historico'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Histórico
          </button>
        </div>
      </div>

      {activeTab === 'pdv' ? (
        <>
        {/* Seleção de barbeiro (apenas admin) */}
        {user?.role === 'admin' && (
          <div className="w-full sm:w-64">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Barbeiro
            </label>
            <select
              value={selectedBarber?.id || ''}
              onChange={(e) => {
                const barberId = parseInt(e.target.value);
                const barber = barbers.find(b => b.id === barberId) || null;
                setSelectedBarber(barber);
              }}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="">Selecione um barbeiro</option>
              {barbers.map((barber) => (
                <option key={barber.id} value={barber.id}>
                  {barber.name}
                </option>
              ))}
            </select>
          </div>
        )}


        {/* Layout principal */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
          {/* Produtos (60% - 3 colunas) */}
          <div className="lg:col-span-2 flex flex-col min-h-0">
            {/* Busca */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Buscar produtos..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                </div>
                <button
                  onClick={loadProducts}
                  disabled={productsLoading}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${productsLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
              </div>
            </div>

            {/* Grade de produtos */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex-1 overflow-y-auto">
              <ProductGrid
                products={filteredProducts}
                onAddToCart={handleAddToCart}
                loading={productsLoading}
              />
            </div>
          </div>

          {/* Carrinho (40% - 2 colunas) */}
          <div className="lg:col-span-1 min-h-0">
            <Cart
              items={cartItems}
              selectedClient={selectedClient}
              clients={clients}
              onUpdateQuantity={handleUpdateQuantity}
              onRemoveItem={handleRemoveItem}
              onSelectClient={setSelectedClient}
              onFinalizeSale={handleFinalizeSale}
              loading={saleLoading}
            />
          </div>
        </div>
        </>
      ) : (
        <>
        {/* Histórico de Vendas */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar por cliente ou barbeiro..."
                  value={salesSearch}
                  onChange={(e) => handleSalesSearch(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
            </div>
            <button
              onClick={loadSales}
              disabled={salesLoading}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${salesLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        <SalesTable
          sales={sales}
          loading={salesLoading}
          onEditSale={handleOpenEdit}
          onDeleteSale={handleOpenDelete}
        />

        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={totalCount}
            itemsPerPage={pageSize}
          />
        )}
        </>
      )}

      <EditSaleItemsModal
        isOpen={editOpen}
        sale={saleToEdit}
        onClose={() => { setEditOpen(false); setSaleToEdit(null); }}
        onSubmit={handleSubmitEdit}
        loading={savingEdit}
      />

      <ConfirmDeleteSaleModal
        isOpen={deleteOpen}
        sale={saleToDelete}
        onClose={() => { setDeleteOpen(false); setSaleToDelete(null); }}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />

    </div>
  );
};