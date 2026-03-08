import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const RULES_FILE = path.join(process.cwd(), 'data', 'tagging-rules.json');

async function readRules() {
  try {
    const data = await fs.readFile(RULES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeRules(rules: any[]) {
  const dir = path.dirname(RULES_FILE);
  try { await fs.mkdir(dir, { recursive: true }); } catch {}
  await fs.writeFile(RULES_FILE, JSON.stringify(rules, null, 2));
}

export async function GET() {
  const rules = await readRules();
  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'add') {
      const rules = await readRules();
      rules.push({ keyword: body.keyword.toLowerCase(), category: body.category });
      await writeRules(rules);
      return NextResponse.json({ rules });
    }

    if (body.action === 'delete') {
      let rules = await readRules();
      rules = rules.filter((r: any) => !(r.keyword === body.keyword && r.category === body.category));
      await writeRules(rules);
      return NextResponse.json({ rules });
    }

    if (body.action === 'update_all') {
      await writeRules(body.rules || []);
      return NextResponse.json({ rules: body.rules });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
