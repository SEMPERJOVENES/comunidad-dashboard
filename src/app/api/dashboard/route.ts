import { NextRequest, NextResponse } from 'next/server';
import { getAllOrders, getStockValuation } from '@/lib/shopify';
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
    const [orders, stripeVolume, stripeBalance, bankTxsResult, tagCatsResult, stockData] = await Promise.all([
      getAllOrders({ created_at_min: start, created_at_max: end, status: 'any' }),
      getPaymentVolume({ created: { gte: startTs, lte: endTs } }).catch(() => ({ volume: 0, count: 0, refunded: 0, disputed: 0, currency: 'eur' })),
      getBalance().catch(() => ({ available: 0, pending: 0, currency: 'eur' })),
      supabase
        .from('bank_transactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false }),
      supabase
        .from('tag_categories')
        .select('name, macro_group'),
      getStockValuation().catch(() => ({ stockValue: 0, stockCost: 0, totalUnits: 0, productCount: 0 })),
    ]);

    const bankTxs = bankTxsResult.data || [];

    // === GLOBAL FINANCIALS from bank transactions ===
    const totalBankIncome = bankTxs.filter((tx: any) => parseFloat(tx.amount) > 0).reduce((s: number, tx: any) => s + parseFloat(tx.amount), 0);
    const totalBankExpenses = bankTxs.filter((tx: any) => parseFloat(tx.amount) < 0).reduce((s: number, tx: any) => s + Math.abs(parseFloat(tx.amount)), 0);

    // Bank balance: get latest transaction globally (not filtered by date range)
    const { data: latestBankTx } = await supabase
      .from('bank_transactions')
      .select('balance')
      .order('date', { ascending: false })
      .limit(1);
    const bankBalance = latestBankTx && latestBankTx.length > 0 ? parseFloat(latestBankTx[0].balance || '0') : 0;

    // === GROUP BY MACRO CATEGORIES (dynamic from tag_categories table) ===
    const tagMacroMap: Record<string, string> = {};
    for (const tc of (tagCatsResult.data || [])) {
      tagMacroMap[tc.name] = tc.macro_group;
    }

    function getMacroCategory(tx: any) {
      const tag = tx.manual_tag || tx.auto_tag || '';
      if (tx.is_diezmo) return 'diezmos';
      const macro = tagMacroMap[tag];
      if (macro) return macro;
      return 'otros';
    }

    // Aggregate by macro category (with individual transactions per tag)
    interface TagTx { date: string; description: string; amount: number }
    const macroGroups: Record<string, { income: number; expenses: number; tags: Record<string, { income: number; expenses: number; transactions: TagTx[] }> }> = {
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
        macroGroups[macro].tags[tag] = { income: 0, expenses: 0, transactions: [] };
      }
      if (amt > 0) {
        macroGroups[macro].tags[tag].income += amt;
      } else {
        macroGroups[macro].tags[tag].expenses += Math.abs(amt);
      }
      macroGroups[macro].tags[tag].transactions.push({
        date: tx.date,
        description: tx.concept || tx.description || '',
        amount: amt,
      });
    }

    // === CAJA: Balance breakdown by category from ALL bank transactions ===
    // Get ALL transactions for "caja" (not date-filtered)
    const { data: allBankTxs } = await supabase
      .from('bank_transactions')
      .select('amount, manual_tag, auto_tag, is_diezmo, date, concept, description')
      .order('date', { ascending: false });

    const cajaByCategory: Record<string, { net: number; count: number; transactions: TagTx[] }> = {};
    const cajaMacro = { comunidad: 0, brand: 0, otros: 0 };
    for (const tx of (allBankTxs || [])) {
      const tag = tx.manual_tag || tx.auto_tag || 'Sin categoría';
      const amt = parseFloat(tx.amount || '0');
      if (!cajaByCategory[tag]) {
        cajaByCategory[tag] = { net: 0, count: 0, transactions: [] };
      }
      cajaByCategory[tag].net += amt;
      cajaByCategory[tag].count += 1;
      cajaByCategory[tag].transactions.push({
        date: tx.date,
        description: tx.concept || tx.description || '',
        amount: amt,
      });

      // Aggregate by macro category
      const macro = getMacroCategory(tx);
      if (macro === 'diezmos') cajaMacro.comunidad += amt;
      else if (macro === 'brand') cajaMacro.brand += amt;
      else cajaMacro.otros += amt;
    }

    // Sort caja by absolute value
    const cajaSorted = Object.entries(cajaByCategory)
      .map(([tag, data]) => ({ tag, net: data.net, count: data.count, transactions: data.transactions.slice(0, 20) }))
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
          tags: Object.entries(macroGroups.diezmos.tags).map(([tag, d]) => ({ tag, ...d, net: d.income - d.expenses, transactions: d.transactions.slice(0, 20) })),
        },
        brand: {
          income: macroGroups.brand.income,
          expenses: macroGroups.brand.expenses,
          net: macroGroups.brand.income - macroGroups.brand.expenses,
          tags: Object.entries(macroGroups.brand.tags).map(([tag, d]) => ({ tag, ...d, net: d.income - d.expenses, transactions: d.transactions.slice(0, 20) })),
        },
        otros: {
          income: macroGroups.otros.income,
          expenses: macroGroups.otros.expenses,
          net: macroGroups.otros.income - macroGroups.otros.expenses,
          tags: Object.entries(macroGroups.otros.tags).map(([tag, d]) => ({ tag, ...d, net: d.income - d.expenses, transactions: d.transactions.slice(0, 20) })),
        },
      },
      // Caja breakdown
      caja: cajaSorted,
      cajaMacro,
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
        stockValue: stockData.stockValue,
        stockCost: stockData.stockCost,
        totalUnits: stockData.totalUnits,
        productCount: stockData.productCount,
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
