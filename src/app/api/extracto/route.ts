import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Load tagging rules from Supabase
async function loadTaggingRules(): Promise<{ keyword: string; category: string }[]> {
  try {
    const { data, error } = await supabase
      .from('tagging_rules')
      .select('keyword, category');
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

function autoTagTransaction(concept: string, rules: { keyword: string; category: string }[]): { tag: string | null; memberName: string | null; isDiezmo: boolean } {
  const conceptLower = concept.toLowerCase();
  const sorted = [...rules].sort((a, b) => b.keyword.length - a.keyword.length);

  let tag: string | null = null;
  for (const rule of sorted) {
    if (conceptLower.includes(rule.keyword.toLowerCase())) {
      tag = rule.category;
      break;
    }
  }

  const isDiezmo = tag === 'Diezmo';
  let memberName: string | null = null;

  if (isDiezmo) {
    const diezmoMatch = concept.match(/[Dd]iezmo\s+(.+?)(?:\.|,|$)/);
    if (diezmoMatch) {
      memberName = diezmoMatch[1].trim().replace(/\d+[.,]\d+\s*€?\s*$/, '').trim();
    }
  }

  if (!memberName && conceptLower.includes('bizum')) {
    const bizumMatch = concept.match(/De\s+(.+?)(?:,|\.|$)/i);
    if (bizumMatch) memberName = bizumMatch[1].trim();
  }

  if (!memberName && (conceptLower.includes('transferencia') || conceptLower.includes('transfer'))) {
    const transMatch = concept.match(/(?:De|Ordenante|Remitente)\s+(.+?)(?:,|Concepto|\.|$)/i);
    if (transMatch) memberName = transMatch[1].trim();
  }

  return { tag, memberName, isDiezmo };
}

// Helper: paginar Supabase para no perder datos por el límite de 1000 filas
async function fetchAllRows(baseQuery: () => ReturnType<ReturnType<typeof supabase.from>['select']>) {
  const PAGE = 1000;
  const all: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await baseQuery().range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    let dateGte: string | undefined;
    let dateLte: string | undefined;

    if (start && end) {
      dateGte = new Date(start).toISOString().split('T')[0];
      dateLte = new Date(end).toISOString().split('T')[0];
    } else if (year) {
      dateGte = `${year}-01-01`;
      dateLte = `${year}-12-31`;
    }

    // Fetch bank transactions (con paginación) y tag_categories en paralelo
    const [data, tagCatsResult] = await Promise.all([
      fetchAllRows(() => {
        let q = supabase.from('bank_transactions').select('*').order('date', { ascending: false });
        if (dateGte) q = q.gte('date', dateGte);
        if (dateLte) q = q.lte('date', dateLte);
        return q;
      }),
      supabase.from('tag_categories').select('*').order('name'),
    ]);

    const tagCategories = tagCatsResult.data;

    const transactions = data.map((row: any) => ({
      id: row.id,
      date: row.date,
      valueDate: row.value_date,
      concept: row.concept,
      amount: parseFloat(row.amount),
      balance: parseFloat(row.balance || 0),
      autoTag: row.auto_tag,
      manualTag: row.manual_tag,
      isDiezmo: row.is_diezmo,
      memberName: row.member_name,
      source: 'bank' as const,
    }));

    return NextResponse.json({
      transactions,
      tagCategories: (tagCategories || []).map((tc: any) => ({
        id: tc.id,
        name: tc.name,
        color: tc.color,
        macroGroup: tc.macro_group,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error fetching extracto:', message);
    return NextResponse.json({ transactions: [], tagCategories: [], error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'tag') {
      const { id, manualTag, isDiezmo } = body;
      const { data, error } = await supabase
        .from('bank_transactions')
        .update({ manual_tag: manualTag || null, is_diezmo: isDiezmo || false })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        transaction: {
          id: data.id, date: data.date, valueDate: data.value_date,
          concept: data.concept, amount: parseFloat(data.amount),
          balance: parseFloat(data.balance || 0), autoTag: data.auto_tag,
          manualTag: data.manual_tag, isDiezmo: data.is_diezmo, memberName: data.member_name,
          source: 'bank',
        },
      });
    }

    if (body.action === 'import') {
      const { transactions } = body;
      if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
        return NextResponse.json({ error: 'No hay transacciones para importar' }, { status: 400 });
      }

      const rules = await loadTaggingRules();

      // Preparar las transacciones parseadas
      const parsed = transactions.map((tx: any) => {
        const concept = tx.concept || tx.Concepto || tx.CONCEPTO || '';
        const rawAmount = tx.amount || tx.Importe || tx.IMPORTE || '0';
        const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(/\./g, '').replace(',', '.')) || 0;
        const rawBalance = tx.balance || tx.Saldo || tx.SALDO || '0';
        const balance = typeof rawBalance === 'number' ? rawBalance : parseFloat(String(rawBalance).replace(/\./g, '').replace(',', '.')) || 0;
        const dateStr = tx.date || tx.Fecha || tx['F. Valor'] || tx.FECHA || '';

        let parsedDate = dateStr;
        if (typeof dateStr === 'string' && dateStr.includes('/')) {
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            parsedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }

        return { concept, amount, balance, date: parsedDate || new Date().toISOString().split('T')[0] };
      });

      // === DEDUPLICACIÓN INTELIGENTE ===
      // Buscar transacciones existentes en el rango de fechas de las nuevas
      const dates = parsed.map((p: any) => p.date).filter(Boolean);
      const minDate = dates.sort()[0];
      const maxDate = dates.sort().reverse()[0];

      const { data: existing } = await supabase
        .from('bank_transactions')
        .select('date, amount, balance, concept')
        .gte('date', minDate)
        .lte('date', maxDate);

      // Crear set de fingerprints existentes: "fecha|importe|saldo"
      const existingFingerprints = new Set(
        (existing || []).map((ex: any) => {
          const amt = parseFloat(ex.amount);
          const bal = parseFloat(ex.balance || 0);
          return `${ex.date}|${amt.toFixed(2)}|${bal.toFixed(2)}`;
        })
      );

      // Filtrar solo las nuevas (que no existen)
      const newTxs = parsed.filter((tx: any) => {
        const fp = `${tx.date}|${tx.amount.toFixed(2)}|${tx.balance.toFixed(2)}`;
        return !existingFingerprints.has(fp);
      });

      if (newTxs.length === 0) {
        return NextResponse.json({
          imported: 0,
          skipped: parsed.length,
          message: `Todas las ${parsed.length} transacciones ya existen en la base de datos`,
          transactions: [],
        });
      }

      const rows = newTxs.map((tx: any, idx: number) => {
        const { tag, memberName, isDiezmo } = autoTagTransaction(tx.concept, rules);
        return {
          id: `bt-${Date.now()}-${idx}`,
          date: tx.date,
          value_date: tx.date,
          concept: tx.concept,
          amount: tx.amount,
          balance: tx.balance,
          auto_tag: tag,
          manual_tag: null,
          is_diezmo: isDiezmo,
          member_name: memberName,
        };
      });

      const { data, error } = await supabase
        .from('bank_transactions')
        .upsert(rows, { onConflict: 'id' })
        .select();

      if (error) throw error;

      return NextResponse.json({
        imported: rows.length,
        skipped: parsed.length - newTxs.length,
        transactions: (data || rows).map((row: any) => ({
          id: row.id, date: row.date, valueDate: row.value_date,
          concept: row.concept, amount: parseFloat(row.amount),
          balance: parseFloat(row.balance || 0), autoTag: row.auto_tag,
          manualTag: row.manual_tag, isDiezmo: row.is_diezmo, memberName: row.member_name,
          source: 'bank',
        })),
      });
    }

    if (body.action === 'retag_all') {
      const rules = await loadTaggingRules();
      const { data: allTx, error: fetchErr } = await supabase
        .from('bank_transactions')
        .select('*')
        .is('manual_tag', null);

      if (fetchErr) throw fetchErr;

      let updated = 0;
      for (const tx of (allTx || [])) {
        const { tag, memberName, isDiezmo } = autoTagTransaction(tx.concept, rules);
        const needsUpdate = (tag && tag !== tx.auto_tag) ||
          (memberName && memberName !== tx.member_name) ||
          (isDiezmo !== tx.is_diezmo);
        if (tag && needsUpdate) {
          await supabase.from('bank_transactions')
            .update({ auto_tag: tag, member_name: memberName, is_diezmo: isDiezmo })
            .eq('id', tx.id);
          updated++;
        }
      }

      return NextResponse.json({ retagged: (allTx || []).length, updated });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error in extracto POST:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
