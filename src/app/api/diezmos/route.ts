import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSubscriptions, getInvoices, getAllCharges, getAllBalanceTransactions } from '@/lib/stripe';

function normalize(name: string) {
  return (name || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Nombres comunes que NO sirven como identificador \u00fanico (solo apellidos importan)
const COMMON_NAMES = new Set([
  'maria', 'jose', 'juan', 'pedro', 'ana', 'manuel', 'antonio', 'francisco',
  'carlos', 'jesus', 'luis', 'miguel', 'angel', 'rafael', 'pablo', 'alejandro',
  'david', 'javier', 'jorge', 'ignacio', 'andres', 'fernando', 'alberto', 'raul',
  'sergio', 'ruben', 'oscar', 'marco', 'marcos', 'gonzalo', 'enrique', 'eduardo',
  'ricardo', 'roberto', 'cristina', 'laura', 'isabel', 'patricia', 'sonia',
  'carmen', 'lucia', 'sara', 'elena', 'paula', 'andrea', 'sofia', 'monica',
  'silvia', 'natalia', 'beatriz', 'rocio', 'marta', 'pilar', 'teresa', 'angela',
  'concepcion', 'claudia', 'salvador', 'bruno', 'stephanie', 'rodrigo',
  'guillermo', 'guillem', 'elisabet', 'eli', 'mariana', 'martin', 'martina',
  'ines', 'irene', 'celia', 'blanca', 'nieves', 'ginebra', 'oriana',
  'mencia', 'macarena', 'leticia', 'gloria', 'vanesa', 'valeria', 'veronica',
  'de', 'del', 'la', 'el', 'los', 'las', 'san', 'santa', 'concepto', 'transferencia',
  'bizum', 'transfer', 'recibo', 'compra', 'pago', 'diezmo', 'donativo', 'misiones',
  'semana', 'cena', 'tabor', 'misa', 'comida', 'subscription', 'update', 'apizz',
  'camiseta', 'apixx', 'favor', 'concepto', 'misiones',
]);

function getSurnames(name: string): string[] {
  return normalize(name).split(' ')
    .filter(w => w.length > 2)
    .filter(w => !COMMON_NAMES.has(w));
}

function getFirstName(name: string): string | null {
  // Primer token significativo (el nombre de pila, aunque sea com\u00fan)
  const tokens = normalize(name).split(' ').filter(w => w.length > 2);
  return tokens.length > 0 ? tokens[0] : null;
}

/**
 * Match MUY estricto:
 *  - Si tiene 2+ apellidos no comunes: exigir TODOS los apellidos.
 *  - Si tiene 1 apellido no com\u00fan: exigir APELLIDO + NOMBRE DE PILA (aunque el
 *    nombre sea com\u00fan). Esto distingue Patricia Hidalgo de Blanca Hidalgo (ambas
 *    son hermanas con apellido "Hidalgo"), o Paula S\u00e1nchez de Agust\u00edn S\u00e1nchez.
 *  - Sin apellidos no comunes: exige nombre completo contenido.
 */
function fuzzyNameMatch(memberName: string, candidateText: string): boolean {
  if (!memberName || !candidateText) return false;
  const memberSurnames = getSurnames(memberName);
  const candidateTokens = new Set(normalize(candidateText).split(' ').filter(w => w.length > 2));

  if (memberSurnames.length >= 2) {
    return memberSurnames.every(s => candidateTokens.has(s));
  }
  if (memberSurnames.length === 1) {
    const firstName = getFirstName(memberName);
    if (!firstName) return false;
    // Exigir apellido + nombre de pila simult\u00e1neamente
    return candidateTokens.has(memberSurnames[0]) && candidateTokens.has(firstName);
  }
  const fullNorm = normalize(memberName);
  return normalize(candidateText).includes(fullNorm);
}

function getMonthKey(date: string | Date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function GET(request: import('next/server').NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    const startDate = startParam ? new Date(startParam).toISOString().split('T')[0] : null;
    const endDate = endParam ? new Date(endParam).toISOString().split('T')[0] : null;

    // Corte mínimo absoluto: 2026-01-01. No procesamos pagos previos.
    const ABSOLUTE_MIN_DATE = '2026-01-01';
    const ABSOLUTE_MIN_TS = Math.floor(new Date(ABSOLUTE_MIN_DATE).getTime() / 1000);
    const requestedStartTs = startParam ? Math.floor(new Date(startParam).getTime() / 1000) : ABSOLUTE_MIN_TS;
    const stripeStartTs = Math.max(requestedStartTs, ABSOLUTE_MIN_TS);
    const stripeEndTs = endParam ? Math.floor(new Date(endParam).getTime() / 1000) : Math.floor(Date.now() / 1000);

    const effectiveStartDate = startDate && startDate > ABSOLUTE_MIN_DATE ? startDate : ABSOLUTE_MIN_DATE;

    // Build bank diezmo query (need to prepare before Promise.all)
    let bankDiezmosQuery = supabase
      .from('bank_transactions')
      .select('*')
      .or('is_diezmo.eq.true,manual_tag.eq.Diezmo,auto_tag.eq.Diezmo')
      .not('concept', 'ilike', '%stripe%')
      .gte('date', effectiveStartDate);
    if (endDate) bankDiezmosQuery = bankDiezmosQuery.lte('date', endDate);

    // ══════════════════════════════════════════════════════════════════
    // PHASE 1: ALL I/O in parallel (DB + Stripe + Bank)
    // ══════════════════════════════════════════════════════════════════
    const [
      { data: membersData, error: membersErr },
      { data: commData, error: commErr },
      { data: paymentsData, error: paymentsErr },
      { data: bankRulesData },
      { data: tagCatsData },
      { data: bankDiezmos },
      stripeSubs,
      stripeInvoices,
      stripeCharges,
      balanceTxs,
    ] = await Promise.all([
      // DB queries
      supabase.from('diezmos_members').select('*').order('name'),
      supabase.from('diezmos_communities').select('*').order('name'),
      supabase.from('diezmos_payments').select('*'),
      supabase.from('diezmos_bank_rules').select('*'),
      supabase.from('tag_categories').select('name, macro_group'),
      bankDiezmosQuery,
      // Stripe API calls (all in parallel!)
      getSubscriptions({ status: 'active', limit: 100 }).catch(() => [] as any[]),
      getInvoices({ created: { gte: stripeStartTs, lte: stripeEndTs }, status: 'paid', limit: 100 }).catch(() => [] as any[]),
      getAllCharges({ created: { gte: stripeStartTs, lte: stripeEndTs } }).catch(() => [] as any[]),
      getAllBalanceTransactions({ created: { gte: stripeStartTs, lte: stripeEndTs } }).catch(() => [] as any[]),
    ]);
    if (membersErr) throw membersErr;
    if (commErr) throw commErr;
    if (paymentsErr) throw paymentsErr;

    const communities = (commData || []).map((c: any) => c.name);
    const bankRules = bankRulesData || [];

    // Index payments by member_id for O(1) lookup instead of O(n) filter
    const paymentsByMember: Record<string, any[]> = {};
    for (const p of (paymentsData || [])) {
      if (!paymentsByMember[p.member_id]) paymentsByMember[p.member_id] = [];
      paymentsByMember[p.member_id].push(p);
    }

    // Index bank rules by member_id
    const rulesByMember: Record<string, any[]> = {};
    for (const r of bankRules) {
      if (!rulesByMember[r.member_id]) rulesByMember[r.member_id] = [];
      rulesByMember[r.member_id].push(r);
    }

    // Build members array (using indexed lookups)
    const members = (membersData || []).map((m: any) => {
      const memberPayments: Record<string, { amount: number; source: string; splitPair?: boolean; originalAmount?: number }> = {};
      for (const p of (paymentsByMember[m.id] || [])) {
        memberPayments[p.month] = { amount: parseFloat(p.amount), source: p.source };
      }
      const memberBankRules = (rulesByMember[m.id] || []).map((r: any) => ({
        id: r.id,
        pattern: r.pattern,
      }));
      return {
        id: m.id,
        name: m.name,
        nickname: m.apodo || null,
        community: m.community,
        email: m.email,
        phone: m.phone || null,
        fechaNacimiento: m.fecha_nacimiento || null,
        isActive: m.is_active,
        stripeCustomerId: m.stripe_customer_id || null,
        stripeCustomerEmail: m.stripe_customer_email || null,
        stripeSubscriptionId: m.stripe_subscription_id,
        stripeAmount: m.stripe_amount ? parseFloat(m.stripe_amount) : null,
        stripeInterval: m.stripe_interval,
        paymentFrequency: m.payment_frequency || 'mensual',
        pairedWith: m.paired_with_member_id || null,
        payments: memberPayments,
        bankRules: memberBankRules,
      };
    });

    // Collect all DB writes to batch at the end
    const memberUpdates: { id: string; data: any }[] = [];
    const paymentUpserts: any[] = [];

    // ══════════════════════════════════════════════════════════════════
    // PHASE 2: CPU-only matching (no await, no I/O)
    // ══════════════════════════════════════════════════════════════════

    // ── Match Stripe subs → members ──────────────────────────────────
    const matchedSubIds = new Set<string>();
    const unmatchedStripeSubscribers: any[] = [];

    for (const sub of stripeSubs) {
      const customerId = sub.customerId || '';
      const subEmail = (sub.customerEmail || '').toLowerCase();

      let matched = members.find((m: any) => m.stripeCustomerId && m.stripeCustomerId === customerId);
      if (!matched) matched = members.find((m: any) => m.stripeCustomerEmail && m.stripeCustomerEmail.toLowerCase() === subEmail && subEmail);
      if (!matched) matched = members.find((m: any) => m.email && m.email.toLowerCase() === subEmail && subEmail);
      if (!matched) matched = members.find((m: any) => m.stripeSubscriptionId === sub.id);
      if (!matched) {
        const custName = sub.customerName || '';
        matched = members.find((m: any) => {
          if (fuzzyNameMatch(m.name, custName)) return true;
          if (m.nickname && fuzzyNameMatch(m.nickname, custName)) return true;
          return false;
        });
      }

      if (matched) {
        matched.stripeSubscriptionId = sub.id;
        matched.stripeAmount = sub.amount;
        matched.stripeInterval = sub.interval;
        matched.stripeCustomerId = customerId;
        matched.stripeCustomerEmail = sub.customerEmail || matched.stripeCustomerEmail;
        matched.email = sub.customerEmail || matched.email;
        matched.isActive = true;
        matchedSubIds.add(sub.id);

        // Queue DB update (no await!)
        memberUpdates.push({
          id: matched.id,
          data: {
            stripe_subscription_id: sub.id,
            stripe_amount: sub.amount,
            stripe_interval: sub.interval,
            stripe_customer_id: customerId,
            stripe_customer_email: sub.customerEmail || matched.email,
            email: sub.customerEmail || matched.email,
            is_active: true,
          },
        });
      } else {
        unmatchedStripeSubscribers.push({
          subscriptionId: sub.id,
          customerId,
          customerName: sub.customerName,
          customerEmail: sub.customerEmail,
          amount: sub.amount,
          interval: sub.interval,
          productName: sub.productName,
        });
      }
    }

    // ── Match Stripe invoices → member payments ──────────────────────
    for (const inv of stripeInvoices) {
      if (inv.amount <= 0) continue;

      let matched = members.find((m: any) =>
        m.stripeSubscriptionId && inv.subscriptionId === m.stripeSubscriptionId
      );
      if (!matched) {
        const invEmail = (inv.customerEmail || '').toLowerCase();
        matched = members.find((m: any) => {
          if (m.stripeCustomerEmail && m.stripeCustomerEmail.toLowerCase() === invEmail) return true;
          if (m.email && m.email.toLowerCase() === invEmail) return true;
          const custName = inv.customerName || '';
          if (fuzzyNameMatch(m.name, custName)) return true;
          if (m.nickname && fuzzyNameMatch(m.nickname, custName)) return true;
          return false;
        });
      }

      if (matched) {
        const startMonthKey = getMonthKey(inv.periodStart || inv.created);
        const isAnnual = matched.stripeInterval === 'year' || (inv.amount >= 100 && (inv.description || '').toLowerCase().includes('year'));

        if (isAnnual) {
          // Distribuir el invoice anual entre 12 meses desde periodStart
          const monthly = inv.amount / 12;
          const startDate = new Date(inv.periodStart || inv.created);
          for (let i = 0; i < 12; i++) {
            const mDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
            const monthKey = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, '0')}`;
            const existing = matched.payments[monthKey];
            const newSource = existing ? (existing.source === 'banco' ? 'ambos' : 'stripe-anual') : 'stripe-anual';
            const newAmount = existing ? existing.amount + monthly : monthly;
            matched.payments[monthKey] = { amount: newAmount, source: newSource };
            paymentUpserts.push({
              id: `dp-stripe-anual-${matched.id}-${monthKey}`,
              member_id: matched.id,
              month: monthKey,
              amount: newAmount,
              source: newSource,
            });
          }
        } else {
          const existing = matched.payments[startMonthKey];
          if (!existing || existing.source !== 'stripe') {
            const newSource = existing ? (existing.source === 'banco' ? 'ambos' : 'stripe') : 'stripe';
            const newAmount = existing ? existing.amount + inv.amount : inv.amount;
            matched.payments[startMonthKey] = { amount: newAmount, source: newSource };
            paymentUpserts.push({
              id: `dp-stripe-${matched.id}-${startMonthKey}`,
              member_id: matched.id,
              month: startMonthKey,
              amount: newAmount,
              source: newSource,
            });
          }
        }
      }
    }

    // ── Stripe charges (brand sales separation + member matching) ────
    let totalStripeCollected = 0;
    const brandSales: { amount: number; customerName: string; customerEmail: string; created: string; description: string }[] = [];
    let totalBrandSales = 0;

    for (const charge of stripeCharges) {
      if (!charge.paid || charge.refunded || charge.amount <= 0) continue;
      totalStripeCollected += charge.amount;

      const isSubscription = (charge.description || '').toLowerCase().includes('subscription');
      const isGuest = !charge.customerName && !charge.customerEmail;

      if (!isSubscription && isGuest) {
        brandSales.push({
          amount: charge.amount,
          customerName: charge.customerName || 'Invitado',
          customerEmail: charge.customerEmail || '',
          created: charge.created,
          description: charge.description || '',
        });
        totalBrandSales += charge.amount;
        continue;
      }

      const matched = members.find((m: any) => {
        if (!charge.customerName && !charge.customerEmail) return false;
        const chargeEmail = (charge.customerEmail || '').toLowerCase();
        if (m.stripeCustomerEmail && m.stripeCustomerEmail.toLowerCase() === chargeEmail) return true;
        if (m.email && m.email.toLowerCase() === chargeEmail) return true;
        const custName = charge.customerName || '';
        if (fuzzyNameMatch(m.name, custName)) return true;
        if (m.nickname && fuzzyNameMatch(m.nickname, custName)) return true;
        return false;
      });

      if (matched) {
        const monthKey = getMonthKey(charge.created);
        const existing = matched.payments[monthKey];
        if (!existing) {
          matched.payments[monthKey] = { amount: charge.amount, source: 'stripe' };
          paymentUpserts.push({
            id: `dp-charge-${matched.id}-${monthKey}`,
            member_id: matched.id,
            month: monthKey,
            amount: charge.amount,
            source: 'stripe',
          });
        }
      }
    }

    // ── Stripe commission (distributed by month) ─────────────────────
    let stripeCommission = 0;
    let totalStripeTransferred = 0;
    const feeByMonth: Record<string, number> = {};
    for (const tx of balanceTxs) {
      if (tx.type === 'charge') {
        stripeCommission += tx.fee;
        const txMonth = getMonthKey(tx.created);
        feeByMonth[txMonth] = (feeByMonth[txMonth] || 0) + tx.fee;
      }
      if (tx.type === 'payout') totalStripeTransferred += Math.abs(tx.amount);
    }

    // ── Match bank transactions → members ────────────────────────────
    const unmatchedBankTransfers: any[] = [];

    for (const tx of (bankDiezmos || [])) {
      const txName = tx.member_name || tx.concept || '';
      const monthKey = getMonthKey(tx.date);
      const amt = Math.abs(parseFloat(tx.amount));
      if (amt <= 0 || parseFloat(tx.amount) <= 0) continue;

      let matched: any = null;
      const normalizedConcept = normalize(txName);

      for (const rule of bankRules) {
        const normalizedPattern = normalize(rule.pattern);
        if (normalizedConcept.includes(normalizedPattern) || normalizedPattern.includes(normalizedConcept)) {
          matched = members.find((m: any) => m.id === rule.member_id);
          break;
        }
      }
      if (!matched) {
        matched = members.find((m: any) => {
          if (fuzzyNameMatch(m.name, txName)) return true;
          if (m.nickname && fuzzyNameMatch(m.nickname, txName)) return true;
          return false;
        });
      }

      if (matched) {
        const existing = matched.payments[monthKey];
        if (existing) {
          if (existing.source !== 'banco') {
            matched.payments[monthKey] = {
              amount: existing.amount + amt,
              source: existing.source === 'stripe' ? 'ambos' : existing.source,
            };
          }
        } else {
          matched.payments[monthKey] = { amount: amt, source: 'banco' };
        }
        paymentUpserts.push({
          id: `dp-banco-${matched.id}-${monthKey}`,
          member_id: matched.id,
          month: monthKey,
          amount: matched.payments[monthKey].amount,
          source: matched.payments[monthKey].source,
        });
      } else {
        unmatchedBankTransfers.push({
          id: tx.id,
          date: tx.date,
          concept: tx.concept,
          memberName: tx.member_name,
          amount: amt,
          month: monthKey,
        });
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // PHASE 3: Batch DB writes (fire-and-forget, don't block response)
    // ══════════════════════════════════════════════════════════════════
    const dbWritePromises: PromiseLike<any>[] = [];

    // Batch member updates (use .then() to convert PostgREST builder to Promise)
    for (const u of memberUpdates) {
      dbWritePromises.push(
        supabase.from('diezmos_members').update(u.data).eq('id', u.id)      );
    }

    // Batch payment upserts (Supabase supports batch upsert)
    if (paymentUpserts.length > 0) {
      // Deduplicate by member_id+month (keep last)
      const uniquePayments = new Map<string, any>();
      for (const p of paymentUpserts) {
        uniquePayments.set(`${p.member_id}-${p.month}`, p);
      }
      const batchPayments = Array.from(uniquePayments.values());
      // Split into chunks of 500 for Supabase limits
      for (let i = 0; i < batchPayments.length; i += 500) {
        dbWritePromises.push(
          supabase.from('diezmos_payments').upsert(
            batchPayments.slice(i, i + 500),
            { onConflict: 'member_id,month' }
          )        );
      }
    }

    // Fire all DB writes in parallel (don't await — let them finish in background)
    Promise.all(dbWritePromises).catch(e => console.error('Background DB write error:', e));

    // ══════════════════════════════════════════════════════════════════
    // PHASE 4: Compute summaries (CPU only)
    // ══════════════════════════════════════════════════════════════════

    // Operational expenses
    const diezmoTags = new Set<string>();
    for (const tc of (tagCatsData || [])) {
      if (tc.macro_group === 'diezmos') diezmoTags.add(tc.name);
    }

    // Build allDiezmo query filter for bank txs that have diezmo-related tags
    const diezmoTagsList = Array.from(diezmoTags).filter(t => t !== 'Diezmo');
    const diezmoIncome: { month: string; amount: number; concept: string }[] = [];
    const diezmoExpenses: { month: string; amount: number; concept: string; tag: string }[] = [];
    const expensesByTag: Record<string, number> = {};
    const expensesByMonth: Record<string, Record<string, number>> = {};
    let totalDiezmoIncome = 0;
    let totalDiezmoExpenses = 0;

    // Reuse bankDiezmos data + filter for additional tags
    const allDiezmoBankTxs = (bankDiezmos || []).filter((tx: any) => {
      if (tx.is_diezmo) return true;
      const tag = tx.manual_tag || tx.auto_tag || '';
      if (tag === 'Diezmo') return true;
      if (diezmoTags.has(tag)) return true;
      return false;
    });

    for (const tx of allDiezmoBankTxs) {
      const amt = parseFloat(tx.amount || '0');
      const tag = tx.manual_tag || tx.auto_tag || '';
      const monthKey = getMonthKey(tx.date);

      if (tag === 'Diezmo' || tx.is_diezmo) {
        if (amt > 0) {
          diezmoIncome.push({ month: monthKey, amount: amt, concept: tx.concept || '' });
          totalDiezmoIncome += amt;
        } else {
          diezmoExpenses.push({ month: monthKey, amount: Math.abs(amt), concept: tx.concept || '', tag: 'Diezmo (gasto)' });
          expensesByTag['Diezmo (gasto)'] = (expensesByTag['Diezmo (gasto)'] || 0) + Math.abs(amt);
          totalDiezmoExpenses += Math.abs(amt);
          if (!expensesByMonth[monthKey]) expensesByMonth[monthKey] = {};
          expensesByMonth[monthKey]['Diezmo (gasto)'] = (expensesByMonth[monthKey]['Diezmo (gasto)'] || 0) + Math.abs(amt);
        }
      } else if (diezmoTags.has(tag)) {
        const isIncomeTag = tag === 'Donativo';
        if (isIncomeTag && amt > 0) {
          diezmoIncome.push({ month: monthKey, amount: amt, concept: tx.concept || '' });
          totalDiezmoIncome += amt;
        } else {
          const absAmt = Math.abs(amt);
          diezmoExpenses.push({ month: monthKey, amount: absAmt, concept: tx.concept || '', tag });
          expensesByTag[tag] = (expensesByTag[tag] || 0) + absAmt;
          totalDiezmoExpenses += absAmt;
          if (!expensesByMonth[monthKey]) expensesByMonth[monthKey] = {};
          expensesByMonth[monthKey][tag] = (expensesByMonth[monthKey][tag] || 0) + absAmt;
        }
      }
    }

    // Stripe commission as expense
    if (stripeCommission > 0) {
      expensesByTag['Comisión Stripe'] = stripeCommission;
      totalDiezmoExpenses += stripeCommission;
      for (const [feeMonth, feeAmount] of Object.entries(feeByMonth)) {
        if (!expensesByMonth[feeMonth]) expensesByMonth[feeMonth] = {};
        expensesByMonth[feeMonth]['Comisión Stripe'] = (expensesByMonth[feeMonth]['Comisión Stripe'] || 0) + feeAmount;
        diezmoExpenses.push({ month: feeMonth, amount: feeAmount, concept: `Comisión Stripe (${feeMonth})`, tag: 'Comisión Stripe' });
      }
    }

    const incomeByMonth: Record<string, number> = {};
    for (const d of diezmoIncome) incomeByMonth[d.month] = (incomeByMonth[d.month] || 0) + d.amount;
    const expTotalByMonth: Record<string, number> = {};
    for (const d of diezmoExpenses) expTotalByMonth[d.month] = (expTotalByMonth[d.month] || 0) + d.amount;

    const allMonthKeys = new Set([...Object.keys(incomeByMonth), ...Object.keys(expTotalByMonth)]);
    const monthlyChart = Array.from(allMonthKeys).sort().map(m => ({
      month: m,
      income: incomeByMonth[m] || 0,
      expenses: expTotalByMonth[m] || 0,
      net: (incomeByMonth[m] || 0) - (expTotalByMonth[m] || 0),
    }));

    // Summary
    const currentMonth = getMonthKey(new Date());
    const prevDate = new Date(); prevDate.setMonth(prevDate.getMonth() - 1);
    const prevMonth = getMonthKey(prevDate);

    // Index miembros por id para resolver pares
    const memberById = new Map(members.map((m: any) => [m.id, m]));

    // ── SPLIT 50/50 entre parejas vinculadas ─────────────────────────
    // Si A paga 50€ y está vinculada con B, A queda con 25€ y B con 25€
    // (lo aplicamos en TODOS los meses, no solo current/prev)
    const splittedPairs = new Set<string>();
    for (const m of members) {
      if (!m.pairedWith || !memberById.has(m.pairedWith)) continue;
      const pairKey = [m.id, m.pairedWith].sort().join('|');
      if (splittedPairs.has(pairKey)) continue;
      splittedPairs.add(pairKey);
      const pair: any = memberById.get(m.pairedWith);
      // Recolectar todos los meses involucrados
      const allMonths = new Set([...Object.keys(m.payments || {}), ...Object.keys(pair.payments || {})]);
      for (const month of allMonths) {
        const payA = m.payments?.[month];
        const payB = pair.payments?.[month];
        const totalAmt = (payA?.amount || 0) + (payB?.amount || 0);
        if (totalAmt <= 0) continue;
        const half = totalAmt / 2;
        const sources = [payA?.source, payB?.source].filter(Boolean);
        const combinedSource = sources.length === 2 && sources[0] !== sources[1] ? 'ambos' : (sources[0] || 'banco');
        m.payments[month] = { amount: half, source: combinedSource, splitPair: true, originalAmount: totalAmt };
        pair.payments[month] = { amount: half, source: combinedSource, splitPair: true, originalAmount: totalAmt };
      }
    }

    // ── Marcar isActive considerando pago propio o de la pareja ──────
    for (const m of members) {
      const paidRecently = m.payments?.[currentMonth] || m.payments?.[prevMonth] || m.stripeSubscriptionId;
      let pairPays = false;
      if (m.pairedWith && memberById.has(m.pairedWith)) {
        const pair: any = memberById.get(m.pairedWith);
        pairPays = !!(pair.payments?.[currentMonth] || pair.payments?.[prevMonth] || pair.stripeSubscriptionId);
      }
      m.isActive = !!(paidRecently || pairPays);
    }

    const communityStats = communities.map((c: string) => {
      const cmembers = members.filter((m: any) => m.community === c);
      const paying = cmembers.filter((m: any) => m.payments?.[currentMonth]);
      const total = paying.reduce((s: number, m: any) => s + (m.payments[currentMonth]?.amount || 0), 0);
      return { community: c, totalMembers: cmembers.length, payingMembers: paying.length, monthlyTotal: total };
    });

    const totalMensual = members.reduce((s: number, m: any) => s + (m.payments?.[currentMonth]?.amount || 0), 0);
    const totalActive = members.filter((m: any) => m.isActive).length;
    const totalPaying = members.filter((m: any) => m.payments?.[currentMonth]).length;
    const stripePayingCount = members.filter((m: any) => {
      const p = m.payments?.[currentMonth];
      return p && (p.source === 'stripe' || p.source === 'ambos');
    }).length;
    const bancoPayingCount = members.filter((m: any) => {
      const p = m.payments?.[currentMonth];
      return p && (p.source === 'banco' || p.source === 'ambos');
    }).length;

    const totalStripeFromPayments = members.reduce((sum: number, m: any) => {
      return sum + Object.values(m.payments as Record<string, { amount: number; source: string }>)
        .filter(p => p.source === 'stripe' || p.source === 'ambos')
        .reduce((s, p) => s + p.amount, 0);
    }, 0);

    const stripeDebug = {
      totalSubsFetched: stripeSubs.length,
      matchedToMembers: matchedSubIds.size,
      unmatchedSubs: unmatchedStripeSubscribers,
      totalInvoicesFetched: stripeInvoices.length,
      totalChargesFetched: stripeCharges.length,
      totalStripeCollected,
      totalStripeFromPayments,
      stripeCommission,
      totalStripeTransferred,
      totalBrandSales,
      brandSalesCount: brandSales.length,
    };

    return NextResponse.json({
      members,
      communities,
      communityStats,
      unmatchedStripeSubscribers,
      unmatchedBankTransfers: unmatchedBankTransfers.sort((a, b) => b.date.localeCompare(a.date)),
      bankRules,
      summary: {
        totalMensual,
        totalMembers: members.length,
        totalActive,
        totalPaying,
        fromStripe: stripePayingCount,
        fromBanco: bancoPayingCount,
        totalStripeSubs: stripeSubs.length,
        matchedStripeSubs: matchedSubIds.size,
        totalStripeCollected,
        totalStripeFromPayments,
        stripeCommission,
        totalStripeTransferred,
      },
      operationalExpenses: {
        totalIncome: totalDiezmoIncome,
        totalExpenses: totalDiezmoExpenses,
        net: totalDiezmoIncome - totalDiezmoExpenses,
        byTag: Object.entries(expensesByTag).map(([tag, amount]) => ({ tag, amount })).sort((a, b) => b.amount - a.amount),
        byMonth: expensesByMonth,
        monthlyChart,
        recentExpenses: diezmoExpenses.sort((a, b) => b.month.localeCompare(a.month)).slice(0, 20),
      },
      brandSales: {
        total: totalBrandSales,
        count: brandSales.length,
        transactions: brandSales.sort((a, b) => b.created.localeCompare(a.created)),
      },
      stripeDebug,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error in diezmos GET:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: import('next/server').NextRequest) {
  try {
    const body = await request.json();

    // ── Existing actions ───────────────────────────────────────────────

    if (body.action === 'add_member') {
      const id = `m${Date.now()}`;
      const row: any = {
        id,
        name: body.name.trim(),
        apodo: body.nickname?.trim() || null,
        community: body.community || 'San Pablo',
        email: body.email || null,
        phone: body.phone || null,
        fecha_nacimiento: body.fechaNacimiento || null,
        is_active: true,
      };
      if (body.paymentFrequency) row.payment_frequency = body.paymentFrequency;
      const { error } = await supabase.from('diezmos_members').insert(row);
      if (error) throw error;
      return NextResponse.json({ success: true, id });
    }

    if (body.action === 'delete_member') {
      // Delete bank rules first (FK may not cascade)
      await supabase.from('diezmos_bank_rules').delete().eq('member_id', body.id);
      await supabase.from('diezmos_payments').delete().eq('member_id', body.id);
      const { error } = await supabase.from('diezmos_members').delete().eq('id', body.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (body.action === 'update_member') {
      const updates: any = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.nickname !== undefined) updates.apodo = body.nickname || null;
      if (body.community !== undefined) updates.community = body.community;
      if (body.email !== undefined) updates.email = body.email;
      if (body.phone !== undefined) updates.phone = body.phone || null;
      if (body.fechaNacimiento !== undefined) updates.fecha_nacimiento = body.fechaNacimiento || null;
      if (body.isActive !== undefined) updates.is_active = body.isActive;
      if (body.paymentFrequency !== undefined) updates.payment_frequency = body.paymentFrequency;
      if (body.pairedWith !== undefined) updates.paired_with_member_id = body.pairedWith || null;
      const { error } = await supabase.from('diezmos_members').update(updates).eq('id', body.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (body.action === 'pair_members') {
      // Vincular dos miembros bidireccionalmente
      const { memberA, memberB } = body;
      if (!memberA || !memberB || memberA === memberB) {
        return NextResponse.json({ error: 'Se requieren dos miembros distintos' }, { status: 400 });
      }
      const { error: e1 } = await supabase.from('diezmos_members').update({ paired_with_member_id: memberB }).eq('id', memberA);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('diezmos_members').update({ paired_with_member_id: memberA }).eq('id', memberB);
      if (e2) throw e2;
      return NextResponse.json({ success: true });
    }

    if (body.action === 'unpair_members') {
      // Desvincular bidireccionalmente
      const { memberId } = body;
      const { data: m } = await supabase.from('diezmos_members').select('paired_with_member_id').eq('id', memberId).single();
      const partnerId = m?.paired_with_member_id;
      const { error: e1 } = await supabase.from('diezmos_members').update({ paired_with_member_id: null }).eq('id', memberId);
      if (e1) throw e1;
      if (partnerId) {
        await supabase.from('diezmos_members').update({ paired_with_member_id: null }).eq('id', partnerId);
      }
      return NextResponse.json({ success: true });
    }

    if (body.action === 'manual_payment') {
      const { error } = await supabase.from('diezmos_payments').upsert({
        id: `dp-manual-${body.memberId}-${body.month}`,
        member_id: body.memberId,
        month: body.month,
        amount: body.amount,
        source: 'manual',
      }, { onConflict: 'member_id,month' });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (body.action === 'delete_payment') {
      const { error } = await supabase.from('diezmos_payments').delete()
        .eq('member_id', body.memberId).eq('month', body.month);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (body.action === 'add_community') {
      const { error } = await supabase.from('diezmos_communities').insert({
        id: `com-${Date.now()}`,
        name: body.name,
      });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // ── NEW: Stripe linking ────────────────────────────────────────────

    if (body.action === 'link_stripe') {
      // Link a Stripe subscriber to an existing member + mark active
      const { memberId, customerId, customerEmail, subscriptionId, amount, interval } = body;
      const { error } = await supabase.from('diezmos_members').update({
        stripe_customer_id: customerId,
        stripe_customer_email: customerEmail,
        stripe_subscription_id: subscriptionId,
        stripe_amount: amount,
        stripe_interval: interval,
        email: customerEmail,
        is_active: true,
      }).eq('id', memberId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (body.action === 'unlink_stripe') {
      // Remove Stripe link from a member
      const { error } = await supabase.from('diezmos_members').update({
        stripe_customer_id: null,
        stripe_customer_email: null,
        stripe_subscription_id: null,
        stripe_amount: null,
        stripe_interval: null,
      }).eq('id', body.memberId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (body.action === 'create_from_stripe') {
      // Create a new member from an unmatched Stripe subscriber
      const id = `m${Date.now()}`;
      const { error } = await supabase.from('diezmos_members').insert({
        id,
        name: body.name.trim(),
        nickname: body.nickname?.trim() || null,
        community: body.community || 'San Pablo',
        email: body.customerEmail || null,
        is_active: true,
        stripe_customer_id: body.customerId || null,
        stripe_customer_email: body.customerEmail || null,
        stripe_subscription_id: body.subscriptionId || null,
        stripe_amount: body.amount || null,
        stripe_interval: body.interval || null,
      });
      if (error) throw error;
      return NextResponse.json({ success: true, id });
    }

    // ── NEW: Bank rules ────────────────────────────────────────────────

    if (body.action === 'create_bank_rule') {
      const id = `br-${Date.now()}`;
      const { error } = await supabase.from('diezmos_bank_rules').insert({
        id,
        pattern: body.pattern.trim().toLowerCase(),
        member_id: body.memberId,
      });
      if (error) throw error;
      return NextResponse.json({ success: true, id });
    }

    if (body.action === 'delete_bank_rule') {
      const { error } = await supabase.from('diezmos_bank_rules').delete().eq('id', body.ruleId || body.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // ── NEW: One-time bank link ────────────────────────────────────────

    if (body.action === 'link_bank_tx') {
      // Manually link a bank transfer to a member (creates payment)
      const monthKey = body.month || getMonthKey(body.date || new Date());
      const { error } = await supabase.from('diezmos_payments').upsert({
        id: `dp-banco-${body.memberId}-${monthKey}`,
        member_id: body.memberId,
        month: monthKey,
        amount: body.amount,
        source: 'banco',
      }, { onConflict: 'member_id,month' });
      if (error) throw error;

      // Optionally create a rule for future auto-matching
      if (body.createRule && body.pattern) {
        await supabase.from('diezmos_bank_rules').insert({
          id: `br-${Date.now()}`,
          pattern: body.pattern.trim().toLowerCase(),
          member_id: body.memberId,
        });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error in diezmos POST:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
