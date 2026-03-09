import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSubscriptions, getInvoices, getAllCharges, getAllBalanceTransactions } from '@/lib/stripe';

function normalize(name: string) {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, '').trim();
}

// Fuzzy matching: compara palabras individuales entre dos nombres
// Devuelve true si al menos 2 palabras coinciden, o si un nombre corto (1 palabra) coincide con alguna palabra del otro
function fuzzyNameMatch(nameA: string, nameB: string): boolean {
  const wordsA = normalize(nameA).split(/\s+/).filter(w => w.length > 2);
  const wordsB = normalize(nameB).split(/\s+/).filter(w => w.length > 2);
  if (wordsA.length === 0 || wordsB.length === 0) return false;

  // Exact substring match (existing logic)
  const nA = normalize(nameA);
  const nB = normalize(nameB);
  if (nA.includes(nB) || nB.includes(nA)) return true;

  // Word overlap: count matching words
  const matchingWords = wordsA.filter(wa => wordsB.some(wb => wa === wb || wa.includes(wb) || wb.includes(wa)));

  // Si un nombre es solo 1 palabra (apodo), basta con que coincida con alguna palabra
  if (wordsA.length === 1 || wordsB.length === 1) return matchingWords.length >= 1;

  // Para nombres con 2+ palabras, al menos 2 palabras deben coincidir
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

    // Date range for filtering
    const startDate = startParam ? new Date(startParam).toISOString().split('T')[0] : null;
    const endDate = endParam ? new Date(endParam).toISOString().split('T')[0] : null;

    // Stripe timestamps for filtering
    const stripeStartTs = startParam ? Math.floor(new Date(startParam).getTime() / 1000) : Math.floor(new Date('2020-01-01').getTime() / 1000);
    const stripeEndTs = endParam ? Math.floor(new Date(endParam).getTime() / 1000) : Math.floor(Date.now() / 1000);

    // 1. Get members from Supabase
    const { data: membersData, error: membersErr } = await supabase
      .from('diezmos_members')
      .select('*')
      .order('name');
    if (membersErr) throw membersErr;

    // 2. Get communities from Supabase
    const { data: commData, error: commErr } = await supabase
      .from('diezmos_communities')
      .select('*')
      .order('name');
    if (commErr) throw commErr;

    // 3. Get payments from Supabase
    const { data: paymentsData, error: paymentsErr } = await supabase
      .from('diezmos_payments')
      .select('*');
    if (paymentsErr) throw paymentsErr;

    const communities = (commData || []).map((c: any) => c.name);
    const members = (membersData || []).map((m: any) => {
      const memberPayments: Record<string, { amount: number; source: string }> = {};
      (paymentsData || []).filter((p: any) => p.member_id === m.id).forEach((p: any) => {
        memberPayments[p.month] = { amount: parseFloat(p.amount), source: p.source };
      });
      return {
        id: m.id,
        name: m.name,
        nickname: m.nickname || null,
        community: m.community,
        email: m.email,
        isActive: m.is_active,
        stripeSubscriptionId: m.stripe_subscription_id,
        stripeAmount: m.stripe_amount ? parseFloat(m.stripe_amount) : null,
        stripeInterval: m.stripe_interval,
        payments: memberPayments,
      };
    });

    // 4. Get ALL Stripe subscriptions (sin filtrar por nombre de producto)
    let stripeSubs: any[] = [];
    try {
      const allSubs = await getSubscriptions({ status: 'active', limit: 100 });
      stripeSubs = allSubs;
    } catch (e) {
      console.error('Error fetching Stripe subscriptions:', e);
    }

    // 5. Match Stripe subscriptions to members by name/email
    const matchedSubIds = new Set<string>();

    for (const sub of stripeSubs) {
      const subName = normalize(sub.customerName || '');
      const subEmail = (sub.customerEmail || '').toLowerCase();

      const matched = members.find((m: any) => {
        if (m.stripeSubscriptionId === sub.id) return true;
        if (m.email && m.email.toLowerCase() === subEmail) return true;
        const custName = sub.customerName || '';
        if (fuzzyNameMatch(m.name, custName)) return true;
        if (m.nickname && fuzzyNameMatch(m.nickname, custName)) return true;
        return false;
      });

      if (matched) {
        matched.stripeSubscriptionId = sub.id;
        matched.stripeAmount = sub.amount;
        matched.stripeInterval = sub.interval;
        matched.email = sub.customerEmail || matched.email;
        matchedSubIds.add(sub.id);

        // Update Stripe info in DB
        await supabase.from('diezmos_members').update({
          stripe_subscription_id: sub.id,
          stripe_amount: sub.amount,
          stripe_interval: sub.interval,
          email: sub.customerEmail || matched.email,
        }).eq('id', matched.id);
      }
    }

    // 6. Get paid Stripe invoices (filtered by date range)
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

    // 7. Map invoices to member payments by month
    for (const inv of stripeInvoices) {
      if (inv.amount <= 0) continue;

      const matched = members.find((m: any) => {
        if (m.stripeSubscriptionId && inv.subscriptionId === m.stripeSubscriptionId) return true;
        const invEmail = (inv.customerEmail || '').toLowerCase();
        if (m.email && m.email.toLowerCase() === invEmail) return true;
        const custName = inv.customerName || '';
        if (fuzzyNameMatch(m.name, custName)) return true;
        if (m.nickname && fuzzyNameMatch(m.nickname, custName)) return true;
        return false;
      });

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

    // 7b. Fetch ALL Stripe charges with auto-pagination (290+)
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

      // Si NO tiene descripción de suscripción y NO tiene customer name (invitado) → venta Brand
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
        continue; // No es diezmo, es venta de brand
      }

      // Intentar match con miembros (diezmo)
      const matched = members.find((m: any) => {
        if (!charge.customerName && !charge.customerEmail) return false;
        const chargeEmail = (charge.customerEmail || '').toLowerCase();
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

    // 7c. Calculate Stripe commission from balance transactions
    let stripeCommission = 0;
    let totalStripeTransferred = 0;
    try {
      const balanceTxs = await getAllBalanceTransactions({
        created: { gte: stripeStartTs, lte: stripeEndTs },
      });
      for (const tx of balanceTxs) {
        if (tx.type === 'charge') {
          stripeCommission += tx.fee;
        }
        if (tx.type === 'payout') {
          totalStripeTransferred += Math.abs(tx.amount);
        }
      }
    } catch (e) {
      console.error('Error fetching Stripe balance transactions:', e);
    }

    // 8. Get bank diezmo transactions (filtered by date)
    let bankDiezmosQuery = supabase
      .from('bank_transactions')
      .select('*')
      .or('is_diezmo.eq.true,manual_tag.eq.Diezmo,auto_tag.eq.Diezmo');
    if (startDate) bankDiezmosQuery = bankDiezmosQuery.gte('date', startDate);
    if (endDate) bankDiezmosQuery = bankDiezmosQuery.lte('date', endDate);
    const { data: bankDiezmos } = await bankDiezmosQuery;

    // 9. Match bank transactions to members (fuzzy matching con nicknames)
    for (const tx of (bankDiezmos || [])) {
      const txName = tx.member_name || tx.concept || '';
      const monthKey = getMonthKey(tx.date);

      const matched = members.find((m: any) => {
        if (fuzzyNameMatch(m.name, txName)) return true;
        if (m.nickname && fuzzyNameMatch(m.nickname, txName)) return true;
        return false;
      });

      if (matched) {
        const existing = matched.payments[monthKey];
        const amt = Math.abs(parseFloat(tx.amount));
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
      }
    }

    // 10. Get operational expenses covered by diezmos from bank
    // Tags dinámicos desde tag_categories con macro_group === 'diezmos'
    const { data: tagCatsData } = await supabase
      .from('tag_categories')
      .select('name, macro_group');

    const diezmoTags = new Set<string>();
    for (const tc of (tagCatsData || [])) {
      if (tc.macro_group === 'diezmos') {
        diezmoTags.add(tc.name);
      }
    }
    // Build dynamic OR filter for bank transactions
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

    // Separate income (diezmos received) vs expenses (operational costs)
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
          // Negative diezmo-tagged = expense
          diezmoExpenses.push({ month: monthKey, amount: Math.abs(amt), concept: tx.concept || '', tag: 'Diezmo (gasto)' });
          expensesByTag['Diezmo (gasto)'] = (expensesByTag['Diezmo (gasto)'] || 0) + Math.abs(amt);
          totalDiezmoExpenses += Math.abs(amt);
          if (!expensesByMonth[monthKey]) expensesByMonth[monthKey] = {};
          expensesByMonth[monthKey]['Diezmo (gasto)'] = (expensesByMonth[monthKey]['Diezmo (gasto)'] || 0) + Math.abs(amt);
        }
      } else if (diezmoTags.has(tag)) {
        // Donativo con importe positivo es ingreso, no gasto
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

    // Monthly totals for chart
    const incomeByMonth: Record<string, number> = {};
    for (const d of diezmoIncome) {
      incomeByMonth[d.month] = (incomeByMonth[d.month] || 0) + d.amount;
    }
    const expTotalByMonth: Record<string, number> = {};
    for (const d of diezmoExpenses) {
      expTotalByMonth[d.month] = (expTotalByMonth[d.month] || 0) + d.amount;
    }

    // Build monthly chart data
    const allMonthKeys = new Set([...Object.keys(incomeByMonth), ...Object.keys(expTotalByMonth)]);
    const monthlyChart = Array.from(allMonthKeys).sort().map(m => ({
      month: m,
      income: incomeByMonth[m] || 0,
      expenses: expTotalByMonth[m] || 0,
      net: (incomeByMonth[m] || 0) - (expTotalByMonth[m] || 0),
    }));

    // 11. Build summary
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

    // Calculate total Stripe diezmo revenue from members' payments
    const totalStripeFromPayments = members.reduce((sum: number, m: any) => {
      return sum + Object.values(m.payments as Record<string, { amount: number; source: string }>)
        .filter(p => p.source === 'stripe' || p.source === 'ambos')
        .reduce((s, p) => s + p.amount, 0);
    }, 0);

    // Add Stripe commission as operational expense
    if (stripeCommission > 0) {
      expensesByTag['Comisión Stripe'] = stripeCommission;
      totalDiezmoExpenses += stripeCommission;
      // Distribute commission across months proportionally (simplification: put in current range)
      const commMonthKey = getMonthKey(new Date());
      if (!expensesByMonth[commMonthKey]) expensesByMonth[commMonthKey] = {};
      expensesByMonth[commMonthKey]['Comisión Stripe'] = stripeCommission;
      diezmoExpenses.push({ month: commMonthKey, amount: stripeCommission, concept: 'Comisión Stripe (fees de todas las transacciones)', tag: 'Comisión Stripe' });
    }

    // Stripe debug info
    const stripeDebug = {
      totalSubsFetched: stripeSubs.length,
      matchedToMembers: matchedSubIds.size,
      unmatchedSubs: stripeSubs.filter(s => !matchedSubIds.has(s.id)).map(s => ({
        name: s.customerName,
        email: s.customerEmail,
        amount: s.amount,
        product: s.productName,
      })),
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
      // Operational expenses section
      operationalExpenses: {
        totalIncome: totalDiezmoIncome,
        totalExpenses: totalDiezmoExpenses,
        net: totalDiezmoIncome - totalDiezmoExpenses,
        byTag: Object.entries(expensesByTag).map(([tag, amount]) => ({ tag, amount })).sort((a, b) => b.amount - a.amount),
        byMonth: expensesByMonth,
        monthlyChart,
        recentExpenses: diezmoExpenses.sort((a, b) => b.month.localeCompare(a.month)).slice(0, 20),
      },
      // Brand sales (pagos de invitados en Stripe, no diezmos)
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
      const { error } = await supabase
        .from('diezmos_members')
        .delete()
        .eq('id', body.id);
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

      const { error } = await supabase
        .from('diezmos_members')
        .update(updates)
        .eq('id', body.id);
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
      const { error } = await supabase
        .from('diezmos_payments')
        .delete()
        .eq('member_id', body.memberId)
        .eq('month', body.month);
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

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error in diezmos POST:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
