import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    let query = supabase
      .from('ventas_presenciales')
      .select('*')
      .order('date', { ascending: false });

    if (start) query = query.gte('date', new Date(start).toISOString());
    if (end) query = query.lte('date', new Date(end).toISOString());

    const { data, error } = await query;

    if (error) throw error;

    // Map to frontend format
    const sales = (data || []).map((row: any) => ({
      id: row.id,
      date: row.date,
      customerName: row.customer_name,
      paymentMethod: row.payment_method,
      totalAmount: parseFloat(row.total_amount),
      items: row.items || [],
      notes: row.notes,
      bankTransactionId: row.bank_transaction_id || null,
      saleType: row.sale_type || 'venta',
      costLoss: parseFloat(row.cost_loss || '0'),
    }));

    return NextResponse.json({ sales });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error fetching ventas:', message);
    return NextResponse.json({ sales: [], error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Link/unlink bank transaction
    if (body.action === 'link_bank_tx') {
      const { error } = await supabase.from('ventas_presenciales')
        .update({ bank_transaction_id: body.bankTransactionId })
        .eq('id', body.saleId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (body.action === 'unlink_bank_tx') {
      const { error } = await supabase.from('ventas_presenciales')
        .update({ bank_transaction_id: null })
        .eq('id', body.saleId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // Bulk insert (varias ventas a la vez — útil para importar CSV)
    if (body.action === 'bulk_insert') {
      const sales = body.sales as any[];
      if (!sales?.length) {
        return NextResponse.json({ error: 'sales requerido' }, { status: 400 });
      }
      const rows = sales.map((s: any, idx: number) => ({
        id: s.id || `vp-${Date.now()}-${idx}`,
        date: s.date || new Date().toISOString(),
        customer_name: s.customerName,
        payment_method: s.paymentMethod,
        total_amount: s.totalAmount || 0,
        items: s.items || [],
        notes: s.notes || null,
        sale_type: s.saleType || (s.paymentMethod === 'regalo' ? 'regalo' : 'venta'),
        cost_loss: s.costLoss || 0,
      }));
      const { data, error } = await supabase
        .from('ventas_presenciales')
        .insert(rows)
        .select();
      if (error) throw error;
      return NextResponse.json({ success: true, count: data?.length || 0, sales: data });
    }

    // Create new sale (default action)
    const sale = body;
    const id = sale.id || `vp-${Date.now()}`;
    const now = new Date().toISOString();
    const isRegalo = sale.paymentMethod === 'regalo' || sale.saleType === 'regalo';

    const { data, error } = await supabase
      .from('ventas_presenciales')
      .insert({
        id,
        date: sale.date || now,
        customer_name: sale.customerName,
        payment_method: sale.paymentMethod,
        total_amount: isRegalo ? 0 : sale.totalAmount,
        items: sale.items || [],
        notes: sale.notes || null,
        sale_type: isRegalo ? 'regalo' : 'venta',
        cost_loss: sale.costLoss || 0,
      })
      .select()
      .single();

    if (error) throw error;

    const formatted = {
      id: data.id,
      date: data.date,
      customerName: data.customer_name,
      paymentMethod: data.payment_method,
      totalAmount: parseFloat(data.total_amount),
      items: data.items || [],
      notes: data.notes,
      bankTransactionId: data.bank_transaction_id || null,
      saleType: data.sale_type || 'venta',
      costLoss: parseFloat(data.cost_loss || '0'),
    };

    return NextResponse.json({ sale: formatted });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error creating venta:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
