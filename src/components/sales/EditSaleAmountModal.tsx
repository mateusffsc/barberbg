import React, { useEffect, useState } from 'react';
import { X, DollarSign } from 'lucide-react';
import { Sale } from '../../types/sale';
import { formatCurrency } from '../../utils/formatters';

interface EditSaleAmountModalProps {
  isOpen: boolean;
  sale: Sale | null;
  onClose: () => void;
  onSubmit: (newAmount: number) => Promise<void> | void;
  loading?: boolean;
}

export const EditSaleAmountModal: React.FC<EditSaleAmountModalProps> = ({
  isOpen,
  sale,
  onClose,
  onSubmit,
  loading = false
}) => {
  const [amountInput, setAmountInput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && sale) {
      setAmountInput((sale.total_amount ?? 0).toFixed(2));
      setError('');
    }
  }, [isOpen, sale]);

  const parseAmount = (value: string): number => {
    // Permitir vírgula como separador decimal
    const normalized = value.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : num;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseAmount(amountInput);
    if (value <= 0) {
      setError('Informe um valor válido maior que zero');
      return;
    }
    setError('');
    await onSubmit(parseFloat(value.toFixed(2)));
  };

  if (!isOpen || !sale) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <DollarSign className="h-5 w-5 mr-2 text-green-600" />
                Editar valor da venda
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={loading}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-700">
                  <div><span className="font-medium">ID da venda:</span> {sale.id}</div>
                  <div><span className="font-medium">Cliente:</span> {sale.client?.name || 'Venda avulsa'}</div>
                  <div><span className="font-medium">Barbeiro:</span> {sale.barber?.name}</div>
                  <div><span className="font-medium">Valor atual:</span> {formatCurrency(sale.total_amount)}</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Novo valor</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 59,90"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
                {error && (
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">Use vírgula para centavos. Ex.: 59,90</p>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};