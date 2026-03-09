import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getOrders } from '@/lib/shopify';

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const includeShopify = searchParams.get('shopify') === '1';

    let query = supabase
      .from('bank_transactions')
      .select('*')
      .order('date', { ascending: false });

    if (year) {
      query = query.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`);
    }

    // Fetch bank transactions and tag_categories in parallel
    const [{ data, error }, { data: tagCategories }] = await Promise.all([
      query,
      supabase.from('tag_categories').select('*').order('name'),
    ]);

    if (error) throw error;

    const transactions = (data || []).map((row: any) => ({
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

    // Fetch Shopify orders if requested
    let shopifyTransactions: any[] = [];
    if (includeShopify && year) {
      try {
        const orders = await getOrders({
          created_at_min: `${year}-01-01T00:00:00Z`,
          created_at_max: `${year}-12-31T23:59:59Z`,
          status: 'any',
          limit: 250,
        });
        shopifyTransactions = orders.map((o: any) => {
          const items = (o.line_items || []).map((i: any) => i.title).join(', ');
          const customerName = o.customer
            ? `${o.customer.first_name || ''} ${o.customer.last_name || ''}`.trim()
            : null;
          return {
            id: `shopify_${o.id}`,
            date: o.created_at?.split('T')[0] || '',
            valueDate: o.created_at?.split('T')[0] || '',
            concept: `Shopify #${o.order_number || o.name || o.id} — ${items || 'Orden'}`,
            amount: parseFloat(o.total_price || '0'),
            balance: 0,
            autoTag: 'Shopify',
            manualTag: null,
            isDiezmo: false,
            memberName: customerName,
            source: 'shopify' as const,
          };
        });
      } catch (err) {
        console.error('Error fetching Shopify orders:', err);
      }
    }

    return NextResponse.json({
      transactions,
      shopifyTransactions,
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
    return NextResponse.json({ transactions: [], shopifyTransactions: [], tagCategories: [], error: message });
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

      const rows = transactions.map((tx: any, idx: number) => {
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

        const { tag, memberName, isDiezmo } = autoTagTransaction(concept, rules);

        return {
          id: `bt-${Date.now()}-${idx}`,
          date: parsedDate || new Date().toISOString().split('T')[0],
          value_date: parsedDate,
          concept,
          amount,
          balance,
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

      for (const tx of (allTx || [])) {
        const { tag, memberName, isDiezmo } = autoTagTransaction(tx.concept, rules);
        if (tag && tag !== tx.auto_tag) {
          await supabase.from('bank_transactions')
            .update({ auto_tag: tag, member_name: memberName, is_diezmo: isDiezmo })
            .eq('id', tx.id);
        }
      }

      return NextResponse.json({ retagged: (allTx || []).length });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error in extracto POST:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
