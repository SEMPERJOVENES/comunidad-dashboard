import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export async function GET() {
  try {
    const [{ data: members, error: mErr }, { data: payments, error: pErr }] = await Promise.all([
      supabase.from('diezmos_members').select('id, name, community, is_active').order('name'),
      supabase.from('diezmos_payments').select('member_id, month'),
    ]);
    if (mErr) throw mErr;
    if (pErr) throw pErr;

    const now = new Date();
    const currentMonth = getMonthKey(now);
    const prevDate = new Date(now);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevMonth = getMonthKey(prevDate);

    const paymentSet = new Set(payments?.map(p => `${p.member_id}__${p.month}`) || []);

    const memberList = (members || []).map(m => ({
      id: m.id,
      name: m.name,
      community: m.community || 'Sin comunidad',
      isActive: m.is_active,
      paidPrevMonth: paymentSet.has(`${m.id}__${prevMonth}`),
      paidCurrentMonth: paymentSet.has(`${m.id}__${currentMonth}`),
    }));

    return NextResponse.json({ members: memberList, prevMonth, currentMonth });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
