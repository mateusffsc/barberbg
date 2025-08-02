export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

export interface Appointment {
  id: number;
  client_id: number;
  barber_id: number;
  appointment_datetime: string;
  status: AppointmentStatus;
  total_price: number;
  note?: string;
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
  appointment_datetime: string;
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