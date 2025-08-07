import React from 'react';
import { DollarSign, TrendingUp, Scissors, ShoppingCart } from 'lucide-react';
import { BarberCommissionSummary } from '../../types/barberReport';

interface CommissionSummaryCardProps {
  summary: BarberCommissionSummary;
}

export const CommissionSummaryCard: React.FC<CommissionSummaryCardProps> = ({ summary }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const cards = [
    {
      title: 'Comissão Total',
      value: formatCurrency(summary.totalCommission),
      icon: DollarSign,
      bgColor: 'bg-green-500',
      subtitle: `${summary.totalAppointments + summary.totalSales} transações`
    },
    {
      title: 'Comissão Serviços',
      value: formatCurrency(summary.serviceCommission),
      icon: Scissors,
      bgColor: 'bg-blue-500',
      subtitle: `${summary.totalAppointments} agendamentos`
    },
    {
      title: 'Comissão Produtos',
      value: formatCurrency(summary.productCommission),
      icon: ShoppingCart,
      bgColor: 'bg-purple-500',
      subtitle: `${summary.totalSales} vendas`
    },
    {
      title: 'Ticket Médio Serviços',
      value: formatCurrency(summary.averageServiceTicket),
      icon: TrendingUp,
      bgColor: 'bg-orange-500',
      subtitle: 'por agendamento'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className={`${card.bgColor} rounded-md p-2 mr-3`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500">{card.subtitle}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};