export interface Client {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

export interface ClientFormData {
  name: string;
  phone: string;
  email: string;
}

export interface ClientsResponse {
  clients: Client[];
  count: number;
}