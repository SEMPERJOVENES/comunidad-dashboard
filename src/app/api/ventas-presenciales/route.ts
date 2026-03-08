import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('ventas_presenciales')
      .select('*')
      .order('date', { ascending: false });

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
    }));

    return NextResponse.json({ sales });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error fetching ventas:', message);
    return NextResponse.json({ sales: [], error: message }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sale = await request.json();
    const id = `vp-${Date.now()}`;
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('ventas_presenciales')
      .insert({
        id,
        date: sale.date || now,
        customer_name: sale.customerName,
        payment_method: sale.paymentMethod,
        total_amount: sale.totalAmount,
        items: sale.items || [],
        notes: sale.notes || null,
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
    };

    return NextResponse.json({ sale: formatted });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error creating venta:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
