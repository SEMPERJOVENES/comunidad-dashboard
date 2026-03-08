import { NextRequest, NextResponse } from 'next/server';
import { getProducts, adjustInventory, getLocations } from '@/lib/shopify';

export async function GET() {
  try {
    const products = await getProducts({ limit: 250 });
    return NextResponse.json({ products });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'adjust_inventory') {
      // Get the first location (usually the only one for small stores)
      const locations = await getLocations();
      if (!locations || locations.length === 0) {
        return NextResponse.json({ error: 'No se encontraron ubicaciones en Shopify' }, { status: 400 });
      }
      const locationId = locations[0].id;

      // Get inventory_item_id from variant
      const products = await getProducts({ limit: 250 });
      const product = products.find((p: any) => p.id === body.productId);
      if (!product) {
        return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
      }
      const variant = product.variants?.find((v: any) => v.id === body.variantId);
      if (!variant) {
        return NextResponse.json({ error: 'Variante no encontrada' }, { status: 404 });
      }

      const inventoryItemId = variant.inventory_item_id;
      const result = await adjustInventory(inventoryItemId, locationId, body.adjustment);

      return NextResponse.json({ success: true, inventory_level: result });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
