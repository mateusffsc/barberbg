import React from 'react';
import { Calendar, Users, DollarSign, Scissors } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();

  const stats = [
    {
      name: 'Agendamentos Hoje',
      value: '12',
      icon: Calendar,
      color: 'bg-blue-500',
    },
    {
      name: 'Clientes Ativos',
      value: '248',
      icon: Users,
      color: 'bg-green-500',
    },
    {
      name: 'Faturamento Mensal',
      value: 'R$ 8.540',
      icon: DollarSign,
      color: 'bg-yellow-500',
    },
    {
      name: 'Serviços Realizados',
      value: '156',
      icon: Scissors,
      color: 'bg-purple-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Bem-vindo, {user?.username}!
        </h1>
        <div className="text-sm text-gray-500">
          {new Date().toLocaleDateString('pt-BR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.name}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center">
                <div className={`${stat.color} rounded-lg p-3`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Próximos Agendamentos
          </h2>
          <div className="space-y-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-700">JD</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">João da Silva</p>
                  <p className="text-xs text-gray-500">Corte + Barba - 14:30</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Vendas Recentes
          </h2>
          <div className="space-y-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">Corte Masculino</p>
                  <p className="text-xs text-gray-500">Cliente: Maria Santos</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-600">R$ 35,00</p>
                  <p className="text-xs text-gray-500">há 2h</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};