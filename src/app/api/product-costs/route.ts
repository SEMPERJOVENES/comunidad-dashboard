import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('product_costs')
      .select('*')
      .order('shopify_product_id', { ascending: true });

    if (error) throw error;

    // Indexar por product_id para acceso rápido en el frontend
    const costMap: Record<string, { cost_price: number; category: string; notes: string | null; id: number }> = {};
    for (const row of (data || [])) {
      const key = row.shopify_variant_id
        ? `${row.shopify_product_id}_${row.shopify_variant_id}`
        : `${row.shopify_product_id}`;
      costMap[key] = {
        cost_price: parseFloat(row.cost_price) || 0,
        category: row.category || 'inventario',
        notes: row.notes,
        id: row.id,
      };
    }

    return NextResponse.json({ costs: data || [], costMap });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'upsert') {
      // Upsert: insertar o actualizar coste de un producto
      const { shopify_product_id, shopify_variant_id, cost_price, category, notes } = body;

      if (!shopify_product_id) {
        return NextResponse.json({ error: 'shopify_product_id es obligatorio' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('product_costs')
        .upsert(
          {
            shopify_product_id,
            shopify_variant_id: shopify_variant_id || null,
            cost_price: parseFloat(cost_price) || 0,
            category: category || 'inventario',
            notes: notes || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'shopify_product_id,shopify_variant_id' }
        )
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ success: true, cost: data });
    }

    if (body.action === 'bulk_upsert') {
      // Bulk upsert: actualizar varios costes a la vez
      const items = body.items as Array<{
        shopify_product_id: number;
        shopify_variant_id?: number;
        cost_price: number;
        category?: string;
        notes?: string;
      }>;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: 'items es obligatorio y debe ser un array' }, { status: 400 });
      }

      const rows = items.map((item) => ({
        shopify_product_id: item.shopify_product_id,
        shopify_variant_id: item.shopify_variant_id || null,
        cost_price: parseFloat(String(item.cost_price)) || 0,
        category: item.category || 'inventario',
        notes: item.notes || null,
        updated_at: new Date().toISOString(),
      }));

      const { data, error } = await supabase
        .from('product_costs')
        .upsert(rows, { onConflict: 'shopify_product_id,shopify_variant_id' })
        .select();

      if (error) throw error;

      return NextResponse.json({ success: true, count: data?.length || 0 });
    }

    if (body.action === 'delete') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'id es obligatorio' }, { status: 400 });

      const { error } = await supabase.from('product_costs').delete().eq('id', id);
      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
