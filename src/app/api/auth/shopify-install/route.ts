import { NextRequest, NextResponse } from 'next/server';

// Endpoint para capturar el code OAuth de Shopify e intercambiarlo por access_token.
// Muestra el token en pantalla para copiarlo.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const shop = searchParams.get('shop');
  const state = searchParams.get('state');

  if (!code || !shop) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:system-ui;padding:40px;background:#f5f5f5">
      <h1>⚠️ Falta code o shop</h1>
      <p>Esta URL espera un callback OAuth de Shopify con ?code=...&shop=...</p>
      <pre style="background:#fff;padding:20px;border-radius:8px">URL recibida: ${request.url}</pre>
      </body></html>`,
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  const clientId = process.env.SHOPIFY_INSTALL_CLIENT_ID || process.env.SHOPIFY_CLIENT_ID || '';
  const clientSecret = process.env.SHOPIFY_INSTALL_CLIENT_SECRET || process.env.SHOPIFY_CLIENT_SECRET || '';

  if (!clientId || !clientSecret) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:system-ui;padding:40px;background:#f5f5f5">
      <h1>❌ Faltan credenciales del servidor</h1>
      <p>SHOPIFY_INSTALL_CLIENT_ID o SHOPIFY_INSTALL_CLIENT_SECRET no están configuradas en Vercel env.</p>
      <h2>Code recibido (cópialo y pásalo a Claude para intercambio manual):</h2>
      <pre style="background:#fff;padding:20px;border-radius:8px;font-size:14px">code: ${code}
shop: ${shop}
state: ${state || '-'}</pre>
      </body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }

  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      throw new Error(`Shopify ${tokenRes.status}: ${errBody}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const scope = tokenData.scope;

    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:system-ui;padding:40px;background:#f5f5f5;max-width:800px;margin:0 auto">
      <h1>✅ Instalación OK</h1>
      <p>App instalada en <strong>${shop}</strong></p>
      <h2>Admin API access token (cópialo):</h2>
      <pre style="background:#000;color:#0f0;padding:20px;border-radius:8px;font-size:16px;word-break:break-all;user-select:all">${accessToken}</pre>
      <h3>Scopes concedidos:</h3>
      <pre style="background:#fff;padding:20px;border-radius:8px;font-size:12px">${scope}</pre>
      <p style="color:#666;font-size:14px">Pega ese token en el chat. Después de pegarlo, REVOCA acceso desde Shopify Admin → Apps si quieres invalidarlo.</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (err: any) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:system-ui;padding:40px;background:#fee">
      <h1>❌ Error intercambiando code</h1>
      <pre style="background:#fff;padding:20px;border-radius:8px">${err.message || err}</pre>
      <h2>Code para intercambio manual:</h2>
      <pre style="background:#fff;padding:20px;border-radius:8px">code: ${code}
shop: ${shop}</pre>
      </body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
}
