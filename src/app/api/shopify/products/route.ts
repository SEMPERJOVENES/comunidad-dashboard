import { NextRequest, NextResponse } from 'next/server';
import { getProducts, setInventory, getLocations, getInventoryLevels } from '@/lib/shopify';

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

      // Obtener location_id
      let locationId: number | null = null;
      try {
        const locations = await getLocations();
        if (locations?.length > 0) locationId = locations[0].id;
      } catch {
        // read_locations scope no disponible
      }

      if (!locationId) {
        // Fallback: sacar location_id del inventory_level del propio item
        const levels = await getInventoryLevels([inventoryItemId]);
        if (levels?.length > 0) locationId = levels[0].location_id;
      }

      if (!locationId) {
        return NextResponse.json({ error: 'No se pudo obtener la ubicación. Revisa el scope read_locations en Shopify.' }, { status: 400 });
      }

      // Set directo — sin leer stock actual, sin race conditions
      const result = await setInventory(inventoryItemId, locationId, Math.max(0, targetStock));
      return NextResponse.json({ success: true, inventory_level: result });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
