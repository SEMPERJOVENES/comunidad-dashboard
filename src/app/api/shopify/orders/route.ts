import { NextRequest, NextResponse } from 'next/server';
import { getOrders } from '@/lib/shopify';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    const limit = searchParams.get('limit');

    const orders = await getOrders({
      created_at_min: startDate || undefined,
      created_at_max: endDate || undefined,
      limit: limit ? parseInt(limit) : 250,
    });

    return NextResponse.json({ orders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
