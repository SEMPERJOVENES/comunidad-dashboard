import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    let query = supabase
      .from('brand_costs')
      .select('*')
      .order('date', { ascending: false });

    if (start) {
      const startDate = start.split('T')[0];
      query = query.gte('date', startDate);
    }
    if (end) {
      const endDate = end.split('T')[0];
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;
    if (error) throw error;

    const costs = data || [];

    // Aggregate by type
    const byType: Record<string, number> = {};
    let total = 0;
    for (const c of costs) {
      const amt = parseFloat(c.amount) || 0;
      byType[c.type] = (byType[c.type] || 0) + amt;
      total += amt;
    }

    // Monthly aggregate
    const byMonth: Record<string, number> = {};
    for (const c of costs) {
      const month = c.date.substring(0, 7);
      const amt = parseFloat(c.amount) || 0;
      byMonth[month] = (byMonth[month] || 0) + amt;
    }

    return NextResponse.json({
      costs,
      byType,
      byMonth,
      total,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'add') {
      const newCost = {
        id: `bc-${Date.now()}`,
        date: body.date || new Date().toISOString().split('T')[0],
        type: body.type || 'other',
        description: body.description || '',
        amount: parseFloat(body.amount) || 0,
        product: body.product || null,
      };

      const { data, error } = await supabase
        .from('brand_costs')
        .insert(newCost)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ success: true, cost: data });
    }

    if (body.action === 'delete') {
      if (!body.id) {
        return NextResponse.json({ error: 'id es obligatorio' }, { status: 400 });
      }

      const { error } = await supabase
        .from('brand_costs')
        .delete()
        .eq('id', body.id);

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
