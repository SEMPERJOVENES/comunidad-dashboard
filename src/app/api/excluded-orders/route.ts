import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('excluded_orders')
      .select('*')
      .order('excluded_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ excluded: data || [] });
  } catch (error: any) {
    return NextResponse.json({ excluded: [], error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'add') {
      const { order_id, order_name, reason } = body;
      if (!order_id) {
        return NextResponse.json({ error: 'order_id requerido' }, { status: 400 });
      }
      const { error } = await supabase.from('excluded_orders').upsert({
        order_id,
        order_name: order_name || null,
        reason: reason || null,
      }, { onConflict: 'order_id' });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (body.action === 'add_bulk') {
      const items = body.items as Array<{ order_id: number; order_name?: string; reason?: string }>;
      if (!items?.length) {
        return NextResponse.json({ error: 'items requerido' }, { status: 400 });
      }
      const rows = items.map(i => ({
        order_id: i.order_id,
        order_name: i.order_name || null,
        reason: i.reason || null,
      }));
      const { error } = await supabase.from('excluded_orders').upsert(rows, { onConflict: 'order_id' });
      if (error) throw error;
      return NextResponse.json({ success: true, count: rows.length });
    }

    if (body.action === 'remove') {
      const { order_id } = body;
      if (!order_id) {
        return NextResponse.json({ error: 'order_id requerido' }, { status: 400 });
      }
      const { error } = await supabase.from('excluded_orders').delete().eq('order_id', order_id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
