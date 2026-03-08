import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'extracto.json');
const RULES_FILE = path.join(process.cwd(), 'data', 'tagging-rules.json');

async function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  try { await fs.mkdir(dir, { recursive: true }); } catch {}
}

async function readJSON(filepath: string) {
  try {
    const data = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeTransactions(txs: any[]) {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(txs, null, 2));
}

async function getTaggingRules() {
  return await readJSON(RULES_FILE);
}

function autoTagTransaction(tx: any, rules: any[]) {
  const concept = (tx.concept || '').toLowerCase();

  // Check configurable rules (longer keywords first for specificity)
  const sorted = [...rules].sort((a, b) => b.keyword.length - a.keyword.length);
  for (const rule of sorted) {
    if (concept.includes(rule.keyword.toLowerCase())) {
      tx.autoTag = rule.category;
      tx.category = rule.category;
      if (rule.category === 'Diezmo') tx.isDiezmo = true;

      // Extract name from concept for diezmo transactions
      if (rule.category === 'Diezmo') {
        const namePatterns = [
          /diezmo\s+(.+?)(?:\.|$)/i,
          /concepto\s+diezmo\s+(.+?)(?:\.|$)/i,
        ];
        for (const pattern of namePatterns) {
          const match = concept.match(pattern);
          if (match) {
            tx.memberName = match[1].trim().replace(/\.$/, '');
            break;
          }
        }
      }

      // Extract name from Bizum
      if (concept.includes('bizum de ')) {
        const match = concept.match(/bizum de (.+?) concepto/i);
        if (match) tx.senderName = match[1].trim();
      }

      // Extract name from Transferencia
      if (concept.includes('transferencia de ')) {
        const match = concept.match(/transferencia de (.+?),?\s*concepto/i);
        if (match) tx.senderName = match[1].trim();
      }
      if (concept.includes('transferencia a favor de ')) {
        const match = concept.match(/transferencia a favor de (.+?) concepto/i);
        if (match) tx.recipientName = match[1].trim();
      }

      return tx;
    }
  }

  tx.autoTag = null;
  tx.category = 'sin_clasificar';
  return tx;
}

export async function GET() {
  try {
    const transactions = await readJSON(DATA_FILE);
    return NextResponse.json({ transactions });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rules = await getTaggingRules();

    if (body.action === 'import') {
      const newTxs = (body.transactions || []).map((tx: any, i: number) => {
        return autoTagTransaction({
          id: `ext-${Date.now()}-${i}`,
          ...tx,
        }, rules);
      });
      const existing = await readJSON(DATA_FILE);
      const all = [...newTxs, ...existing];
      await writeTransactions(all);
      return NextResponse.json({ imported: newTxs.length, total: all.length });
    }

    if (body.action === 'tag') {
      const { id, manualTag, isDiezmo, memberName } = body;
      const txs = await readJSON(DATA_FILE);
      const idx = txs.findIndex((t: any) => t.id === id);
      if (idx === -1) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
      txs[idx].manualTag = manualTag;
      if (isDiezmo !== undefined) txs[idx].isDiezmo = isDiezmo;
      if (memberName) txs[idx].memberName = memberName;
      await writeTransactions(txs);
      return NextResponse.json({ transaction: txs[idx] });
    }

    if (body.action === 'retag_all') {
      const txs = await readJSON(DATA_FILE);
      const retagged = txs.map((tx: any) => {
        if (!tx.manualTag) return autoTagTransaction(tx, rules);
        return tx;
      });
      await writeTransactions(retagged);
      return NextResponse.json({ total: retagged.length });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
