import React, { useState, useEffect } from 'react';
import { X, DollarSign, Plus, Trash2, ShoppingCart, Package } from 'lucide-react';
import { formatCurrency, parseCurrency, formatCurrencyInputFlexible } from '../../utils/formatters';
import { PaymentMethod, PAYMENT_METHODS, MultiplePaymentInfo } from '../../types/payment';
import { Product } from '../../types/product';
import { useProducts } from '../../hooks/useProducts';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface PaymentConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payments: MultiplePaymentInfo[], finalAmount: number, soldProducts?: { product: Product; quantity: number }[]) => void;
  title: string;
  originalAmount: number;
  loading?: boolean;
  appointmentId?: number; // Novo prop para identificar o agendamento
  barberId?: number; // Novo prop para identificar o barbeiro
  clientId?: number; // Novo prop para identificar o cliente
}

export const PaymentConfirmationModal: React.FC<PaymentConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  originalAmount,
  loading: externalLoading = false,
  appointmentId,
  barberId,
  clientId
}) => {
  // Todos os hooks devem estar no topo, sempre na mesma ordem
  const [payments, setPayments] = useState<MultiplePaymentInfo[]>([]);
  const [finalAmount, setFinalAmount] = useState<string>('');
  const [paymentDisplayValues, setPaymentDisplayValues] = useState<string[]>([]);
  const [showCustomAmount, setShowCustomAmount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showProducts, setShowProducts] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<{ product: Product; quantity: number }[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  
  // Hook sempre chamado, independente de condições
  const { fetchProducts } = useProducts();

  // Calcular valores numéricos
  const numericFinalAmount = parseCurrency(finalAmount);
  const productsTotal = selectedProducts.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const totalValue = originalAmount + productsTotal;
  const hasValueChanged = Math.abs(numericFinalAmount - totalValue) > 0.01;
  const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const remainingAmount = totalValue - totalPayments;
  const isPaymentComplete = Math.abs(remainingAmount) < 0.01;

  // Carregar produtos disponíveis
  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const response = await fetchProducts(1, '', 50); // Carregar até 50 produtos
      setAvailableProducts(response.products);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setFinalAmount(originalAmount.toFixed(2));
      setPayments([{ method: 'money', amount: originalAmount }]);
      setPaymentDisplayValues([originalAmount.toFixed(2).replace('.', ',')]);
      setShowCustomAmount(false);
      setShowProducts(false);
      setSelectedProducts([]);
      setProductSearch('');
      loadProducts();
    }
  }, [isOpen, originalAmount]);

  // Atualizar final_amount e pagamentos quando produtos mudarem
  useEffect(() => {
    const productsTotal = selectedProducts.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const totalToPay = originalAmount + productsTotal;
    
    // Atualizar o final_amount para incluir produtos
    setFinalAmount(totalToPay.toFixed(2));
    
    // Atualizar os pagamentos para incluir o valor total (serviço + produtos)
    setPayments([{ method: 'money', amount: totalToPay }]);
    setPaymentDisplayValues([totalToPay.toFixed(2).replace('.', ',')]);
  }, [selectedProducts, originalAmount]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!isPaymentComplete) return;

    setLoading(true);
    try {
      // Se há produtos selecionados, registrar venda separada
      if (selectedProducts.length > 0 && appointmentId && barberId) {
        await registerProductSale(appointmentId, selectedProducts, payments[0].method);
      }

      // Chamar onConfirm apenas com o valor do serviço (sem produtos)
      await onConfirm(payments, originalAmount, undefined);
      onClose();
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
      toast.error('Erro ao processar pagamento');
    } finally {
      setLoading(false);
    }
  };

  // Função para registrar venda de produtos separadamente
  const registerProductSale = async (appointmentId: number, soldProducts: { product: Product; quantity: number }[], paymentMethod: PaymentMethod) => {
    try {
      // Calcular total da venda de produtos
      const total = soldProducts.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

      // Buscar dados do barbeiro para obter taxa de comissão
      const { data: barberData, error: barberError } = await supabase
        .from('barbers')
        .select('commission_rate_product')
        .eq('id', barberId)
        .single();

      if (barberError) throw barberError;

      // Criar registro de venda
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          client_id: clientId,
          barber_id: barberId,
          sale_datetime: new Date().toISOString(),
          total_amount: total,
          payment_method: paymentMethod,
          appointment_id: appointmentId
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Registrar produtos vendidos e atualizar estoque
      for (const item of soldProducts) {
        // Inserir item vendido
        const { error: itemError } = await supabase
          .from('sale_products')
          .insert({
            sale_id: sale.id,
            product_id: item.product.id,
            quantity: item.quantity,
            price_at_sale: item.product.price,
            commission_rate_applied: barberData.commission_rate_product || 0
          });

        if (itemError) throw itemError;

        // Atualizar estoque
        const { error: stockError } = await supabase
          .from('products')
          .update({ 
            stock_quantity: item.product.stock_quantity - item.quantity 
          })
          .eq('id', item.product.id);

        if (stockError) throw stockError;
      }

      console.log('Venda de produtos registrada separadamente:', sale.id);
      toast.success(`Venda de ${soldProducts.length} produto(s) registrada com sucesso!`);
    } catch (error) {
      console.error('Erro ao registrar venda de produtos:', error);
      throw error;
    }
  };

  const addPayment = () => {
    const remainingAmount = parseCurrency(finalAmount) - payments.reduce((sum, p) => sum + p.amount, 0);
    if (remainingAmount > 0) {
      setPayments([...payments, { method: 'money', amount: remainingAmount }]);
      setPaymentDisplayValues([...paymentDisplayValues, remainingAmount.toFixed(2).replace('.', ',')]);
    }
  };

  const removePayment = (index: number) => {
    if (payments.length > 1) {
      setPayments(payments.filter((_, i) => i !== index));
      setPaymentDisplayValues(paymentDisplayValues.filter((_, i) => i !== index));
    }
  };

  const updatePaymentMethod = (index: number, method: PaymentMethod) => {
    const updatedPayments = [...payments];
    updatedPayments[index].method = method;
    setPayments(updatedPayments);
  };

  const updatePaymentAmount = (index: number, value: string) => {
    const formattedValue = formatCurrencyInputFlexible(value);
    const amount = parseCurrency(formattedValue) || 0;
    
    // Atualizar o valor numérico
    const updatedPayments = [...payments];
    updatedPayments[index].amount = amount;
    setPayments(updatedPayments);
    
    // Atualizar o valor de exibição
    const updatedDisplayValues = [...paymentDisplayValues];
    updatedDisplayValues[index] = formattedValue;
    setPaymentDisplayValues(updatedDisplayValues);
  };

  // Funções para produtos
  const addProductToCart = (product: Product) => {
    const existingItem = selectedProducts.find(item => item.product.id === product.id);
    
    if (existingItem) {
      // Se já existe, aumentar quantidade se há estoque
      if (existingItem.quantity < product.stock_quantity) {
        updateProductQuantity(product.id, existingItem.quantity + 1);
      }
    } else {
      // Adicionar novo produto
      setSelectedProducts(prev => [...prev, { product, quantity: 1 }]);
    }
  };

  const removeProductFromCart = (productId: number) => {
    setSelectedProducts(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateProductQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeProductFromCart(productId);
      return;
    }

    const product = selectedProducts.find(item => item.product.id === productId)?.product;
    if (product && quantity <= product.stock_quantity) {
      setSelectedProducts(prev => 
        prev.map(item => 
          item.product.id === productId 
            ? { ...item, quantity }
            : item
        )
      );
    }
  };

  const updateFinalAmountWithProducts = () => {
    // Esta função não deve mais incluir produtos no final_amount
    // O final_amount deve ser apenas do serviço
    // Os produtos são tratados separadamente
  };

  const filteredProducts = availableProducts.filter(product =>
    product.name.toLowerCase().includes(productSearch.toLowerCase()) &&
    product.stock_quantity > 0
  );



  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Permitir apenas números, vírgula e ponto
    value = value.replace(/[^\d,\.]/g, '');
    
    // Se contém vírgula, substituir por ponto para cálculos
    // Mas manter a vírgula na exibição se for o último caractere digitado
    if (value.includes(',')) {
      // Se há vírgula, garantir que só há uma
      const parts = value.split(',');
      if (parts.length > 2) {
        value = parts[0] + ',' + parts.slice(1).join('');
      }
      
      // Limitar casas decimais após a vírgula
      if (parts[1] && parts[1].length > 2) {
        value = parts[0] + ',' + parts[1].substring(0, 2);
      }
    } else if (value.includes('.')) {
      // Se há ponto, garantir que só há um
      const parts = value.split('.');
      if (parts.length > 2) {
        value = parts[0] + '.' + parts.slice(1).join('');
      }
      
      // Limitar casas decimais após o ponto
      if (parts[1] && parts[1].length > 2) {
        value = parts[0] + '.' + parts[1].substring(0, 2);
      }
    }
    
    setFinalAmount(value);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading || externalLoading}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">{/* Amount Section */}
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

          {/* Products Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-medium text-gray-700">
                Produtos adicionais:
              </div>
              <button
                onClick={() => setShowProducts(!showProducts)}
                className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                disabled={loading || externalLoading}
              >
                <Package className="h-4 w-4" />
                <span>{showProducts ? 'Ocultar produtos' : 'Adicionar produtos'}</span>
              </button>
            </div>

            {/* Selected Products */}
            {selectedProducts.length > 0 && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-700 mb-2">Produtos selecionados:</div>
                <div className="space-y-2">
                  {selectedProducts.map((item) => (
                    <div key={item.product.id} className="flex items-center justify-between text-sm">
                      <div className="flex-1">
                        <span className="font-medium">{item.product.name}</span>
                        <span className="text-gray-500 ml-2">
                          {formatCurrency(item.product.price)} x {item.quantity}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateProductQuantity(item.product.id, item.quantity - 1)}
                          className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-700 border rounded"
                          disabled={loading || externalLoading}
                        >
                          -
                        </button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateProductQuantity(item.product.id, item.quantity + 1)}
                          className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-700 border rounded"
                          disabled={loading || externalLoading || item.quantity >= item.product.stock_quantity}
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeProductFromCart(item.product.id)}
                          className="text-red-500 hover:text-red-700 ml-2"
                          disabled={loading || externalLoading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between text-sm font-medium">
                      <span>Total produtos:</span>
                      <span>{formatCurrency(selectedProducts.reduce((sum, item) => sum + (item.product.price * item.quantity), 0))}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Products List */}
            {showProducts && (
              <div className="border rounded-lg p-3 max-h-60 overflow-y-auto">
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Buscar produtos..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    disabled={loading || externalLoading}
                  />
                </div>

                {loadingProducts ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    <span className="text-sm text-gray-600 mt-2">Carregando produtos...</span>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-4 text-sm text-gray-500">
                    Nenhum produto encontrado
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredProducts.map((product) => (
                      <div key={product.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{product.name}</div>
                          <div className="text-xs text-gray-500">
                            {formatCurrency(product.price)} • Estoque: {product.stock_quantity}
                          </div>
                        </div>
                        <button
                          onClick={() => addProductToCart(product)}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                          disabled={loading || externalLoading || product.stock_quantity === 0}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment Methods */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-700">
                Formas de pagamento:
              </div>
              <button
                onClick={addPayment}
                disabled={loading || externalLoading || remainingAmount <= 0}
                className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" />
                <span>Adicionar</span>
              </button>
            </div>

            {payments.map((payment, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Pagamento {index + 1}
                  </span>
                  {payments.length > 1 && (
                    <button
                      onClick={() => removePayment(index)}
                      disabled={loading || externalLoading}
                      className="text-red-600 hover:text-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Payment Method Selection */}
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((method) => (
                    <button
                      key={method.value}
                      onClick={() => updatePaymentMethod(index, method.value)}
                      disabled={loading || externalLoading}
                      className={`flex items-center space-x-2 p-3 border rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        payment.method === method.value
                          ? 'border-gray-900 bg-gray-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-lg">{method.icon}</div>
                      <div className="text-sm font-medium text-gray-900">{method.label}</div>
                    </button>
                  ))}
                </div>

                {/* Payment Amount */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={paymentDisplayValues[index] || ''}
                    onChange={(e) => updatePaymentAmount(index, e.target.value)}
                    placeholder="0,00"
                    className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              </div>
            ))}

            {/* Payment Summary */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Valor do serviço:</span>
                <span className="font-medium">{formatCurrency(originalAmount)}</span>
              </div>
              {selectedProducts.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Valor dos produtos:</span>
                  <span className="font-medium">{formatCurrency(selectedProducts.reduce((sum, item) => sum + (item.product.price * item.quantity), 0))}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-300 pt-2">
                <span className="text-gray-600">Valor total:</span>
                <span className="font-medium">{formatCurrency(originalAmount + selectedProducts.reduce((sum, item) => sum + (item.product.price * item.quantity), 0))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total pago:</span>
                <span className="font-medium">{formatCurrency(totalPayments)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-300 pt-2">
                <span className={`font-medium ${remainingAmount > 0 ? 'text-red-600' : remainingAmount < 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {remainingAmount > 0 ? 'Restante:' : remainingAmount < 0 ? 'Excesso:' : 'Completo:'}
                </span>
                <span className={`font-medium ${remainingAmount > 0 ? 'text-red-600' : remainingAmount < 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {formatCurrency(Math.abs(remainingAmount))}
                </span>
              </div>
            </div>
            </div>

            {!isPaymentComplete && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <div className="text-yellow-600">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="text-sm text-yellow-800">
                    <strong>Atenção:</strong> O valor total dos pagamentos deve ser igual ao valor final.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={loading || externalLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || externalLoading || !isPaymentComplete}
            className="px-6 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {(loading || externalLoading) ? (
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