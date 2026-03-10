import { NextRequest, NextResponse } from 'next/server';
import { getAllOrders } from '@/lib/shopify';
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

    // MÉTODO BRUTO: todos los pedidos cuentan como ingreso, devoluciones como gasto
    const shopifyGross = orders.reduce((sum: number, o: any) => sum + parseFloat(o.total_price || '0'), 0);
    const paidOrders = orders.filter((o: any) => o.financial_status !== 'refunded');
    const refundedOrders = orders.filter((o: any) => o.financial_status === 'refunded' || o.financial_status === 'partially_refunded');
    const shopifyRefundAmount = refundedOrders.reduce((sum: number, o: any) => sum + parseFloat(o.total_price || '0'), 0);

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

    const [{ data: bankTxs }, { data: tagCats }] = await Promise.all([
      supabase
        .from('bank_transactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate),
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

    for (const tx of (bankTxs || [])) {
      const tag = tx.manual_tag || tx.auto_tag || '';
      const amount = parseFloat(tx.amount || '0');

      // Solo incluir transacciones cuyo tag pertenezca al grupo "brand"
      if (!brandTags.has(tag)) continue;

      const detail = { date: tx.date, concept: tx.concept || tx.description || '', amount: Math.abs(amount) };

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

    // 3b. Stripe fees (comisiones de pasarela de pago)
    const startTimestamp = Math.floor(new Date(start).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(end).getTime() / 1000);

    let stripeFees = 0;
    let stripeRefundFees = 0;
    let stripeGross = 0;
    let stripeNet = 0;
    const stripeMonthlyFees = new Map<string, number>();
    const stripeChargeDetails: Array<{ date: string; description: string; amount: number; fee: number }> = [];

    try {
      const stripeTxs = await getAllBalanceTransactions({
        created: { gte: startTimestamp, lte: endTimestamp },
      });

      for (const tx of stripeTxs) {
        if (tx.type === 'charge' || tx.type === 'payment') {
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
          // Las devoluciones de Stripe devuelven la comisión (fee suele ser 0 o negativo)
          stripeRefundFees += tx.fee;
          const month = new Date(tx.created).toISOString().substring(0, 7);
          stripeMonthlyFees.set(month, (stripeMonthlyFees.get(month) || 0) + tx.fee);
        }
      }
    } catch (err) {
      console.error('Error fetching Stripe fees:', err);
    }

    // Comisiones netas de Stripe (cargos - reembolsadas)
    const netStripeFees = stripeFees + stripeRefundFees; // refundFees suele ser <= 0

    // 4. Desglose mensual — método bruto (todos los pedidos)
    const monthlyMap = new Map<string, { shopify: number; shopifyRefunds: number; ventas: number; bankIncome: number; expenses: number; stripeFees: number; orders: number }>();

    for (const o of orders) {
      const month = o.created_at.substring(0, 7);
      const existing = monthlyMap.get(month) || { shopify: 0, shopifyRefunds: 0, ventas: 0, bankIncome: 0, expenses: 0, stripeFees: 0, orders: 0 };
      const amount = parseFloat(o.total_price || '0');
      existing.shopify += amount;
      existing.orders += 1;
      if (o.financial_status === 'refunded' || o.financial_status === 'partially_refunded') {
        existing.shopifyRefunds += amount;
      }
      monthlyMap.set(month, existing);
    }

    for (const v of (ventas || [])) {
      const month = new Date(v.date).toISOString().substring(0, 7);
      const existing = monthlyMap.get(month) || { shopify: 0, shopifyRefunds: 0, ventas: 0, bankIncome: 0, expenses: 0, stripeFees: 0, orders: 0 };
      existing.ventas += parseFloat(v.total_amount || '0');
      monthlyMap.set(month, existing);
    }

    for (const tx of (bankTxs || [])) {
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
    }));

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
      monthlyBreakdown,
      topProducts,
      orders: allOrders,
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
