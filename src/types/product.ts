export interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  stock_quantity: number;
  created_at: string;
  updated_at: string;
}

export interface ProductFormData {
  name: string;
  description: string;
  price: string;
  stock_quantity: string;
}

export interface ProductsResponse {
  products: Product[];
  count: number;
}