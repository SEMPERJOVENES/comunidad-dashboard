import { NextRequest, NextResponse } from 'next/server';
import { getAllOrders } from '@/lib/shopify';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    const orders = await getAllOrders({
      created_at_min: startDate || undefined,
      created_at_max: endDate || undefined,
      status: 'any',
    });

    return NextResponse.json({ orders, total: orders.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
