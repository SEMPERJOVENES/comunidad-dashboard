import { NextRequest, NextResponse } from 'next/server';
import { getBalance, getPayouts, getCharges, getPaymentVolume } from '@/lib/stripe';
import { subDays } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const gte = Math.floor(subDays(new Date(), days).getTime() / 1000);

    const [balance, payouts, charges, volume] = await Promise.all([
      getBalance(),
      getPayouts({ limit: 10 }),
      getCharges({ limit: 20, created: { gte } }),
      getPaymentVolume({ created: { gte } }),
    ]);

    return NextResponse.json({ balance, payouts, charges, volume });
  } catch (error: any) {
    console.error('Stripe API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
