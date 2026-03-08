import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getSubscriptions } from '@/lib/stripe';

const MEMBERS_FILE = path.join(process.cwd(), 'data', 'diezmos-members.json');
const EXTRACTO_FILE = path.join(process.cwd(), 'data', 'extracto.json');

async function readJSON(filepath: string) {
  try {
    const data = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return filepath.includes('diezmos-members') ? { communities: ['San Pablo', 'San Ignacio', 'P. Pio'], members: [] } : [];
  }
}

async function writeMembers(data: any) {
  const dir = path.dirname(MEMBERS_FILE);
  try { await fs.mkdir(dir, { recursive: true }); } catch {}
  await fs.writeFile(MEMBERS_FILE, JSON.stringify(data, null, 2));
}

function normalize(name: string) {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, '').trim();
}

function getMonthKey(date: string | Date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function GET() {
  try {
    const data = await readJSON(MEMBERS_FILE);
    const members = data.members || [];
    const communities = data.communities || ['San Pablo', 'San Ignacio', 'P. Pio'];

    // 1. Get Stripe subscriptions for "Diezmo" products
    let stripeSubs: any[] = [];
    try {
      const allSubs = await getSubscriptions({ status: 'active', limit: 100 });
      stripeSubs = allSubs.filter(s =>
        s.productName.toLowerCase().includes('diezmo') ||
        s.productName.toLowerCase().includes('tithe')
      );
    } catch {}

    // 2. Get bank transactions tagged as diezmo
    const extracto = await readJSON(EXTRACTO_FILE);
    const diezmosBanco = (Array.isArray(extracto) ? extracto : []).filter((tx: any) =>
      tx.isDiezmo || tx.manualTag === 'Diezmo' || tx.autoTag === 'Diezmo'
    );

    // 3. Match Stripe subscriptions to members
    for (const sub of stripeSubs) {
      const subName = normalize(sub.customerName || '');
      const subEmail = (sub.customerEmail || '').toLowerCase();
      const monthKey = getMonthKey(sub.created);

      let matched = members.find((m: any) => {
        const mName = normalize(m.name);
        return mName === subName ||
          subName.includes(mName) || mName.includes(subName) ||
          (m.email && m.email.toLowerCase() === subEmail);
      });

      if (matched) {
        matched.stripeSubscriptionId = sub.id;
        matched.stripeAmount = sub.amount;
        matched.stripeInterval = sub.interval;
        matched.email = sub.customerEmail || matched.email;
        // Mark current month as paid via Stripe
        const now = new Date();
        const currentMonth = getMonthKey(now);
        if (!matched.payments) matched.payments = {};
        if (!matched.payments[currentMonth]) {
          const monthlyAmount = sub.interval === 'year' ? sub.amount / 12 : sub.amount;
          matched.payments[currentMonth] = { amount: monthlyAmount, source: 'stripe' };
        }
      }
    }

    // 4. Match bank diezmo transactions to members
    for (const tx of diezmosBanco) {
      const txName = normalize(tx.memberName || tx.senderName || tx.concept || '');
      const monthKey = getMonthKey(tx.date);

      let matched = members.find((m: any) => {
        const mName = normalize(m.name);
        return txName.includes(mName) || mName.includes(txName);
      });

      if (matched) {
        if (!matched.payments) matched.payments = {};
        const existing = matched.payments[monthKey];
        const amt = Math.abs(tx.amount);
        if (existing) {
          matched.payments[monthKey] = {
            amount: existing.amount + amt,
            source: existing.source === 'stripe' ? 'ambos' : 'banco',
          };
        } else {
          matched.payments[monthKey] = { amount: amt, source: 'banco' };
        }
      }
    }

    // 5. Build summary
    const now = new Date();
    const currentMonth = getMonthKey(now);

    const communityStats = communities.map((c: string) => {
      const cmembers = members.filter((m: any) => m.community === c);
      const paying = cmembers.filter((m: any) => m.payments?.[currentMonth]);
      const total = paying.reduce((s: number, m: any) => s + (m.payments[currentMonth]?.amount || 0), 0);
      return { community: c, totalMembers: cmembers.length, payingMembers: paying.length, monthlyTotal: total };
    });

    const totalMensual = members.reduce((s: number, m: any) => s + (m.payments?.[currentMonth]?.amount || 0), 0);
    const totalActive = members.filter((m: any) => m.isActive).length;
    const totalPaying = members.filter((m: any) => m.payments?.[currentMonth]).length;

    return NextResponse.json({
      members,
      communities,
      communityStats,
      summary: {
        totalMensual,
        totalMembers: members.length,
        totalActive,
        totalPaying,
        fromStripe: stripeSubs.length,
        fromBanco: diezmosBanco.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: import('next/server').NextRequest) {
  try {
    const body = await request.json();
    const data = await readJSON(MEMBERS_FILE);
    const members = data.members || [];
    const communities = data.communities || ['San Pablo', 'San Ignacio', 'P. Pio'];

    if (body.action === 'add_member') {
      const id = `m${Date.now()}`;
      members.push({
        id,
        name: body.name.trim(),
        community: body.community || 'San Pablo',
        email: body.email || null,
        isActive: true,
        payments: {},
      });
      await writeMembers({ communities, members });
      return NextResponse.json({ success: true, id });
    }

    if (body.action === 'delete_member') {
      const idx = members.findIndex((m: any) => m.id === body.id);
      if (idx !== -1) members.splice(idx, 1);
      await writeMembers({ communities, members });
      return NextResponse.json({ success: true });
    }

    if (body.action === 'update_member') {
      const member = members.find((m: any) => m.id === body.id);
      if (member) {
        if (body.name !== undefined) member.name = body.name;
        if (body.community !== undefined) member.community = body.community;
        if (body.email !== undefined) member.email = body.email;
        if (body.isActive !== undefined) member.isActive = body.isActive;
      }
      await writeMembers({ communities, members });
      return NextResponse.json({ success: true });
    }

    if (body.action === 'manual_payment') {
      const member = members.find((m: any) => m.id === body.memberId);
      if (member) {
        if (!member.payments) member.payments = {};
        member.payments[body.month] = { amount: body.amount, source: 'manual' };
      }
      await writeMembers({ communities, members });
      return NextResponse.json({ success: true });
    }

    if (body.action === 'delete_payment') {
      const member = members.find((m: any) => m.id === body.memberId);
      if (member && member.payments) {
        delete member.payments[body.month];
      }
      await writeMembers({ communities, members });
      return NextResponse.json({ success: true });
    }

    if (body.action === 'add_community') {
      if (!communities.includes(body.name)) {
        communities.push(body.name);
      }
      await writeMembers({ communities, members });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
