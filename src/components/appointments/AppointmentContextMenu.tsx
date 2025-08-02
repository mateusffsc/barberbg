import React from 'react';
import { Check, X, UserX, Edit, Trash2 } from 'lucide-react';
import { CalendarEvent } from '../../types/appointment';

interface AppointmentContextMenuProps {
  show: boolean;
  x: number;
  y: number;
  event: CalendarEvent | null;
  onClose: () => void;
  onStatusChange: (status: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const AppointmentContextMenu: React.FC<AppointmentContextMenuProps> = ({
  show,
  x,
  y,
  event,
  onClose,
  onStatusChange,
  onEdit,
  onDelete
}) => {
  if (!show || !event) return null;

  const menuItems = [
    {
      label: 'Marcar como Concluído',
      icon: Check,
      onClick: () => onStatusChange('completed'),
      show: event.resource.status === 'scheduled',
      className: 'text-green-600 hover:bg-green-50'
    },
    {
      label: 'Cancelar',
      icon: X,
      onClick: () => onStatusChange('cancelled'),
      show: event.resource.status === 'scheduled',
      className: 'text-red-600 hover:bg-red-50'
    },
    {
      label: 'Marcar Não Compareceu',
      icon: UserX,
      onClick: () => onStatusChange('no_show'),
      show: event.resource.status === 'scheduled',
      className: 'text-gray-600 hover:bg-gray-50'
    },
    {
      label: 'Editar',
      icon: Edit,
      onClick: onEdit,
      show: true,
      className: 'text-blue-600 hover:bg-blue-50'
    },
    {
      label: 'Excluir',
      icon: Trash2,
      onClick: onDelete,
      show: true,
      className: 'text-red-600 hover:bg-red-50'
    }
  ];

  const visibleItems = menuItems.filter(item => item.show);

  return (
    <div
      className="fixed z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-48"
      style={{ left: x, top: y }}
    >
      {/* Informações do agendamento */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="font-medium text-sm text-gray-900">
          {event.resource.client}
        </div>
        <div className="text-xs text-gray-500">
          {event.resource.services.join(', ')}
        </div>
        <div className="text-xs text-gray-500">
          {event.start.toLocaleString('pt-BR')}
        </div>
      </div>

      {/* Ações */}
      <div className="py-1">
        {visibleItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={index}
              onClick={item.onClick}
              className={`w-full text-left px-3 py-2 text-sm flex items-center space-x-2 transition-colors ${item.className}`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};