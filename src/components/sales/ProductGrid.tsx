import React from 'react';
import { Package, AlertTriangle } from 'lucide-react';
import { Product } from '../../types/product';
import { formatCurrency } from '../../utils/formatters';

interface ProductGridProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  loading?: boolean;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  onAddToCart,
  loading = false
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="animate-pulse">
              <div className="bg-gray-200 h-32 rounded-lg mb-3"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-6 bg-gray-200 rounded w-1/2 mb-3"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum produto encontrado</h3>
        <p className="mt-1 text-sm text-gray-500">
          Tente ajustar sua busca ou verifique se há produtos cadastrados.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {products.map((product) => (
        <div
          key={product.id}
          className="border rounded-lg p-4 hover:shadow-lg transition-shadow bg-white"
        >
          {/* Placeholder da imagem */}
          <div className="h-24 bg-gray-200 rounded mb-2 flex items-center justify-center">
            <Package className="h-8 w-8 text-gray-400" />
          </div>
          
          {/* Nome do produto */}
          <h3 className="font-medium text-gray-900 mb-1 truncate">
            {product.name}
          </h3>
          
          {/* Estoque */}
          <div className="flex items-center text-sm text-gray-600 mb-2">
            {product.stock_quantity < 5 && product.stock_quantity > 0 && (
              <AlertTriangle className="h-3 w-3 text-red-500 mr-1" />
            )}
            <span className={product.stock_quantity < 5 ? 'text-red-600' : ''}>
              Estoque: {product.stock_quantity}
            </span>
          </div>
          
          {/* Preço e botão */}
          <div className="flex justify-between items-center mt-2">
            <span className="font-bold text-lg">
              {formatCurrency(product.price)}
            </span>
            <button
              onClick={() => onAddToCart(product)}
              disabled={product.stock_quantity === 0}
              className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {product.stock_quantity === 0 ? '×' : '+'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};