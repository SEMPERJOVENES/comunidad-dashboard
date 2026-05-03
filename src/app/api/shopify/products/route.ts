import { NextRequest, NextResponse } from 'next/server';
import { getProducts, setInventory, getLocations, getInventoryLevels } from '@/lib/shopify';

const SHOPIFY_STORE = process.env.SHOPIFY_STORE!;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN!;
const API_VERSION = '2025-04';

async function shopifyRequest(endpoint: string, method: string, body?: any) {
  const res = await fetch(`https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Shopify ${method} ${endpoint} → ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function resolveLocationId(inventoryItemIdHint?: number): Promise<number | null> {
  try {
    const locations = await getLocations();
    if (locations?.length > 0) return locations[0].id;
  } catch {}
  if (inventoryItemIdHint) {
    try {
      const levels = await getInventoryLevels([inventoryItemIdHint]);
      if (levels?.length > 0) return levels[0].location_id;
    } catch {}
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const noCache = searchParams.get('fresh') === '1';
    const products = await getProducts({ limit: 250, noCache });
    return NextResponse.json({ products });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'set_inventory') {
      const { inventoryItemId, targetStock } = body;
      if (!inventoryItemId || targetStock === undefined) {
        return NextResponse.json({ error: 'Faltan inventoryItemId o targetStock' }, { status: 400 });
      }
      const locationId = await resolveLocationId(inventoryItemId);
      if (!locationId) {
        return NextResponse.json({ error: 'No se pudo obtener la ubicación. Revisa el scope read_locations en Shopify.' }, { status: 400 });
      }
      const result = await setInventory(inventoryItemId, locationId, Math.max(0, targetStock));
      return NextResponse.json({ success: true, inventory_level: result });
    }

    // Bulk set inventory para múltiples variants en una sola llamada
    if (body.action === 'bulk_set_inventory') {
      const items = body.items as Array<{ inventoryItemId: number; targetStock: number }>;
      if (!items?.length) {
        return NextResponse.json({ error: 'items requerido' }, { status: 400 });
      }
      const locationId = await resolveLocationId(items[0]?.inventoryItemId);
      if (!locationId) {
        return NextResponse.json({ error: 'No se pudo obtener la ubicación' }, { status: 400 });
      }
      const results: Array<{ inventoryItemId: number; success: boolean; error?: string }> = [];
      for (const item of items) {
        try {
          await setInventory(item.inventoryItemId, locationId, Math.max(0, item.targetStock));
          results.push({ inventoryItemId: item.inventoryItemId, success: true });
        } catch (e: any) {
          results.push({ inventoryItemId: item.inventoryItemId, success: false, error: e.message });
        }
      }
      return NextResponse.json({ success: true, results });
    }

    // Crear variants por talla en un producto
    // Body: { action:'add_size_variants', productId, sizes:[{title,qty,price}], optionName? }
    if (body.action === 'add_size_variants') {
      const { productId, sizes, optionName } = body;
      if (!productId || !sizes?.length) {
        return NextResponse.json({ error: 'productId y sizes requeridos' }, { status: 400 });
      }

      const productData = await shopifyRequest(`products/${productId}.json`, 'GET');
      const product = productData?.product;
      if (!product) {
        return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
      }

      const currentVariants = product.variants || [];
      const isDefaultOnly = currentVariants.length === 1 && currentVariants[0].option1 === 'Default Title';

      const newOptions = [{ name: optionName || 'Talla' }];
      const newVariants = sizes.map((s: any) => ({
        option1: s.title,
        price: s.price || currentVariants[0]?.price || '25.00',
        inventory_management: 'shopify',
        inventory_policy: 'deny',
      }));

      const updated = await shopifyRequest(`products/${productId}.json`, 'PUT', {
        product: { id: productId, options: newOptions, variants: newVariants },
      });

      const newProduct = updated?.product;
      const inventoryResults: Array<{ size: string; qty: number; success: boolean; error?: string }> = [];
      const locationId = await resolveLocationId(newProduct?.variants?.[0]?.inventory_item_id);

      if (locationId && newProduct?.variants) {
        for (const v of newProduct.variants) {
          const matchingSize = sizes.find((s: any) => s.title === v.option1);
          const qty = matchingSize?.qty || 0;
          try {
            await setInventory(v.inventory_item_id, locationId, Math.max(0, qty));
            inventoryResults.push({ size: v.option1, qty, success: true });
          } catch (e: any) {
            inventoryResults.push({ size: v.option1, qty, success: false, error: e.message });
          }
        }
      }

      return NextResponse.json({
        success: true,
        product: newProduct,
        inventoryResults,
        replacedDefault: isDefaultOnly,
      });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
