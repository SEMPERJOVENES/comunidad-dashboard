import { NextRequest, NextResponse } from 'next/server';
import { getAllOrders, getProducts } from '@/lib/shopify';
import { supabase } from '@/lib/supabase';
import { getAllBalanceTransactions } from '@/lib/stripe';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start') || '2020-01-01T00:00:00Z';
    const end = searchParams.get('end') || new Date().toISOString();

    // 1. Shopify orders (todas son Semper Brand) — con paginación completa
    const orders = await getAllOrders({
      created_at_min: start,
      created_at_max: end,
      status: 'any',
    });

    // MÉTODO BRUTO: todos los pedidos cuentan como ingreso, devoluciones REALES como gasto
    const shopifyGross = orders.reduce((sum: number, o: any) => sum + parseFloat(o.total_price || '0'), 0);
    const paidOrders = orders.filter((o: any) => o.financial_status !== 'refunded');
    const refundedOrders = orders.filter((o: any) => o.financial_status === 'refunded' || o.financial_status === 'partially_refunded');

    // Calcular importe REAL de devoluciones (no el total del pedido)
    function getActualRefundAmount(order: any): number {
      let total = 0;
      for (const refund of (order.refunds || [])) {
        for (const li of (refund.refund_line_items || [])) {
          total += parseFloat(li.subtotal || '0');
          total += parseFloat(li.total_tax || '0');
        }
        // Ajustes adicionales (envío devuelto, etc.)
        for (const adj of (refund.order_adjustments || [])) {
          total += Math.abs(parseFloat(adj.amount || '0'));
        }
      }
      return total;
    }
    const shopifyRefundAmount = orders.reduce((sum: number, o: any) => sum + getActualRefundAmount(o), 0);

    // 2. Ventas presenciales (todas son Semper Brand)
    const { data: ventas } = await supabase
      .from('ventas_presenciales')
      .select('*')
      .gte('date', start)
      .lte('date', end);

    const ventasTotal = (ventas || []).reduce((s: number, v: any) => s + parseFloat(v.total_amount || '0'), 0);

    // 3. Bank transactions — SOLO las categorizadas como "brand" en tag_categories
    const startDate = start.split('T')[0];
    const endDate = end.split('T')[0];

    // Paginar bank_transactions para no perder datos con >1000 filas
    async function fetchAllBankRows() {
      const PAGE = 1000;
      const all: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('bank_transactions').select('*')
          .gte('date', startDate).lte('date', endDate)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return all;
    }

    const [bankTxs, { data: tagCats }] = await Promise.all([
      fetchAllBankRows(),
      supabase
        .from('tag_categories')
        .select('name, macro_group'),
    ]);

    // Construir set de tags que son "brand"
    const brandTags = new Set<string>();
    for (const tc of (tagCats || [])) {
      if (tc.macro_group === 'brand') {
        brandTags.add(tc.name);
      }
    }

    // Categorizar transacciones bancarias — SOLO contar las de macro_group "brand"
    const incomeByTag: Record<string, number> = {};
    const expensesByTag: Record<string, number> = {};
    let totalBankIncome = 0;
    let totalBankExpenses = 0;

    // Detalle por tag para drill-down
    const bankIncomeDetail: Record<string, Array<{ date: string; concept: string; amount: number }>> = {};
    const bankExpenseDetail: Record<string, Array<{ date: string; concept: string; amount: number }>> = {};

    for (const tx of bankTxs) {
      const tag = tx.manual_tag || tx.auto_tag || '';
      const amount = parseFloat(tx.amount || '0');

      // Solo incluir transacciones cuyo tag pertenezca al grupo "brand"
      if (!brandTags.has(tag)) continue;

      const detail = { date: tx.date, concept: tx.concept || '', amount: Math.abs(amount) };

      if (amount > 0) {
        incomeByTag[tag] = (incomeByTag[tag] || 0) + amount;
        totalBankIncome += amount;
        if (!bankIncomeDetail[tag]) bankIncomeDetail[tag] = [];
        bankIncomeDetail[tag].push(detail);
      } else {
        expensesByTag[tag] = (expensesByTag[tag] || 0) + Math.abs(amount);
        totalBankExpenses += Math.abs(amount);
        if (!bankExpenseDetail[tag]) bankExpenseDetail[tag] = [];
        bankExpenseDetail[tag].push(detail);
      }
    }

    // 3b. Stripe fees — SOLO cargos de Brand (excluir suscripciones de diezmos)
    const startTimestamp = Math.floor(new Date(start).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(end).getTime() / 1000);

    let stripeFees = 0;
    let stripeRefundFees = 0;
    let stripeGross = 0;
    let stripeNet = 0;
    const stripeMonthlyFees = new Map<string, number>();
    const stripeChargeDetails: Array<{ date: string; description: string; amount: number; fee: number }> = [];

    // Helper: detectar si una transacción es de suscripción/diezmo (NO de Brand)
    function isSubscriptionTx(description: string | null): boolean {
      if (!description) return false;
      const lower = description.toLowerCase();
      return lower.includes('subscription') || lower.includes('invoice') || lower.includes('suscripci');
    }

    try {
      const stripeTxs = await getAllBalanceTransactions({
        created: { gte: startTimestamp, lte: endTimestamp },
      });

      for (const tx of stripeTxs) {
        if (tx.type === 'charge' || tx.type === 'payment') {
          // Excluir cargos de suscripciones (son diezmos, no Brand)
          if (isSubscriptionTx(tx.description)) continue;

          stripeFees += tx.fee;
          stripeGross += tx.amount > 0 ? tx.amount : 0;
          stripeNet += tx.net > 0 ? tx.net : 0;

          // Desglose mensual de fees
          const month = new Date(tx.created).toISOString().substring(0, 7);
          stripeMonthlyFees.set(month, (stripeMonthlyFees.get(month) || 0) + tx.fee);

          stripeChargeDetails.push({
            date: tx.created,
            description: tx.description || 'Pago Stripe',
            amount: tx.amount,
            fee: tx.fee,
          });
        } else if (tx.type === 'refund') {
          // Excluir reembolsos de suscripciones también
          if (isSubscriptionTx(tx.description)) continue;

          stripeRefundFees += tx.fee;
          const month = new Date(tx.created).toISOString().substring(0, 7);
          stripeMonthlyFees.set(month, (stripeMonthlyFees.get(month) || 0) + tx.fee);
        }
      }
    } catch (err) {
      console.error('Error fetching Stripe fees:', err);
    }

    // Comisiones netas de Stripe de Brand (sin suscripciones)
    const netStripeFees = stripeFees + stripeRefundFees;

    // 4. Desglose mensual — método bruto (todos los pedidos)
    const monthlyMap = new Map<string, { shopify: number; shopifyRefunds: number; ventas: number; bankIncome: number; expenses: number; stripeFees: number; orders: number }>();

    for (const o of orders) {
      const month = o.created_at.substring(0, 7);
      const existing = monthlyMap.get(month) || { shopify: 0, shopifyRefunds: 0, ventas: 0, bankIncome: 0, expenses: 0, stripeFees: 0, orders: 0 };
      const amount = parseFloat(o.total_price || '0');
      existing.shopify += amount;
      existing.orders += 1;
      // Usar importe REAL de devolución, no el total del pedido
      const refundAmt = getActualRefundAmount(o);
      if (refundAmt > 0) {
        existing.shopifyRefunds += refundAmt;
      }
      monthlyMap.set(month, existing);
    }

    for (const v of (ventas || [])) {
      const month = new Date(v.date).toISOString().substring(0, 7);
      const existing = monthlyMap.get(month) || { shopify: 0, shopifyRefunds: 0, ventas: 0, bankIncome: 0, expenses: 0, stripeFees: 0, orders: 0 };
      existing.ventas += parseFloat(v.total_amount || '0');
      monthlyMap.set(month, existing);
    }

    for (const tx of bankTxs) {
      const tag = tx.manual_tag || tx.auto_tag || '';
      if (!brandTags.has(tag)) continue;
      const month = new Date(tx.date).toISOString().substring(0, 7);
      const existing = monthlyMap.get(month) || { shopify: 0, shopifyRefunds: 0, ventas: 0, bankIncome: 0, expenses: 0, stripeFees: 0, orders: 0 };
      const amount = parseFloat(tx.amount || '0');
      if (amount > 0) {
        existing.bankIncome += amount;
      } else {
        existing.expenses += Math.abs(amount);
      }
      monthlyMap.set(month, existing);
    }

    // Stripe fees por mes
    for (const [month, fee] of stripeMonthlyFees) {
      const existing = monthlyMap.get(month) || { shopify: 0, shopifyRefunds: 0, ventas: 0, bankIncome: 0, expenses: 0, stripeFees: 0, orders: 0 };
      existing.stripeFees += fee;
      monthlyMap.set(month, existing);
    }

    const monthlyBreakdown = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        ...data,
        totalIncome: data.shopify + data.ventas + data.bankIncome,
        totalExpenses: data.expenses + data.stripeFees + data.shopifyRefunds,
        profit: data.shopify + data.ventas + data.bankIncome - data.expenses - data.stripeFees - data.shopifyRefunds,
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

    // 6. Órdenes individuales (TODAS, incluidas reembolsadas)
    const allOrders = orders.map((o: any) => ({
      id: o.id,
      name: o.name || '',
      customer: o.customer
        ? `${o.customer.first_name || ''} ${o.customer.last_name || ''}`.trim()
        : (o.billing_address?.name || 'Desconocido'),
      email: o.customer?.email || o.email || '',
      date: o.created_at,
      total: parseFloat(o.total_price || '0'),
      refundAmount: getActualRefundAmount(o),
      financialStatus: o.financial_status || '',
      fulfillmentStatus: o.fulfillment_status || '',
      itemCount: (o.line_items || []).reduce((s: number, li: any) => s + (li.quantity || 1), 0),
      items: (o.line_items || []).map((li: any) => li.title).join(', '),
    })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Totales — Método bruto: Ingresos = TODOS los pedidos + presencial + banco
    const totalIncome = shopifyGross + ventasTotal + totalBankIncome;
    const totalExpensesAll = totalBankExpenses + netStripeFees + shopifyRefundAmount;
    const profit = totalIncome - totalExpensesAll;
    const margin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;

    // Ventas presenciales detalle para drill-down
    const ventasDetail = (ventas || []).map((v: any) => ({
      date: v.date,
      description: v.customer_name || v.notes || 'Venta presencial',
      amount: parseFloat(v.total_amount || '0'),
      paymentMethod: v.payment_method || '',
      saleType: v.sale_type || 'venta',
      costLoss: parseFloat(v.cost_loss || '0'),
    }));

    // Pérdidas por regalos (coste de producción de unidades regaladas)
    const giftLoss = (ventas || [])
      .filter((v: any) => v.sale_type === 'regalo' || v.payment_method === 'regalo')
      .reduce((s: number, v: any) => s + parseFloat(v.cost_loss || '0'), 0);

    // ============================================================
    // STOCK VALUATION — usando costes manuales de Supabase
    // ============================================================
    let stockUnits = 0;
    let stockRetailValue = 0;     // ingreso potencial si vendemos todo a PVP
    let stockCostValue = 0;        // inmovilizado real (€ invertidos)
    let stockProductsWithCost = 0;
    let stockProductsWithoutCost = 0;
    const stockTopByValue: Array<{ title: string; units: number; retail: number; cost: number; potentialProfit: number }> = [];

    try {
      const [shopifyProducts, costsResult] = await Promise.all([
        getProducts({ limit: 250 }).catch(() => []),
        supabase.from('product_costs').select('*'),
      ]);

      const costMap: Record<string, { cost_price: number; category: string }> = {};
      for (const row of (costsResult.data || [])) {
        const key = row.shopify_variant_id
          ? `${row.shopify_product_id}_${row.shopify_variant_id}`
          : `${row.shopify_product_id}`;
        costMap[key] = {
          cost_price: parseFloat(row.cost_price) || 0,
          category: row.category || 'inventario',
        };
      }

      for (const p of shopifyProducts) {
        let prodUnits = 0, prodRetail = 0, prodCost = 0;
        let hasCost = false;
        for (const v of (p.variants || [])) {
          const qty = v.inventory_quantity || 0;
          const price = parseFloat(v.price || '0');
          const variantKey = `${p.id}_${v.id}`;
          const productKey = `${p.id}`;
          const cost = costMap[variantKey] || costMap[productKey];
          const cat = cost?.category || 'inventario';
          if (cat === 'inmovilizado') continue; // separar inmovilizado del stock vendible

          prodUnits += qty;
          prodRetail += price * qty;
          if (cost?.cost_price) {
            prodCost += cost.cost_price * qty;
            hasCost = true;
          }
        }
        stockUnits += prodUnits;
        stockRetailValue += prodRetail;
        stockCostValue += prodCost;
        if (hasCost) stockProductsWithCost++;
        else if (prodUnits > 0) stockProductsWithoutCost++;

        if (prodUnits > 0) {
          stockTopByValue.push({
            title: p.title,
            units: prodUnits,
            retail: prodRetail,
            cost: prodCost,
            potentialProfit: prodRetail - prodCost,
          });
        }
      }
      stockTopByValue.sort((a, b) => b.retail - a.retail);
    } catch (err) {
      console.error('Stock valuation error:', err);
    }

    const stockPotentialProfit = stockRetailValue - stockCostValue;
    const stockPotentialMargin = stockRetailValue > 0 ? (stockPotentialProfit / stockRetailValue) * 100 : 0;

    return NextResponse.json({
      income: {
        shopify: shopifyGross,
        shopifyOrders: orders.length,
        shopifyPaidOrders: paidOrders.length,
        ventasPresenciales: ventasTotal,
        ventasCount: (ventas || []).length,
        bankIncome: incomeByTag,
        totalBankIncome,
        total: totalIncome,
      },
      expenses: {
        byTag: expensesByTag,
        total: totalBankExpenses,
        stripeFees: netStripeFees,
        stripeGross,
        stripeNet,
        shopifyRefunds: shopifyRefundAmount,
        shopifyRefundCount: refundedOrders.length,
      },
      profit,
      margin,
      giftLoss,
      monthlyBreakdown,
      topProducts,
      orders: allOrders,
      stockValuation: {
        units: stockUnits,
        retailValue: stockRetailValue,
        costValue: stockCostValue,
        potentialProfit: stockPotentialProfit,
        potentialMargin: stockPotentialMargin,
        productsWithCost: stockProductsWithCost,
        productsWithoutCost: stockProductsWithoutCost,
        topByValue: stockTopByValue.slice(0, 12),
      },
      transactions: {
        ventas: ventasDetail,
        bankIncome: bankIncomeDetail,
        bankExpense: bankExpenseDetail,
        stripeCharges: stripeChargeDetails,
      },
    });
  } catch (error: any) {
    console.error('Semper Brand API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
