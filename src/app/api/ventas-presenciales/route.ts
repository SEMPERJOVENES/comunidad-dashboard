import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'ventas-presenciales.json');

async function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  try { await fs.mkdir(dir, { recursive: true }); } catch {}
}

async function readSales() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeSales(sales: any[]) {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(sales, null, 2));
}

export async function GET() {
  try {
    const sales = await readSales();
    return NextResponse.json({ sales });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sale = await request.json();
    sale.id = `vp-${Date.now()}`;
    sale.date = sale.date || new Date().toISOString();

    const sales = await readSales();
    sales.unshift(sale);
    await writeSales(sales);

    return NextResponse.json({ sale });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
