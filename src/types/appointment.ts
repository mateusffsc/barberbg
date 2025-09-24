import { PaymentMethod } from './payment';

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

export interface Appointment {
  id: number;
  client_id: number;
  client_name: string; // Nome do cliente (sincronizado automaticamente)
  client_phone: string; // Telefone do cliente (sincronizado automaticamente)
  barber_id: number;
  barber_name: string; // Nome do barbeiro (sincronizado automaticamente)
  barber_phone: string; // Telefone do barbeiro (sincronizado automaticamente)
  services_names: string; // Nomes dos serviços separados por vírgula
  services_ids: number[]; // Array com IDs dos serviços
  appointment_datetime: string; // Data e hora combinadas (principal)
  appointment_date: string; // Data separada (YYYY-MM-DD)
  appointment_time: string; // Hora separada (HH:MM:SS)
  status: AppointmentStatus;
  total_price: number;
  final_amount?: number; // Valor final após desconto/acréscimo
  duration_minutes?: number; // Duração do agendamento em minutos (customizada ou padrão)
  duration_minutes_normal?: number;
  duration_minutes_special?: number;
  note?: string; // Observações do agendamento
  payment_method?: PaymentMethod;
  created_at: string;
  updated_at: string;
  // Relacionamentos (opcionais para compatibilidade)
  client?: {
    id: number;
    name: string;
    phone?: string;
  };
  barber?: {
    id: number;
    name: string;
    phone?: string;
  };
  services?: Array<{
    id: number;
    name: string;
    price: number;
    duration_minutes_normal: number;
    duration_minutes_special: number;
    is_chemical: boolean;
  }>;
}

export interface AppointmentFormData {
  client_id: number;
  barber_id: number;
  appointment_datetime: string; // Principal - formato datetime-local
  appointment_date?: string; // Opcional - formato YYYY-MM-DD
  appointment_time?: string; // Opcional - formato HH:MM
  service_ids: number[];
  note: string; // Observações do agendamento
  custom_duration?: number; // Duração customizada em minutos
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
    barberId?: string;
    client: string;
    services: string[];
    total: number;
    appointment: Appointment;
    isBlock?: boolean;
    blockData?: any;
  };
}

export interface AppointmentsResponse {
  appointments: Appointment[];
  count: number;
}