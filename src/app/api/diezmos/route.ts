import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSubscriptions, getInvoices, getAllCharges, getAllBalanceTransactions } from '@/lib/stripe';

function normalize(name: string) {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, '').trim();
}

function fuzzyNameMatch(nameA: string, nameB: string): boolean {
  const wordsA = normalize(nameA).split(/\s+/).filter(w => w.length > 2);
  const wordsB = normalize(nameB).split(/\s+/).filter(w => w.length > 2);
  if (wordsA.length === 0 || wordsB.length === 0) return false;

  const nA = normalize(nameA);
  const nB = normalize(nameB);
  if (nA.includes(nB) || nB.includes(nA)) return true;

  const matchingWords = wordsA.filter(wa => wordsB.some(wb => wa === wb || wa.includes(wb) || wb.includes(wa)));
  if (wordsA.length === 1 || wordsB.length === 1) return matchingWords.length >= 1;
  return matchingWords.length >= 2;
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

    const stripeStartTs = startParam ? Math.floor(new Date(startParam).getTime() / 1000) : Math.floor(new Date('2020-01-01').getTime() / 1000);
    const stripeEndTs = endParam ? Math.floor(new Date(endParam).getTime() / 1000) : Math.floor(Date.now() / 1000);

    // ── 1. Fetch all DB data in parallel ───────────────────────────────
    const [
      { data: membersData, error: membersErr },
      { data: commData, error: commErr },
      { data: paymentsData, error: paymentsErr },
      { data: bankRulesData },
    ] = await Promise.all([
      supabase.from('diezmos_members').select('*').order('name'),
      supabase.from('diezmos_communities').select('*').order('name'),
      supabase.from('diezmos_payments').select('*'),
      supabase.from('diezmos_bank_rules').select('*'),
    ]);
    if (membersErr) throw membersErr;
    if (commErr) throw commErr;
    if (paymentsErr) throw paymentsErr;

    const communities = (commData || []).map((c: any) => c.name);
    const bankRules = bankRulesData || [];

    // Build members array with their existing payments and persistent Stripe link
    const members = (membersData || []).map((m: any) => {
      const memberPayments: Record<string, { amount: number; source: string }> = {};
      (paymentsData || []).filter((p: any) => p.member_id === m.id).forEach((p: any) => {
        memberPayments[p.month] = { amount: parseFloat(p.amount), source: p.source };
      });
      // Bank rules linked to this member
      const memberBankRules = bankRules.filter((r: any) => r.member_id === m.id).map((r: any) => ({
        id: r.id,
        pattern: r.pattern,
      }));
      return {
        id: m.id,
        name: m.name,
        nickname: m.nickname || null,
        community: m.community,
        email: m.email,
        isActive: m.is_active,
        stripeCustomerId: m.stripe_customer_id || null,
        stripeCustomerEmail: m.stripe_customer_email || null,
        stripeSubscriptionId: m.stripe_subscription_id,
        stripeAmount: m.stripe_amount ? parseFloat(m.stripe_amount) : null,
        stripeInterval: m.stripe_interval,
        payments: memberPayments,
        bankRules: memberBankRules,
      };
    });

    // ── 2. Stripe subscriptions ────────────────────────────────────────
    let stripeSubs: any[] = [];
    try {
      stripeSubs = await getSubscriptions({ status: 'active', limit: 100 });
    } catch (e) {
      console.error('Error fetching Stripe subscriptions:', e);
    }

    // ── 3. Match Stripe subs → members (persistent-first) ──────────────
    const matchedSubIds = new Set<string>();
    const unmatchedStripeSubscribers: any[] = [];

    for (const sub of stripeSubs) {
      const customerId = sub.customerId || '';
      const subEmail = (sub.customerEmail || '').toLowerCase();

      // Priority 1: Match by persistent stripe_customer_id
      let matched = members.find((m: any) => m.stripeCustomerId && m.stripeCustomerId === customerId);

      // Priority 2: Match by stripe_customer_email
      if (!matched) {
        matched = members.find((m: any) => m.stripeCustomerEmail && m.stripeCustomerEmail.toLowerCase() === subEmail && subEmail);
      }

      // Priority 3: Match by member email
      if (!matched) {
        matched = members.find((m: any) => m.email && m.email.toLowerCase() === subEmail && subEmail);
      }

      // Priority 4: Match by existing stripe_subscription_id
      if (!matched) {
        matched = members.find((m: any) => m.stripeSubscriptionId === sub.id);
      }

      // Priority 5: Fuzzy name match
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
        matchedSubIds.add(sub.id);

        // Persist the link in DB
        await supabase.from('diezmos_members').update({
          stripe_subscription_id: sub.id,
          stripe_amount: sub.amount,
          stripe_interval: sub.interval,
          stripe_customer_id: customerId,
          stripe_customer_email: sub.customerEmail || matched.email,
          email: sub.customerEmail || matched.email,
        }).eq('id', matched.id);
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

    // ── 4. Stripe invoices → member payments ───────────────────────────
    let stripeInvoices: any[] = [];
    try {
      stripeInvoices = await getInvoices({
        created: { gte: stripeStartTs, lte: stripeEndTs },
        status: 'paid',
        limit: 100,
      });
    } catch (e) {
      console.error('Error fetching Stripe invoices:', e);
    }

    for (const inv of stripeInvoices) {
      if (inv.amount <= 0) continue;

      // Match by subscription_id first (most reliable after linking)
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
        const monthKey = getMonthKey(inv.periodStart || inv.created);
        const existing = matched.payments[monthKey];

        if (!existing || existing.source !== 'stripe') {
          const newSource = existing ? (existing.source === 'banco' ? 'ambos' : 'stripe') : 'stripe';
          const newAmount = existing ? existing.amount + inv.amount : inv.amount;
          matched.payments[monthKey] = { amount: newAmount, source: newSource };

          await supabase.from('diezmos_payments').upsert({
            id: `dp-stripe-${matched.id}-${monthKey}`,
            member_id: matched.id,
            month: monthKey,
            amount: newAmount,
            source: newSource,
          }, { onConflict: 'member_id,month' });
        }
      }
    }

    // ── 5. Stripe charges (all, with brand sales separation) ───────────
    let stripeCharges: any[] = [];
    let totalStripeCollected = 0;
    const brandSales: { amount: number; customerName: string; customerEmail: string; created: string; description: string }[] = [];
    let totalBrandSales = 0;
    try {
      stripeCharges = await getAllCharges({
        created: { gte: stripeStartTs, lte: stripeEndTs },
      });
    } catch (e) {
      console.error('Error fetching Stripe charges:', e);
    }

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

      // Try matching charges to members for additional payments
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
          await supabase.from('diezmos_payments').upsert({
            id: `dp-charge-${matched.id}-${monthKey}`,
            member_id: matched.id,
            month: monthKey,
            amount: charge.amount,
            source: 'stripe',
          }, { onConflict: 'member_id,month' });
        }
      }
    }

    // ── 6. Stripe commission (distributed by actual month) ────────────
    let stripeCommission = 0;
    let totalStripeTransferred = 0;
    const feeByMonth: Record<string, number> = {};
    try {
      const balanceTxs = await getAllBalanceTransactions({
        created: { gte: stripeStartTs, lte: stripeEndTs },
      });
      for (const tx of balanceTxs) {
        if (tx.type === 'charge') {
          stripeCommission += tx.fee;
          const txMonth = getMonthKey(tx.created);
          feeByMonth[txMonth] = (feeByMonth[txMonth] || 0) + tx.fee;
        }
        if (tx.type === 'payout') totalStripeTransferred += Math.abs(tx.amount);
      }
    } catch (e) {
      console.error('Error fetching Stripe balance transactions:', e);
    }

    // ── 7. Bank diezmo transactions ────────────────────────────────────
    let bankDiezmosQuery = supabase
      .from('bank_transactions')
      .select('*')
      .or('is_diezmo.eq.true,manual_tag.eq.Diezmo,auto_tag.eq.Diezmo');
    if (startDate) bankDiezmosQuery = bankDiezmosQuery.gte('date', startDate);
    if (endDate) bankDiezmosQuery = bankDiezmosQuery.lte('date', endDate);
    const { data: bankDiezmos } = await bankDiezmosQuery;

    // ── 8. Match bank transactions → members (rules-first, then fuzzy) ─
    const unmatchedBankTransfers: any[] = [];

    for (const tx of (bankDiezmos || [])) {
      const txName = tx.member_name || tx.concept || '';
      const monthKey = getMonthKey(tx.date);
      const amt = Math.abs(parseFloat(tx.amount));
      if (amt <= 0) continue;

      // Only match positive amounts (income from transfers)
      if (parseFloat(tx.amount) <= 0) continue;

      // Priority 1: Match by bank rules
      let matched: any = null;
      const normalizedConcept = normalize(txName);

      for (const rule of bankRules) {
        const normalizedPattern = normalize(rule.pattern);
        if (normalizedConcept.includes(normalizedPattern) || normalizedPattern.includes(normalizedConcept)) {
          matched = members.find((m: any) => m.id === rule.member_id);
          break;
        }
      }

      // Priority 2: Fuzzy name match
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

        await supabase.from('diezmos_payments').upsert({
          id: `dp-banco-${matched.id}-${monthKey}`,
          member_id: matched.id,
          month: monthKey,
          amount: matched.payments[monthKey].amount,
          source: matched.payments[monthKey].source,
        }, { onConflict: 'member_id,month' });
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

    // ── 9. Operational expenses ────────────────────────────────────────
    const { data: tagCatsData } = await supabase
      .from('tag_categories')
      .select('name, macro_group');

    const diezmoTags = new Set<string>();
    for (const tc of (tagCatsData || [])) {
      if (tc.macro_group === 'diezmos') diezmoTags.add(tc.name);
    }

    const diezmoTagsList = Array.from(diezmoTags).filter(t => t !== 'Diezmo');
    const orFilters = ['is_diezmo.eq.true', 'manual_tag.eq.Diezmo', 'auto_tag.eq.Diezmo'];
    if (diezmoTagsList.length > 0) {
      orFilters.push(`manual_tag.in.(${diezmoTagsList.join(',')})`);
      orFilters.push(`auto_tag.in.(${diezmoTagsList.join(',')})`);
    }

    let allDiezmoQuery = supabase
      .from('bank_transactions')
      .select('*')
      .or(orFilters.join(','));
    if (startDate) allDiezmoQuery = allDiezmoQuery.gte('date', startDate);
    if (endDate) allDiezmoQuery = allDiezmoQuery.lte('date', endDate);
    const { data: allDiezmoBankTxs } = await allDiezmoQuery;

    const diezmoIncome: { month: string; amount: number; concept: string }[] = [];
    const diezmoExpenses: { month: string; amount: number; concept: string; tag: string }[] = [];
    const expensesByTag: Record<string, number> = {};
    const expensesByMonth: Record<string, Record<string, number>> = {};
    let totalDiezmoIncome = 0;
    let totalDiezmoExpenses = 0;

    for (const tx of (allDiezmoBankTxs || [])) {
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

    // Stripe commission as expense (distributed by actual month)
    if (stripeCommission > 0) {
      expensesByTag['Comisión Stripe'] = stripeCommission;
      totalDiezmoExpenses += stripeCommission;
      for (const [feeMonth, feeAmount] of Object.entries(feeByMonth)) {
        if (!expensesByMonth[feeMonth]) expensesByMonth[feeMonth] = {};
        expensesByMonth[feeMonth]['Comisión Stripe'] = (expensesByMonth[feeMonth]['Comisión Stripe'] || 0) + feeAmount;
        diezmoExpenses.push({ month: feeMonth, amount: feeAmount, concept: `Comisión Stripe (${feeMonth})`, tag: 'Comisión Stripe' });
      }
    }

    // Monthly chart
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

    // ── 10. Summary ────────────────────────────────────────────────────
    const currentMonth = getMonthKey(new Date());
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
      // NEW: Unmatched data for reconciliation UI
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
      const { error } = await supabase.from('diezmos_members').insert({
        id,
        name: body.name.trim(),
        nickname: body.nickname?.trim() || null,
        community: body.community || 'San Pablo',
        email: body.email || null,
        is_active: true,
      });
      if (error) throw error;
      return NextResponse.json({ success: true, id });
    }

    if (body.action === 'delete_member') {
      const { error } = await supabase.from('diezmos_members').delete().eq('id', body.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (body.action === 'update_member') {
      const updates: any = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.nickname !== undefined) updates.nickname = body.nickname || null;
      if (body.community !== undefined) updates.community = body.community;
      if (body.email !== undefined) updates.email = body.email;
      if (body.isActive !== undefined) updates.is_active = body.isActive;
      const { error } = await supabase.from('diezmos_members').update(updates).eq('id', body.id);
      if (error) throw error;
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
      // Link a Stripe subscriber to an existing member
      const { memberId, customerId, customerEmail, subscriptionId, amount, interval } = body;
      const { error } = await supabase.from('diezmos_members').update({
        stripe_customer_id: customerId,
        stripe_customer_email: customerEmail,
        stripe_subscription_id: subscriptionId,
        stripe_amount: amount,
        stripe_interval: interval,
        email: customerEmail,
      }).eq('id', memberId);
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
      const { error } = await supabase.from('diezmos_bank_rules').delete().eq('id', body.id);
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
