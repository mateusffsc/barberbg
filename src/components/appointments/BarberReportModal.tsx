import React, { useState, useEffect } from 'react';
import { X, UserCheck, DollarSign, Calendar, TrendingUp, Percent, Package, Scissors } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { toLocalISOString } from '../../utils/dateHelpers';

interface BarberReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  barberId: number | null;
}

interface BarberDetails {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  commission_rate_service: number;
  commission_rate_product: number;
  commission_rate_chemical_service: number;
  created_at: string;
}

interface CommissionData {
  totalServices: number;
  totalChemicalServices: number;
  totalProducts: number;
  serviceCommission: number;
  chemicalCommission: number;
  productCommission: number;
  totalCommission: number;
  totalRevenue: number;
}

interface RecentAppointment {
  id: number;
  appointment_datetime: string;
  status: string;
  total_price: number;
  client: {
    name: string;
  };
  services: Array<{
    name: string;
    is_chemical: boolean;
    price: number;
  }>;
}

interface RecentSale {
  id: number;
  sale_datetime: string;
  total_amount: number;
  products: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

interface CommissionTransaction {
  id: string;
  date: string;
  type: 'appointment' | 'sale';
  client_name?: string;
  items: string[];
  total_value: number;
  commission_value: number;
}

export const BarberReportModal: React.FC<BarberReportModalProps> = ({
  isOpen,
  onClose,
  barberId
}) => {
  const [barber, setBarber] = useState<BarberDetails | null>(null);
  const [commissionData, setCommissionData] = useState<CommissionData | null>(null);
  const [recentAppointments, setRecentAppointments] = useState<RecentAppointment[]>([]);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [commissionTransactions, setCommissionTransactions] = useState<CommissionTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('month'); // month, week, today

  useEffect(() => {
    if (isOpen && barberId) {
      loadBarberData();
    }
  }, [isOpen, barberId, selectedPeriod]);

  const getPeriodDates = () => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    
    switch (selectedPeriod) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'week':
        // Início da semana atual (domingo)
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        startDate = startOfWeek;
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
    }
    
    console.log('Relatório Barbeiro - Período:', selectedPeriod);
    console.log('Data início:', startDate.toLocaleString('pt-BR'));
    console.log('Data fim:', endDate.toLocaleString('pt-BR'));
    
