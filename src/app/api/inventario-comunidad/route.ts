import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Fetch manual inventory items
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
      source: 'manual' as const,
    }));

    // Fetch bank transactions tagged as "Material"
    const { data: bankData, error: bankError } = await supabase
      .from('bank_transactions')
      .select('*')
      .or('auto_tag.eq.Material,manual_tag.eq.Material')
      .order('date', { ascending: false });

    if (bankError) console.error('Bank fetch error:', bankError);

    const bankItems = (bankData || []).map(row => ({
      id: `bank_${row.id}`,
      name: row.concept || 'Movimiento bancario',
      category: 'Material',
      quantity: 1,
      unitCost: Math.abs(parseFloat(row.amount || '0')),
      totalCost: Math.abs(parseFloat(row.amount || '0')),
      purchaseDate: row.date,
      fundedBy: 'Banco',
      notes: `Auto-importado del extracto bancario`,
      source: 'bank' as const,
    }));

    return NextResponse.json({ items, bankItems });
  } catch (error: any) {
    console.error('Inventory API error:', error);
    return NextResponse.json({ items: [], bankItems: [], error: error.message }, { status: 500 });
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

    if (action === 'update') {
      const { id, name, category, quantity, unitCost, totalCost, purchaseDate, fundedBy, notes } = body;
      const { error } = await supabase.from('community_inventory').update({
        name,
        category,
        quantity: quantity || 1,
        unit_cost: unitCost || 0,
        total_cost: totalCost || 0,
        purchase_date: purchaseDate,
        funded_by: fundedBy || 'Diezmo',
        notes: notes || '',
      }).eq('id', id);
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
