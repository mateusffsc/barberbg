export interface ReportPeriod {
  startDate: Date;
  endDate: Date;
  label: string;
}

export interface SalesReport {
  totalSales: number;
  totalRevenue: number;
  averageTicket: number;
  topProducts: Array<{
    id: number;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  salesByDay: Array<{
    date: string;
    sales: number;
    revenue: number;
  }>;
  salesByBarber: Array<{
    id: number;
    name: string;
    sales: number;
    revenue: number;
    commission: number;
  }>;
}

export interface AppointmentsReport {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  totalRevenue: number;
  averageTicket: number;
  topServices: Array<{
    id: number;
    name: string;
    count: number;
    revenue: number;
  }>;
  appointmentsByDay: Array<{
    date: string;
    appointments: number;
    revenue: number;
  }>;
  appointmentsByBarber: Array<{
    id: number;
    name: string;
    appointments: number;
    revenue: number;
    commission: number;
  }>;
}

export interface ClientsReport {
  totalClients: number;
  newClientsThisPeriod: number;
  activeClients: number;
  topClients: Array<{
    id: number;
    name: string;
    totalSpent: number;
    totalAppointments: number;
    lastVisit: string;
  }>;
  clientRetention: {
    returning: number;
    new: number;
  };
}

export interface FinancialReport {
  totalRevenue: number;
  salesRevenue: number;
  servicesRevenue: number;
  totalCommissions: number;
  totalExpenses: number;
  netRevenue: number;
  revenueByDay: Array<{
    date: string;
    sales: number;
    services: number;
    total: number;
  }>;
  commissionsByBarber: Array<{
    id: number;
    name: string;
    totalCommission: number;
    serviceCommission: number;
    productCommission: number;
  }>;
  expensesByCategory: Array<{
    category: string;
    total: number;
    count: number;
  }>;
  expensesByDay: Array<{
    date: string;
    total: number;
  }>;
}

export interface DashboardData {
  salesReport: SalesReport;
  appointmentsReport: AppointmentsReport;
  clientsReport: ClientsReport;
  financialReport: FinancialReport;
}