export interface Barber {
  id: number;
  user_id: number;
  name: string;
  phone?: string;
  email?: string;
  commission_rate_service: number;
  commission_rate_product: number;
  commission_rate_chemical_service: number;
  created_at: string;
  updated_at: string;
  user?: {
    id: number;
    username: string;
    role: string;
  };
}

export interface BarberFormData {
  username: string;
  password: string;
  name: string;
  phone: string;
  email: string;
  commission_rate_service: number;
  commission_rate_product: number;
  commission_rate_chemical_service: number;
}

export interface BarberUpdateData {
  name: string;
  phone: string;
  email: string;
  commission_rate_service: number;
  commission_rate_product: number;
  commission_rate_chemical_service: number;
}

export interface BarbersResponse {
  barbers: Barber[];
  count: number;
}