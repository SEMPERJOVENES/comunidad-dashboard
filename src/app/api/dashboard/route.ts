import { NextRequest, NextResponse } from 'next/server';
import { getAllOrders, getStockValuation } from '@/lib/shopify';
import { getPaymentVolume, getBalance } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';
import { format, parseISO, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

// Helper: paginar Supabase para no perder datos por el límite de 1000 filas
async function fetchAllBankTxs(query: { gte?: [string, string]; lte?: [string, string]; select?: string; order?: [string, { ascending: boolean }] }) {
  const PAGE = 1000;
  const all: any[] = [];
  let from = 0;
  while (true) {
    let q = supabase.from('bank_transactions').select(query.select || '*');
    if (query.gte) q = q.gte(query.gte[0], query.gte[1]);
    if (query.lte) q = q.lte(query.lte[0], query.lte[1]);
    if (query.order) q = q.order(query.order[0], query.order[1]);
    q = q.range(from, from + PAGE - 1);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start') || subDays(new Date(), 30).toISOString();
    const end = searchParams.get('end') || new Date().toISOString();

    const startTs = Math.floor(new Date(start).getTime() / 1000);
    const endTs = Math.floor(new Date(end).getTime() / 1000);
    const startDate = new Date(start).toISOString().split('T')[0];
    const endDate = new Date(end).toISOString().split('T')[0];

    // Fetch all data in parallel (bank txs con paginación para no perder datos)
    const [orders, stripeVolume, stripeBalance, bankTxs, tagCatsResult, stockData] = await Promise.all([
      getAllOrders({ created_at_min: start, created_at_max: end, status: 'any' }),
      getPaymentVolume({ created: { gte: startTs, lte: endTs } }).catch(() => ({ volume: 0, count: 0, refunded: 0, disputed: 0, currency: 'eur' })),
      getBalance().catch(() => ({ available: 0, pending: 0, currency: 'eur' })),
      fetchAllBankTxs({
        gte: ['date', startDate],
        lte: ['date', endDate],
        order: ['date', { ascending: false }],
      }),
      supabase
        .from('tag_categories')
        .select('name, macro_group'),
      getStockValuation().catch(() => ({ stockValue: 0, stockCost: 0, totalUnits: 0, productCount: 0 })),
    ]);

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

    // Caja Brand (efectivo de ventas presenciales — desde inicio, no por rango)
    const { data: efectivoVentas } = await supabase
      .from('ventas_presenciales')
      .select('date, total_amount, sale_type, payment_method, customer_name, items, notes')
      .eq('payment_method', 'efectivo');
    const efectivoNoRegalo = (efectivoVentas || []).filter((v: any) => v.sale_type !== 'regalo' && v.sale_type !== 'pendiente_pago');
    const cajaBrandEfectivo = efectivoNoRegalo.reduce((s: number, v: any) => s + parseFloat(v.total_amount || '0'), 0);

    // Coste regalos (cost_loss de ventas tipo regalo) — para descontar de inversión proveedor
    const { data: regalosVentas } = await supabase
      .from('ventas_presenciales')
      .select('cost_loss')
      .or('sale_type.eq.regalo,payment_method.eq.regalo');
    const brandRegalosCoste = (regalosVentas || []).reduce((s: number, v: any) => s + parseFloat(v.cost_loss || '0'), 0);

    // Desglose por producto
    const cajaBrandEfectivoByProduct: Record<string, { total: number; count: number; items: Array<{ date: string; customer: string; variant: string; amount: number; notes: string }> }> = {};
    for (const v of efectivoNoRegalo) {
      const items = v.items || [];
      for (const it of items) {
        const title = it.productTitle || it.title || 'Sin título';
        const qty = it.quantity || 1;
        const unitPrice = parseFloat(it.unitPrice || 0);
        const amount = unitPrice * qty;
        if (!cajaBrandEfectivoByProduct[title]) cajaBrandEfectivoByProduct[title] = { total: 0, count: 0, items: [] };
        cajaBrandEfectivoByProduct[title].total += amount;
        cajaBrandEfectivoByProduct[title].count += qty;
        cajaBrandEfectivoByProduct[title].items.push({
          date: v.date,
          customer: v.customer_name || '',
          variant: it.variantTitle || '',
          amount,
          notes: v.notes || '',
        });
      }
    }

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

    // Brand desglose por CANAL (Bizum / Transferencia / Stripe Shopify / etc.)
    const brandByChannel = {
      bizum: 0,
      transferencia: 0,
      stripeShopify: 0,    // payouts "Concepto Shopify" tag Brand
      otro: 0,
    };

    // Brand expenses desglosados: Inversión vs Gasto operativo
    let brandInversionTotal = 0;
    let brandGastoOperativoTotal = 0;
    const brandInversionDetail: Array<{ date: string; concept: string; amount: number }> = [];
    const brandGastoOperativoDetail: Array<{ date: string; concept: string; amount: number }> = [];

    for (const tx of bankTxs) {
      const macro = getMacroCategory(tx);
      if (macro === 'excluido') continue; // Skip "No contabilizar"
      const amt = parseFloat(tx.amount || '0');
      const tag = tx.manual_tag || tx.auto_tag || 'Sin categoría';
      const concept = (tx.concept || '').toLowerCase();

      if (amt > 0) {
        macroGroups[macro].income += amt;
      } else {
        macroGroups[macro].expenses += Math.abs(amt);
      }

      // Si es Brand y es ingreso, desglosar por canal
      if (macro === 'brand' && amt > 0) {
        if (concept.includes('bizum')) brandByChannel.bizum += amt;
        else if (concept.includes('transferencia de stripe') && concept.includes('shopify')) brandByChannel.stripeShopify += amt;
        else if (concept.includes('transferencia')) brandByChannel.transferencia += amt;
        else brandByChannel.otro += amt;
      }

      // Si es Brand y es gasto, separar Inversión vs Gasto operativo
      if (macro === 'brand' && amt < 0) {
        const isInvestment = /rockwear|lote|produc|imprenta|tela|fabric|proveedor/.test(concept);
        const detail = { date: tx.date, concept: tx.concept || '', amount: Math.abs(amt) };
        if (isInvestment) {
          brandInversionTotal += Math.abs(amt);
          brandInversionDetail.push(detail);
        } else {
          brandGastoOperativoTotal += Math.abs(amt);
          brandGastoOperativoDetail.push(detail);
        }
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
        description: tx.concept || '',
        amount: amt,
      });
    }

    // Sumar caja efectivo al Brand (Stripe one-time se calcula en el frontend con fetch paralelo)
    macroGroups.brand.income += cajaBrandEfectivo;

    // === CAJA: Balance breakdown by category from ALL bank transactions ===
    // Get ALL transactions for "caja" (not date-filtered) — con paginación
    const allBankTxs = await fetchAllBankTxs({
      select: 'amount, manual_tag, auto_tag, is_diezmo, date, concept',
      order: ['date', { ascending: false }],
    });

    const cajaByCategory: Record<string, { net: number; count: number; transactions: TagTx[] }> = {};
    const cajaMacro = { comunidad: 0, brand: 0, otros: 0 };
    for (const tx of allBankTxs) {
      const macro = getMacroCategory(tx);
      if (macro === 'excluido') continue; // Skip "No contabilizar"
      const tag = tx.manual_tag || tx.auto_tag || 'Sin categoría';
      const amt = parseFloat(tx.amount || '0');
      if (!cajaByCategory[tag]) {
        cajaByCategory[tag] = { net: 0, count: 0, transactions: [] };
      }
      cajaByCategory[tag].net += amt;
      cajaByCategory[tag].count += 1;
      cajaByCategory[tag].transactions.push({
        date: tx.date,
        description: tx.concept || '',
        amount: amt,
      });

      // Aggregate by macro category
      if (macro === 'diezmos') cajaMacro.comunidad += amt;
      else if (macro === 'brand') cajaMacro.brand += amt;
      else cajaMacro.otros += amt;
    }

    // Sort caja by absolute value
    const cajaSorted = Object.entries(cajaByCategory)
      .map(([tag, data]) => ({ tag, net: data.net, count: data.count, transactions: data.transactions }))
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
        cajaBrandEfectivo,
        cajaBrandEfectivoByProduct,
        brandByChannel,
        // Inversión proveedor NETA = lote total − coste regalos
        brandInversionTotal: Math.max(0, brandInversionTotal - brandRegalosCoste),
        brandInversionTotalBruto: brandInversionTotal,
        brandInversionDetail,
        brandGastoOperativoTotal,
        brandGastoOperativoDetail,
        brandRegalosCoste,
      },
      // Macro groups
      macroGroups: {
        diezmos: {
          income: macroGroups.diezmos.income,
          expenses: macroGroups.diezmos.expenses,
          net: macroGroups.diezmos.income - macroGroups.diezmos.expenses,
          tags: Object.entries(macroGroups.diezmos.tags).map(([tag, d]) => ({ tag, ...d, net: d.income - d.expenses, transactions: d.transactions })),
        },
        brand: {
          income: macroGroups.brand.income,
          expenses: macroGroups.brand.expenses,
          net: macroGroups.brand.income - macroGroups.brand.expenses,
          tags: Object.entries(macroGroups.brand.tags).map(([tag, d]) => ({ tag, ...d, net: d.income - d.expenses, transactions: d.transactions })),
        },
        otros: {
          income: macroGroups.otros.income,
          expenses: macroGroups.otros.expenses,
          net: macroGroups.otros.income - macroGroups.otros.expenses,
          tags: Object.entries(macroGroups.otros.tags).map(([tag, d]) => ({ tag, ...d, net: d.income - d.expenses, transactions: d.transactions })),
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
