import { PaymentMethod } from './payment';

export interface Sale {
  id: number;
  client_id?: number;
  barber_id: number;
  sale_datetime: string;
  total_amount: number;
  payment_method: PaymentMethod;
  created_at: string;
  updated_at: string;
  client?: {
    id: number;
    name: string;
  };
  barber?: {
    id: number;
    name: string;
  };
  products?: Array<{
    id: number;
    name: string;
    quantity: number;
    price: number;
  }>;
}

export interface CartItem {
  product: Product;
  quantity: number;
  subtotal: number;
}

export interface SaleFormData {
  client_id?: number;
  barber_id: number;
  items: CartItem[];
  total: number;
}

export interface SalesResponse {
  sales: Sale[];
  count: number;
}

import { Product } from './product';