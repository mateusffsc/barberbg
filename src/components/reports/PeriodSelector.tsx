import React from 'react';
import { Calendar } from 'lucide-react';
import { ReportPeriod } from '../../types/report';

interface PeriodSelectorProps {
  selectedPeriod: ReportPeriod;
  onPeriodChange: (period: ReportPeriod) => void;
  loading?: boolean;
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  selectedPeriod,
  onPeriodChange,
  loading = false
}) => {
  const predefinedPeriods: ReportPeriod[] = [
    {
      startDate: new Date(new Date().setDate(new Date().getDate() - 7)),
      endDate: new Date(),
      label: 'Últimos 7 dias'
    },
    {
      startDate: new Date(new Date().setDate(new Date().getDate() - 30)),
      endDate: new Date(),
      label: 'Últimos 30 dias'
    },
    {
      startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      endDate: new Date(),
      label: 'Este mês'
    },
    {
      startDate: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
      endDate: new Date(new Date().getFullYear(), new Date().getMonth(), 0),
      label: 'Mês passado'
    },
    {
      startDate: new Date(new Date().getFullYear(), 0, 1),
      endDate: new Date(),
      label: 'Este ano'
    }
  ];

  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const handleCustomPeriod = (startDate: string, endDate: string) => {
    if (startDate && endDate) {
      onPeriodChange({
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        label: 'Período personalizado'
      });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-gray-500" />
          <span className="font-medium text-gray-900">Período:</span>
          <span className="text-gray-600">{selectedPeriod.label}</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Períodos predefinidos */}
          <div className="flex flex-wrap gap-2">
            {predefinedPeriods.map((period, index) => (
              <button
                key={index}
                onClick={() => onPeriodChange(period)}
                disabled={loading}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  selectedPeriod.label === period.label
                    ? 'bg-gray-900 text-white'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {period.label}
              </button>
            ))}
          </div>

          {/* Período personalizado */}
          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={formatDateForInput(selectedPeriod.startDate)}
              onChange={(e) => handleCustomPeriod(e.target.value, formatDateForInput(selectedPeriod.endDate))}
              disabled={loading}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-50"
            />
            <span className="text-gray-500">até</span>
            <input
              type="date"
              value={formatDateForInput(selectedPeriod.endDate)}
              onChange={(e) => handleCustomPeriod(formatDateForInput(selectedPeriod.startDate), e.target.value)}
              disabled={loading}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-50"
            />
          </div>
        </div>
      </div>
    </div>
  );
};