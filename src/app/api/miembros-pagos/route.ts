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
    const [membersRes, paymentsRes, bankTxsRes, bankRulesRes, stripeSubs, stripeCharges] = await Promise.all([
      supabase.from('diezmos_members').select('*').order('name'),
      supabase.from('diezmos_payments').select('*'),
      supabase.from('bank_transactions').select('*')
        .gte('date', startDate).lte('date', endDate)
        .or('is_diezmo.eq.true,manual_tag.eq.Diezmo,auto_tag.eq.Diezmo')
        .order('date', { ascending: false }),
      supabase.from('diezmos_bank_rules').select('*'),
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
    const bankRules = bankRulesRes.data || [];

    // Normalización correcta (rango unicode escapado)
    function normalize(s: string) {
      return (s || '').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Nombres de pila comunes y conectores (no cuentan como apellidos identificadores)
    const COMMON_NAMES = new Set([
      'maria', 'jose', 'juan', 'pedro', 'ana', 'manuel', 'antonio', 'francisco',
      'carlos', 'jesus', 'luis', 'miguel', 'angel', 'rafael', 'pablo', 'alejandro',
      'david', 'javier', 'jorge', 'ignacio', 'andres', 'fernando', 'alberto', 'raul',
      'sergio', 'ruben', 'oscar', 'marco', 'marcos', 'gonzalo', 'enrique', 'eduardo',
      'ricardo', 'roberto', 'cristina', 'laura', 'isabel', 'patricia', 'sonia',
      'carmen', 'lucia', 'sara', 'elena', 'paula', 'andrea', 'sofia', 'monica',
      'silvia', 'natalia', 'beatriz', 'rocio', 'marta', 'pilar', 'teresa', 'angela',
      'concepcion', 'lucia', 'claudia', 'salvador', 'bruno', 'stephanie', 'rodrigo',
      'guillermo', 'guillem', 'elisabet', 'eli', 'mariana', 'martin', 'martina',
      'ines', 'irene', 'celia', 'blanca', 'nieves', 'ginebra', 'oriana', 'mariana',
      'mencia', 'macarena', 'leticia', 'gloria', 'vanesa', 'valeria', 'veronica',
      // conectores
      'de', 'del', 'la', 'el', 'los', 'las', 'san', 'santa', 'concepto', 'transferencia',
      'bizum', 'transfer', 'recibo', 'compra', 'pago', 'diezmo', 'donativo', 'misiones',
      'semana', 'cena', 'tabor', 'misa', 'comida', 'subscription', 'update', 'apizz',
      'camiseta', 'apixx',
    ]);

    function getSurnames(name: string): string[] {
      // Devuelve tokens >2 chars que NO sean nombres comunes ni conectores
      return normalize(name).split(' ')
        .filter(w => w.length > 2)
        .filter(w => !COMMON_NAMES.has(w));
    }

    /**
     * Match MUY estricto: TODOS los apellidos no-comunes del miembro deben
     * estar en el concepto. Evita confundir Mencía Pérez de Leza con
     * Garvía Pérez Gonzalo.
     */
    function fuzzy(memberName: string, conceptText: string): boolean {
      if (!memberName || !conceptText) return false;
      const memberSurnames = getSurnames(memberName);
      const conceptTokens = new Set(normalize(conceptText).split(' ').filter(w => w.length > 2));

      if (memberSurnames.length >= 1) {
        // TODOS los apellidos deben estar
        return memberSurnames.every(s => conceptTokens.has(s));
      }

      const fullNorm = normalize(memberName);
      const conceptNorm = normalize(conceptText);
      return conceptNorm.includes(fullNorm);
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

    // Transferencias bancarias diezmo SIN miembro asignado
    const matchedBankIds = new Set<string>();
    for (const m of result) {
      for (const h of m.history) {
        if (h.source === 'banco') {
          // No tenemos id de tx en history, no podemos rastrear. Mejor recorrer bankTxs
        }
      }
    }
    const unmatchedBank = bankTxs.filter((tx: any) => {
      if (parseFloat(tx.amount) <= 0) return false;
      const concept = (tx.concept || '').toLowerCase();
      // Excluir payouts agregados de Stripe (ya contabilizados vía Stripe API por miembro)
      if (concept.includes('stripe')) return false;
      const txText = (tx.member_name || '') + ' ' + (tx.concept || '');
      const matched = result.some(r => fuzzy(r.name, txText) || (r.apodo && fuzzy(r.apodo, txText)));
      return !matched;
    }).map((tx: any) => ({
      id: tx.id,
      date: tx.date,
      concept: tx.concept,
      memberName: tx.member_name,
      amount: parseFloat(tx.amount),
    }));

    // Para la TABLA DE MATCHING: recolectar todos los nombres bancarios distintos
    // que aparecen en transacciones diezmo (para el lookup manual)
    const distinctBankNames = new Map<string, { name: string; count: number; lastDate: string; sample: string }>();
    for (const tx of bankTxs) {
      if (parseFloat(tx.amount) <= 0) continue;
      const concept = (tx.concept || '').replace(/\s+/g, ' ').trim();
      // Extraer nombre del tipo "Transferencia De X Y, Concepto..." o "Bizum De X Y Concepto..."
      const match = concept.match(/(?:transferencia\s+de|bizum\s+de)\s+([^,.]+?)(?:\s+concepto|\s+nº|,|$)/i);
      if (!match) continue;
      const personName = match[1].trim();
      if (personName.toLowerCase().includes('stripe')) continue;
      const key = personName.toLowerCase();
      const existing = distinctBankNames.get(key);
      if (existing) {
        existing.count++;
        if (tx.date > existing.lastDate) existing.lastDate = tx.date;
      } else {
        distinctBankNames.set(key, { name: personName, count: 1, lastDate: tx.date, sample: concept.slice(0, 100) });
      }
    }
    const bankNamesList = Array.from(distinctBankNames.values()).sort((a, b) => b.count - a.count);

    // Customers Stripe distintos (con sus charges agregados)
    const distinctStripeCustomers = new Map<string, { customerId: string | null; customerName: string; customerEmail: string | null; chargeCount: number; total: number; subscriptionId?: string; isSubscription?: boolean }>();
    for (const c of stripeCharges as any[]) {
      if (!c.paid || c.refunded) continue;
      const key = c.customerEmail || c.customerName || 'unknown';
      const existing = distinctStripeCustomers.get(key);
      if (existing) {
        existing.chargeCount++;
        existing.total += (c.amount - (c.amountRefunded || 0));
      } else {
        distinctStripeCustomers.set(key, {
          customerId: c.customerId || null,
          customerName: c.customerName || 'Invitado',
          customerEmail: c.customerEmail || null,
          chargeCount: 1,
          total: c.amount - (c.amountRefunded || 0),
          isSubscription: !!c.isSubscription,
        });
      }
    }
    // Añadir subs activas que quizá no tienen charges en el rango
    for (const s of stripeSubs) {
      const key = s.customerEmail || s.customerName || s.id;
      if (!distinctStripeCustomers.has(key)) {
        distinctStripeCustomers.set(key, {
          customerId: s.customerId || null,
          customerName: s.customerName || 'Invitado',
          customerEmail: s.customerEmail || null,
          chargeCount: 0,
          total: 0,
          subscriptionId: s.id,
          isSubscription: true,
        });
      } else {
        const e = distinctStripeCustomers.get(key)!;
        e.subscriptionId = s.id;
        e.isSubscription = true;
      }
    }
    const stripeCustomersList = Array.from(distinctStripeCustomers.values()).sort((a, b) => b.total - a.total);

    return NextResponse.json({
      members: result,
      byCommunity: Array.from(byCommunity.entries()).map(([name, data]) => ({ community: name, ...data })),
      unmatchedSubs,
      unmatchedBank,
      bankRules,
      bankNamesList,
      stripeCustomersList,
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
