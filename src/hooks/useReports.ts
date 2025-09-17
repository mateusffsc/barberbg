import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  SalesReport, 
  AppointmentsReport, 
  ClientsReport, 
  FinancialReport,
  DashboardData,
  ReportPeriod 
} from '../types/report';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export const useReports = () => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const generateSalesReport = async (period: ReportPeriod): Promise<SalesReport> => {
    try {
      let salesQuery = supabase
        .from('sales')
        .select(`
          *,
          client:clients(id, name),
          barber:barbers(id, name, commission_rate_product),
          sale_products(
            quantity,
            price_at_sale,
            product:products(id, name)
          )
        `)
        .gte('sale_datetime', period.startDate.toISOString())
        .lte('sale_datetime', period.endDate.toISOString());

      // Filtrar por barbeiro se usuário for barbeiro
      if (user?.role === 'barber' && user.barber?.id) {
        salesQuery = salesQuery.eq('barber_id', user.barber.id);
      }

      const { data: sales, error } = await salesQuery;
      if (error) throw error;

      // Calcular métricas
      const totalSales = sales?.length || 0;
      const totalRevenue = sales?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;
      const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

      // Top produtos
      const productStats = new Map();
      sales?.forEach(sale => {
        sale.sale_products?.forEach((sp: any) => {
          const productId = sp.product.id;
          const existing = productStats.get(productId) || {
            id: productId,
            name: sp.product.name,
            quantity: 0,
            revenue: 0
          };
          existing.quantity += sp.quantity;
          existing.revenue += sp.quantity * sp.price_at_sale;
          productStats.set(productId, existing);
        });
      });

      const topProducts = Array.from(productStats.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Vendas por dia
      const salesByDay = new Map();
      sales?.forEach(sale => {
        const date = new Date(sale.sale_datetime).toISOString().split('T')[0];
        const existing = salesByDay.get(date) || { date, sales: 0, revenue: 0 };
        existing.sales += 1;
        existing.revenue += sale.total_amount;
        salesByDay.set(date, existing);
      });

      // Vendas por barbeiro
      const barberStats = new Map();
      sales?.forEach(sale => {
        const barberId = sale.barber_id;
        const existing = barberStats.get(barberId) || {
          id: barberId,
          name: sale.barber?.name || 'Desconhecido',
          sales: 0,
          revenue: 0,
          commission: 0
        };
        existing.sales += 1;
        existing.revenue += sale.total_amount;
        
        // Calcular comissão dos produtos
        sale.sale_products?.forEach((sp: any) => {
          existing.commission += sp.quantity * sp.price_at_sale * (sale.barber?.commission_rate_product || 0);
        });
        
        barberStats.set(barberId, existing);
      });

      return {
        totalSales,
        totalRevenue,
        averageTicket,
        topProducts,
        salesByDay: Array.from(salesByDay.values()).sort((a, b) => a.date.localeCompare(b.date)),
        salesByBarber: Array.from(barberStats.values()).sort((a, b) => b.revenue - a.revenue)
      };
    } catch (error) {
      console.error('Erro ao gerar relatório de vendas:', error);
      throw error;
    }
  };

  const generateAppointmentsReport = async (period: ReportPeriod): Promise<AppointmentsReport> => {
    try {
      let appointmentsQuery = supabase
        .from('appointments')
        .select(`
          *,
          client:clients(id, name),
          barber:barbers(id, name, commission_rate_service, commission_rate_chemical_service),
          appointment_services(
            price_at_booking,
            commission_rate_applied,
            service:services(id, name, is_chemical)
          )
        `)
        .gte('appointment_datetime', period.startDate.toISOString())
        .lte('appointment_datetime', period.endDate.toISOString());

      // Filtrar por barbeiro se usuário for barbeiro
      if (user?.role === 'barber' && user.barber?.id) {
        appointmentsQuery = appointmentsQuery.eq('barber_id', user.barber.id);
      }

      const { data: appointments, error } = await appointmentsQuery;
      if (error) throw error;

      // Calcular métricas
      const totalAppointments = appointments?.length || 0;
      const completedAppointments = appointments?.filter(apt => apt.status === 'completed').length || 0;
      const cancelledAppointments = appointments?.filter(apt => apt.status === 'cancelled').length || 0;
      const noShowAppointments = appointments?.filter(apt => apt.status === 'no_show').length || 0;
      
      const completedApts = appointments?.filter(apt => apt.status === 'completed') || [];
      const totalRevenue = completedApts.reduce((sum, apt) => sum + (apt.final_amount || apt.total_price), 0);
      const averageTicket = completedApts.length > 0 ? totalRevenue / completedApts.length : 0;

      // Top serviços
      const serviceStats = new Map();
      completedApts.forEach(apt => {
        apt.appointment_services?.forEach((as: any) => {
          const serviceId = as.service.id;
          const existing = serviceStats.get(serviceId) || {
            id: serviceId,
            name: as.service.name,
            count: 0,
            revenue: 0
          };
          existing.count += 1;
          existing.revenue += as.price_at_booking;
          serviceStats.set(serviceId, existing);
        });
      });

      const topServices = Array.from(serviceStats.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Agendamentos por dia
      const appointmentsByDay = new Map();
      appointments?.forEach(apt => {
        const date = new Date(apt.appointment_datetime).toISOString().split('T')[0];
        const existing = appointmentsByDay.get(date) || { date, appointments: 0, revenue: 0 };
        existing.appointments += 1;
        if (apt.status === 'completed') {
          existing.revenue += (apt.final_amount || apt.total_price);
        }
        appointmentsByDay.set(date, existing);
      });

      // Agendamentos por barbeiro
      const barberStats = new Map();
      appointments?.forEach(apt => {
        const barberId = apt.barber_id;
        const existing = barberStats.get(barberId) || {
          id: barberId,
          name: apt.barber?.name || 'Desconhecido',
          appointments: 0,
          revenue: 0,
          commission: 0
        };
        existing.appointments += 1;
        
        if (apt.status === 'completed') {
          existing.revenue += (apt.final_amount || apt.total_price);
          
          // Calcular comissão dos serviços proporcionalmente ao final_amount
          const originalTotal = apt.total_price;
          const finalTotal = apt.final_amount || apt.total_price;
          const discountFactor = originalTotal > 0 ? finalTotal / originalTotal : 1;

          apt.appointment_services?.forEach((as: any) => {
            const adjustedCommission = as.price_at_booking * as.commission_rate_applied * discountFactor;
            existing.commission += adjustedCommission;
          });
        }
        
        barberStats.set(barberId, existing);
      });

      return {
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        noShowAppointments,
        totalRevenue,
        averageTicket,
        topServices,
        appointmentsByDay: Array.from(appointmentsByDay.values()).sort((a, b) => a.date.localeCompare(b.date)),
        appointmentsByBarber: Array.from(barberStats.values()).sort((a, b) => b.revenue - a.revenue)
      };
    } catch (error) {
      console.error('Erro ao gerar relatório de agendamentos:', error);
      throw error;
    }
  };

  const generateClientsReport = async (period: ReportPeriod): Promise<ClientsReport> => {
    try {
      // Buscar todos os clientes
      const { data: allClients, error: clientsError } = await supabase
        .from('clients')
        .select('*');

      if (clientsError) throw clientsError;

      // Clientes novos no período
      const newClients = allClients?.filter(client => {
        const createdAt = new Date(client.created_at);
        return createdAt >= period.startDate && createdAt <= period.endDate;
      }) || [];

      // Buscar agendamentos do período para identificar clientes ativos
      let appointmentsQuery = supabase
        .from('appointments')
        .select(`
          client_id,
          total_price,
          final_amount,
          appointment_datetime,
          status,
          client:clients(id, name)
        `)
        .gte('appointment_datetime', period.startDate.toISOString())
        .lte('appointment_datetime', period.endDate.toISOString())
        .eq('status', 'completed');

      if (user?.role === 'barber' && user.barber?.id) {
        appointmentsQuery = appointmentsQuery.eq('barber_id', user.barber.id);
      }

      const { data: appointments, error: appointmentsError } = await appointmentsQuery;
      if (appointmentsError) throw appointmentsError;

      // Calcular estatísticas por cliente
      const clientStats = new Map();
      appointments?.forEach(apt => {
        const clientId = apt.client_id;
        const existing = clientStats.get(clientId) || {
          id: clientId,
          name: apt.client?.name || 'Desconhecido',
          totalSpent: 0,
          totalAppointments: 0,
          lastVisit: apt.appointment_datetime
        };
        existing.totalSpent += (apt.final_amount || apt.total_price);
        existing.totalAppointments += 1;
        if (new Date(apt.appointment_datetime) > new Date(existing.lastVisit)) {
          existing.lastVisit = apt.appointment_datetime;
        }
        clientStats.set(clientId, existing);
      });

      const activeClients = Array.from(clientStats.values());
      const topClients = activeClients
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10);

      // Calcular retenção (clientes que já vieram antes vs novos)
      const clientIds = new Set(appointments?.map(apt => apt.client_id));
      const returningClients = activeClients.filter(client => 
        !newClients.some(newClient => newClient.id === client.id)
      ).length;

      return {
        totalClients: allClients?.length || 0,
        newClientsThisPeriod: newClients.length,
        activeClients: activeClients.length,
        topClients,
        clientRetention: {
          returning: returningClients,
          new: newClients.length
        }
      };
    } catch (error) {
      console.error('Erro ao gerar relatório de clientes:', error);
      throw error;
    }
  };

  const generateFinancialReport = async (period: ReportPeriod): Promise<FinancialReport> => {
    try {
      // Buscar vendas, agendamentos e despesas em paralelo
      const [salesResult, appointmentsResult, expensesResult] = await Promise.all([
        generateSalesReport(period),
        generateAppointmentsReport(period),
        // Buscar despesas do período
        supabase
          .from('expenses')
          .select('*')
          .gte('expense_date', period.startDate.toISOString().split('T')[0])
          .lte('expense_date', period.endDate.toISOString().split('T')[0])
      ]);

      if (expensesResult.error) throw expensesResult.error;

      const salesRevenue = salesResult.totalRevenue;
      const servicesRevenue = appointmentsResult.totalRevenue;
      const totalRevenue = salesRevenue + servicesRevenue;

      // Calcular despesas totais
      const expenses = expensesResult.data || [];
      const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

      // Calcular comissões totais
      const salesCommissions = salesResult.salesByBarber.reduce((sum, barber) => sum + barber.commission, 0);
      const servicesCommissions = appointmentsResult.appointmentsByBarber.reduce((sum, barber) => sum + barber.commission, 0);
      const totalCommissions = salesCommissions + servicesCommissions;

      const netRevenue = totalRevenue - totalCommissions - totalExpenses;

      // Despesas por categoria
      const expensesByCategory = new Map();
      expenses.forEach(expense => {
        const existing = expensesByCategory.get(expense.category) || {
          category: expense.category,
          total: 0,
          count: 0
        };
        existing.total += expense.amount;
        existing.count += 1;
        expensesByCategory.set(expense.category, existing);
      });

      // Despesas por dia
      const expensesByDay = new Map();
      expenses.forEach(expense => {
        const date = expense.expense_date;
        const existing = expensesByDay.get(date) || { date, total: 0 };
        existing.total += expense.amount;
        expensesByDay.set(date, existing);
      });

      // Combinar receita por dia
      const revenueByDay = new Map();
      
      // Adicionar vendas
      salesResult.salesByDay.forEach(day => {
        revenueByDay.set(day.date, {
          date: day.date,
          sales: day.revenue,
          services: 0,
          total: day.revenue
        });
      });

      // Adicionar serviços
      appointmentsResult.appointmentsByDay.forEach(day => {
        const existing = revenueByDay.get(day.date) || {
          date: day.date,
          sales: 0,
          services: 0,
          total: 0
        };
        existing.services = day.revenue;
        existing.total = existing.sales + day.revenue;
        revenueByDay.set(day.date, existing);
      });

      // Combinar comissões por barbeiro
      const commissionsByBarber = new Map();
      
      // Adicionar comissões de vendas
      salesResult.salesByBarber.forEach(barber => {
        commissionsByBarber.set(barber.id, {
          id: barber.id,
          name: barber.name,
          totalCommission: barber.commission,
          serviceCommission: 0,
          productCommission: barber.commission
        });
      });

      // Adicionar comissões de serviços
      appointmentsResult.appointmentsByBarber.forEach(barber => {
        const existing = commissionsByBarber.get(barber.id) || {
          id: barber.id,
          name: barber.name,
          totalCommission: 0,
          serviceCommission: 0,
          productCommission: 0
        };
        existing.serviceCommission = barber.commission;
        existing.totalCommission += barber.commission;
        commissionsByBarber.set(barber.id, existing);
      });

      return {
        totalRevenue,
        salesRevenue,
        servicesRevenue,
        totalCommissions,
        totalExpenses,
        netRevenue,
        revenueByDay: Array.from(revenueByDay.values()).sort((a, b) => a.date.localeCompare(b.date)),
        commissionsByBarber: Array.from(commissionsByBarber.values()).sort((a, b) => b.totalCommission - a.totalCommission),
        expensesByCategory: Array.from(expensesByCategory.values()).sort((a, b) => b.total - a.total),
        expensesByDay: Array.from(expensesByDay.values()).sort((a, b) => a.date.localeCompare(b.date))
      };
    } catch (error) {
      console.error('Erro ao gerar relatório financeiro:', error);
      throw error;
    }
  };

  const generateDashboard = async (period: ReportPeriod): Promise<DashboardData> => {
    setLoading(true);
    try {
      const [salesReport, appointmentsReport, clientsReport, financialReport] = await Promise.all([
        generateSalesReport(period),
        generateAppointmentsReport(period),
        generateClientsReport(period),
        generateFinancialReport(period)
      ]);

      return {
        salesReport,
        appointmentsReport,
        clientsReport,
        financialReport
      };
    } catch (error) {
      console.error('Erro ao gerar dashboard:', error);
      toast.error('Erro ao carregar relatórios');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    generateSalesReport,
    generateAppointmentsReport,
    generateClientsReport,
    generateFinancialReport,
    generateDashboard
  };
};