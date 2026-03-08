import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSubscriptions } from '@/lib/stripe';

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

    // 4. Get Stripe subscriptions for "Diezmo" products
    let stripeSubs: any[] = [];
    try {
      const allSubs = await getSubscriptions({ status: 'active', limit: 100 });
      stripeSubs = allSubs.filter(s =>
        s.productName.toLowerCase().includes('diezmo') ||
        s.productName.toLowerCase().includes('tithe')
      );
    } catch {}

    // 5. Get bank transactions tagged as diezmo
    const { data: bankDiezmos } = await supabase
      .from('bank_transactions')
      .select('*')
      .or('is_diezmo.eq.true,manual_tag.eq.Diezmo,auto_tag.eq.Diezmo');

    // 6. Match Stripe subscriptions to members
    for (const sub of stripeSubs) {
      const subName = normalize(sub.customerName || '');
      const subEmail = (sub.customerEmail || '').toLowerCase();

      const matched = members.find((m: any) => {
        const mName = normalize(m.name);
        return mName === subName ||
          subName.includes(mName) || mName.includes(subName) ||
          (m.email && m.email.toLowerCase() === subEmail);
      });

      if (matched) {
        matched.stripeSubscriptionId = sub.id;
        matched.stripeAmount = sub.amount;
        matched.stripeInterval = sub.interval;
        matched.email = sub.customerEmail || matched.email;

        // Update Stripe info in DB
        await supabase.from('diezmos_members').update({
          stripe_subscription_id: sub.id,
          stripe_amount: sub.amount,
          stripe_interval: sub.interval,
          email: sub.customerEmail || matched.email,
        }).eq('id', matched.id);

        // Mark current month as paid via Stripe
        const currentMonth = getMonthKey(new Date());
        if (!matched.payments[currentMonth]) {
          const monthlyAmount = sub.interval === 'year' ? sub.amount / 12 : sub.amount;
          matched.payments[currentMonth] = { amount: monthlyAmount, source: 'stripe' };

          // Upsert payment in DB
          await supabase.from('diezmos_payments').upsert({
            id: `dp-stripe-${matched.id}-${currentMonth}`,
            member_id: matched.id,
            month: currentMonth,
            amount: monthlyAmount,
            source: 'stripe',
          }, { onConflict: 'member_id,month' });
        }
      }
    }

    // 7. Match bank diezmo transactions to members
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
          matched.payments[monthKey] = {
            amount: existing.amount + amt,
            source: existing.source === 'stripe' ? 'ambos' : 'banco',
          };
        } else {
          matched.payments[monthKey] = { amount: amt, source: 'banco' };
        }

        // Upsert payment in DB
        await supabase.from('diezmos_payments').upsert({
          id: `dp-banco-${matched.id}-${monthKey}`,
          member_id: matched.id,
          month: monthKey,
          amount: matched.payments[monthKey].amount,
          source: matched.payments[monthKey].source,
        }, { onConflict: 'member_id,month' });
      }
    }

    // 8. Build summary
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

    return NextResponse.json({
      members,
      communities,
      communityStats,
      summary: {
        totalMensual,
        totalMembers: members.length,
        totalActive,
        totalPaying,
        fromStripe: stripeSubs.length,
        fromBanco: (bankDiezmos || []).length,
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
      // Payments are cascaded automatically via FK
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
