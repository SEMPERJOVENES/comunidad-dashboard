import { NextRequest, NextResponse } from 'next/server';
import { getOrders } from '@/lib/shopify';
import { supabase } from '@/lib/supabase';

// Etiquetas que NO son de Semper Brand (se excluyen del cálculo)
const EXCLUDED_TAGS = ['Diezmo', 'Donativo', 'Misa/Tabor', 'BAC', 'Retiros', 'Viajes', 'Música'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start') || '2026-01-01T00:00:00Z';
    const end = searchParams.get('end') || new Date().toISOString();

    // 1. Shopify orders (todas son Semper Brand)
    const orders = await getOrders({
      created_at_min: start,
      created_at_max: end,
      status: 'any',
      limit: 250,
    });

    const paidOrders = orders.filter((o: any) => o.financial_status !== 'refunded');
    const shopifyRevenue = paidOrders.reduce((sum: number, o: any) => sum + parseFloat(o.total_price || '0'), 0);
    const shopifyRefunds = orders
      .filter((o: any) => o.financial_status === 'refunded' || o.financial_status === 'partially_refunded')
      .reduce((sum: number, o: any) => sum + parseFloat(o.total_price || '0'), 0);

    // 2. Ventas presenciales (todas son Semper Brand)
    const { data: ventas } = await supabase
      .from('ventas_presenciales')
      .select('*')
      .gte('date', start)
      .lte('date', end);

    const ventasTotal = (ventas || []).reduce((s: number, v: any) => s + parseFloat(v.total_amount || '0'), 0);

    // 3. Bank transactions (filtrar por fecha y excluir tags no-brand)
    const startDate = start.split('T')[0];
    const endDate = end.split('T')[0];
    const { data: bankTxs } = await supabase
      .from('bank_transactions')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate);

    // Categorizar transacciones bancarias
    const incomeByTag: Record<string, number> = {};
    const expensesByTag: Record<string, number> = {};
    let totalBankIncome = 0;
    let totalBankExpenses = 0;

    for (const tx of (bankTxs || [])) {
      const tag = tx.manual_tag || tx.auto_tag || 'Sin etiqueta';
      const amount = parseFloat(tx.amount || '0');

      // Excluir transacciones de categorías no-brand
      if (EXCLUDED_TAGS.includes(tag)) continue;

      if (amount > 0) {
        incomeByTag[tag] = (incomeByTag[tag] || 0) + amount;
        totalBankIncome += amount;
      } else {
        expensesByTag[tag] = (expensesByTag[tag] || 0) + Math.abs(amount);
        totalBankExpenses += Math.abs(amount);
      }
    }

    // 4. Desglose mensual
    const monthlyMap = new Map<string, { shopify: number; ventas: number; bankIncome: number; expenses: number; orders: number }>();

    for (const o of paidOrders) {
      const month = o.created_at.substring(0, 7);
      const existing = monthlyMap.get(month) || { shopify: 0, ventas: 0, bankIncome: 0, expenses: 0, orders: 0 };
      existing.shopify += parseFloat(o.total_price || '0');
      existing.orders += 1;
      monthlyMap.set(month, existing);
    }

    for (const v of (ventas || [])) {
      const month = new Date(v.date).toISOString().substring(0, 7);
      const existing = monthlyMap.get(month) || { shopify: 0, ventas: 0, bankIncome: 0, expenses: 0, orders: 0 };
      existing.ventas += parseFloat(v.total_amount || '0');
      monthlyMap.set(month, existing);
    }

    for (const tx of (bankTxs || [])) {
      const tag = tx.manual_tag || tx.auto_tag || 'Sin etiqueta';
      if (EXCLUDED_TAGS.includes(tag)) continue;
      const month = new Date(tx.date).toISOString().substring(0, 7);
      const existing = monthlyMap.get(month) || { shopify: 0, ventas: 0, bankIncome: 0, expenses: 0, orders: 0 };
      const amount = parseFloat(tx.amount || '0');
      if (amount > 0) {
        existing.bankIncome += amount;
      } else {
        existing.expenses += Math.abs(amount);
      }
      monthlyMap.set(month, existing);
    }

    const monthlyBreakdown = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        ...data,
        totalIncome: data.shopify + data.ventas + data.bankIncome,
        profit: data.shopify + data.ventas + data.bankIncome - data.expenses,
      }));

    // 5. Top productos (de Shopify)
    const productMap = new Map<string, { title: string; revenue: number; units: number }>();
    for (const o of paidOrders) {
      for (const item of o.line_items || []) {
        const key = item.product_id?.toString() || item.title;
        const existing = productMap.get(key) || { title: item.title, revenue: 0, units: 0 };
        existing.revenue += parseFloat(item.price || '0') * (item.quantity || 1);
        existing.units += item.quantity || 1;
        productMap.set(key, existing);
      }
    }
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Totales
    const totalIncome = shopifyRevenue + ventasTotal + totalBankIncome;
    const profit = totalIncome - totalBankExpenses;
    const margin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;

    return NextResponse.json({
      income: {
        shopify: shopifyRevenue,
        shopifyOrders: paidOrders.length,
        shopifyRefunds,
        ventasPresenciales: ventasTotal,
        ventasCount: (ventas || []).length,
        bankIncome: incomeByTag,
        totalBankIncome,
        total: totalIncome,
      },
      expenses: {
        byTag: expensesByTag,
        total: totalBankExpenses,
      },
      profit,
      margin,
      monthlyBreakdown,
      topProducts,
    });
  } catch (error: any) {
    console.error('Semper Brand API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
