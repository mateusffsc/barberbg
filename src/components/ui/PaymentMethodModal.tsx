import React, { useState } from 'react';
import { X } from 'lucide-react';
import { PaymentMethod, PAYMENT_METHODS } from '../../types/payment';

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (paymentMethod: PaymentMethod) => void;
  title: string;
  amount: number;
  loading?: boolean;
}

export const PaymentMethodModal: React.FC<PaymentMethodModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  title,
  amount,
  loading = false
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedMethod) {
      onSelect(selectedMethod);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Amount */}
          <div className="mb-6 text-center">
            <div className="text-sm text-gray-600 mb-1">Valor total:</div>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(amount)}
            </div>
          </div>

          {/* Payment Methods */}
          <div className="space-y-3 mb-6">
            <div className="text-sm font-medium text-gray-700 mb-3">
              Selecione a forma de pagamento:
            </div>
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method.value}
                onClick={() => setSelectedMethod(method.value)}
                className={`w-full flex items-center space-x-3 p-4 border rounded-lg transition-colors ${
                  selectedMethod === method.value
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl">{method.icon}</div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-gray-900">{method.label}</div>
                </div>
                <div className={`w-4 h-4 border-2 rounded-full ${
                  selectedMethod === method.value
                    ? 'border-gray-900 bg-gray-900'
                    : 'border-gray-300'
                }`}>
                  {selectedMethod === method.value && (
                    <div className="w-full h-full bg-white rounded-full scale-50"></div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedMethod || loading}
            className="px-6 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processando...
              </div>
            ) : (
              'Confirmar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};