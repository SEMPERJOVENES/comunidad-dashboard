import { NextRequest, NextResponse } from 'next/server';
import { getAllOrders } from '@/lib/shopify';
import { supabase } from '@/lib/supabase';

/**
 * Conciliación bancaria: comparar ingresos TEÓRICOS (Shopify + ventas presenciales)
 * con ingresos REALES del banco (bank_transactions con tag "Brand").
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start') || '2026-01-01T00:00:00Z';
    const end = searchParams.get('end') || new Date().toISOString();

    const startDate = start.split('T')[0];
    const endDate = end.split('T')[0];

    // 1. Shopify orders
    const orders = await getAllOrders({ created_at_min: start, created_at_max: end, status: 'any' });

    // 2. Ventas presenciales
    const { data: ventas } = await supabase
      .from('ventas_presenciales')
      .select('*')
      .gte('date', start)
      .lte('date', end);

    // 3. Bank transactions con tag categoría brand
    const { data: tagCats } = await supabase.from('tag_categories').select('name, macro_group');
    const brandTags = new Set<string>(
      (tagCats || []).filter(tc => tc.macro_group === 'brand').map(tc => tc.name)
    );

    const { data: bankTxs } = await supabase
      .from('bank_transactions').select('*')
      .gte('date', startDate).lte('date', endDate);

    // 4. Agrupar por mes
    interface MonthData {
      month: string;
      teorico: { shopify: number; ventas: number; total: number; orders: number; ventasCount: number };
      real: { bizum: number; transferencia: number; stripePayout: number; total: number; txs: number };
      diferencia: number;
      pct: number;
      detalle: {
        shopifyOrders: Array<{ name: string; total: number; date: string; financial_status: string }>;
        ventas: Array<{ id: string; customer: string; total: number; date: string; method: string; saleType: string }>;
        bankBrand: Array<{ id: string; concept: string; amount: number; date: string; tag: string }>;
      };
    }

    const map = new Map<string, MonthData>();
    function getMonth(m: string): MonthData {
      if (!map.has(m)) {
        map.set(m, {
          month: m,
          teorico: { shopify: 0, ventas: 0, total: 0, orders: 0, ventasCount: 0 },
          real: { bizum: 0, transferencia: 0, stripePayout: 0, total: 0, txs: 0 },
          diferencia: 0, pct: 0,
          detalle: { shopifyOrders: [], ventas: [], bankBrand: [] },
        });
      }
      return map.get(m)!;
    }

    for (const o of orders) {
      const m = o.created_at.substring(0, 7);
      const md = getMonth(m);
      const total = parseFloat(o.total_price || '0');
      // Excluir refunded
      if (o.financial_status === 'refunded') continue;
      md.teorico.shopify += total;
      md.teorico.orders += 1;
      md.detalle.shopifyOrders.push({
        name: o.name || '',
        total, date: o.created_at,
        financial_status: o.financial_status || '',
      });
    }

    for (const v of (ventas || [])) {
      const m = new Date(v.date).toISOString().substring(0, 7);
      const md = getMonth(m);
      const total = parseFloat(v.total_amount || '0');
      const saleType = v.sale_type || (v.payment_method === 'regalo' ? 'regalo' : 'venta');
      // Regalos no cuentan como ingreso teórico
      if (saleType === 'regalo' || v.payment_method === 'regalo') continue;
      md.teorico.ventas += total;
      md.teorico.ventasCount += 1;
      md.detalle.ventas.push({
        id: v.id, customer: v.customer_name, total,
        date: v.date, method: v.payment_method, saleType,
      });
    }

    for (const tx of (bankTxs || [])) {
      const m = tx.date.substring(0, 7);
      const md = getMonth(m);
      const tag = tx.manual_tag || tx.auto_tag || '';
      const amount = parseFloat(tx.amount || '0');
      if (amount <= 0) continue; // solo ingresos
      const conceptLower = (tx.concept || '').toLowerCase();
      const isBrandRelated =
        brandTags.has(tag) ||
        conceptLower.includes('stripe') ||
        conceptLower.includes('shopify');
      if (!isBrandRelated) continue;

      // Clasificar tipo
      if (conceptLower.includes('stripe')) md.real.stripePayout += amount;
      else if (conceptLower.includes('bizum')) md.real.bizum += amount;
      else md.real.transferencia += amount;

      md.real.total += amount;
      md.real.txs += 1;
      md.detalle.bankBrand.push({
        id: tx.id, concept: tx.concept, amount,
        date: tx.date, tag,
      });
    }

    // Calcular totales y diferencias
    const months = Array.from(map.values()).map(md => {
      md.teorico.total = md.teorico.shopify + md.teorico.ventas;
      md.diferencia = md.teorico.total - md.real.total;
      md.pct = md.teorico.total > 0 ? (md.diferencia / md.teorico.total) * 100 : 0;
      return md;
    }).sort((a, b) => a.month.localeCompare(b.month));

    // Totales globales
    const totals = months.reduce((acc, m) => ({
      teoricoShopify: acc.teoricoShopify + m.teorico.shopify,
      teoricoVentas: acc.teoricoVentas + m.teorico.ventas,
      realBizum: acc.realBizum + m.real.bizum,
      realTransfer: acc.realTransfer + m.real.transferencia,
      realStripe: acc.realStripe + m.real.stripePayout,
      realTotal: acc.realTotal + m.real.total,
      teoricoTotal: acc.teoricoTotal + m.teorico.total,
    }), {
      teoricoShopify: 0, teoricoVentas: 0,
      realBizum: 0, realTransfer: 0, realStripe: 0, realTotal: 0,
      teoricoTotal: 0,
    });

    return NextResponse.json({ months, totals });
  } catch (error: any) {
    console.error('Conciliación API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
