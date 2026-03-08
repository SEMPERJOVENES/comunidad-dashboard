import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getCharges } from '@/lib/stripe';

const EXTRACTO_FILE = path.join(process.cwd(), 'data', 'extracto.json');
const MEMBERS_FILE = path.join(process.cwd(), 'data', 'diezmos-members.json');

async function readJSON(filepath: string) {
  try {
    const data = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function ensureDataDir() {
  const dir = path.dirname(MEMBERS_FILE);
  try { await fs.mkdir(dir, { recursive: true }); } catch {}
}

export async function GET() {
  try {
    // 1. Get Stripe charges (potential tithes - recurring/donations)
    const sixMonthsAgo = Math.floor(Date.now() / 1000) - 180 * 86400;
    const stripeCharges = await getCharges({ limit: 100, created: { gte: sixMonthsAgo } });

    // 2. Get bank statement transactions tagged as diezmo
    const extracto = await readJSON(EXTRACTO_FILE);
    const diezmosBanco = extracto.filter((tx: any) => tx.isDiezmo || tx.manualTag === 'Diezmo' || (tx.autoTag === 'Diezmo'));

    // 3. Get saved member list
    const savedMembers = await readJSON(MEMBERS_FILE);

    // 4. Combine into member-based view
    const memberMap = new Map<string, any>();

    // From saved members
    for (const m of savedMembers) {
      memberMap.set(m.name.toLowerCase(), { ...m, payments: m.payments || [] });
    }

    // From Stripe charges (use description or customer email as identifier)
    for (const charge of stripeCharges) {
      const name = (charge.description || String(charge.customer || '') || 'Stripe anónimo').toLowerCase();
      const existing = memberMap.get(name);
      const payment = { date: charge.created, amount: charge.amount, source: 'stripe' as const, reference: charge.id };

      if (existing) {
        existing.payments.push(payment);
        existing.totalPaid += charge.amount;
        existing.source = existing.source === 'banco' ? 'ambos' : 'stripe';
        if (!existing.lastPayment || charge.created > existing.lastPayment) existing.lastPayment = charge.created;
      } else {
        memberMap.set(name, {
          name: charge.description || charge.customer || 'Stripe anónimo',
          email: null,
          source: 'stripe',
          totalPaid: charge.amount,
          payments: [payment],
          lastPayment: charge.created,
          isActive: true,
        });
      }
    }

    // From bank statement
    for (const tx of diezmosBanco) {
      const name = (tx.memberName || tx.concept || `Banco-${tx.id}`).toLowerCase();
      const existing = memberMap.get(name);
      const payment = { date: tx.date, amount: Math.abs(tx.amount), source: 'banco' as const, reference: tx.id };

      if (existing) {
        existing.payments.push(payment);
        existing.totalPaid += Math.abs(tx.amount);
        existing.source = existing.source === 'stripe' ? 'ambos' : 'banco';
        if (!existing.lastPayment || tx.date > existing.lastPayment) existing.lastPayment = tx.date;
      } else {
        memberMap.set(name, {
          name: tx.memberName || tx.concept,
          email: null,
          source: 'banco',
          totalPaid: Math.abs(tx.amount),
          payments: [payment],
          lastPayment: tx.date,
          isActive: true,
        });
      }
    }

    const members = Array.from(memberMap.values()).sort((a, b) => b.totalPaid - a.totalPaid);
    const totalDiezmos = members.reduce((s: number, m: any) => s + m.totalPaid, 0);
    const activeMembers = members.filter((m: any) => m.isActive).length;

    return NextResponse.json({
      members,
      summary: {
        totalDiezmos,
        totalMembers: members.length,
        activeMembers,
        fromStripe: members.filter((m: any) => m.source === 'stripe' || m.source === 'ambos').length,
        fromBanco: members.filter((m: any) => m.source === 'banco' || m.source === 'ambos').length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Add/edit members manually
export async function POST(request: import('next/server').NextRequest) {
  try {
    await ensureDataDir();
    const body = await request.json();

    if (body.action === 'add_member') {
      const members = await readJSON(MEMBERS_FILE);
      const member = {
        name: body.name,
        email: body.email || null,
        source: 'manual' as const,
        totalPaid: 0,
        payments: [],
        lastPayment: null,
        isActive: true,
      };
      members.push(member);
      await fs.writeFile(MEMBERS_FILE, JSON.stringify(members, null, 2));
      return NextResponse.json({ member });
    }

    if (body.action === 'toggle_active') {
      const members = await readJSON(MEMBERS_FILE);
      const idx = members.findIndex((m: any) => m.name.toLowerCase() === body.name.toLowerCase());
      if (idx !== -1) {
        members[idx].isActive = !members[idx].isActive;
        await fs.writeFile(MEMBERS_FILE, JSON.stringify(members, null, 2));
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
