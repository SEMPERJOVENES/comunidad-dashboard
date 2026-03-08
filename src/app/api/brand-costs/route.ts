import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'brand-costs.json');

interface BrandCost {
  id: string;
  date: string;
  type: 'cogs' | 'shipping' | 'influencer' | 'shopify_fee' | 'other';
  description: string;
  amount: number;
  product?: string;
}

function loadCosts(): BrandCost[] {
  if (!existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveCosts(costs: BrandCost[]) {
  writeFileSync(DATA_FILE, JSON.stringify(costs, null, 2), 'utf-8');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    let costs = loadCosts();

    if (start) costs = costs.filter(c => c.date >= start.split('T')[0]);
    if (end) costs = costs.filter(c => c.date <= end.split('T')[0]);

    // Aggregate by type
    const byType: Record<string, number> = {};
    let total = 0;
    for (const c of costs) {
      byType[c.type] = (byType[c.type] || 0) + c.amount;
      total += c.amount;
    }

    // Monthly aggregate
    const byMonth: Record<string, number> = {};
    for (const c of costs) {
      const month = c.date.substring(0, 7);
      byMonth[month] = (byMonth[month] || 0) + c.amount;
    }

    return NextResponse.json({
      costs: costs.sort((a, b) => b.date.localeCompare(a.date)),
      byType,
      byMonth,
      total,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'add') {
      const costs = loadCosts();
      const newCost: BrandCost = {
        id: `bc-${Date.now()}`,
        date: body.date || new Date().toISOString().split('T')[0],
        type: body.type || 'other',
        description: body.description || '',
        amount: parseFloat(body.amount) || 0,
        product: body.product || undefined,
      };
      costs.push(newCost);
      saveCosts(costs);
      return NextResponse.json({ success: true, cost: newCost });
    }

    if (body.action === 'delete') {
      const costs = loadCosts().filter(c => c.id !== body.id);
      saveCosts(costs);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
