import { NextRequest, NextResponse } from 'next/server';
import { getOrders } from '@/lib/shopify';
import { getPaymentVolume, getBalance } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';
import { format, parseISO, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start') || subDays(new Date(), 30).toISOString();
    const end = searchParams.get('end') || new Date().toISOString();

    const startTs = Math.floor(new Date(start).getTime() / 1000);
    const endTs = Math.floor(new Date(end).getTime() / 1000);
    const startDate = new Date(start).toISOString().split('T')[0];
    const endDate = new Date(end).toISOString().split('T')[0];

    // Fetch all data in parallel
    const [orders, stripeVolume, stripeBalance, bankTxsResult] = await Promise.all([
      getOrders({ created_at_min: start, created_at_max: end, status: 'any', limit: 250 }),
      getPaymentVolume({ created: { gte: startTs, lte: endTs } }).catch(() => ({ volume: 0, count: 0, refunded: 0, disputed: 0, currency: 'eur' })),
      getBalance().catch(() => ({ available: 0, pending: 0, currency: 'eur' })),
      supabase
        .from('bank_transactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false }),
    ]);

    const bankTxs = bankTxsResult.data || [];

    // === GLOBAL FINANCIALS from bank transactions ===
    const totalBankIncome = bankTxs.filter((tx: any) => parseFloat(tx.amount) > 0).reduce((s: number, tx: any) => s + parseFloat(tx.amount), 0);
    const totalBankExpenses = bankTxs.filter((tx: any) => parseFloat(tx.amount) < 0).reduce((s: number, tx: any) => s + Math.abs(parseFloat(tx.amount)), 0);
    const bankBalance = bankTxs.length > 0 ? parseFloat(bankTxs[0].balance || '0') : 0; // latest balance

    // === GROUP BY MACRO CATEGORIES ===
    // Diezmos: etiqueta "Diezmo" o is_diezmo
    // Semper Brand: etiquetas "Brand", "Shopify", "Stripe", "Venta presencial", "Proveedor", "Semper CD"
    // Otros: todo lo demás

    const BRAND_TAGS = ['Brand', 'Shopify', 'Stripe', 'Venta presencial', 'Proveedor', 'Semper CD'];
    const DIEZMO_TAGS = ['Diezmo'];

    function getMacroCategory(tx: any) {
      const tag = tx.manual_tag || tx.auto_tag || '';
      if (tx.is_diezmo || DIEZMO_TAGS.includes(tag)) return 'diezmos';
      if (BRAND_TAGS.includes(tag)) return 'brand';
      return 'otros';
    }

    // Aggregate by macro category
    const macroGroups: Record<string, { income: number; expenses: number; tags: Record<string, { income: number; expenses: number }> }> = {
      diezmos: { income: 0, expenses: 0, tags: {} },
      brand: { income: 0, expenses: 0, tags: {} },
      otros: { income: 0, expenses: 0, tags: {} },
    };

    for (const tx of bankTxs) {
      const macro = getMacroCategory(tx);
      const amt = parseFloat(tx.amount || '0');
      const tag = tx.manual_tag || tx.auto_tag || 'Sin categoría';

      if (amt > 0) {
        macroGroups[macro].income += amt;
      } else {
        macroGroups[macro].expenses += Math.abs(amt);
      }

      if (!macroGroups[macro].tags[tag]) {
        macroGroups[macro].tags[tag] = { income: 0, expenses: 0 };
      }
      if (amt > 0) {
        macroGroups[macro].tags[tag].income += amt;
      } else {
        macroGroups[macro].tags[tag].expenses += Math.abs(amt);
      }
    }

    // === CAJA: Balance breakdown by category from ALL bank transactions ===
    // Get ALL transactions for "caja" (not date-filtered)
    const { data: allBankTxs } = await supabase
      .from('bank_transactions')
      .select('amount, manual_tag, auto_tag, is_diezmo')
      .order('date', { ascending: false });

    const cajaByCategory: Record<string, number> = {};
    for (const tx of (allBankTxs || [])) {
      const tag = tx.manual_tag || tx.auto_tag || 'Sin categoría';
      const amt = parseFloat(tx.amount || '0');
      cajaByCategory[tag] = (cajaByCategory[tag] || 0) + amt;
    }

    // Sort caja by absolute value
    const cajaSorted = Object.entries(cajaByCategory)
      .map(([tag, net]) => ({ tag, net }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

    // === SHOPIFY DATA ===
    const shopifyRevenue = orders.reduce((sum: number, o: any) => sum + parseFloat(o.total_price || '0'), 0);
    const shopifyOrders = orders.length;

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
      .map(([date, data]) => ({ date, revenue: Math.round(data.revenue * 100) / 100, orders: data.orders }));

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

    // Recent orders (last 10)
    const recentOrders = orders
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    return NextResponse.json({
      // Global financials (from bank)
      financials: {
        totalIncome: totalBankIncome,
        totalExpenses: totalBankExpenses,
        profit: totalBankIncome - totalBankExpenses,
        bankBalance,
      },
      // Macro groups
      macroGroups: {
        diezmos: {
          income: macroGroups.diezmos.income,
          expenses: macroGroups.diezmos.expenses,
          net: macroGroups.diezmos.income - macroGroups.diezmos.expenses,
          tags: Object.entries(macroGroups.diezmos.tags).map(([tag, d]) => ({ tag, ...d, net: d.income - d.expenses })),
        },
        brand: {
          income: macroGroups.brand.income,
          expenses: macroGroups.brand.expenses,
          net: macroGroups.brand.income - macroGroups.brand.expenses,
          tags: Object.entries(macroGroups.brand.tags).map(([tag, d]) => ({ tag, ...d, net: d.income - d.expenses })),
        },
        otros: {
          income: macroGroups.otros.income,
          expenses: macroGroups.otros.expenses,
          net: macroGroups.otros.income - macroGroups.otros.expenses,
          tags: Object.entries(macroGroups.otros.tags).map(([tag, d]) => ({ tag, ...d, net: d.income - d.expenses })),
        },
      },
      // Caja breakdown
      caja: cajaSorted,
      // Stripe
      stripe: {
        volume: stripeVolume.volume,
        available: stripeBalance.available,
        pending: stripeBalance.pending,
      },
      // Shopify
      shopify: {
        revenue: shopifyRevenue,
        orders: shopifyOrders,
      },
      // Charts & details
      revenueData,
      topProducts,
      recentOrders,
    });
  } catch (error: any) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
