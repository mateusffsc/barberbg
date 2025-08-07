import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  DollarSign, 
  Users,
  Scissors,
  ShoppingCart,
  Calendar
} from 'lucide-react';
import { useBarberReports } from '../hooks/useBarberReports';
import { BarberReport } from '../types/barberReport';
import { ReportPeriod } from '../types/report';
import { CommissionSummaryCard } from '../components/reports/CommissionSummaryCard';
import { CommissionChart } from '../components/reports/CommissionChart';
import { ServicesCommissionTable } from '../components/reports/ServicesCommissionTable';
import { ProductsCommissionTable } from '../components/reports/ProductsCommissionTable';
import { PeriodSelector } from '../components/reports/PeriodSelector';
import { useAuth } from '../contexts/AuthContext';
import toast, { Toaster } from 'react-hot-toast';

export const MyReports: React.FC = () => {
  const { user } = useAuth();
  const { loading, generateBarberReport } = useBarberReports();
  const [reportData, setReportData] = useState<BarberReport | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>({
    startDate: new Date(new Date().setHours(0, 0, 0, 0)),
    endDate: new Date(new Date().setHours(23, 59, 59, 999)),
    label: 'Hoje'
  });

  useEffect(() => {
    loadReport();
  }, [selectedPeriod]);

  const loadReport = async () => {
    if (!user?.barber?.id) {
      toast.error('Dados do barbeiro não encontrados');
      return;
    }

    try {
      const data = await generateBarberReport(
        selectedPeriod.startDate,
        selectedPeriod.endDate,
        user.barber.id
      );
      setReportData(data);
    } catch (error) {
      console.error('Erro ao carregar relatório:', error);
      toast.error('Erro ao carregar relatório');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loading && !reportData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <BarChart3 className="h-6 w-6 mr-2" />
            Meus Relatórios de Comissão
          </h1>
          <p className="text-gray-600">
            Acompanhe suas comissões e performance pessoal
          </p>
        </div>

        <PeriodSelector
          selectedPeriod={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
        />
      </div>

      {reportData ? (
        <>
          {/* Summary Cards */}
          <CommissionSummaryCard summary={reportData.summary} />

          {/* Charts and Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Commission Chart */}
            <CommissionChart
              data={reportData.dailyCommissions}
              title="Comissões Diárias"
            />

            {/* Top Clients */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-4">
                <Users className="h-5 w-5 text-blue-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Top Clientes</h3>
              </div>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {reportData.topClients.map((client, index) => (
                  <div key={client.clientId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{client.clientName}</p>
                      <p className="text-sm text-gray-600">
                        {client.appointmentsCount} agendamentos • {client.salesCount} vendas
                      </p>
                      <p className="text-xs text-gray-500">
                        Última visita: {new Date(client.lastVisit).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">
                        {formatCurrency(client.totalSpent)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Ticket médio: {formatCurrency(client.averageTicket)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {reportData.topClients.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p>Nenhum cliente encontrado para o período</p>
                </div>
              )}
            </div>
          </div>

          {/* Payment Methods Stats */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <DollarSign className="h-5 w-5 text-green-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Formas de Pagamento</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {reportData.paymentMethodStats.map((method, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      {method.paymentMethod}
                    </span>
                    <span className="text-sm text-gray-600">
                      {method.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${method.percentage}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>{method.count} transações</span>
                    <span>{formatCurrency(method.totalRevenue)}</span>
                  </div>
                </div>
              ))}
            </div>

            {reportData.paymentMethodStats.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>Nenhuma forma de pagamento registrada para o período</p>
              </div>
            )}
          </div>

          {/* Monthly Summary */}
          {reportData.monthlyCommissions.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-4">
                <Calendar className="h-5 w-5 text-orange-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Resumo Mensal</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reportData.monthlyCommissions.map((month, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg">
                    <h4 className="font-semibold text-gray-900 mb-2">
                      {month.month} {month.year}
                    </h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total:</span>
                        <span className="font-semibold text-green-600">
                          {formatCurrency(month.totalCommission)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Serviços:</span>
                        <span>{formatCurrency(month.serviceCommission)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Produtos:</span>
                        <span>{formatCurrency(month.productCommission)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 pt-1 border-t">
                        <span>{month.appointmentsCount} agendamentos</span>
                        <span>{month.salesCount} vendas</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Services Details */}
          <ServicesCommissionTable services={reportData.serviceDetails} />

          {/* Products Details */}
          <ProductsCommissionTable products={reportData.productDetails} />
        </>
      ) : (
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Nenhum dado disponível para o período selecionado</p>
          </div>
        </div>
      )}
    </div>
  );
};