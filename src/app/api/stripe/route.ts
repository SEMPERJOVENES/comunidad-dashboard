import { NextRequest, NextResponse } from 'next/server';
import { getBalance, getPayouts, getAllCharges, getAllPaymentVolume } from '@/lib/stripe';
import { subDays } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    const gte = start
      ? Math.floor(new Date(start).getTime() / 1000)
      : Math.floor(subDays(new Date(), 30).getTime() / 1000);
    const lte = end
      ? Math.floor(new Date(end).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    const [balance, payouts, charges, volume] = await Promise.all([
      getBalance(),
      getPayouts({ limit: 10, created: { gte, lte } }),
      getAllCharges({ created: { gte, lte } }),
      getAllPaymentVolume({ created: { gte, lte } }),
    ]);

    return NextResponse.json({ balance, payouts, charges, volume });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Stripe API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
