import React, { useState, useEffect } from 'react';
import { Calendar, Users, DollarSign, Scissors, Plus, ShoppingCart, Filter } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Appointment } from '../types/appointment';
import { Sale } from '../types/sale';
import { Client } from '../types/client';
import { Barber } from '../types/barber';
import { Service } from '../types/service';
import { Product } from '../types/product';
import { CartItem } from '../types/sale';
import { AppointmentModal } from '../components/appointments/AppointmentModal';
import { ProductGrid } from '../components/sales/ProductGrid';
import { ShoppingCart as ShoppingCartComponent } from '../components/sales/ShoppingCart';
import { useAppointments } from '../hooks/useAppointments';
import { useClients } from '../hooks/useClients';
import { useBarbers } from '../hooks/useBarbers';
import { useServices } from '../hooks/useServices';
import { useProducts } from '../hooks/useProducts';
import { useSales } from '../hooks/useSales';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import toast from 'react-hot-toast';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  
  // Hooks
  const { createAppointment } = useAppointments();
  const { createSale } = useSales();
  
  // Local data states for modals
  const [clients, setClients] = useState<Client[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingModalData, setLoadingModalData] = useState(false);
  
  // Dashboard data states
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [allTodayAppointments, setAllTodayAppointments] = useState<Appointment[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [totalClients, setTotalClients] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [monthlyAppointments, setMonthlyAppointments] = useState(0);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');
  
  // Modal states
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  
  // Sale modal states
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [saleLoading, setSaleLoading] = useState(false);
  
  const periods = {
    today: { label: 'Hoje', days: 0 },
    week: { label: 'Esta Semana', days: 7 },
    month: { label: 'Este Mês', days: 30 },
    year: { label: 'Este Ano', days: 365 }
  };

  const getPeriodDescription = () => {
    const now = new Date();
    switch (selectedPeriod) {
      case 'today':
        return 'Hoje';
      case 'week':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        return `${startOfWeek.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
      case 'month':
        return `${now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;
      case 'year':
        return `${now.getFullYear()}`;
      default:
        return 'Este Mês';
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [selectedPeriod]);

  useEffect(() => {
    // Carregar dados iniciais apenas uma vez
    loadInitialData();
  }, []);

  // Configurar subscriptions em tempo real para o dashboard
  useRealtimeSubscription({
    table: 'appointments',
    onChange: () => {
      // Recarregar dados do dashboard quando houver mudanças em agendamentos
      loadDashboardData();
      loadTodayAppointments();
    },
    showNotifications: false
  });

  useRealtimeSubscription({
    table: 'sales',
    onChange: () => {
      // Recarregar dados do dashboard quando houver mudanças em vendas
      loadDashboardData();
    },
    showNotifications: false
  });

  const loadTodayAppointments = async () => {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);

      let todayQuery = supabase
        .from('appointments')
        .select(`
          *,
          client:clients(id, name),
          barber:barbers(id, name),
          appointment_services(
            service:services(id, name)
          )
        `)
        .eq('status', 'scheduled')
        .gte('appointment_datetime', today.toISOString())
        .lte('appointment_datetime', endOfToday.toISOString());

      if (user?.role === 'barber' && user.barber?.id) {
        todayQuery = todayQuery.eq('barber_id', user.barber.id);
      }

      const { data: allTodayApts, error: todayError } = await todayQuery;
      if (todayError) throw todayError;

      const todayAppointmentsWithServices = (allTodayApts || []).map(apt => ({
        ...apt,
        services: apt.appointment_services?.map((as: any) => as.service) || []
      }));
      
      setAllTodayAppointments(todayAppointmentsWithServices);
    } catch (error) {
      console.error('Erro ao recarregar agendamentos de hoje:', error);
    }
  };

  const loadInitialData = async () => {
    setLoadingModalData(true);
    try {
      console.log('Carregando dados iniciais para os modais...');
      
      // Buscar clientes
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      
      if (clientsError) throw clientsError;
      
      // Buscar barbeiros
      const { data: barbersData, error: barbersError } = await supabase
        .from('barbers')
        .select('*')
        .order('name');
      
      if (barbersError) throw barbersError;
      
      // Buscar serviços
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('*')
        .order('name');
      
      if (servicesError) throw servicesError;
      
      // Buscar produtos
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('name');
      
      if (productsError) throw productsError;
      
      // Atualizar estados
      setClients(clientsData || []);
      setBarbers(barbersData || []);
      setServices(servicesData || []);
      setProducts(productsData || []);
      
      console.log('Dados carregados com sucesso:', {
        clients: clientsData?.length || 0,
        barbers: barbersData?.length || 0,
        services: servicesData?.length || 0,
        products: productsData?.length || 0
      });
    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
      toast.error('Erro ao carregar dados para os modais');
    } finally {
      setLoadingModalData(false);
    }
  };

  const loadDashboardData = async () => {
    setLoadingData(true);
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      
      // Calcular períodos baseados na seleção
      let startDate: Date;
      let endDate: Date;
      
      switch (selectedPeriod) {
        case 'today':
          startDate = today;
          endDate = endOfToday;
          break;
        case 'week':
          // Início da semana (domingo)
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          startOfWeek.setHours(0, 0, 0, 0);
          
          // Fim da semana (sábado) ou hoje se ainda estivermos na semana
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);
          
          startDate = startOfWeek;
          endDate = endOfWeek > now ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59) : endOfWeek;
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          // Último dia do mês ou hoje se ainda estivermos no mês
          const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
          endDate = endOfMonth > now ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59) : endOfMonth;
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          // Último dia do ano ou hoje se ainda estivermos no ano
          const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
          endDate = endOfYear > now ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59) : endOfYear;
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          const endOfDefaultMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
          endDate = endOfDefaultMonth > now ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59) : endOfDefaultMonth;
      }

      console.log('=== DASHBOARD FILTER DEBUG ===');
      console.log('Período selecionado:', selectedPeriod);
      console.log('Agora:', now.toLocaleString('pt-BR'));
      console.log('Data início:', startDate.toLocaleString('pt-BR'));
      console.log('Data fim:', endDate.toLocaleString('pt-BR'));
      console.log('Diferença em dias:', Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      console.log('==============================');

      // 1. Buscar agendamentos de hoje para o contador (apenas scheduled)
      let todayQuery = supabase
        .from('appointments')
        .select(`
          *,
          client:clients(id, name),
          barber:barbers(id, name),
          appointment_services(
            service:services(id, name)
          )
        `)
        .eq('status', 'scheduled')
        .gte('appointment_datetime', today.toISOString())
        .lte('appointment_datetime', endOfToday.toISOString());

      if (user?.role === 'barber' && user.barber?.id) {
        todayQuery = todayQuery.eq('barber_id', user.barber.id);
      }

      const { data: allTodayApts, error: todayError } = await todayQuery;
      if (todayError) throw todayError;

      const todayAppointmentsWithServices = (allTodayApts || []).map(apt => ({
        ...apt,
        services: apt.appointment_services?.map((as: any) => as.service) || []
      }));
      
      setAllTodayAppointments(todayAppointmentsWithServices);
      
      // Buscar todos os agendamentos de hoje (do início ao fim do dia)
      let todayDisplayQuery = supabase
        .from('appointments')
        .select(`
          *,
          client:clients(id, name, phone),
          barber:barbers(id, name),
          appointment_services(
            service:services(id, name, price)
          )
        `)
        .gte('appointment_datetime', today.toISOString())
        .lte('appointment_datetime', endOfToday.toISOString())
        .order('appointment_datetime', { ascending: true })
        .limit(6);

      if (user?.role === 'barber' && user.barber?.id) {
        todayDisplayQuery = todayDisplayQuery.eq('barber_id', user.barber.id);
      }

      const { data: todayDisplayApts, error: todayDisplayError } = await todayDisplayQuery;
      if (todayDisplayError) throw todayDisplayError;

      const todayDisplayAppointmentsWithServices = (todayDisplayApts || []).map(apt => ({
        ...apt,
        services: apt.appointment_services?.map((as: any) => as.service) || []
      }));
      
      console.log('Agendamentos do dia encontrados:', todayDisplayAppointmentsWithServices.length);
      setTodayAppointments(todayDisplayAppointmentsWithServices);

      // 2. Buscar total de clientes (sempre total, independente do filtro)
      const { count: clientCount, error: clientError } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true });
      
      if (clientError) throw clientError;
      setTotalClients(clientCount || 0);

      // 3. Buscar agendamentos do período selecionado
      let periodApptQuery = supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .gte('appointment_datetime', startDate.toISOString())
        .lte('appointment_datetime', endDate.toISOString());

      if (user?.role === 'barber' && user.barber?.id) {
        periodApptQuery = periodApptQuery.eq('barber_id', user.barber.id);
      }

      const { count: periodApptsCount, error: periodError } = await periodApptQuery;
      if (periodError) throw periodError;
      setMonthlyAppointments(periodApptsCount || 0);

      // 4. Buscar faturamento do período (agendamentos completados + vendas)
      console.log('Buscando faturamento para o período:', { startDate, endDate });
      
      // Agendamentos completados
      let completedApptQuery = supabase
        .from('appointments')
        .select('total_price, final_amount')
        .eq('status', 'completed')
        .gte('appointment_datetime', startDate.toISOString())
        .lte('appointment_datetime', endDate.toISOString());

      if (user?.role === 'barber' && user.barber?.id) {
        completedApptQuery = completedApptQuery.eq('barber_id', user.barber.id);
      }

      const { data: completedApts, error: revenueError } = await completedApptQuery;
      if (revenueError) {
        console.error('Erro ao buscar agendamentos completados:', revenueError);
        throw revenueError;
      }

      // Vendas do período
      let salesQuery = supabase
        .from('sales')
        .select('total_amount')
        .gte('sale_datetime', startDate.toISOString())
        .lte('sale_datetime', endDate.toISOString());

      if (user?.role === 'barber' && user.barber?.id) {
        salesQuery = salesQuery.eq('barber_id', user.barber.id);
      }

      const { data: salesData, error: salesError } = await salesQuery;
      if (salesError) {
        console.error('Erro ao buscar vendas:', salesError);
        throw salesError;
      }

      const appointmentsRevenue = (completedApts || []).reduce((sum, apt) => {
        // Usa final_amount se disponível, senão usa total_price
        const price = Number(apt.final_amount || apt.total_price) || 0;
        return sum + price;
      }, 0);
      
      const salesRevenue = (salesData || []).reduce((sum, sale) => {
        const amount = Number(sale.total_amount) || 0;
        return sum + amount;
      }, 0);
      
      const totalRevenue = appointmentsRevenue + salesRevenue;
      
      console.log('Faturamento calculado:', { 
        completedApts: completedApts?.length || 0,
        salesData: salesData?.length || 0,
        appointmentsRevenue, 
        salesRevenue, 
        totalRevenue 
      });
      
      setMonthlyRevenue(totalRevenue);

      // 5. Buscar vendas recentes (sempre recentes, independente do filtro)
      let recentSalesQuery = supabase
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
        `)
        .order('sale_datetime', { ascending: false })
        .limit(5);

      if (user?.role === 'barber' && user.barber?.id) {
        recentSalesQuery = recentSalesQuery.eq('barber_id', user.barber.id);
      }

      const { data: recentSalesData, error: recentSalesError } = await recentSalesQuery;
      if (recentSalesError) throw recentSalesError;

      const salesWithProducts = (recentSalesData || []).map(sale => ({
        ...sale,
        products: sale.sale_products?.map((sp: any) => ({
          id: sp.product.id,
          name: sp.product.name,
          quantity: sp.quantity,
          price: sp.price_at_sale
        })) || []
      }));
      
      setRecentSales(salesWithProducts);
      
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
      toast.error('Erro ao carregar dashboard');
    } finally {
      setLoadingData(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateTime = (dateTime: string) => {
    const date = new Date(dateTime);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();
    
    if (isToday) {
      return `Hoje, ${formatTime(dateTime)}`;
    } else if (isTomorrow) {
      return `Amanhã, ${formatTime(dateTime)}`;
    } else {
      return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${formatTime(dateTime)}`;
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // Funções do modal de vendas
  const handleAddToCart = (product: Product) => {
    const existingItem = cartItems.find(item => item.product.id === product.id);
    
    if (existingItem) {
      if (existingItem.quantity < product.stock_quantity) {
        setCartItems(items => 
          items.map(item => 
            item.product.id === product.id 
              ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * product.price }
              : item
          )
        );
      } else {
        toast.error('Estoque insuficiente');
      }
    } else {
      if (product.stock_quantity > 0) {
        setCartItems(items => [...items, {
          product,
          quantity: 1,
          subtotal: product.price
        }]);
      } else {
        toast.error('Produto fora de estoque');
      }
    }
  };

  const handleUpdateCartQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveFromCart(productId);
      return;
    }

    const item = cartItems.find(item => item.product.id === productId);
    if (item && quantity > item.product.stock_quantity) {
      toast.error('Quantidade maior que o estoque disponível');
      return;
    }

    setCartItems(items => 
      items.map(item => 
        item.product.id === productId 
          ? { ...item, quantity, subtotal: quantity * item.product.price }
          : item
      )
    );
  };

  const handleRemoveFromCart = (productId: number) => {
    setCartItems(items => items.filter(item => item.product.id !== productId));
  };

  const handleFinalizeSale = async () => {
    if (cartItems.length === 0) {
      toast.error('Carrinho vazio');
      return;
    }

    if (!user?.barber?.id && user?.role === 'barber') {
      toast.error('Erro: barbeiro não identificado');
      return;
    }

    setSaleLoading(true);
    try {
      const selectedBarber = user?.role === 'barber' 
        ? barbers.find(b => b.id === user.barber?.id)
        : barbers[0]; // Se for admin, usar primeiro barbeiro

      if (!selectedBarber) {
        toast.error('Barbeiro não encontrado');
        return;
      }

      const sale = await createSale(
        cartItems,
        selectedClient?.id || null,
        selectedBarber
      );

      if (sale) {
        setCartItems([]);
        setSelectedClient(null);
        setShowSaleModal(false);
        loadDashboardData(); // Recarregar dados do dashboard
        toast.success('Venda realizada com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao finalizar venda:', error);
      toast.error('Erro ao processar venda');
    } finally {
      setSaleLoading(false);
    }
  };

  const handleCloseModals = () => {
    setShowAppointmentModal(false);
    setShowSaleModal(false);
    setCartItems([]);
    setSelectedClient(null);
  };

  const handleAppointmentSubmit = async (appointmentData: any, selectedServices: Service[], selectedBarber: Barber, recurrence?: any) => {
    try {
      const result = await createAppointment(appointmentData, selectedServices, selectedBarber, recurrence);
      if (result) {
        setShowAppointmentModal(false);
        loadDashboardData(); // Recarregar dados do dashboard
        toast.success('Agendamento criado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      toast.error('Erro ao criar agendamento');
    }
  };

  const handleCreateClient = async (clientData: { name: string; phone: string; email: string }) => {
    try {
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({
          name: clientData.name.trim(),
          phone: clientData.phone.trim() || null,
          email: clientData.email.trim() || null
        })
        .select()
        .single();

      if (error) throw error;

      // Atualizar lista local de clientes
      setClients(prev => [...prev, newClient]);
      toast.success('Cliente cadastrado com sucesso!');
      return newClient;
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

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-64 p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  const allStats = [
    {
      name: 'Agendamentos Hoje',
      value: allTodayAppointments.length.toString(),
      icon: Calendar,
      color: 'bg-blue-500',
    },
    {
      name: 'Clientes Cadastrados',
      value: totalClients.toString(),
      icon: Users,
      color: 'bg-green-500',
    },
    {
      name: selectedPeriod === 'today' ? 'Faturamento Hoje' : `Faturamento - ${getPeriodDescription()}`,
      value: formatCurrency(monthlyRevenue),
      icon: DollarSign,
      color: 'bg-yellow-500',
    },
    {
      name: selectedPeriod === 'today' ? 'Agendamentos Hoje' : `Agendamentos - ${getPeriodDescription()}`,
      value: monthlyAppointments.toString(),
      icon: Scissors,
      color: 'bg-purple-500',
    },
  ];

  // Filtrar stats para barbeiros (remover card de clientes cadastrados)
  const stats = user?.role === 'barber' 
    ? allStats.filter(stat => stat.name !== 'Clientes Cadastrados')
    : allStats;

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Bem-vindo, {user?.username}!
        </h1>
        <div className="flex items-center gap-4">
          <div className="text-xs sm:text-sm text-gray-500">
            {new Date().toLocaleDateString('pt-BR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </div>
      </div>

      {/* Botões de Atalho */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <button
          onClick={() => {
            console.log('Abrindo modal de agendamento. Dados disponíveis:', {
              clients: clients.length,
              barbers: barbers.length,
              services: services.length
            });
            setShowAppointmentModal(true);
          }}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 sm:py-2 rounded-lg transition-colors text-sm sm:text-base"
        >
          <Plus className="h-4 w-4" />
          Novo Agendamento
        </button>
        <button
          onClick={() => {
            console.log('Abrindo modal de venda. Dados disponíveis:', {
              clients: clients.length,
              products: products.length
            });
            setShowSaleModal(true);
          }}
          className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-3 sm:py-2 rounded-lg transition-colors text-sm sm:text-base"
        >
          <ShoppingCart className="h-4 w-4" />
          Vender Produto
        </button>
      </div>

      {/* Filtros de Período */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Período:</span>
          </div>
          <div className="grid grid-cols-2 sm:flex gap-2">
            {Object.entries(periods).map(([key, period]) => (
              <button
                key={key}
                onClick={() => setSelectedPeriod(key as typeof selectedPeriod)}
                className={`px-3 py-2 sm:py-1 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  selectedPeriod === key
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.name}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center">
                <div className={`${stat.color} rounded-lg p-2 sm:p-3`}>
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="ml-3 sm:ml-4 min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{stat.name}</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{stat.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
            Agendamentos de Hoje
          </h2>
          <div className="space-y-3 sm:space-y-4">
            {todayAppointments.length > 0 ? (
              todayAppointments.map((appointment) => (
                <div key={appointment.id} className="flex items-start space-x-3 sm:space-x-4 p-4 bg-gray-50 rounded-lg border-l-4 border-blue-500">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm sm:text-base font-semibold text-blue-700">
                      {getInitials(appointment.client?.name || 'Cliente')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {appointment.client?.name || 'Cliente'}
                      </p>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        appointment.status === 'scheduled' ? 'bg-green-100 text-green-800' :
                        appointment.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        appointment.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {appointment.status === 'scheduled' ? 'Agendado' :
                         appointment.status === 'completed' ? 'Concluído' :
                         appointment.status === 'cancelled' ? 'Cancelado' :
                         appointment.status}
                      </span>
                    </div>
                    {appointment.client?.phone && (
                      <p className="text-xs text-gray-600 mb-1">
                        📞 {appointment.client.phone}
                      </p>
                    )}
                    <p className="text-xs text-gray-600 mb-1">
                      👤 {appointment.barber?.name || 'Barbeiro não informado'}
                    </p>
                    <p className="text-xs text-gray-500 truncate mb-2">
                      ✂️ {appointment.services?.map(s => s.name).join(' + ') || 'Serviço'}
                    </p>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-blue-600 font-medium">
                        🕒 {formatDateTime(appointment.appointment_datetime)}
                      </p>
                      {appointment.services && appointment.services.length > 0 && (
                        <p className="text-xs font-semibold text-green-600">
                          💰 R$ {appointment.services.reduce((total, service) => total + (service.price || 0), 0).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-medium">Nenhum agendamento para hoje</p>
                <p className="text-xs">Os agendamentos de hoje aparecerão aqui</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
            Vendas Recentes
          </h2>
          <div className="space-y-3 sm:space-y-4">
            {recentSales.length > 0 ? (
              recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {sale.products?.map(p => p.name).join(', ') || 'Produtos'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      Cliente: {sale.client?.name || 'Sem cliente'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-green-600">
                      {formatCurrency(sale.total_amount)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(sale.sale_datetime).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 sm:py-4 text-gray-500">
                <p className="text-sm">Nenhuma venda recente</p>
                <p className="text-xs">As vendas recentes aparecerão aqui</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Novo Agendamento */}
      {showAppointmentModal && (
        <AppointmentModal
          isOpen={showAppointmentModal}
          onClose={handleCloseModals}
          onSubmit={handleAppointmentSubmit}
          clients={clients}
          setClients={setClients}
          barbers={barbers}
          services={services}
          loading={loadingModalData}
        />
      )}

      {/* Modal de Nova Venda */}
      {showSaleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-none sm:rounded-lg max-w-6xl w-full h-full sm:h-auto sm:max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Nova Venda</h2>
              <button
                onClick={handleCloseModals}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Plus className="h-5 w-5 rotate-45 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              <div className="flex flex-col lg:grid lg:grid-cols-3 gap-0 lg:gap-6 h-full">
                {/* Produtos */}
                <div className="lg:col-span-2 flex-1 lg:flex-none overflow-hidden flex flex-col">
                  <div className="p-4 sm:p-6 pb-2 sm:pb-3 flex-shrink-0">
                    <h3 className="text-base sm:text-lg font-medium text-gray-900">
                      Produtos ({products.length} encontrados)
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6">
                    {loadingModalData ? (
                      <div className="flex items-center justify-center py-8 sm:py-12">
                        <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-sm sm:text-base text-gray-600">Carregando produtos...</span>
                      </div>
                    ) : (
                      <ProductGrid
                        products={products}
                        onAddToCart={handleAddToCart}
                        loading={false}
                      />
                    )}
                  </div>
                </div>

                {/* Carrinho */}
                <div className="lg:col-span-1 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-gray-200">
                  <div className="h-full p-4 sm:p-6">
                    <ShoppingCartComponent
                      items={cartItems}
                      selectedClient={selectedClient}
                      clients={clients}
                      onUpdateQuantity={handleUpdateCartQuantity}
                      onRemoveItem={handleRemoveFromCart}
                      onSelectClient={setSelectedClient}
                      onFinalizeSale={handleFinalizeSale}
                      loading={saleLoading}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};