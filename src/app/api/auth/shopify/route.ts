import { NextRequest, NextResponse } from 'next/server';

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Step 1: Redirect to Shopify OAuth
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get('shop');

  // If we have a code, exchange it for a token
  const code = searchParams.get('code');
  if (code && shop) {
    return exchangeToken(shop, code);
  }

  // Otherwise, start OAuth flow
  if (!shop) {
    return NextResponse.json({ error: 'Parámetro shop requerido' }, { status: 400 });
  }

  const scopes = 'read_orders,read_products,read_customers,read_inventory,read_analytics,read_shopify_payments_bank_accounts,read_shopify_payments_disputes';
  const redirectUri = `${APP_URL}/api/auth/shopify`;
  const nonce = Math.random().toString(36).substring(7);

  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_CLIENT_ID}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${nonce}`;

  return NextResponse.redirect(authUrl);
}

async function exchangeToken(shop: string, code: string) {
  const tokenUrl = `https://${shop}/admin/oauth/access_token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
      code,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error: `Error obteniendo token: ${error}` }, { status: 500 });
  }

  const data = await response.json();

  // In production, save this token securely
  return NextResponse.json({
    success: true,
    message: 'Token obtenido correctamente. Agréguelo a SHOPIFY_ACCESS_TOKEN en las variables de entorno.',
    access_token: data.access_token,
    scope: data.scope,
  });
}
