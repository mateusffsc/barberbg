import React, { useEffect, useMemo, useState } from 'react';
import { X, Calculator } from 'lucide-react';
import { Sale } from '../../types/sale';
import { formatCurrency } from '../../utils/formatters';

interface EditSaleItemsModalProps {
  isOpen: boolean;
  sale: Sale | null;
  onClose: () => void;
  onSubmit: (updates: Array<{ productId: number; newSubtotal: number }>) => void | Promise<void>;
  loading?: boolean;
}

type EditableItem = {
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  currentSubtotal: number;
  newSubtotalInput: string; // raw currency text (accepts comma)
};

function parseCurrencyInput(input: string): number | null {
  if (!input) return null;
  const normalized = input
    .replace(/[^0-9.,]/g, '')
    .replace(/\.(?=.*\.)/g, '') // keep only last dot
    .replace(',', '.');
  const value = parseFloat(normalized);
  if (isNaN(value)) return null;
  return value;
}

export default function EditSaleItemsModal({ isOpen, sale, onClose, onSubmit, loading }: EditSaleItemsModalProps) {
  const [items, setItems] = useState<EditableItem[]>([]);

  useEffect(() => {
    if (sale && isOpen) {
      const next: EditableItem[] = (sale.products || []).map((p) => {
        const currentSubtotal = p.quantity * p.price;
        return {
          productId: p.id,
          name: p.name,
          quantity: p.quantity,
          unitPrice: p.price,
          currentSubtotal,
          newSubtotalInput: currentSubtotal.toFixed(2).replace('.', ','),
        };
      });
      setItems(next);
    }
  }, [sale, isOpen]);

  const totals = useMemo(() => {
    const original = items.reduce((sum, it) => sum + it.currentSubtotal, 0);
    let edited = 0;
    let invalid = false;
    for (const it of items) {
      const parsed = parseCurrencyInput(it.newSubtotalInput);
      if (parsed === null || parsed <= 0) {
        invalid = true;
      } else {
        edited += parsed;
      }
    }
    return { original, edited, invalid };
  }, [items]);

  const handleChange = (index: number, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], newSubtotalInput: value };
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const updates: Array<{ productId: number; newSubtotal: number }> = [];
    for (const it of items) {
      const parsed = parseCurrencyInput(it.newSubtotalInput);
      if (parsed === null || parsed <= 0) return; // block submit on invalid
      updates.push({ productId: it.productId, newSubtotal: parsed });
    }
    await onSubmit(updates);
  };

  if (!isOpen || !sale) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calculator className="w-5 h-5" /> Editar valores por produto
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-100"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-4 max-h-[60vh] overflow-auto">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Venda</div>
                <div className="font-medium">#{sale.id}</div>
              </div>
              <div>
                <div className="text-gray-500">Cliente</div>
                <div className="font-medium">{sale.client?.name || '—'}</div>
              </div>
              <div>
                <div className="text-gray-500">Barbeiro</div>
                <div className="font-medium">{sale.barber?.name || '—'}</div>
              </div>
              <div>
                <div className="text-gray-500">Total atual</div>
                <div className="font-medium">{formatCurrency(sale.total_amount)}</div>
              </div>
            </div>

            <div className="border rounded">
              <div className="grid grid-cols-12 gap-2 p-2 bg-gray-50 text-xs font-semibold">
                <div className="col-span-5">Produto</div>
                <div className="col-span-2 text-right">Qtd</div>
                <div className="col-span-2 text-right">Unitário</div>
                <div className="col-span-3 text-right">Subtotal (editar)</div>
              </div>
              <div>
                {items.map((it, idx) => (
                  <div key={it.productId} className="grid grid-cols-12 gap-2 p-2 border-t text-sm items-center">
                    <div className="col-span-5 truncate" title={it.name}>{it.name}</div>
                    <div className="col-span-2 text-right">{it.quantity}</div>
                    <div className="col-span-2 text-right">{formatCurrency(it.unitPrice)}</div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        value={it.newSubtotalInput}
                        onChange={(e) => handleChange(idx, e.target.value)}
                        className="w-full border rounded px-2 py-1 text-right"
                        placeholder="0,00"
                      />
                      <div className="text-xs text-gray-500 text-right mt-1">
                        Atual: {formatCurrency(it.currentSubtotal)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-6 text-sm">
              <div className="flex flex-col items-end">
                <span className="text-gray-500">Total original</span>
                <span className="font-semibold">{formatCurrency(totals.original)}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-gray-500">Novo total</span>
                <span className="font-semibold">{formatCurrency(totals.edited || 0)}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-gray-500">Diferença</span>
                <span className="font-semibold">{formatCurrency((totals.edited || 0) - (totals.original || 0))}</span>
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
              type="submit"
              disabled={loading || totals.invalid}
              className={`px-4 py-2 rounded text-white ${
                loading || totals.invalid ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? 'Salvando...' : 'Salvar edição'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}