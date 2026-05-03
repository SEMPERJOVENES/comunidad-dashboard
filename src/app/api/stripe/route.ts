import { NextRequest, NextResponse } from 'next/server';
import { getBalance, getPayouts, getAllCharges, getAllPaymentVolume, getPayoutBreakdown } from '@/lib/stripe';
import { subDays } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const breakdownOnly = searchParams.get('breakdown') === '1';
    const payoutId = searchParams.get('payoutId');

    // Endpoint específico para obtener breakdown de UN payout
    if (payoutId) {
      const bd = await getPayoutBreakdown(payoutId);
      return NextResponse.json({ breakdown: bd });
    }

    const gte = start
      ? Math.floor(new Date(start).getTime() / 1000)
      : Math.floor(subDays(new Date(), 30).getTime() / 1000);
    const lte = end
      ? Math.floor(new Date(end).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    const [balance, payouts, charges, volume] = await Promise.all([
      getBalance(),
      getPayouts({ limit: 50, created: { gte, lte } }),
      getAllCharges({ created: { gte, lte } }),
      getAllPaymentVolume({ created: { gte, lte } }),
    ]);

    // Para cada payout, obtener su breakdown (cuánto es subs vs one-time)
    let payoutsWithBreakdown = payouts;
    if (!breakdownOnly) {
      payoutsWithBreakdown = await Promise.all(
        payouts.map(async (p) => {
          try {
            const bd = await getPayoutBreakdown(p.id);
            return { ...p, breakdown: bd };
          } catch {
            return p;
          }
        })
      );
    }

    return NextResponse.json({ balance, payouts: payoutsWithBreakdown, charges, volume });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Stripe API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
