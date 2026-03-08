import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const RULES_PATH = path.join(process.cwd(), 'data', 'tagging-rules.json');

async function loadRules(): Promise<{ keyword: string; category: string }[]> {
  try {
    const data = await fs.readFile(RULES_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveRules(rules: { keyword: string; category: string }[]) {
  await fs.writeFile(RULES_PATH, JSON.stringify(rules, null, 2), 'utf-8');
}

export async function GET() {
  try {
    const rules = await loadRules();
    return NextResponse.json({ rules });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'add') {
      const rules = await loadRules();
      const exists = rules.some(r => r.keyword.toLowerCase() === body.keyword.toLowerCase());
      if (exists) {
        return NextResponse.json({ error: 'Esa palabra clave ya existe' }, { status: 400 });
      }
      rules.push({ keyword: body.keyword.toLowerCase().trim(), category: body.category });
      rules.sort((a, b) => a.keyword.localeCompare(b.keyword));
      await saveRules(rules);
      return NextResponse.json({ rules });
    }

    if (body.action === 'delete') {
      let rules = await loadRules();
      rules = rules.filter(r => r.keyword !== body.keyword);
      await saveRules(rules);
      return NextResponse.json({ rules });
    }

    if (body.action === 'update') {
      const rules = await loadRules();
      const idx = rules.findIndex(r => r.keyword === body.oldKeyword);
      if (idx >= 0) {
        rules[idx] = { keyword: body.keyword.toLowerCase().trim(), category: body.category };
        rules.sort((a, b) => a.keyword.localeCompare(b.keyword));
        await saveRules(rules);
      }
      return NextResponse.json({ rules });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
