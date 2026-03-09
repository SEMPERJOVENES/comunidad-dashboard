import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start') || '2020-01-01';
    const end = searchParams.get('end') || new Date().toISOString().split('T')[0];

    const startDate = start.split('T')[0];
    const endDate = end.split('T')[0];

    // Fetch tag_categories and bank_transactions in parallel
    const [{ data: bankTxs, error }, { data: tagCategories }] = await Promise.all([
      supabase
        .from('bank_transactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false }),
      supabase
        .from('tag_categories')
        .select('*')
        .order('name'),
    ]);

    if (error) throw error;

    const txs = bankTxs || [];

    // Agrupar por categoría (tag)
    const categoriesMap: Record<string, {
      tag: string;
      income: number;
      expenses: number;
      incomeCount: number;
      expensesCount: number;
      transactions: { id: string; date: string; concept: string; amount: number }[];
    }> = {};

    for (const tx of txs) {
      const tag = tx.manual_tag || tx.auto_tag || 'Sin categoría';
      const amount = parseFloat(tx.amount || '0');

      if (!categoriesMap[tag]) {
        categoriesMap[tag] = { tag, income: 0, expenses: 0, incomeCount: 0, expensesCount: 0, transactions: [] };
      }

      if (amount > 0) {
        categoriesMap[tag].income += amount;
        categoriesMap[tag].incomeCount += 1;
      } else {
        categoriesMap[tag].expenses += Math.abs(amount);
        categoriesMap[tag].expensesCount += 1;
      }

      categoriesMap[tag].transactions.push({
        id: tx.id,
        date: tx.date,
        concept: tx.concept,
        amount,
      });
    }

    const categories = Object.values(categoriesMap).sort((a, b) => {
      const netA = a.income - a.expenses;
      const netB = b.income - b.expenses;
      return Math.abs(netB) - Math.abs(netA);
    });

    // Totales
    const totalIncome = categories.reduce((s, c) => s + c.income, 0);
    const totalExpenses = categories.reduce((s, c) => s + c.expenses, 0);

    // Evolución mensual por categoría (top 8 + Otros)
    const topTags = categories.slice(0, 8).map(c => c.tag);
    const monthlyMap = new Map<string, Record<string, number>>();

    for (const tx of txs) {
      const tag = tx.manual_tag || tx.auto_tag || 'Sin categoría';
      const month = tx.date.substring(0, 7);
      const amount = parseFloat(tx.amount || '0');
      const groupTag = topTags.includes(tag) ? tag : 'Otros';

      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, {});
      }
      const monthData = monthlyMap.get(month)!;
      monthData[groupTag] = (monthData[groupTag] || 0) + amount;
    }

    const monthlyBreakdown = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }));

    // Sin categorizar
    const uncategorized = txs.filter(tx => !tx.manual_tag && !tx.auto_tag).length;

    return NextResponse.json({
      categories: categories.map(c => ({
        tag: c.tag,
        income: c.income,
        expenses: c.expenses,
        net: c.income - c.expenses,
        incomeCount: c.incomeCount,
        expensesCount: c.expensesCount,
        totalOps: c.incomeCount + c.expensesCount,
      })),
      tagCategories: (tagCategories || []).map((tc: any) => ({
        id: tc.id,
        name: tc.name,
        color: tc.color,
        macroGroup: tc.macro_group,
      })),
      totalIncome,
      totalExpenses,
      net: totalIncome - totalExpenses,
      totalTransactions: txs.length,
      uncategorized,
      monthlyBreakdown,
    });
  } catch (error: any) {
    console.error('Categorías API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'add_category') {
      const { name, color, macroGroup } = body;
      if (!name) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
      const { error } = await supabase.from('tag_categories').insert({
        name: name.trim(),
        color: color || 'gray',
        macro_group: macroGroup || 'otros',
      });
      if (error) {
        if (error.code === '23505') return NextResponse.json({ error: 'Ya existe una categoría con ese nombre' }, { status: 400 });
        throw error;
      }
      return NextResponse.json({ success: true });
    }

    if (body.action === 'rename_category') {
      const { oldName, newName } = body;
      if (!oldName || !newName) return NextResponse.json({ error: 'Nombres requeridos' }, { status: 400 });

      // Update tag_categories
      const { error: catError } = await supabase.from('tag_categories')
        .update({ name: newName.trim() })
        .eq('name', oldName);
      if (catError) throw catError;

      // Update bank_transactions manual_tag
      await supabase.from('bank_transactions')
        .update({ manual_tag: newName.trim() })
        .eq('manual_tag', oldName);

      // Update bank_transactions auto_tag
      await supabase.from('bank_transactions')
        .update({ auto_tag: newName.trim() })
        .eq('auto_tag', oldName);

      // Update tagging_rules
      await supabase.from('tagging_rules')
        .update({ category: newName.trim() })
        .eq('category', oldName);

      return NextResponse.json({ success: true });
    }

    if (body.action === 'delete_category') {
      const { name } = body;
      if (!name) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });

      // Delete from tag_categories
      const { error: catError } = await supabase.from('tag_categories')
        .delete()
        .eq('name', name);
      if (catError) throw catError;

      // Null out manual_tag on affected bank_transactions
      await supabase.from('bank_transactions')
        .update({ manual_tag: null })
        .eq('manual_tag', name);

      // Null out auto_tag on affected bank_transactions
      await supabase.from('bank_transactions')
        .update({ auto_tag: null })
        .eq('auto_tag', name);

      return NextResponse.json({ success: true });
    }

    if (body.action === 'update_category') {
      const { name, color, macroGroup } = body;
      if (!name) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });

      const updates: Record<string, string> = {};
      if (color !== undefined) updates.color = color;
      if (macroGroup !== undefined) updates.macro_group = macroGroup;

      const { error } = await supabase.from('tag_categories')
        .update(updates)
        .eq('name', name);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    console.error('Categorías POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
