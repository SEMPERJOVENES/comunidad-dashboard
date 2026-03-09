import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('community_inventory')
      .select('*')
      .order('purchase_date', { ascending: false });

    if (error) throw error;

    const items = (data || []).map(row => ({
      id: row.id,
      name: row.name,
      category: row.category,
      quantity: row.quantity,
      unitCost: parseFloat(row.unit_cost || '0'),
      totalCost: parseFloat(row.total_cost || '0'),
      purchaseDate: row.purchase_date,
      fundedBy: row.funded_by || 'Diezmo',
      notes: row.notes || '',
    }));

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error('Inventory API error:', error);
    return NextResponse.json({ items: [], error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'add') {
      const { name, category, quantity, unitCost, totalCost, purchaseDate, fundedBy, notes } = body;
      const { error } = await supabase.from('community_inventory').insert({
        name,
        category,
        quantity: quantity || 1,
        unit_cost: unitCost || 0,
        total_cost: totalCost || 0,
        purchase_date: purchaseDate,
        funded_by: fundedBy || 'Diezmo',
        notes: notes || '',
      });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      const { id } = body;
      const { error } = await supabase.from('community_inventory').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    console.error('Inventory POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
