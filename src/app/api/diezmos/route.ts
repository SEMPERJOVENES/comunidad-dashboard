import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSubscriptions, getInvoices } from '@/lib/stripe';

function normalize(name: string) {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, '').trim();
}

function getMonthKey(date: string | Date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function GET() {
  try {
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
        const mName = normalize(m.name);
        if (m.stripeSubscriptionId === sub.id) return true;
        return mName === subName ||
          subName.includes(mName) || mName.includes(subName) ||
          (m.email && m.email.toLowerCase() === subEmail);
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

    // 6. Get paid Stripe invoices from Jan 2026 for payment history
    let stripeInvoices: any[] = [];
    try {
      const jan2026 = new Date('2026-01-01T00:00:00Z');
      stripeInvoices = await getInvoices({
        created: { gte: Math.floor(jan2026.getTime() / 1000) },
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
        const invName = normalize(inv.customerName || '');
        const invEmail = (inv.customerEmail || '').toLowerCase();
        const mName = normalize(m.name);
        return mName === invName || invName.includes(mName) || mName.includes(invName) ||
          (m.email && m.email.toLowerCase() === invEmail);
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

    // 8. Get bank diezmo transactions
    const { data: bankDiezmos } = await supabase
      .from('bank_transactions')
      .select('*')
      .or('is_diezmo.eq.true,manual_tag.eq.Diezmo,auto_tag.eq.Diezmo');

    // 9. Match bank transactions to members
    for (const tx of (bankDiezmos || [])) {
      const txName = normalize(tx.member_name || tx.concept || '');
      const monthKey = getMonthKey(tx.date);

      const matched = members.find((m: any) => {
        const mName = normalize(m.name);
        return txName.includes(mName) || mName.includes(txName);
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

    // 10. Build summary
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
      },
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
