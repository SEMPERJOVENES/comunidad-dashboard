import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';

const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;

function verifyHmac(rawBody: string, hmacHeader: string | null): boolean {
  if (!SHOPIFY_WEBHOOK_SECRET || !hmacHeader) return false;
  const calculated = crypto
    .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody, 'utf8')
    .digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
    const topic = request.headers.get('x-shopify-topic') || '';
    const shopDomain = request.headers.get('x-shopify-shop-domain') || '';

    if (SHOPIFY_WEBHOOK_SECRET && !verifyHmac(rawBody, hmacHeader)) {
      console.warn('[shopify-refund] HMAC inválido', { topic, shopDomain });
      return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    const refundId = payload.id?.toString();
    const orderId = Number(payload.order_id);
    const orderName = payload.order_name || payload.order?.name || null;

    let refundAmount = 0;
    for (const li of (payload.refund_line_items || [])) {
      refundAmount += parseFloat(li.subtotal || '0');
      refundAmount += parseFloat(li.total_tax || '0');
    }
    for (const adj of (payload.order_adjustments || [])) {
      refundAmount += Math.abs(parseFloat(adj.amount || '0'));
    }
    if (!refundAmount) {
      for (const tx of (payload.transactions || [])) {
        if (tx.kind === 'refund' && tx.status === 'success') {
          refundAmount += parseFloat(tx.amount || '0');
        }
      }
    }

    const id = `refund-${refundId || Date.now()}`;
    const { error } = await supabase.from('shopify_refund_events').upsert({
      id,
      order_id: orderId,
      order_name: orderName,
      refund_amount: refundAmount,
      refund_currency: payload.currency || 'EUR',
      refund_note: payload.note || null,
      refund_payload: payload,
    }, { onConflict: 'id' });

    if (error) {
      console.error('[shopify-refund] Supabase error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id, refundAmount });
  } catch (error: any) {
    console.error('[shopify-refund] Error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET para health-check
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'shopify-refund webhook' });
}
