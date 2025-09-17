import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  DollarSign, 
  Users, 
  Calendar, 
  ShoppingCart, 
  Scissors,
  TrendingUp,
  Package,
  UserCheck,
  Receipt,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useReports } from '../hooks/useReports';
import { ReportCard } from '../components/reports/ReportCard';
import { SimpleChart } from '../components/reports/SimpleChart';
import { TopItemsList } from '../components/reports/TopItemsList';
import { PeriodSelector } from '../components/reports/PeriodSelector';
import { DashboardData, ReportPeriod } from '../types/report';
import { useAuth } from '../contexts/AuthContext';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { AdminPasswordModal } from '../components/ui/AdminPasswordModal';
import toast, { Toaster } from 'react-hot-toast';

export const Reports: React.FC = () => {
  const { user } = useAuth();
  const { loading, generateDashboard } = useReports();
  const { isAuthenticated, isLoading: authLoading, authenticate } = useAdminAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)),
    endDate: new Date(),
    label: 'Últimos 30 dias'
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setShowPasswordModal(true);
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboard();
    }
  }, [selectedPeriod, isAuthenticated]);

  const loadDashboard = async () => {
    try {
      const data = await generateDashboard(selectedPeriod);
      setDashboardData(data);
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      toast.error('Erro ao carregar relatórios');
    }
  };

  if (authLoading || (loading && !dashboardData)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <AdminPasswordModal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
          onSuccess={() => {
            authenticate();
            setShowPasswordModal(false);
          }}
          title="Acesso aos Relatórios Administrativos"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <BarChart3 className="h-6 w-6 mr-2" />
            Relatórios
          </h1>
          <p className="text-gray-600">
            {user?.role === 'admin' 
              ? 'Análise completa do desempenho da barbearia'
              : 'Seus relatórios de performance'
            }
          </p>
        </div>
      </div>

      {/* Seletor de período */}
      <PeriodSelector
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        loading={loading}
      />

      {dashboardData && (
        <>
          {/* Cards principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ReportCard
              title="Receita Total"
              value={dashboardData.financialReport.totalRevenue}
              icon={DollarSign}
              color="bg-green-500"
              subtitle={`Líquida: ${dashboardData.financialReport.netRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
            />
            
            <ReportCard
              title="Agendamentos"
              value={dashboardData.appointmentsReport.totalAppointments}
              icon={Calendar}
              color="bg-blue-500"
              subtitle={`${dashboardData.appointmentsReport.completedAppointments} concluídos`}
            />
            
            <ReportCard
              title="Vendas de Produtos"
              value={dashboardData.salesReport.totalSales}
              icon={ShoppingCart}
              color="bg-purple-500"
              subtitle={`Ticket médio: ${dashboardData.salesReport.averageTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
            />
            
            <ReportCard
              title="Clientes Ativos"
              value={dashboardData.clientsReport.activeClients}
              icon={Users}
              color="bg-yellow-500"
              subtitle={`${dashboardData.clientsReport.newClientsThisPeriod} novos`}
            />
          </div>

          {/* Balanço Financeiro */}
          {user?.role === 'admin' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Balanço Financeiro - {selectedPeriod.label}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <div className="flex items-center justify-center mb-2">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {dashboardData.financialReport.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <div className="text-sm text-green-800">Faturamento Total</div>
                </div>
                
                <div className="bg-red-50 p-4 rounded-lg text-center">
                  <div className="flex items-center justify-center mb-2">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="text-2xl font-bold text-red-600">
                    {dashboardData.financialReport.totalExpenses.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <div className="text-sm text-red-800">Despesas Total</div>
                </div>
                
                <div className="bg-orange-50 p-4 rounded-lg text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Receipt className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="text-2xl font-bold text-orange-600">
                    {dashboardData.financialReport.totalCommissions.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <div className="text-sm text-orange-800">Comissões Pagas</div>
                </div>
                
                <div className={`p-4 rounded-lg text-center ${
                  dashboardData.financialReport.netRevenue >= 0 
                    ? 'bg-blue-50' 
                    : 'bg-red-50'
                }`}>
                  <div className="flex items-center justify-center mb-2">
                    {dashboardData.financialReport.netRevenue >= 0 ? (
                      <TrendingUp className="h-6 w-6 text-blue-600" />
                    ) : (
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    )}
                  </div>
                  <div className={`text-2xl font-bold ${
                    dashboardData.financialReport.netRevenue >= 0 
                      ? 'text-blue-600' 
                      : 'text-red-600'
                  }`}>
                    {dashboardData.financialReport.netRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <div className={`text-sm ${
                    dashboardData.financialReport.netRevenue >= 0 
                      ? 'text-blue-800' 
                      : 'text-red-800'
                  }`}>
                    Lucro {dashboardData.financialReport.netRevenue >= 0 ? 'Líquido' : '(Prejuízo)'}
                  </div>
                </div>
              </div>

              {/* Gráfico de despesas por categoria */}
              {dashboardData.financialReport.expensesByCategory.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Despesas por Categoria</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {dashboardData.financialReport.expensesByCategory.map((expense, index) => (
                      <div key={expense.category} className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-900">{expense.category}</span>
                          <span className="text-sm font-bold text-red-600">
                            {expense.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{expense.count} despesa(s)</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Análise de performance */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-md font-medium text-gray-900 mb-3">Análise Financeira</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Margem de Lucro:</span>
                    <span className={`ml-2 font-medium ${
                      dashboardData.financialReport.netRevenue >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {dashboardData.financialReport.totalRevenue > 0 
                        ? ((dashboardData.financialReport.netRevenue / dashboardData.financialReport.totalRevenue) * 100).toFixed(1)
                        : '0'
                      }%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">% Comissões:</span>
                    <span className="ml-2 font-medium text-orange-600">
                      {dashboardData.financialReport.totalRevenue > 0 
                        ? ((dashboardData.financialReport.totalCommissions / dashboardData.financialReport.totalRevenue) * 100).toFixed(1)
                        : '0'
                      }%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">% Despesas:</span>
                    <span className="ml-2 font-medium text-red-600">
                      {dashboardData.financialReport.totalRevenue > 0 
                        ? ((dashboardData.financialReport.totalExpenses / dashboardData.financialReport.totalRevenue) * 100).toFixed(1)
                        : '0'
                      }%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Gráficos de receita */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SimpleChart
              title="Receita por Dia"
              type="line"
              data={dashboardData.financialReport.revenueByDay.map(day => ({
                label: new Date(day.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                value: day.total
              }))}
            />
            
            <SimpleChart
              title="Receita vs Despesas"
              type="bar"
              data={[
                { label: 'Faturamento', value: dashboardData.financialReport.totalRevenue, color: 'bg-green-500' },
                { label: 'Despesas', value: dashboardData.financialReport.totalExpenses, color: 'bg-red-500' },
                { label: 'Comissões', value: dashboardData.financialReport.totalCommissions, color: 'bg-orange-500' }
              ]}
            />
          </div>

          {/* Performance por barbeiro */}
          {user?.role === 'admin' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <UserCheck className="h-5 w-5 mr-2" />
                  Performance dos Barbeiros - Serviços
                </h3>
                <div className="space-y-3">
                  {dashboardData.appointmentsReport.appointmentsByBarber.map((barber, index) => (
                    <div key={barber.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">{index + 1}</span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{barber.name}</div>
                          <div className="text-sm text-gray-500">{barber.appointments} agendamentos</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-900">
                          {barber.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                        <div className="text-sm text-green-600">
                          +{barber.commission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} comissão
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Package className="h-5 w-5 mr-2" />
                  Performance dos Barbeiros - Produtos
                </h3>
                <div className="space-y-3">
                  {dashboardData.salesReport.salesByBarber.map((barber, index) => (
                    <div key={barber.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">{index + 1}</span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{barber.name}</div>
                          <div className="text-sm text-gray-500">{barber.sales} vendas</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-900">
                          {barber.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                        <div className="text-sm text-green-600">
                          +{barber.commission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} comissão
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Top produtos e serviços */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopItemsList
              title="Top Produtos"
              items={dashboardData.salesReport.topProducts.map(product => ({
                id: product.id,
                name: product.name,
                value: product.revenue,
                subtitle: `${product.quantity} unidades vendidas`
              }))}
              valueLabel="Receita (R$)"
              emptyMessage="Nenhuma venda de produto no período"
            />
            
            <TopItemsList
              title="Top Serviços"
              items={dashboardData.appointmentsReport.topServices.map(service => ({
                id: service.id,
                name: service.name,
                value: service.revenue,
                subtitle: `${service.count} vezes realizado`
              }))}
              valueLabel="Receita (R$)"
              emptyMessage="Nenhum serviço realizado no período"
            />
          </div>

          {/* Top clientes */}
          <TopItemsList
            title="Top Clientes"
            items={dashboardData.clientsReport.topClients.map(client => ({
              id: client.id,
              name: client.name,
              value: client.totalSpent,
              subtitle: `${client.totalAppointments} agendamentos`,
              badge: `Última visita: ${new Date(client.lastVisit).toLocaleDateString('pt-BR')}`
            }))}
            valueLabel="Total gasto (R$)"
            emptyMessage="Nenhum cliente ativo no período"
          />

          {/* Resumo de comissões */}
          {dashboardData.financialReport.commissionsByBarber.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Resumo de Comissões
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dashboardData.financialReport.commissionsByBarber.map(barber => (
                  <div key={barber.id} className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-medium text-gray-900 mb-2">{barber.name}</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Serviços:</span>
                        <span className="font-medium">
                          {barber.serviceCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Produtos:</span>
                        <span className="font-medium">
                          {barber.productCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-1">
                        <span className="font-medium text-gray-900">Total:</span>
                        <span className="font-bold text-green-600">
                          {barber.totalCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <AdminPasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={() => {
          authenticate();
          setShowPasswordModal(false);
        }}
        title="Acesso aos Relatórios Administrativos"
      />
    </div>
  );
};