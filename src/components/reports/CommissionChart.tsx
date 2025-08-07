import React from 'react';
import { BarberDailyCommission } from '../../types/barberReport';

interface CommissionChartProps {
  data: BarberDailyCommission[];
  title: string;
}

export const CommissionChart: React.FC<CommissionChartProps> = ({ data, title }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const maxValue = Math.max(...data.map(d => d.totalCommission));
  const minValue = Math.min(...data.map(d => d.totalCommission));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {data.map((item, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-900">
                  {new Date(item.date).toLocaleDateString('pt-BR', { 
                    day: '2-digit', 
                    month: '2-digit' 
                  })}
                </span>
                <span className="text-sm font-semibold text-green-600">
                  {formatCurrency(item.totalCommission)}
                </span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                <div
                  className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: maxValue > 0 ? `${(item.totalCommission / maxValue) * 100}%` : '0%'
                  }}
                ></div>
              </div>
              
              <div className="flex justify-between text-xs text-gray-500">
                <span>Serviços: {formatCurrency(item.serviceCommission)}</span>
                <span>Produtos: {formatCurrency(item.productCommission)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {data.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>Nenhum dado disponível para o período selecionado</p>
        </div>
      )}
    </div>
  );
};