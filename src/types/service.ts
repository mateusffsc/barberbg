export interface Service {
  id: number;
  name: string;
  description?: string;
  price: number;
  duration_minutes: number;
  is_chemical: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceFormData {
  name: string;
  description: string;
  price: string;
  duration_minutes: string;
  is_chemical: boolean;
}

export interface ServicesResponse {
  services: Service[];
  count: number;
}