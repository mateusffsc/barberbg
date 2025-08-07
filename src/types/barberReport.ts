export interface BarberCommissionSummary {
  totalCommission: number;
  serviceCommission: number;
  productCommission: number;
  chemicalServiceCommission: number;
  totalServiceRevenue: number;
  totalProductRevenue: number;
  totalChemicalServiceRevenue: number;
  totalAppointments: number;
  totalSales: number;
  averageServiceTicket: number;
  averageProductTicket: number;
}

export interface BarberServiceDetail {
  serviceId: number;
  serviceName: string;
  count: number;
  totalRevenue: number;
  totalCommission: number;
  averagePrice: number;
  commissionRate: number;
  isChemical: boolean;
  paymentMethods: string[];
}

export interface BarberProductDetail {
  productId: number;
  productName: string;
  quantity: number;
  totalRevenue: number;
  totalCommission: number;
  averagePrice: number;
  commissionRate: number;
  paymentMethods: string[];
}

export interface BarberDailyCommission {
  date: string;
  serviceCommission: number;
  productCommission: number;
  totalCommission: number;
  appointmentsCount: number;
  salesCount: number;
  totalRevenue: number;
}

export interface BarberMonthlyCommission {
  month: string;
  year: number;
  serviceCommission: number;
  productCommission: number;
  totalCommission: number;
  appointmentsCount: number;
  salesCount: number;
  totalRevenue: number;
}

export interface BarberClientStats {
  clientId: number;
  clientName: string;
  totalSpent: number;
  totalCommissionEarned: number;
  appointmentsCount: number;
  salesCount: number;
  lastVisit: string;
  averageTicket: number;
}

export interface BarberPaymentMethodStats {
  paymentMethod: string;
  count: number;
  totalRevenue: number;
  totalCommission: number;
  percentage: number;
}

export interface BarberReport {
  period: {
    startDate: Date;
    endDate: Date;
    label: string;
  };
  summary: BarberCommissionSummary;
  serviceDetails: BarberServiceDetail[];
  productDetails: BarberProductDetail[];
  dailyCommissions: BarberDailyCommission[];
  monthlyCommissions: BarberMonthlyCommission[];
  topClients: BarberClientStats[];
  paymentMethodStats: BarberPaymentMethodStats[];
}

export interface BarberCommissionGoal {
  id?: number;
  barberId: number;
  month: number;
  year: number;
  targetCommission: number;
  currentCommission: number;
  achievementPercentage: number;
}