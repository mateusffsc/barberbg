import { PaymentMethod } from './payment';

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

export interface Appointment {
  id: number;
  client_id: number;
  barber_id: number;
  appointment_date: string; // Formato: YYYY-MM-DD
  appointment_time: string; // Formato: HH:MM:SS
  appointment_datetime?: string; // Campo calculado para compatibilidade
  status: AppointmentStatus;
  total_price: number;
  note?: string;
  payment_method?: PaymentMethod;
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
  services?: Array<{
    id: number;
    name: string;
    price: number;
    duration_minutes: number;
    is_chemical: boolean;
  }>;
}

export interface AppointmentFormData {
  client_id: number;
  barber_id: number;
  appointment_date: string; // Formato: YYYY-MM-DD
  appointment_time: string; // Formato: HH:MM
  appointment_datetime?: string; // Para compatibilidade com código existente
  service_ids: number[];
  note: string;
  recurrence?: {
    type: 'none' | 'daily' | 'weekly' | 'monthly';
    interval: number;
    end_date?: string;
    occurrences?: number;
  };
}

export interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resource: {
    status: AppointmentStatus;
    barber: string;
    client: string;
    services: string[];
    total: number;
    appointment: Appointment;
  };
}

export interface AppointmentsResponse {
  appointments: Appointment[];
  count: number;
}