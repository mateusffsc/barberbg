import React, { useState, useEffect } from 'react';
import { X, DollarSign } from 'lucide-react';
import { PaymentMethod, PAYMENT_METHODS } from '../../types/payment';

interface PaymentConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentMethod: PaymentMethod, finalAmount: number) => void;
  title: string;
  originalAmount: number;
  loading?: boolean;
}

export const PaymentConfirmationModal: React.FC<PaymentConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  originalAmount,
  loading = false
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [finalAmount, setFinalAmount] = useState<string>('');
  const [showCustomAmount, setShowCustomAmount] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFinalAmount(originalAmount.toFixed(2));
      setSelectedMethod(null);
      setShowCustomAmount(false);
    }
  }, [isOpen, originalAmount]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedMethod && finalAmount) {
      const numericAmount = parseFloat(finalAmount);
      if (numericAmount > 0) {
        onConfirm(selectedMethod, numericAmount);
      }
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d,]/g, '').replace(',', '.');
    setFinalAmount(value);
  };

  const numericFinalAmount = parseFloat(finalAmount) || 0;
  const hasValueChanged = Math.abs(numericFinalAmount - originalAmount) > 0.01;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Amount Section */}
          <div className="mb-6">
            <div className="text-center mb-4">
              <div className="text-sm text-gray-600 mb-1">Valor original do serviço:</div>
              <div className="text-lg font-semibold text-gray-800">
                {formatCurrency(originalAmount)}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Valor final:</span>
                <button
                  onClick={() => setShowCustomAmount(!showCustomAmount)}
                  className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                >
                  {showCustomAmount ? 'Usar valor original' : 'Alterar valor'}
                </button>
              </div>

              {showCustomAmount ? (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={finalAmount}
                    onChange={handleAmountChange}
                    placeholder="0,00"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-semibold text-center"
                  />
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(numericFinalAmount)}
                  </div>
                </div>
              )}

              {hasValueChanged && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <div className="text-yellow-600">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="text-sm text-yellow-800">
                      <strong>Atenção:</strong> O valor foi alterado. Isso afetará os relatórios financeiros.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment Methods */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700 mb-3">
              Selecione a forma de pagamento:
            </div>
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method.value}
                onClick={() => setSelectedMethod(method.value)}
                disabled={loading}
                className={`w-full flex items-center space-x-3 p-4 border rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
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
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedMethod || !finalAmount || numericFinalAmount <= 0 || loading}
            className="px-6 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processando...
              </div>
            ) : (
              'Confirmar Pagamento'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};