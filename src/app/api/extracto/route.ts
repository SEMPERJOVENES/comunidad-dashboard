import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'extracto.json');

async function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  try { await fs.mkdir(dir, { recursive: true }); } catch {}
}

async function readTransactions() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeTransactions(txs: any[]) {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(txs, null, 2));
}

// Auto-tagging rules
function autoTagTransaction(tx: any) {
  const concept = (tx.concept || '').toLowerCase();

  // Stripe transfers
  if (concept.includes('stripe') || concept.includes('sp ')) {
    tx.autoTag = 'Stripe';
    tx.category = 'stripe';
    return tx;
  }

  // Shopify
  if (concept.includes('shopify')) {
    tx.autoTag = 'Shopify';
    tx.category = 'ecommerce';
    return tx;
  }

  // Bizum - likely presential sales or diezmos
  if (concept.includes('bizum')) {
    tx.autoTag = 'Bizum';
    tx.category = 'bizum';
    // Extract name from concept
    const nameMatch = concept.match(/bizum\s+(?:de\s+)?(.+)/i);
    if (nameMatch) tx.memberName = nameMatch[1].trim();
    return tx;
  }

  // Transferencia
  if (concept.includes('transferencia') || concept.includes('transf')) {
    tx.autoTag = 'Transferencia';
    tx.category = 'transferencia';
    return tx;
  }

  // Diezmo keywords
  if (concept.includes('diezmo') || concept.includes('ofrenda') || concept.includes('donación') || concept.includes('donacion')) {
    tx.autoTag = 'Diezmo';
    tx.category = 'diezmo';
    tx.isDiezmo = true;
    return tx;
  }

  // Comisiones bancarias
  if (concept.includes('comisión') || concept.includes('comision') || concept.includes('mantenimiento') || concept.includes('liquidación')) {
    tx.autoTag = 'Comisión bancaria';
    tx.category = 'comision';
    return tx;
  }

  tx.autoTag = null;
  tx.category = 'sin_clasificar';
  return tx;
}

export async function GET() {
  try {
    const transactions = await readTransactions();
    return NextResponse.json({ transactions });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Import bank statement data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'import') {
      // Import new transactions from parsed Excel data
      const newTxs = (body.transactions || []).map((tx: any, i: number) => {
        const tagged = autoTagTransaction({
          id: `ext-${Date.now()}-${i}`,
          ...tx,
        });
        return tagged;
      });

      const existing = await readTransactions();
      const all = [...newTxs, ...existing];
      await writeTransactions(all);

      return NextResponse.json({ imported: newTxs.length, total: all.length });
    }

    if (body.action === 'tag') {
      // Manual tag a transaction
      const { id, manualTag, isDiezmo, memberName } = body;
      const txs = await readTransactions();
      const idx = txs.findIndex((t: any) => t.id === id);
      if (idx === -1) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

      txs[idx].manualTag = manualTag;
      if (isDiezmo !== undefined) txs[idx].isDiezmo = isDiezmo;
      if (memberName) txs[idx].memberName = memberName;
      await writeTransactions(txs);

      return NextResponse.json({ transaction: txs[idx] });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
