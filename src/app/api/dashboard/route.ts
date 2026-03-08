import { NextRequest, NextResponse } from 'next/server';
import { getOrders } from '@/lib/shopify';
import { getPaymentVolume } from '@/lib/stripe';
import { format, parseISO, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { promises as fs } from 'fs';
import path from 'path';

async function readJSON(filepath: string) {
  try {
    const data = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(data);
  } catch { return []; }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start') || subDays(new Date(), 30).toISOString();
    const end = searchParams.get('end') || new Date().toISOString();

    // Fetch all data sources in parallel
    const startTs = Math.floor(new Date(start).getTime() / 1000);
    const endTs = Math.floor(new Date(end).getTime() / 1000);

    const [orders, prevOrders, stripeVolume, ventasPresenciales, extracto] = await Promise.all([
      getOrders({ created_at_min: start, created_at_max: end, status: 'any', limit: 250 }),
      (() => {
        const periodMs = new Date(end).getTime() - new Date(start).getTime();
        const prevStart = new Date(new Date(start).getTime() - periodMs).toISOString();
        return getOrders({ created_at_min: prevStart, created_at_max: start, status: 'any', limit: 250 });
      })(),
      getPaymentVolume({ created: { gte: startTs, lte: endTs } }).catch(() => ({ volume: 0, count: 0, refunded: 0, disputed: 0, currency: 'eur' })),
      readJSON(path.join(process.cwd(), 'data', 'ventas-presenciales.json')),
      readJSON(path.join(process.cwd(), 'data', 'extracto.json')),
    ]);

    // KPIs
    const totalRevenue = orders.reduce((sum: number, o: any) => sum + parseFloat(o.total_price || '0'), 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const refundedOrders = orders.filter((o: any) => o.financial_status === 'refunded' || o.financial_status === 'partially_refunded');
    const refundRate = totalOrders > 0 ? (refundedOrders.length / totalOrders) * 100 : 0;

    // Customer stats
    const customerIds = new Set<number>();
    const newCustomerIds = new Set<number>();
    const returningCustomerIds = new Set<number>();
    for (const o of orders) {
      if (o.customer) {
        customerIds.add(o.customer.id);
        if (o.customer.orders_count <= 1) {
          newCustomerIds.add(o.customer.id);
        } else {
          returningCustomerIds.add(o.customer.id);
        }
      }
    }

    // Previous period comparison
    const prevRevenue = prevOrders.reduce((sum: number, o: any) => sum + parseFloat(o.total_price || '0'), 0);
    const prevTotalOrders = prevOrders.length;
    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    const ordersChange = prevTotalOrders > 0 ? ((totalOrders - prevTotalOrders) / prevTotalOrders) * 100 : 0;

    const kpi = {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      refundRate,
      newCustomers: newCustomerIds.size,
      returningCustomers: returningCustomerIds.size,
      revenueChange,
      ordersChange,
    };

    // Revenue chart data (daily)
    const dailyMap = new Map<string, { revenue: number; orders: number }>();
    for (const o of orders) {
      const day = format(parseISO(o.created_at), 'dd MMM', { locale: es });
      const existing = dailyMap.get(day) || { revenue: 0, orders: 0 };
      existing.revenue += parseFloat(o.total_price || '0');
      existing.orders += 1;
      dailyMap.set(day, existing);
    }
    const revenueData = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, revenue: Math.round(data.revenue * 100) / 100, orders: data.orders }))
      .sort((a, b) => {
        const idxA = Array.from(dailyMap.keys()).indexOf(a.date);
        const idxB = Array.from(dailyMap.keys()).indexOf(b.date);
        return idxA - idxB;
      });

    // Top products from line items
    const productMap = new Map<string, { id: number; title: string; revenue: number; unitsSold: number }>();
    for (const o of orders) {
      for (const item of o.line_items || []) {
        const key = item.product_id?.toString() || item.title;
        const existing = productMap.get(key) || { id: item.product_id || 0, title: item.title, revenue: 0, unitsSold: 0 };
        existing.revenue += parseFloat(item.price || '0') * (item.quantity || 1);
        existing.unitsSold += item.quantity || 1;
        productMap.set(key, existing);
      }
    }
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Project breakdown from tags
    const PROJECT_COLORS = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#6366F1', '#14B8A6'];
    const projectMap = new Map<string, { revenue: number; orders: number }>();
    for (const o of orders) {
      const tags = (o.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean);
      const projectTag = tags[0] || 'Sin etiqueta';
      const existing = projectMap.get(projectTag) || { revenue: 0, orders: 0 };
      existing.revenue += parseFloat(o.total_price || '0');
      existing.orders += 1;
      projectMap.set(projectTag, existing);
    }
    const projects = Array.from(projectMap.entries())
      .map(([name, data], i) => ({
        projectName: name,
        color: PROJECT_COLORS[i % PROJECT_COLORS.length],
        totalRevenue: Math.round(data.revenue * 100) / 100,
        totalOrders: data.orders,
        percentage: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Recent orders (last 10)
    const recentOrders = orders
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    // Consolidated income from all sources
    const startDate = new Date(start);
    const endDate = new Date(end);

    const ventasFiltered = ventasPresenciales.filter((v: any) => {
      const d = new Date(v.date);
      return d >= startDate && d <= endDate;
    });
    const ventasPresencialesTotal = ventasFiltered.reduce((s: number, v: any) => s + (v.totalAmount || 0), 0);

    const diezmosExtracto = extracto.filter((tx: any) => {
      const d = new Date(tx.date);
      return d >= startDate && d <= endDate && (tx.isDiezmo || tx.manualTag === 'Diezmo' || tx.autoTag === 'Diezmo');
    });
    const diezmosTotal = diezmosExtracto.reduce((s: number, tx: any) => s + Math.abs(tx.amount || 0), 0);

    const incomeSources = {
      shopify: totalRevenue,
      stripe: stripeVolume.volume,
      ventasPresenciales: ventasPresencialesTotal,
      diezmos: diezmosTotal,
      totalConsolidado: totalRevenue + ventasPresencialesTotal + diezmosTotal,
    };

    return NextResponse.json({
      kpi,
      revenueData,
      topProducts,
      projects,
      recentOrders,
      incomeSources,
    });
  } catch (error: any) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
