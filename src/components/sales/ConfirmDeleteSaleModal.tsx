import React from 'react';
import { X, Trash2 } from 'lucide-react';
import { Sale } from '../../types/sale';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface ConfirmDeleteSaleModalProps {
  isOpen: boolean;
  sale: Sale | null;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

export default function ConfirmDeleteSaleModal({
  isOpen,
  sale,
  onClose,
  onConfirm,
  loading,
}: ConfirmDeleteSaleModalProps) {
  if (!isOpen || !sale) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-600" /> Excluir venda
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-100"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-700">
            Tem certeza que deseja excluir esta venda? Esta ação não pode ser desfeita.
          </p>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Venda</div>
              <div className="font-medium">#{sale.id}</div>
            </div>
            <div>
              <div className="text-gray-500">Data/Hora</div>
              <div className="font-medium">{formatDate(sale.sale_datetime)}</div>
            </div>
            <div>
              <div className="text-gray-500">Cliente</div>
              <div className="font-medium">{sale.client?.name || 'Venda avulsa'}</div>
            </div>
            <div>
              <div className="text-gray-500">Total</div>
              <div className="font-medium">{formatCurrency(sale.total_amount)}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded border hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!!loading}
            className={`px-4 py-2 rounded text-white ${
              loading ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {loading ? 'Excluindo...' : 'Excluir venda'}
          </button>
        </div>
      </div>
    </div>
  );
}