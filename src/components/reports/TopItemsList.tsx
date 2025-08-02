import React from 'react';
import { formatCurrency } from '../../utils/formatters';

interface TopItem {
  id: number;
  name: string;
  value: number;
  subtitle?: string;
  badge?: string;
}

interface TopItemsListProps {
  title: string;
  items: TopItem[];
  valueLabel: string;
  emptyMessage?: string;
}

export const TopItemsList: React.FC<TopItemsListProps> = ({
  title,
  items,
  valueLabel,
  emptyMessage = 'Nenhum item encontrado'
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
      
      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 10).map((item, index) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {index + 1}
                  </span>
                </div>
                <div>
                  <div className="font-medium text-gray-900">{item.name}</div>
                  {item.subtitle && (
                    <div className="text-sm text-gray-500">{item.subtitle}</div>
                  )}
                  {item.badge && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                      {item.badge}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium text-gray-900">
                  {valueLabel.includes('R$') ? formatCurrency(item.value) : item.value.toLocaleString('pt-BR')}
                </div>
                <div className="text-sm text-gray-500">{valueLabel}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};