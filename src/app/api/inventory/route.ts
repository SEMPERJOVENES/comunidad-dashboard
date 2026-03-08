import { NextRequest, NextResponse } from 'next/server';
import { getProducts, getLocations, adjustInventory } from '@/lib/shopify';

export async function GET() {
  try {
    const [products, locations] = await Promise.all([
      getProducts({ limit: 250 }),
      getLocations(),
    ]);

    const inventory = products.map((p: any) => ({
      id: p.id,
      title: p.title,
      image: p.images?.[0]?.src || null,
      status: p.status,
      product_type: p.product_type,
      variants: (p.variants || []).map((v: any) => ({
        id: v.id,
        title: v.title,
        sku: v.sku,
        price: v.price,
        inventory_quantity: v.inventory_quantity,
        inventory_item_id: v.inventory_item_id,
      })),
      totalStock: (p.variants || []).reduce((sum: number, v: any) => sum + (v.inventory_quantity || 0), 0),
    }));

    return NextResponse.json({ inventory, locations });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inventoryItemId, locationId, adjustment } = body;

    if (!inventoryItemId || !locationId || adjustment === undefined) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const result = await adjustInventory(inventoryItemId, locationId, adjustment);
    return NextResponse.json({ result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
