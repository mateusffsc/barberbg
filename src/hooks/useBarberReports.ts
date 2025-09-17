import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  BarberReport, 
  BarberCommissionSummary, 
  BarberServiceDetail, 
  BarberProductDetail,
  BarberDailyCommission,
  BarberMonthlyCommission,
  BarberClientStats,
  BarberPaymentMethodStats
} from '../types/barberReport';
import { PaymentMethod, getPaymentMethodLabel } from '../types/payment';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export const useBarberReports = () => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const generateBarberReport = async (
    startDate: Date, 
    endDate: Date, 
    barberId?: number
  ): Promise<BarberReport | null> => {
    if (!user) return null;
    
    setLoading(true);
    try {
      // Se o barbeiro não for especificado e o usuário for barbeiro, usar o próprio ID
      const targetBarberId = barberId || (user.role === 'barber' ? user.barber?.id : null);
      
      if (!targetBarberId) {
        throw new Error('ID do barbeiro não encontrado');
      }

      // Buscar informações do barbeiro
      const { data: barberData, error: barberError } = await supabase
        .from('barbers')
        .select('*')
        .eq('id', targetBarberId)
        .single();

      if (barberError) throw barberError;

      const [
        summary,
        serviceDetails,
        productDetails,
        dailyCommissions,
        monthlyCommissions,
        topClients,
        paymentStats
      ] = await Promise.all([
        generateCommissionSummary(targetBarberId, startDate, endDate, barberData),
        generateServiceDetails(targetBarberId, startDate, endDate, barberData),
        generateProductDetails(targetBarberId, startDate, endDate, barberData),
        generateDailyCommissions(targetBarberId, startDate, endDate, barberData),
        generateMonthlyCommissions(targetBarberId, startDate, endDate, barberData),
        generateTopClients(targetBarberId, startDate, endDate),
        generatePaymentMethodStats(targetBarberId, startDate, endDate)
      ]);

      return {
        period: {
          startDate,
          endDate,
          label: `${startDate.toLocaleDateString('pt-BR')} - ${endDate.toLocaleDateString('pt-BR')}`
        },
        summary,
        serviceDetails,
        productDetails,
        dailyCommissions,
        monthlyCommissions,
        topClients,
        paymentMethodStats: paymentStats
      };

    } catch (error) {
      console.error('Erro ao gerar relatório do barbeiro:', error);
      toast.error('Erro ao gerar relatório');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const generateCommissionSummary = async (
    barberId: number, 
    startDate: Date, 
    endDate: Date,
    barberData: any
  ): Promise<BarberCommissionSummary> => {
    // Buscar agendamentos concluídos
    const { data: appointments } = await supabase
      .from('appointments')
      .select(`
        *,
        appointment_services(
          service_id,
          price_at_booking,
          commission_rate_applied,
          service:services(id, name, is_chemical)
        )
      `)
      .eq('barber_id', barberId)
      .eq('status', 'completed')
      .gte('appointment_datetime', startDate.toISOString())
      .lte('appointment_datetime', endDate.toISOString());

    // Buscar vendas
    const { data: sales } = await supabase
      .from('sales')
      .select(`
        *,
        sale_products(
          quantity,
          price_at_sale,
          product:products(id, name)
        )
      `)
      .eq('barber_id', barberId)
      .gte('sale_datetime', startDate.toISOString())
      .lte('sale_datetime', endDate.toISOString());

    let totalServiceRevenue = 0;
    let totalChemicalServiceRevenue = 0;
    let serviceCommission = 0;
    let chemicalServiceCommission = 0;

    // Calcular comissões de serviços
    appointments?.forEach(appointment => {
      const originalTotal = appointment.total_price;
      const finalTotal = appointment.final_amount || appointment.total_price;
      const discountFactor = originalTotal > 0 ? finalTotal / originalTotal : 1;

      appointment.appointment_services?.forEach((service: any) => {
        const revenue = service.price_at_booking;
        const adjustedRevenue = revenue * discountFactor;
        const commissionRate = service.commission_rate_applied;
        const commission = adjustedRevenue * commissionRate;

        if (service.service.is_chemical) {
          totalChemicalServiceRevenue += adjustedRevenue;
          chemicalServiceCommission += commission;
        } else {
          totalServiceRevenue += adjustedRevenue;
          serviceCommission += commission;
        }
      });
    });

    // Calcular comissões de produtos
    let totalProductRevenue = 0;
    let productCommission = 0;
    
    sales?.forEach(sale => {
      sale.sale_products?.forEach((saleProduct: any) => {
        const revenue = saleProduct.price_at_sale * saleProduct.quantity;
        totalProductRevenue += revenue;
        productCommission += revenue * barberData.commission_rate_product;
      });
    });

    const totalCommission = serviceCommission + chemicalServiceCommission + productCommission;
    const totalAppointments = appointments?.length || 0;
    const totalSales = sales?.length || 0;
    const averageServiceTicket = totalAppointments > 0 ? (totalServiceRevenue + totalChemicalServiceRevenue) / totalAppointments : 0;
    const averageProductTicket = totalSales > 0 ? totalProductRevenue / totalSales : 0;

    return {
      totalCommission,
      serviceCommission,
      productCommission,
      chemicalServiceCommission,
      totalServiceRevenue,
      totalProductRevenue,
      totalChemicalServiceRevenue,
      totalAppointments,
      totalSales,
      averageServiceTicket,
      averageProductTicket
    };
  };

  const generateServiceDetails = async (
    barberId: number,
    startDate: Date,
    endDate: Date,
    barberData: any
  ): Promise<BarberServiceDetail[]> => {
    const { data: appointments } = await supabase
      .from('appointments')
      .select(`
        appointment_services(
          service_id,
          price_at_booking,
          commission_rate_applied,
          service:services(id, name, is_chemical)
        )
      `)
      .eq('barber_id', barberId)
      .eq('status', 'completed')
      .gte('appointment_datetime', startDate.toISOString())
      .lte('appointment_datetime', endDate.toISOString());

    const serviceStats = new Map();

    appointments?.forEach(appointment => {
      const originalTotal = appointment.total_price;
      const finalTotal = appointment.final_amount || appointment.total_price;
      const discountFactor = originalTotal > 0 ? finalTotal / originalTotal : 1;

      appointment.appointment_services?.forEach((service: any) => {
        const key = service.service_id;
        const revenue = service.price_at_booking;
        const adjustedRevenue = revenue * discountFactor;
        const commission = adjustedRevenue * service.commission_rate_applied;

        if (!serviceStats.has(key)) {
          serviceStats.set(key, {
            serviceId: service.service_id,
            serviceName: service.service.name,
            count: 0,
            totalRevenue: 0,
            totalCommission: 0,
            commissionRate: service.commission_rate_applied,
            isChemical: service.service.is_chemical,
            averagePrice: 0
          });
        }

        const stats = serviceStats.get(key);
        stats.count += 1;
        stats.totalRevenue += adjustedRevenue;
        stats.totalCommission += commission;
        stats.averagePrice = stats.totalRevenue / stats.count;
      });
    });

    return Array.from(serviceStats.values()).sort((a, b) => b.totalCommission - a.totalCommission);
  };

  const generateProductDetails = async (
    barberId: number,
    startDate: Date,
    endDate: Date,
    barberData: any
  ): Promise<BarberProductDetail[]> => {
    const { data: sales } = await supabase
      .from('sales')
      .select(`
        sale_products(
          quantity,
          price_at_sale,
          product:products(id, name)
        )
      `)
      .eq('barber_id', barberId)
      .gte('sale_datetime', startDate.toISOString())
      .lte('sale_datetime', endDate.toISOString());

    const productStats = new Map();

    sales?.forEach(sale => {
      sale.sale_products?.forEach((saleProduct: any) => {
        const key = saleProduct.product.id;
        const revenue = saleProduct.price_at_sale * saleProduct.quantity;
        const commission = revenue * barberData.commission_rate_product;

        if (!productStats.has(key)) {
          productStats.set(key, {
            productId: saleProduct.product.id,
            productName: saleProduct.product.name,
            quantity: 0,
            totalRevenue: 0,
            totalCommission: 0,
            averagePrice: 0,
            commissionRate: barberData.commission_rate_product
          });
        }

        const stats = productStats.get(key);
        stats.quantity += saleProduct.quantity;
        stats.totalRevenue += revenue;
        stats.totalCommission += commission;
        stats.averagePrice = stats.totalRevenue / stats.quantity;
      });
    });

    return Array.from(productStats.values()).sort((a, b) => b.totalCommission - a.totalCommission);
  };

  const generateDailyCommissions = async (
    barberId: number,
    startDate: Date,
    endDate: Date,
    barberData: any
  ): Promise<BarberDailyCommission[]> => {
    const dailyStats = new Map();

    // Inicializar todos os dias do período
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      dailyStats.set(dateStr, {
        date: dateStr,
        serviceCommission: 0,
        productCommission: 0,
        totalCommission: 0,
        appointmentsCount: 0,
        salesCount: 0,
        totalRevenue: 0
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Buscar agendamentos
    const { data: appointments } = await supabase
      .from('appointments')
      .select(`
        appointment_datetime,
        appointment_services(
          price_at_booking,
          commission_rate_applied
        )
      `)
      .eq('barber_id', barberId)
      .eq('status', 'completed')
      .gte('appointment_datetime', startDate.toISOString())
      .lte('appointment_datetime', endDate.toISOString());

    // Buscar vendas
    const { data: sales } = await supabase
      .from('sales')
      .select(`
        sale_datetime,
        total_amount,
        sale_products(
          quantity,
          price_at_sale
        )
      `)
      .eq('barber_id', barberId)
      .gte('sale_datetime', startDate.toISOString())
      .lte('sale_datetime', endDate.toISOString());

    // Processar agendamentos
    appointments?.forEach(appointment => {
      const dateStr = appointment.appointment_datetime.split('T')[0];
      const stats = dailyStats.get(dateStr);
      if (stats) {
        const originalTotal = appointment.total_price;
        const finalTotal = appointment.final_amount || appointment.total_price;
        const discountFactor = originalTotal > 0 ? finalTotal / originalTotal : 1;

        stats.appointmentsCount += 1;
        appointment.appointment_services?.forEach((service: any) => {
          const adjustedRevenue = service.price_at_booking * discountFactor;
          const commission = adjustedRevenue * service.commission_rate_applied;
          stats.serviceCommission += commission;
          stats.totalRevenue += adjustedRevenue;
        });
      }
    });

    // Processar vendas
    sales?.forEach(sale => {
      const dateStr = sale.sale_datetime.split('T')[0];
      const stats = dailyStats.get(dateStr);
      if (stats) {
        stats.salesCount += 1;
        stats.totalRevenue += sale.total_amount;
        stats.productCommission += sale.total_amount * barberData.commission_rate_product;
      }
    });

    // Calcular totais
    dailyStats.forEach(stats => {
      stats.totalCommission = stats.serviceCommission + stats.productCommission;
    });

    return Array.from(dailyStats.values()).sort((a, b) => a.date.localeCompare(b.date));
  };

  const generateMonthlyCommissions = async (
    barberId: number,
    startDate: Date,
    endDate: Date,
    barberData: any
  ): Promise<BarberMonthlyCommission[]> => {
    const monthlyStats = new Map();

    // Buscar todos os dados
    const [appointmentsResult, salesResult] = await Promise.all([
      supabase
        .from('appointments')
        .select(`
          appointment_datetime,
          appointment_services(
            price_at_booking,
            commission_rate_applied
          )
        `)
        .eq('barber_id', barberId)
        .eq('status', 'completed')
        .gte('appointment_datetime', startDate.toISOString())
        .lte('appointment_datetime', endDate.toISOString()),
      
      supabase
        .from('sales')
        .select(`
          sale_datetime,
          total_amount
        `)
        .eq('barber_id', barberId)
        .gte('sale_datetime', startDate.toISOString())
        .lte('sale_datetime', endDate.toISOString())
    ]);

    const appointments = appointmentsResult.data;
    const sales = salesResult.data;

    // Processar agendamentos
    appointments?.forEach(appointment => {
      const date = new Date(appointment.appointment_datetime);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyStats.has(monthKey)) {
        monthlyStats.set(monthKey, {
          month: date.toLocaleDateString('pt-BR', { month: 'long' }),
          year: date.getFullYear(),
          serviceCommission: 0,
          productCommission: 0,
          totalCommission: 0,
          appointmentsCount: 0,
          salesCount: 0,
          totalRevenue: 0
        });
      }

      const stats = monthlyStats.get(monthKey);
      const originalTotal = appointment.total_price;
      const finalTotal = appointment.final_amount || appointment.total_price;
      const discountFactor = originalTotal > 0 ? finalTotal / originalTotal : 1;

      stats.appointmentsCount += 1;
      
      appointment.appointment_services?.forEach((service: any) => {
        const adjustedRevenue = service.price_at_booking * discountFactor;
        const commission = adjustedRevenue * service.commission_rate_applied;
        stats.serviceCommission += commission;
        stats.totalRevenue += adjustedRevenue;
      });
    });

    // Processar vendas
    sales?.forEach(sale => {
      const date = new Date(sale.sale_datetime);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyStats.has(monthKey)) {
        monthlyStats.set(monthKey, {
          month: date.toLocaleDateString('pt-BR', { month: 'long' }),
          year: date.getFullYear(),
          serviceCommission: 0,
          productCommission: 0,
          totalCommission: 0,
          appointmentsCount: 0,
          salesCount: 0,
          totalRevenue: 0
        });
      }

      const stats = monthlyStats.get(monthKey);
      stats.salesCount += 1;
      stats.totalRevenue += sale.total_amount;
      stats.productCommission += sale.total_amount * barberData.commission_rate_product;
    });

    // Calcular totais
    monthlyStats.forEach(stats => {
      stats.totalCommission = stats.serviceCommission + stats.productCommission;
    });

    return Array.from(monthlyStats.values()).sort((a, b) => 
      `${a.year}-${a.month}`.localeCompare(`${b.year}-${b.month}`)
    );
  };

  const generateTopClients = async (
    barberId: number,
    startDate: Date,
    endDate: Date
  ): Promise<BarberClientStats[]> => {
    const clientStats = new Map();

    // Buscar agendamentos
    const { data: appointments } = await supabase
      .from('appointments')
      .select(`
        client_id,
        appointment_datetime,
        total_price,
        final_amount,
        client:clients(id, name)
      `)
      .eq('barber_id', barberId)
      .eq('status', 'completed')
      .gte('appointment_datetime', startDate.toISOString())
      .lte('appointment_datetime', endDate.toISOString());

    // Buscar vendas
    const { data: sales } = await supabase
      .from('sales')
      .select(`
        client_id,
        sale_datetime,
        total_amount,
        client:clients(id, name)
      `)
      .eq('barber_id', barberId)
      .gte('sale_datetime', startDate.toISOString())
      .lte('sale_datetime', endDate.toISOString())
      .not('client_id', 'is', null);

    // Processar agendamentos
    appointments?.forEach(appointment => {
      if (!appointment.client_id) return;
      
      const key = appointment.client_id;
      if (!clientStats.has(key)) {
        clientStats.set(key, {
          clientId: appointment.client_id,
          clientName: appointment.client.name,
          totalSpent: 0,
          totalCommissionEarned: 0,
          appointmentsCount: 0,
          salesCount: 0,
          lastVisit: appointment.appointment_datetime,
          averageTicket: 0
        });
      }

      const stats = clientStats.get(key);
      stats.appointmentsCount += 1;
      stats.totalSpent += (appointment.final_amount || appointment.total_price);
      if (appointment.appointment_datetime > stats.lastVisit) {
        stats.lastVisit = appointment.appointment_datetime;
      }
    });

    // Processar vendas
    sales?.forEach(sale => {
      if (!sale.client_id) return;
      
      const key = sale.client_id;
      if (!clientStats.has(key)) {
        clientStats.set(key, {
          clientId: sale.client_id,
          clientName: sale.client.name,
          totalSpent: 0,
          totalCommissionEarned: 0,
          appointmentsCount: 0,
          salesCount: 0,
          lastVisit: sale.sale_datetime,
          averageTicket: 0
        });
      }

      const stats = clientStats.get(key);
      stats.salesCount += 1;
      stats.totalSpent += sale.total_amount;
      if (sale.sale_datetime > stats.lastVisit) {
        stats.lastVisit = sale.sale_datetime;
      }
    });

    // Calcular médias e ordenar
    const clientStatsArray = Array.from(clientStats.values());
    clientStatsArray.forEach(stats => {
      const totalTransactions = stats.appointmentsCount + stats.salesCount;
      stats.averageTicket = totalTransactions > 0 ? stats.totalSpent / totalTransactions : 0;
    });

    return clientStatsArray
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10); // Top 10 clientes
  };

  const generatePaymentMethodStats = async (
    barberId: number,
    startDate: Date,
    endDate: Date
  ): Promise<BarberPaymentMethodStats[]> => {
    const paymentStats = new Map();

    // Buscar agendamentos com forma de pagamento
    const { data: appointments } = await supabase
      .from('appointments')
      .select('payment_method, total_price, final_amount')
      .eq('barber_id', barberId)
      .eq('status', 'completed')
      .gte('appointment_datetime', startDate.toISOString())
      .lte('appointment_datetime', endDate.toISOString())
      .not('payment_method', 'is', null);

    // Buscar vendas com forma de pagamento
    const { data: sales } = await supabase
      .from('sales')
      .select('payment_method, total_amount')
      .eq('barber_id', barberId)
      .gte('sale_datetime', startDate.toISOString())
      .lte('sale_datetime', endDate.toISOString());

    let totalRevenue = 0;

    // Processar agendamentos
    appointments?.forEach(appointment => {
      const method = appointment.payment_method;
      const revenue = appointment.final_amount || appointment.total_price;
      totalRevenue += revenue;

      if (!paymentStats.has(method)) {
        paymentStats.set(method, {
          paymentMethod: getPaymentMethodLabel(method as PaymentMethod),
          count: 0,
          totalRevenue: 0,
          totalCommission: 0,
          percentage: 0
        });
      }

      const stats = paymentStats.get(method);
      stats.count += 1;
      stats.totalRevenue += revenue;
    });

    // Processar vendas
    sales?.forEach(sale => {
      const method = sale.payment_method;
      const revenue = sale.total_amount;
      totalRevenue += revenue;

      if (!paymentStats.has(method)) {
        paymentStats.set(method, {
          paymentMethod: getPaymentMethodLabel(method as PaymentMethod),
          count: 0,
          totalRevenue: 0,
          totalCommission: 0,
          percentage: 0
        });
      }

      const stats = paymentStats.get(method);
      stats.count += 1;
      stats.totalRevenue += revenue;
    });

    // Calcular percentuais
    const statsArray = Array.from(paymentStats.values());
    statsArray.forEach(stats => {
      stats.percentage = totalRevenue > 0 ? (stats.totalRevenue / totalRevenue) * 100 : 0;
    });

    return statsArray.sort((a, b) => b.totalRevenue - a.totalRevenue);
  };

  return {
    loading,
    generateBarberReport
  };
};