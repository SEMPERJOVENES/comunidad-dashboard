import { NextRequest, NextResponse } from 'next/server';
import { getProducts, adjustInventory, getLocations, getInventoryLevels } from '@/lib/shopify';

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

    if (body.action === 'adjust_inventory') {
      // Get location ID — try locations API, fallback to inventory_levels
      let locationId: number | null = null;
      try {
        const locations = await getLocations();
        if (locations && locations.length > 0) locationId = locations[0].id;
      } catch {
        // read_locations scope no disponible — obtener del inventario
      }

      if (!locationId) {
        // Fallback: sacar location_id del primer inventory_level que encontremos
        const products = await getProducts({ limit: 1 });
        const firstVariant = products?.[0]?.variants?.[0];
        if (firstVariant?.inventory_item_id) {
          const levels = await getInventoryLevels([firstVariant.inventory_item_id]);
          if (levels?.length > 0) locationId = levels[0].location_id;
        }
      }

      if (!locationId) {
        return NextResponse.json({ error: 'No se pudo obtener la ubicación. Añade el scope read_locations en tu Custom App de Shopify.' }, { status: 400 });
      }

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
