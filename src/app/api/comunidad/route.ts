import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCharges } from '@/lib/stripe';

function getMonthKey(date: string | Date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Income tags: positive amounts with these tags count as income
const INCOME_TAGS = new Set(['Diezmo', 'Donativo']);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    // 1. Get all diezmos macro group tags
    const { data: tagCatsData } = await supabase
      .from('tag_categories')
      .select('name, macro_group, color');

    const diezmoTags = new Map<string, string>();
    for (const tc of (tagCatsData || [])) {
      if (tc.macro_group === 'diezmos') {
        diezmoTags.set(tc.name, tc.color || '#8b5cf6');
      }
    }

    const allTagNames = Array.from(diezmoTags.keys());

    // 2. Fetch bank transactions con paginación (evitar límite 1000 filas)
    let dateGte: string | undefined;
    let dateLte: string | undefined;
    if (start && end) {
      dateGte = new Date(start).toISOString().split('T')[0];
      dateLte = new Date(end).toISOString().split('T')[0];
    }

    const orFilters = [
      'is_diezmo.eq.true',
      `manual_tag.in.(${allTagNames.join(',')})`,
      `auto_tag.in.(${allTagNames.join(',')})`,
    ].join(',');

    const PAGE = 1000;
    const bankTxs: any[] = [];
    let from = 0;
    while (true) {
      let q = supabase.from('bank_transactions').select('*').order('date', { ascending: false }).or(orFilters);
      if (dateGte) q = q.gte('date', dateGte);
      if (dateLte) q = q.lte('date', dateLte);
      q = q.range(from, from + PAGE - 1);
      const { data, error } = await q;
      if (error) throw error;
      if (!data || data.length === 0) break;
      bankTxs.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    // 3. Process transactions
    let totalIncome = 0;
    let totalExpenses = 0;
    const byTag: Record<string, { income: number; expenses: number; transactions: any[] }> = {};
    const byMonth: Record<string, { income: number; expenses: number }> = {};

    // Initialize all tags
    for (const tag of allTagNames) {
      byTag[tag] = { income: 0, expenses: 0, transactions: [] };
    }

    for (const tx of bankTxs) {
      const amt = parseFloat(tx.amount || '0');
      const tag = tx.manual_tag || tx.auto_tag || (tx.is_diezmo ? 'Diezmo' : '');
      if (!tag || !diezmoTags.has(tag)) continue;

      const monthKey = getMonthKey(tx.date);
      if (!byMonth[monthKey]) byMonth[monthKey] = { income: 0, expenses: 0 };
      if (!byTag[tag]) byTag[tag] = { income: 0, expenses: 0, transactions: [] };

      const isIncomeTag = INCOME_TAGS.has(tag);

      if (isIncomeTag && amt > 0) {
        totalIncome += amt;
        byTag[tag].income += amt;
        byMonth[monthKey].income += amt;
      } else {
        const absAmt = Math.abs(amt);
        totalExpenses += absAmt;
        byTag[tag].expenses += absAmt;
        byMonth[monthKey].expenses += absAmt;
      }

      byTag[tag].transactions.push({
        date: tx.date,
        concept: tx.concept || '',
        amount: amt,
        memberName: tx.member_name,
      });
    }

    // 4. Stripe diezmo income (charges in date range)
    let stripeIncome = 0;
    try {
      const startTs = start ? Math.floor(new Date(start).getTime() / 1000) : Math.floor(new Date('2020-01-01').getTime() / 1000);
      const endTs = end ? Math.floor(new Date(end).getTime() / 1000) : Math.floor(Date.now() / 1000);

      const charges = await getCharges({
        created: { gte: startTs, lte: endTs },
        limit: 100,
      });

      for (const charge of charges) {
        if (charge.paid && !charge.refunded && charge.amount > 0) {
          stripeIncome += charge.amount;
        }
      }
    } catch (e) {
      console.error('Error fetching Stripe charges for comunidad:', e);
    }

    // Add Stripe to totals
    totalIncome += stripeIncome;

    // 5. Members summary
    const { data: membersData } = await supabase
      .from('diezmos_members')
      .select('id, is_active');

    const { data: paymentsData } = await supabase
      .from('diezmos_payments')
      .select('member_id, month');

    const currentMonth = getMonthKey(new Date());
    const totalMembers = (membersData || []).length;
    const activeMembers = (membersData || []).filter((m: any) => m.is_active).length;
    const payingIds = new Set(
      (paymentsData || []).filter((p: any) => p.month === currentMonth).map((p: any) => p.member_id)
    );
    const payingMembers = payingIds.size;

    // 6. Unmatched diezmo bank transactions (no member_name)
    const unmatchedTxs = (bankTxs || [])
      .filter((tx: any) => {
        const tag = tx.manual_tag || tx.auto_tag || '';
        return (tag === 'Diezmo' || tx.is_diezmo) && parseFloat(tx.amount) > 0 && !tx.member_name;
      })
      .map((tx: any) => ({
        id: tx.id,
        date: tx.date,
        concept: tx.concept || '',
        amount: parseFloat(tx.amount),
      }));

    // 7. Build monthly chart data sorted
    const monthlyChart = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        income: data.income,
        expenses: data.expenses,
        net: data.income - data.expenses,
      }));

    // 8. Tag breakdown sorted
    const tagBreakdown = Object.entries(byTag)
      .filter(([, v]) => v.income > 0 || v.expenses > 0)
      .map(([tag, v]) => ({
        tag,
        income: v.income,
        expenses: v.expenses,
        net: v.income - v.expenses,
        color: diezmoTags.get(tag) || '#8b5cf6',
        count: v.transactions.length,
        transactions: v.transactions
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 30),
      }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

    return NextResponse.json({
      financials: {
        totalIncome,
        totalExpenses,
        net: totalIncome - totalExpenses,
        stripeIncome,
        bankIncome: totalIncome - stripeIncome,
      },
      members: {
        total: totalMembers,
        active: activeMembers,
        paying: payingMembers,
      },
      tagBreakdown,
      monthlyChart,
      unmatchedTxs,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error in comunidad GET:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
