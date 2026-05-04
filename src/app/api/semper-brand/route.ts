import { NextRequest, NextResponse } from 'next/server';
import { getAllOrders, getProducts } from '@/lib/shopify';
import { supabase } from '@/lib/supabase';
import { getAllBalanceTransactions, getPayouts, getPayoutBreakdownLite, getBalance } from '@/lib/stripe';

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

    // 1b. Shopify orders HISTÓRICAS sin filtro de rango — para trazabilidad de stock (BAC 26)
    // Cachear sería ideal; por ahora se pide una sola vez por petición.
    let allTimeOrders: any[] = orders;
    try {
      allTimeOrders = await getAllOrders({
        created_at_min: '2024-01-01T00:00:00Z',
        status: 'any',
      });
    } catch {
      // Fallback al rango actual si falla
      allTimeOrders = orders;
    }

    // Calcular ventas históricas Shopify por colección trazable (Pingüino, GOD Luck)
    function matchTraceable(title: string): string | null {
      const t = (title || '').toLowerCase();
      if (/ping[üu]ino/.test(t)) return 'pinguino';
      if (/god\s*luck|good\s*luck/.test(t)) return 'godluck';
      return null;
    }
    const historicalSalesByCollection: Record<string, { revenue: number; units: number; refundedUnits: number; shopifyRevenue: number; shopifyUnits: number; presencialRevenue: number; presencialUnits: number }> = {
      pinguino: { revenue: 0, units: 0, refundedUnits: 0, shopifyRevenue: 0, shopifyUnits: 0, presencialRevenue: 0, presencialUnits: 0 },
      godluck: { revenue: 0, units: 0, refundedUnits: 0, shopifyRevenue: 0, shopifyUnits: 0, presencialRevenue: 0, presencialUnits: 0 },
    };
    // 1. Ventas Shopify históricas
    for (const o of allTimeOrders) {
      const refundedByLineItem = new Map<number, number>();
      for (const r of (o.refunds || [])) {
        for (const rli of (r.refund_line_items || [])) {
          refundedByLineItem.set(rli.line_item_id, (refundedByLineItem.get(rli.line_item_id) || 0) + (rli.quantity || 0));
        }
      }
      for (const item of (o.line_items || [])) {
        const collection = matchTraceable(item.title || '');
        if (!collection) continue;
        const refundedQty = refundedByLineItem.get(item.id) || 0;
        const netQty = (item.quantity || 1) - refundedQty;
        if (netQty <= 0) {
          historicalSalesByCollection[collection].refundedUnits += (item.quantity || 1);
          continue;
        }
        const r = parseFloat(item.price || '0') * netQty;
        historicalSalesByCollection[collection].shopifyRevenue += r;
        historicalSalesByCollection[collection].shopifyUnits += netQty;
        historicalSalesByCollection[collection].revenue += r;
        historicalSalesByCollection[collection].units += netQty;
      }
    }
    // 2. Ventas presenciales históricas — sin filtro de rango
    const { data: ventasAllTime } = await supabase
      .from('ventas_presenciales')
      .select('items, sale_type, payment_method');
    for (const v of (ventasAllTime || [])) {
      if (v.sale_type === 'regalo' || v.payment_method === 'regalo') continue;
      const items = v.items || [];
      for (const it of items) {
        const title = it.productTitle || it.title || '';
        const collection = matchTraceable(title);
        if (!collection) continue;
        const qty = it.quantity || 1;
        const r = (it.unitPrice || 0) * qty;
        historicalSalesByCollection[collection].presencialRevenue += r;
        historicalSalesByCollection[collection].presencialUnits += qty;
        historicalSalesByCollection[collection].revenue += r;
        historicalSalesByCollection[collection].units += qty;
      }
    }

    // MÉTODO BRUTO: todos los pedidos cuentan como ingreso, devoluciones REALES como gasto
    const shopifyGross = orders.reduce((sum: number, o: any) => sum + parseFloat(o.total_price || '0'), 0);
    const paidOrders = orders.filter((o: any) => o.financial_status !== 'refunded');
    const refundedOrders = orders.filter((o: any) => o.financial_status === 'refunded' || o.financial_status === 'partially_refunded');

    // Calcular importe REAL de devoluciones — usar TRANSACTIONS (lo que el procesador de pago realmente devolvió)
    // Los adjustments tipo `refund_discrepancy` se compensan entre sí (+X / -X) y NO se deben sumar con abs.
    function getActualRefundAmount(order: any): number {
      let total = 0;
      for (const refund of (order.refunds || [])) {
        // Preferir transactions (refund de Stripe / pasarela): es el dinero real devuelto al cliente
        const refundTxs = (refund.transactions || []).filter((t: any) => t.kind === 'refund' && t.status === 'success');
        if (refundTxs.length > 0) {
          for (const tx of refundTxs) total += parseFloat(tx.amount || '0');
          continue;
        }
        // Fallback: line_items + adjustments con SIGNO (no abs) — los discrepancies se cancelan
        for (const li of (refund.refund_line_items || [])) {
          total += parseFloat(li.subtotal || '0');
          total += parseFloat(li.total_tax || '0');
        }
        for (const adj of (refund.order_adjustments || [])) {
          total += parseFloat(adj.amount || '0');  // SIN abs — discrepancies +X/-X se cancelan
        }
      }
      return Math.max(0, total);
    }
    const shopifyRefundAmount = orders.reduce((sum: number, o: any) => sum + getActualRefundAmount(o), 0);

    // 2. Ventas presenciales (todas son Semper Brand)
    const { data: ventas } = await supabase
      .from('ventas_presenciales')
      .select('*')
      .gte('date', start)
      .lte('date', end);

    // Ventas: separar pagadas vs pendientes de pago
    const ventasPagadas = (ventas || []).filter((v: any) => v.sale_type !== 'pendiente_pago');
    const ventasPendientes = (ventas || []).filter((v: any) => v.sale_type === 'pendiente_pago');

    const ventasTotal = ventasPagadas.reduce((s: number, v: any) => s + parseFloat(v.total_amount || '0'), 0);
    const pendientePagoTotal = ventasPendientes.reduce((s: number, v: any) => s + parseFloat(v.total_amount || '0'), 0);
    const pendientePagoDetail = ventasPendientes.map((v: any) => ({
      id: v.id,
      date: v.date,
      customer: v.customer_name || '',
      amount: parseFloat(v.total_amount || '0'),
      items: v.items || [],
      notes: v.notes || '',
    }));

    // POS desglose por método de pago (excluye regalos y pendientes)
    const posByMethod: Record<string, { total: number; count: number }> = {};
    // Caja efectivo desglose por producto
    const cajaEfectivoByProduct: Record<string, { total: number; count: number; items: Array<{ date: string; customer: string; variant: string; amount: number; notes: string }> }> = {};
    for (const v of ventasPagadas) {
      if (v.sale_type === 'regalo' || v.payment_method === 'regalo') continue;
      const method = v.payment_method || 'sin método';
      if (!posByMethod[method]) posByMethod[method] = { total: 0, count: 0 };
      posByMethod[method].total += parseFloat(v.total_amount || '0');
      posByMethod[method].count += 1;

      // Si es efectivo, desglosar por producto
      if (method === 'efectivo') {
        const items = v.items || [];
        for (const it of items) {
          const title = it.productTitle || it.title || 'Sin título';
          const qty = it.quantity || 1;
          const unitPrice = parseFloat(it.unitPrice || 0);
          const amount = unitPrice * qty;
          if (!cajaEfectivoByProduct[title]) cajaEfectivoByProduct[title] = { total: 0, count: 0, items: [] };
          cajaEfectivoByProduct[title].total += amount;
          cajaEfectivoByProduct[title].count += qty;
          cajaEfectivoByProduct[title].items.push({
            date: v.date,
            customer: v.customer_name || '',
            variant: it.variantTitle || '',
            amount,
            notes: v.notes || '',
          });
        }
      }
    }

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

    // Desglose Brand por canal (sin Stripe payouts — esos los splitemos via API)
    let brandBizum = 0;          // Bizums tag Brand al banco
    let brandTransferencia = 0;  // Transferencias tag Brand al banco (sin Stripe)
    let brandStripePayoutShopify = 0; // Stripe payouts "Concepto Shopify" tag Brand
    const brandBizumDetail: Array<{ date: string; concept: string; amount: number }> = [];
    const brandTransferDetail: Array<{ date: string; concept: string; amount: number }> = [];
    const brandShopifyPayoutDetail: Array<{ date: string; concept: string; amount: number }> = [];

    for (const tx of bankTxs) {
      const tag = tx.manual_tag || tx.auto_tag || '';
      const amount = parseFloat(tx.amount || '0');
      const concept = (tx.concept || '').toLowerCase();

      // Solo incluir transacciones cuyo tag pertenezca al grupo "brand"
      if (!brandTags.has(tag)) continue;

      const detail = { date: tx.date, concept: tx.concept || '', amount: Math.abs(amount) };

      if (amount > 0) {
        incomeByTag[tag] = (incomeByTag[tag] || 0) + amount;
        totalBankIncome += amount;
        if (!bankIncomeDetail[tag]) bankIncomeDetail[tag] = [];
        bankIncomeDetail[tag].push(detail);

        // Desglosar por canal
        if (concept.includes('bizum')) {
          brandBizum += amount;
          brandBizumDetail.push(detail);
        } else if (concept.includes('transferencia de stripe') && concept.includes('shopify')) {
          brandStripePayoutShopify += amount;
          brandShopifyPayoutDetail.push(detail);
        } else if (concept.includes('transferencia')) {
          brandTransferencia += amount;
          brandTransferDetail.push(detail);
        } else {
          // Fallback: considerar como transferencia
          brandTransferencia += amount;
          brandTransferDetail.push(detail);
        }
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

    // 5. Top productos — combinar Shopify + ventas presenciales, restando refunds
    // Clave normalizada para agrupar duplicados (ej. "Camiseta GOD LUCK" y "Camiseta GOD Luck" → mismo producto)
    function normalizeProductKey(title: string): string {
      return (title || '')
        .toLowerCase()
        .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
        .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
        .replace(/^camiseta\s+/, '').replace(/^libro\s+/, '')
        .replace(/^sudadera\s+/, '').replace(/^botella\s+/, '')
        .replace(/^camiseta\s*"/, '').replace(/"$/, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    const productMap = new Map<string, { title: string; revenue: number; units: number; source: { shopify: number; presencial: number } }>();

    function ensureProduct(key: string, title: string) {
      if (!productMap.has(key)) {
        productMap.set(key, { title, revenue: 0, units: 0, source: { shopify: 0, presencial: 0 } });
      } else {
        // Si ya existe pero el title actual es más "limpio" (sin "Camiseta "), mantener el más corto/canónico
        const cur = productMap.get(key)!;
        if (title.length < cur.title.length) cur.title = title;
      }
      return productMap.get(key)!;
    }

    // Shopify orders (TODAS, no solo pagadas — restamos refunds después)
    for (const o of orders) {
      const refundedByLineItem = new Map<number, number>();
      for (const r of (o.refunds || [])) {
        for (const rli of (r.refund_line_items || [])) {
          const lineItemId = rli.line_item_id;
          refundedByLineItem.set(lineItemId, (refundedByLineItem.get(lineItemId) || 0) + (rli.quantity || 0));
        }
      }
      for (const item of (o.line_items || [])) {
        const key = normalizeProductKey(item.title);
        const refundedQty = refundedByLineItem.get(item.id) || 0;
        const netQty = (item.quantity || 1) - refundedQty;
        if (netQty <= 0) continue;
        const p = ensureProduct(key, item.title);
        const revenue = parseFloat(item.price || '0') * netQty;
        p.revenue += revenue;
        p.units += netQty;
        p.source.shopify += revenue;
      }
    }

    // Ventas presenciales — items
    for (const v of (ventas || [])) {
      const saleType = v.sale_type || (v.payment_method === 'regalo' ? 'regalo' : 'venta');
      if (saleType === 'regalo') continue;
      for (const item of (v.items || [])) {
        const title = item.productTitle || item.title || 'Sin título';
        const key = normalizeProductKey(title);
        const p = ensureProduct(key, title);
        const qty = item.quantity || 1;
        const revenue = (item.unitPrice || 0) * qty;
        p.revenue += revenue;
        p.units += qty;
        p.source.presencial += revenue;
      }
    }

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 15);

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

    // === TOTALES — fuente de verdad: BANCO BRAND ===
    // El user confirmó (2026-05-03) que TODAS las txs etiquetadas Brand en el banco
    // son ingresos brand legítimos. Por tanto:
    //   - totalIncome = totalBankIncome (lo que entró al banco como Brand)
    //   - Shopify y Presencial son INFORMATIVOS (vista comercial, drill-down)
    //   - Esto cuadra con el dashboard / (macroGroups.brand.income)
    const totalIncome = totalBankIncome;
    const totalExpensesAll = totalBankExpenses + netStripeFees + shopifyRefundAmount;
    const profit = totalIncome - totalExpensesAll;
    const margin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;

    // Diferencia entre teórico (lo que vendimos según POS+Shopify) y real (banco)
    // — cuanto más cerca de 0, mejor cuadra el sistema comercial con el banco.
    const totalIncomeTeorico = shopifyGross + ventasTotal;
    const conciliacionDif = totalIncome - totalIncomeTeorico;

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

    // Detalle de regalos: por cada venta tipo regalo, listar items con coste
    const giftDetail: Array<{ date: string; description: string; productTitle: string; quantity: number; costLoss: number }> = [];
    for (const v of (ventas || [])) {
      const isGift = v.sale_type === 'regalo' || v.payment_method === 'regalo';
      if (!isGift) continue;
      const items = v.items || [];
      const totalCostLoss = parseFloat(v.cost_loss || '0');
      const totalQty = items.reduce((s: number, it: any) => s + (it.quantity || 1), 0) || 1;
      for (const it of items) {
        const qty = it.quantity || 1;
        const allocCost = totalQty > 0 ? (totalCostLoss * qty) / totalQty : 0;
        giftDetail.push({
          date: v.date,
          description: v.customer_name || v.notes || 'Regalo',
          productTitle: it.productTitle || it.title || 'Sin título',
          quantity: qty,
          costLoss: allocCost,
        });
      }
      if (items.length === 0) {
        giftDetail.push({
          date: v.date,
          description: v.customer_name || v.notes || 'Regalo',
          productTitle: 'Sin detalle',
          quantity: 1,
          costLoss: totalCostLoss,
        });
      }
    }

    // ============================================================
    // STOCK VALUATION — usando costes manuales de Supabase
    // ============================================================
    let stockUnits = 0;
    let stockRetailValue = 0;     // ingreso potencial si vendemos todo a PVP
    let stockCostValue = 0;        // inmovilizado real (€ invertidos)
    let stockProductsWithCost = 0;
    let stockProductsWithoutCost = 0;
    const stockTopByValue: Array<{ title: string; units: number; retail: number; cost: number; potentialProfit: number; image: string | null }> = [];

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
          if (cat === 'inmovilizado' || cat === 'preproduccion' || cat === 'archivado') continue; // excluir inmovilizado, preventa y archivados

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
          // Imagen del producto: image.src o images[0].src
          const image = (p.image && p.image.src) || (p.images && p.images[0] && p.images[0].src) || null;
          stockTopByValue.push({
            title: p.title,
            units: prodUnits,
            retail: prodRetail,
            cost: prodCost,
            potentialProfit: prodRetail - prodCost,
            image,
          });
        }
      }
      stockTopByValue.sort((a, b) => b.retail - a.retail);
    } catch (err) {
      console.error('Stock valuation error:', err);
    }

    const stockPotentialProfit = stockRetailValue - stockCostValue;
    const stockPotentialMargin = stockRetailValue > 0 ? (stockPotentialProfit / stockRetailValue) * 100 : 0;

    // Stripe one-time charges (pagos únicos Brand, no suscripciones)
    const stripeOneTimeAmount = stripeChargeDetails.reduce((s, c) => s + (c.amount > 0 ? c.amount : 0), 0);
    const stripeOneTimeCount = stripeChargeDetails.length;

    // ========================================================
    // DESGLOSE Brand: Stripe payouts auto-split (mixed payouts)
    // Para cada Stripe payout, llamar a getPayoutBreakdown y separar Brand vs Diezmo
    // ========================================================
    let stripePayoutsBrandFromMixed = 0;  // one-time embebidos en payouts (incluso si tag Diezmo)
    let stripePayoutsDiezmoFromMixed = 0; // subs reales (referencia)
    let stripePendingBrand = 0;           // one-time aún no liquidados al banco
    const stripePayoutBreakdownDetail: Array<{ payoutId: string; date: string; amount: number; brand: number; diezmo: number; arrived: boolean }> = [];

    try {
      const allPayoutsRange = await getPayouts({ limit: 50, created: { gte: startTimestamp, lte: endTimestamp } });
      const bankPayoutAmounts = bankTxs
        .filter((tx: any) => (tx.concept || '').toLowerCase().includes('transferencia de stripe'))
        .map((tx: any) => ({ amount: parseFloat(tx.amount || '0'), date: tx.date }));

      // Paralelizar las llamadas a getPayoutBreakdown
      const breakdowns = await Promise.all(
        allPayoutsRange.map(async (p) => {
          try {
            const bd = await getPayoutBreakdownLite(p.id);
            return { payout: p, breakdown: bd };
          } catch { return null; }
        })
      );

      for (const item of breakdowns) {
        if (!item) continue;
        const { payout: p, breakdown: bd } = item;
        const arrived = bankPayoutAmounts.some((b: any) => Math.abs(b.amount - p.amount) < 0.5);
        stripePayoutBreakdownDetail.push({
          payoutId: p.id,
          date: p.arrival_date,
          amount: p.amount,
          brand: bd.oneTimeAmount,
          diezmo: bd.subsAmount,
          arrived,
        });
        if (arrived) {
          stripePayoutsBrandFromMixed += bd.oneTimeAmount;
          stripePayoutsDiezmoFromMixed += bd.subsAmount;
        } else {
          stripePendingBrand += bd.oneTimeAmount;
        }
      }
    } catch (e) {
      console.error('Stripe payouts breakdown error:', e);
    }

    // Caja efectivo POS
    const cajaBrandEfectivo = posByMethod.efectivo?.total || 0;

    // Stripe pending balance (saldo no liquidado)
    let stripePendingBalance = 0;
    try {
      const balance = await getBalance();
      stripePendingBalance = balance.pending || 0;
    } catch (e) { /* skip */ }

    // ============================================================
    // SUMA BRAND POR CANAL (todo desglosado para el informe)
    // ============================================================
    const realBrandByChannel = {
      bankBizum: brandBizum,                              // Bizums tag Brand al banco
      bankTransferencia: brandTransferencia,              // Transferencias tag Brand (sin Stripe)
      bankStripePayoutShopify: brandStripePayoutShopify,  // Stripe payouts "Concepto Shopify" tag Brand
      stripePayoutsOneTimeMixed: stripePayoutsBrandFromMixed, // one-time dentro payouts mixed (tag Diezmo)
      stripePending: stripePendingBrand,                   // Brand pendiente en Stripe (no liquidado)
      cajaEfectivo: cajaBrandEfectivo,                     // Efectivo POS en caja
    };
    const realBrandTotal = Object.values(realBrandByChannel).reduce((s: number, v: number) => s + v, 0);

    const teoricoBrandByChannel = {
      posBizum: posByMethod.bizum?.total || 0,
      posEfectivo: posByMethod.efectivo?.total || 0,
      shopifyOnline: shopifyGross,
      stripeOneTime: stripeOneTimeAmount,
    };
    const teoricoBrandTotal = Object.values(teoricoBrandByChannel).reduce((s: number, v: number) => s + v, 0);

    const realVsTeoricoGap = realBrandTotal - teoricoBrandTotal;

    // total ingresos = banco brand. shopify y presencial son drill-down informativo.
    return NextResponse.json({
      income: {
        shopify: shopifyGross,
        shopifyOrders: orders.length,
        shopifyPaidOrders: paidOrders.length,
        ventasPresenciales: ventasTotal,
        ventasCount: (ventas || []).length,
        posByMethod,                       // { bizum: {total, count}, efectivo: {total, count} }
        bankIncome: incomeByTag,
        totalBankIncome,
        stripeOneTime: stripeOneTimeAmount,
        stripeOneTimeCount,
        teorico: totalIncomeTeorico,       // Shopify + Presencial (vista comercial)
        conciliacionDif,                   // banco - teórico (debe ser cercano a 0)
        total: totalIncome,                // = totalBankIncome (banco brand = verdad)
        // DESGLOSE COMPLETO Brand (real vs teórico por canal)
        realBrandByChannel,
        realBrandTotal,
        teoricoBrandByChannel,
        teoricoBrandTotal,
        realVsTeoricoGap,
        stripePayoutBreakdownDetail,
        stripePendingBalance,
        // Pendientes de pago (vendido pero no cobrado)
        pendientePagoTotal,
        pendientePagoDetail,
        // Caja efectivo desglosada por producto
        cajaEfectivoByProduct,
        // Ventas históricas Shopify por colección trazable (sin filtro de rango)
        historicalSalesByCollection,
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
      giftDetail,
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