    return { startDate, endDate };
  };

  const loadBarberData = async () => {
    if (!barberId) return;
    
    setLoading(true);
    try {
      // Buscar dados do barbeiro
      const { data: barberData, error: barberError } = await supabase
        .from('barbers')
        .select('*')
        .eq('id', barberId)
        .single();

      if (barberError) throw barberError;
      setBarber(barberData);

      const { startDate, endDate } = getPeriodDates();

      // Buscar agendamentos do período
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_datetime,
          status,
          total_price,
          client:clients(name),
          appointment_services(
            service_id,
            price_at_booking,
            commission_rate_applied,
            service:services(name, is_chemical)
          )
        `)
        .eq('barber_id', barberId)
        .gte('appointment_datetime', toLocalISOString(startDate))
        .lte('appointment_datetime', toLocalISOString(endDate))
        .eq('status', 'completed')
        .order('appointment_datetime', { ascending: false });
        
      console.log('Query agendamentos:', {
        barberId,
        startDate: toLocalISOString(startDate),
        endDate: toLocalISOString(endDate),
        resultCount: appointmentsData?.length || 0
      });

      if (appointmentsError) throw appointmentsError;

      // Calcular comissões
      let totalServices = 0;
      let totalChemicalServices = 0;
      let serviceCommission = 0;
      let chemicalCommission = 0;
      let totalRevenue = 0;

      const formattedAppointments = appointmentsData.map(apt => {
        totalRevenue += apt.total_price;
        
        const services = apt.appointment_services?.map((as: any) => {
          const service = {
            name: as.service.name,
            is_chemical: as.service.is_chemical,
            price: as.price_at_booking
          };

          if (as.service.is_chemical) {
            totalChemicalServices++;
            chemicalCommission += as.price_at_booking * as.commission_rate_applied;
          } else {
            totalServices++;
            serviceCommission += as.price_at_booking * as.commission_rate_applied;
          }

          return service;
        }) || [];

        return {
          ...apt,
          services
        };
      });

      setRecentAppointments(formattedAppointments);

      // Buscar vendas de produtos do período
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          total_amount,
          sale_datetime,
          sale_products(
            quantity,
            price_at_sale,
            commission_rate_applied,
            product:products(name)
          )
        `)
        .eq('barber_id', barberId)
        .gte('sale_datetime', toLocalISOString(startDate))
        .lte('sale_datetime', toLocalISOString(endDate))
        .order('sale_datetime', { ascending: false });
        
      console.log('Query vendas:', {
        barberId,
        salesCount: salesData?.length || 0,
        salesError
      });
      
      let totalProducts = 0;
      let productCommission = 0;
      
      const formattedSales = salesData?.map(sale => {
        const products = sale.sale_products?.map((sp: any) => {
          totalProducts += sp.quantity;
          productCommission += sp.price_at_sale * sp.quantity * sp.commission_rate_applied;
          
          return {
            name: sp.product.name,
            quantity: sp.quantity,
            price: sp.price_at_sale
          };
        }) || [];
        
        return {
          ...sale,
          products
        };
      }) || [];
      
      setRecentSales(formattedSales);
      
      // Criar lista combinada de transações de comissão
      const transactions: CommissionTransaction[] = [];
      
      // Adicionar agendamentos
      formattedAppointments.forEach(apt => {
        const serviceCommissions = apt.services.reduce((sum, service) => {
          const rate = service.is_chemical 
            ? barberData.commission_rate_chemical_service 
            : barberData.commission_rate_service;
          return sum + (service.price * rate);
        }, 0);
        
        transactions.push({
          id: `apt-${apt.id}`,
          date: apt.appointment_datetime,
          type: 'appointment',
          client_name: apt.client.name,
          items: apt.services.map(s => s.name),
          total_value: apt.total_price,
          commission_value: serviceCommissions
        });
      });
      
      // Adicionar vendas
      formattedSales.forEach(sale => {
        const saleCommission = sale.sale_products?.reduce((sum: number, sp: any) => {
          return sum + (sp.price_at_sale * sp.quantity * sp.commission_rate_applied);
        }, 0) || 0;
        
        transactions.push({
          id: `sale-${sale.id}`,
          date: sale.sale_datetime,
          type: 'sale',
          items: sale.products.map(p => `${p.name} (${p.quantity}x)`),
          total_value: sale.total_amount,
          commission_value: saleCommission
        });
      });
      
      // Ordenar por data (mais recente primeiro)
      transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setCommissionTransactions(transactions);

      setCommissionData({
        totalServices,
        totalChemicalServices,
        totalProducts,
        serviceCommission,
        chemicalCommission,
        productCommission,
        totalCommission: serviceCommission + chemicalCommission + productCommission,
        totalRevenue
      });

    } catch (error) {
      console.error('Erro ao carregar dados do barbeiro:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'today': return 'Hoje';
      case 'week': return 'Últimos 7 dias';
      case 'month': return 'Este mês';
      default: return 'Este mês';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900">
                Relatório do Barbeiro
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : barber ? (
              <div className="space-y-6">
                {/* Informações do Barbeiro */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="h-16 w-16 bg-gray-900 rounded-full flex items-center justify-center">
                      <UserCheck className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-900">{barber.name}</h4>
                      <p className="text-sm text-gray-500">
                        Barbeiro desde {formatDate(barber.created_at)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Taxas de Comissão */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Scissors className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">Serviços Gerais</span>
                      </div>
                      <div className="text-lg font-bold text-blue-600">
                        {Math.round(barber.commission_rate_service * 100)}%
                      </div>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Scissors className="h-4 w-4 text-purple-600" />
                        <span className="text-sm font-medium text-purple-800">Serviços Químicos</span>
                      </div>
                      <div className="text-lg font-bold text-purple-600">
                        {Math.round(barber.commission_rate_chemical_service * 100)}%
                      </div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Package className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">Produtos</span>
                      </div>
                      <div className="text-lg font-bold text-green-600">
                        {Math.round(barber.commission_rate_product * 100)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filtro de Período */}
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium text-gray-700">Período:</span>
                  <div className="flex space-x-2">
                    {[
                      { value: 'today', label: 'Hoje' },
                      { value: 'week', label: '7 dias' },
                      { value: 'month', label: 'Mês' }
                    ].map((period) => (
                      <button
                        key={period.value}
                        onClick={() => setSelectedPeriod(period.value)}
                        className={`px-3 py-1 text-sm rounded ${
                          selectedPeriod === period.value
                            ? 'bg-gray-900 text-white'
                            : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {period.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Estatísticas de Comissão */}
                {commissionData && (
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">
                      Comissões - {getPeriodLabel()}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-blue-50 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-blue-600">{commissionData.totalServices}</div>
                        <div className="text-sm text-blue-800">Serviços Gerais</div>
                        <div className="text-lg font-medium text-blue-600 mt-1">
                          {formatCurrency(commissionData.serviceCommission)}
                        </div>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-purple-600">{commissionData.totalChemicalServices}</div>
                        <div className="text-sm text-purple-800">Serviços Químicos</div>
                        <div className="text-lg font-medium text-purple-600 mt-1">
                          {formatCurrency(commissionData.chemicalCommission)}
                        </div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-600">{commissionData.totalProducts}</div>
                        <div className="text-sm text-green-800">Produtos</div>
                        <div className="text-lg font-medium text-green-600 mt-1">
                          {formatCurrency(commissionData.productCommission)}
                        </div>
                      </div>
                      <div className="bg-yellow-50 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-yellow-600">
                          {formatCurrency(commissionData.totalCommission)}
                        </div>
                        <div className="text-sm text-yellow-800">Total Comissão</div>
                        <div className="text-xs text-yellow-600 mt-1">
                          de {formatCurrency(commissionData.totalRevenue)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Comissões Recentes */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">
                    Comissões Recentes - {getPeriodLabel()}
                  </h4>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {commissionTransactions.length > 0 ? (
                      commissionTransactions.map((transaction) => (
                        <div key={transaction.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <Calendar className="h-4 w-4 text-gray-500" />
                              <span className="font-medium text-gray-900">
                                {new Date(transaction.date).toLocaleDateString('pt-BR')}
                              </span>
                              <span className="text-gray-500">
                                {new Date(transaction.date).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                transaction.type === 'appointment' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {transaction.type === 'appointment' ? 'Serviço' : 'Produto'}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center space-x-1">
                                <DollarSign className="h-4 w-4 text-green-600" />
                                <span className="font-medium text-green-600">
                                  {formatCurrency(transaction.total_value)}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                Comissão: {formatCurrency(transaction.commission_value)}
                              </div>
                            </div>
                          </div>
                          
                          {transaction.client_name && (
                            <div className="mb-2">
                              <span className="text-sm text-gray-600">
                                Cliente: {transaction.client_name}
                              </span>
                            </div>
                          )}
                          
                          <div className="flex flex-wrap gap-1">
                            {transaction.items.map((item, index) => (
                              <span
                                key={index}
                                className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                                  transaction.type === 'appointment'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-green-100 text-green-800'
                                }`}
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        Nenhuma comissão encontrada no período
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Barbeiro não encontrado
              </div>
            )}
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={onClose}
              className="w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 sm:mt-0 sm:w-auto sm:text-sm"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};