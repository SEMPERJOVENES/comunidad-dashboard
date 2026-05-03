import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSubscriptions, getAllCharges } from '@/lib/stripe';

/**
 * Endpoint que muestra POR MIEMBRO cómo paga su diezmo.
 * Cruza:
 *  - diezmos_members (lista oficial de miembros)
 *  - diezmos_payments (histórico Supabase)
 *  - bank_transactions con tag Diezmo (Bizum / Transferencia / Stripe payouts)
 *  - Stripe subscriptions activas (recurrencias)
 *  - Stripe charges (cargos puntuales / mensuales del miembro)
 *
 * Devuelve para cada miembro:
 *  - paymentMethods: { stripe: bool, bizum: bool, transferencia: bool }
 *  - methodPrimary: el más usado
 *  - stripeStatus: active/none + amount + interval
 *  - bizumCount + transferCount + bizumTotal + transferTotal
 *  - lastPayment, lastMethod
 *  - allPayments: lista cronológica (date, amount, method, source)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start') || '2024-01-01T00:00:00Z';
    const end = searchParams.get('end') || new Date().toISOString();

    const startDate = start.split('T')[0];
    const endDate = end.split('T')[0];

    // 1. Miembros + payments + bank txs Diezmo + Stripe subs
    const [membersRes, paymentsRes, bankTxsRes, stripeSubs, stripeCharges] = await Promise.all([
      supabase.from('diezmos_members').select('*').order('name'),
      supabase.from('diezmos_payments').select('*'),
      supabase.from('bank_transactions').select('*')
        .gte('date', startDate).lte('date', endDate)
        .or('is_diezmo.eq.true,manual_tag.eq.Diezmo,auto_tag.eq.Diezmo')
        .order('date', { ascending: false }),
      getSubscriptions({ status: 'active', limit: 100 }).catch(() => []),
      getAllCharges({
        created: {
          gte: Math.floor(new Date(start).getTime() / 1000),
          lte: Math.floor(new Date(end).getTime() / 1000),
        },
      }).catch(() => []),
    ]);

    const members = membersRes.data || [];
    const allPayments = paymentsRes.data || [];
    const bankTxs = bankTxsRes.data || [];

    // Función fuzzy para nombres
    function normalize(s: string) {
      return (s || '').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9 ]/g, '').trim();
    }
    function fuzzy(a: string, b: string): boolean {
      const na = normalize(a), nb = normalize(b);
      if (!na || !nb) return false;
      const wa = na.split(' ').filter(w => w.length > 2);
      const wb = nb.split(' ').filter(w => w.length > 2);
      // Al menos 2 palabras de >2 chars en común
      let matches = 0;
      for (const x of wa) for (const y of wb) if (x === y) matches++;
      return matches >= Math.min(2, Math.min(wa.length, wb.length));
    }

    // Clasificar tipo de tx bancaria
    function classifyMethod(concept: string): 'bizum' | 'transferencia' | 'stripe' | 'otro' {
      const c = (concept || '').toLowerCase();
      if (c.includes('bizum')) return 'bizum';
      if (c.includes('stripe')) return 'stripe';
      if (c.includes('transferencia') || c.includes('transfer')) return 'transferencia';
      return 'otro';
    }

    // Construir resultado por miembro
    const result = members.map((m: any) => {
      // Stripe sub activo
      const stripeSub = stripeSubs.find((s: any) =>
        (m.stripe_customer_id && s.customerId === m.stripe_customer_id) ||
        (m.stripe_customer_email && s.customerEmail?.toLowerCase() === m.stripe_customer_email?.toLowerCase()) ||
        (m.email && s.customerEmail?.toLowerCase() === m.email?.toLowerCase()) ||
        fuzzy(m.name, s.customerName || '')
      );

      // Stripe charges del miembro
      const memberCharges = stripeCharges.filter((c: any) =>
        (m.stripe_customer_email && c.customerEmail?.toLowerCase() === m.stripe_customer_email?.toLowerCase()) ||
        (m.email && c.customerEmail?.toLowerCase() === m.email?.toLowerCase()) ||
        fuzzy(m.name, c.customerName || '')
      );

      // Bank txs del miembro (por nombre o member_name)
      const memberBankTxs = bankTxs.filter((tx: any) => {
        if (parseFloat(tx.amount) <= 0) return false;
        const txName = (tx.member_name || '') + ' ' + (tx.concept || '');
        return fuzzy(m.name, txName) ||
          (m.apodo && fuzzy(m.apodo, txName));
      });

      // Histórico Supabase
      const memberHistorical = allPayments.filter((p: any) => p.member_id === m.id);

      // Clasificar pagos
      const byMethod = { bizum: { count: 0, total: 0 }, transferencia: { count: 0, total: 0 }, stripe: { count: 0, total: 0 }, otro: { count: 0, total: 0 } };
      const allEntries: Array<{ date: string; amount: number; method: string; source: string; concept?: string | null }> = [];

      // Bank txs
      for (const tx of memberBankTxs) {
        const m_ = classifyMethod(tx.concept || '');
        const amt = parseFloat(tx.amount);
        byMethod[m_].count++;
        byMethod[m_].total += amt;
        allEntries.push({ date: tx.date, amount: amt, method: m_, source: 'banco', concept: tx.concept });
      }

      // Stripe charges
      for (const c of memberCharges) {
        if (!c.paid || c.refunded) continue;
        const amt = c.amount - (c.amountRefunded || 0);
        byMethod.stripe.count++;
        byMethod.stripe.total += amt;
        allEntries.push({
          date: c.created.split('T')[0],
          amount: amt,
          method: 'stripe',
          source: c.isSubscription ? 'stripe-sub' : 'stripe-onetime',
          concept: c.description,
        });
      }

      allEntries.sort((a, b) => b.date.localeCompare(a.date));

      // Determinar método primary (el de mayor total)
      const methodEntries = Object.entries(byMethod).filter(([, v]) => v.count > 0);
      const methodPrimary = methodEntries.length > 0
        ? methodEntries.sort(([, a], [, b]) => b.total - a.total)[0][0]
        : (stripeSub ? 'stripe' : 'sin pagos');

      const totalPaid = Object.values(byMethod).reduce((s, v) => s + v.total, 0);
      const lastEntry = allEntries[0];

      return {
        id: m.id,
        name: m.name,
        apodo: m.apodo,
        community: m.community || 'Sin comunidad',
        email: m.email,
        isActive: m.is_active !== false,
        pairedWith: m.paired_with_member_id,

        // Métodos
        methods: {
          stripe: {
            count: byMethod.stripe.count,
            total: byMethod.stripe.total,
            subscriptionActive: !!stripeSub,
            subscriptionAmount: stripeSub?.amount || m.stripe_amount || null,
            subscriptionInterval: stripeSub?.interval || m.stripe_interval || null,
            email: stripeSub?.customerEmail || m.stripe_customer_email,
          },
          bizum: { count: byMethod.bizum.count, total: byMethod.bizum.total },
          transferencia: { count: byMethod.transferencia.count, total: byMethod.transferencia.total },
        },

        methodPrimary,
        totalPaid,
        paymentCount: allEntries.length,
        lastPayment: lastEntry ? { date: lastEntry.date, amount: lastEntry.amount, method: lastEntry.method } : null,
        history: allEntries.slice(0, 50),
      };
    });

    // Agregados por comunidad
    const byCommunity = new Map<string, { members: number; totalPaid: number; paying: number }>();
    for (const m of result) {
      if (!byCommunity.has(m.community)) byCommunity.set(m.community, { members: 0, totalPaid: 0, paying: 0 });
      const c = byCommunity.get(m.community)!;
      c.members++;
      c.totalPaid += m.totalPaid;
      if (m.totalPaid > 0 || m.methods.stripe.subscriptionActive) c.paying++;
    }

    // Stripe subs sin matchear a ningún miembro
    const matchedSubIds = new Set(result.filter(r => r.methods.stripe.subscriptionActive).map(r => r.email || r.id));
    const unmatchedSubs = stripeSubs.filter((s: any) => {
      const matched = result.some(r =>
        r.methods.stripe.subscriptionActive &&
        ((r.methods.stripe.email && r.methods.stripe.email.toLowerCase() === s.customerEmail?.toLowerCase()) ||
         fuzzy(r.name, s.customerName || ''))
      );
      return !matched;
    });

    return NextResponse.json({
      members: result,
      byCommunity: Array.from(byCommunity.entries()).map(([name, data]) => ({ community: name, ...data })),
      unmatchedSubs,
      totals: {
        members: result.length,
        paying: result.filter(r => r.totalPaid > 0).length,
        stripeActive: result.filter(r => r.methods.stripe.subscriptionActive).length,
        totalRecaudado: result.reduce((s, r) => s + r.totalPaid, 0),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
