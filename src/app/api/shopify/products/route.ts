import { NextResponse } from 'next/server';
import { getProducts } from '@/lib/shopify';

export async function GET() {
  try {
    const products = await getProducts({ limit: 250 });
    return NextResponse.json({ products });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
