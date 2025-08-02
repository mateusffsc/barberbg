import React from 'react';
import { ShoppingCart as CartIcon, User } from 'lucide-react';
import { CartItem } from '../../types/sale';
import { Client } from '../../types/client';
import { formatCurrency } from '../../utils/formatters';

interface ShoppingCartProps {
  items: CartItem[];
  selectedClient: Client | null;
  clients: Client[];
  onUpdateQuantity: (productId: number, quantity: number) => void;
  onRemoveItem: (productId: number) => void;
  onSelectClient: (client: Client | null) => void;
  onFinalizeSale: () => void;
  loading?: boolean;
}

export const ShoppingCart: React.FC<ShoppingCartProps> = ({
  items,
  selectedClient,
  clients,
  onUpdateQuantity,
  onRemoveItem,
  onSelectClient,
  onFinalizeSale,
  loading = false
}) => {
  const total = items.reduce((sum, item) => sum + item.subtotal, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="bg-white rounded-lg border border-gray-200 h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <CartIcon className="h-5 w-5 mr-2" />
            Carrinho
          </h2>
          {totalItems > 0 && (
            <span className="bg-gray-900 text-white text-xs px-2 py-1 rounded-full">
              {totalItems} {totalItems === 1 ? 'item' : 'itens'}
            </span>
          )}
        </div>
      </div>

      {/* Cliente */}
      <div className="p-4 border-b border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Cliente (opcional)
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <User className="h-5 w-5 text-gray-400" />
          </div>
          <select
            value={selectedClient?.id || ''}
            onChange={(e) => {
              const clientId = parseInt(e.target.value);
              const client = clients.find(c => c.id === clientId) || null;
              onSelectClient(client);
            }}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          >
            <option value="">Venda avulsa</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <CartIcon className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <p>Carrinho vazio</p>
            <p className="text-sm">Adicione produtos para começar</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {items.map((item) => (
              <div key={item.product.id} className="flex items-center justify-between p-2 border-b border-gray-200">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {item.product.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatCurrency(item.product.price)} cada
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    className="w-6 h-6 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                  >
                    -
                  </button>
                  <input 
                    type="number" 
                    value={item.quantity} 
                    min="1"
                    max={item.product.stock_quantity}
                    className="w-12 text-center border border-gray-300 rounded px-1 py-0.5 text-sm"
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1;
                      const clampedValue = Math.max(1, Math.min(value, item.product.stock_quantity));
                      onUpdateQuantity(item.product.id, clampedValue);
                    }}
                  />
                  <button 
                    onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                    disabled={item.quantity >= item.product.stock_quantity}
                    className="w-6 h-6 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                  >
                    +
                  </button>
                  <button 
                    onClick={() => onRemoveItem(item.product.id)} 
                    className="text-red-500 hover:text-red-700 ml-2 w-6 h-6 flex items-center justify-center"
                    title="Remover item"
                  >
                    ×
                  </button>
                </div>
                
                <span className="font-medium ml-4 min-w-[80px] text-right">
                  {formatCurrency(item.subtotal)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {items.length > 0 && (
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-semibold text-gray-900">Total:</span>
            <span className="text-xl font-bold text-green-600">
              {formatCurrency(total)}
            </span>
          </div>
          
          <button
            onClick={onFinalizeSale}
            disabled={loading}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Processando...
              </div>
            ) : (
              'Finalizar Venda'
            )}
          </button>
        </div>
      )}
    </div>
  );
};