import React, { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
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
  const [showCustomPeriod, setShowCustomPeriod] = useState(false);
  const predefinedPeriods: ReportPeriod[] = [
    {
      startDate: new Date(new Date().setHours(0, 0, 0, 0)),
      endDate: new Date(new Date().setHours(23, 59, 59, 999)),
      label: 'Hoje'
    },
    {
      // Semana atual: de domingo (início) a domingo (fim)
      startDate: (() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        // set to Sunday of current week
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);
        return start;
      })(),
      endDate: (() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        start.setDate(start.getDate() - start.getDay());
        const end = new Date(start);
        // move to next Sunday and set end of day (domingo a domingo)
        end.setDate(end.getDate() + 7);
        end.setHours(23, 59, 59, 999);
        return end;
      })(),
      label: 'Semanal (Domingo a Domingo)'
    },
    {
      startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      endDate: new Date(),
      label: 'Este mês'
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
        label: 'Personalizado'
      });
    }
  };

  const handlePredefinedPeriodClick = (period: ReportPeriod) => {
    setShowCustomPeriod(false);
    onPeriodChange(period);
  };

  const handleCustomPeriodToggle = () => {
    setShowCustomPeriod(!showCustomPeriod);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Período atual selecionado */}
      <div className="flex items-center space-x-2 text-sm text-gray-600">
        <Calendar className="h-4 w-4" />
        <span>Período: <strong>{selectedPeriod.label}</strong></span>
      </div>

      {/* Botões de períodos */}
      <div className="flex flex-wrap gap-2">
        {/* Períodos predefinidos */}
        {predefinedPeriods.map((period, index) => (
          <button
            key={index}
            onClick={() => handlePredefinedPeriodClick(period)}
            disabled={loading}
            className={`px-3 py-2 text-sm rounded-lg transition-colors ${
              selectedPeriod.label === period.label && !showCustomPeriod
                ? 'bg-gray-900 text-white'
                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {period.label}
          </button>
        ))}

        {/* Botão Personalizado */}
        <button
          onClick={handleCustomPeriodToggle}
          disabled={loading}
          className={`px-3 py-2 text-sm rounded-lg transition-colors flex items-center space-x-1 ${
            showCustomPeriod || selectedPeriod.label === 'Personalizado'
              ? 'bg-gray-900 text-white'
              : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <span>Personalizado</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${showCustomPeriod ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Campos de data personalizada */}
      {showCustomPeriod && (
        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
          <input
            type="date"
            value={formatDateForInput(selectedPeriod.startDate)}
            onChange={(e) => handleCustomPeriod(e.target.value, formatDateForInput(selectedPeriod.endDate))}
            disabled={loading}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-50"
          />
          <span className="text-gray-500 text-sm">até</span>
          <input
            type="date"
            value={formatDateForInput(selectedPeriod.endDate)}
            onChange={(e) => handleCustomPeriod(formatDateForInput(selectedPeriod.startDate), e.target.value)}
            disabled={loading}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-50"
          />
        </div>
      )}
    </div>
  );
};