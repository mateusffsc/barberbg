export interface Service {
  id: number;
  name: string;
  description?: string;
  price: number;
  duration_minutes: number; // Manter para compatibilidade
  duration_minutes_normal: number;
  duration_minutes_special: number;
  is_chemical: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceFormData {
  name: string;
  description: string;
  price: string | number; // Permitir string para formatação de moeda
  duration_minutes_normal: number;
  duration_minutes_special: number;
  is_chemical: boolean;
}

export interface ServicesResponse {
  services: Service[];
  count: number;
}