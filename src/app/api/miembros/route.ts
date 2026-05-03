import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const SELECT_COLS = 'id, name, apellidos, apodo, community, email, phone, fecha_nacimiento, notes, is_active, stripe_subscription_id, stripe_amount, stripe_interval, created_at';

export async function GET() {
  try {
    const [{ data: members, error: mErr }, { data: payments, error: pErr }, { data: communities }] = await Promise.all([
      supabase.from('diezmos_members').select(SELECT_COLS).order('name'),
      supabase.from('diezmos_payments').select('member_id, month, amount'),
      supabase.from('diezmos_communities').select('id, name').order('name'),
    ]);
    if (mErr) throw mErr;
    if (pErr) throw pErr;

    const now = new Date();
    const currentMonth = getMonthKey(now);
    const prevDate = new Date(now);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevMonth = getMonthKey(prevDate);

    const paymentSet = new Set(payments?.map(p => `${p.member_id}__${p.month}`) || []);
    const paymentsByMember = new Map<string, number>();
    for (const p of (payments || [])) {
      paymentsByMember.set(p.member_id, (paymentsByMember.get(p.member_id) || 0) + 1);
    }

    const memberList = (members || []).map(m => ({
      id: m.id,
      name: m.name,
      apellidos: m.apellidos || '',
      apodo: m.apodo || '',
      community: m.community || 'Sin comunidad',
      email: m.email || '',
      phone: m.phone || '',
      fechaNacimiento: m.fecha_nacimiento || null,
      notes: m.notes || '',
      isActive: m.is_active !== false,
      stripeSubscriptionId: m.stripe_subscription_id,
      stripeAmount: m.stripe_amount ? parseFloat(m.stripe_amount) : null,
      stripeInterval: m.stripe_interval,
      paidPrevMonth: paymentSet.has(`${m.id}__${prevMonth}`),
      paidCurrentMonth: paymentSet.has(`${m.id}__${currentMonth}`),
      totalPayments: paymentsByMember.get(m.id) || 0,
      createdAt: m.created_at,
    }));

    return NextResponse.json({
      members: memberList,
      communities: (communities || []).map(c => ({ id: c.id, name: c.name })),
      prevMonth, currentMonth,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'add') {
      const id = body.id || `dm-${Date.now()}`;
      const { error } = await supabase.from('diezmos_members').insert({
        id,
        name: (body.name || '').trim(),
        apellidos: body.apellidos?.trim() || null,
        apodo: body.apodo?.trim() || null,
        community: body.community?.trim() || null,
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        fecha_nacimiento: body.fechaNacimiento || null,
        notes: body.notes?.trim() || null,
        is_active: body.isActive !== false,
      });
      if (error) throw error;
      return NextResponse.json({ success: true, id });
    }

    if (body.action === 'update') {
      if (!body.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });
      const updates: any = {};
      const fields = ['name', 'apellidos', 'apodo', 'community', 'email', 'phone', 'notes'];
      for (const f of fields) {
        if (body[f] !== undefined) updates[f] = (body[f] || '').toString().trim() || null;
      }
      if (body.fechaNacimiento !== undefined) updates.fecha_nacimiento = body.fechaNacimiento || null;
      if (body.isActive !== undefined) updates.is_active = body.isActive;
      const { error } = await supabase.from('diezmos_members').update(updates).eq('id', body.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (body.action === 'delete') {
      if (!body.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });
      const { error } = await supabase.from('diezmos_members').delete().eq('id', body.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (body.action === 'add_community') {
      const id = `com-${(body.name || '').toLowerCase().replace(/\s+/g, '-')}`;
      const { error } = await supabase.from('diezmos_communities').insert({
        id, name: (body.name || '').trim(),
      });
      if (error) throw error;
      return NextResponse.json({ success: true, id });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
