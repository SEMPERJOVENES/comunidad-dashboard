import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const EVENT_CATEGORIES: Record<string, string[]> = {
  'Viajes': ['Viajes'],
  'Retiros': ['Retiros'],
  'BAC': ['BAC'],
  'Música': ['Música'],
  'Misa/Tabor': ['Misa/Tabor'],
  'Donativo': ['Donativo'],
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start') || '2026-01-01';
    const end = searchParams.get('end') || new Date().toISOString().split('T')[0];

    const startDate = start.split('T')[0];
    const endDate = end.split('T')[0];

    const { data: bankTxs } = await supabase
      .from('bank_transactions')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    const categories: Record<string, { income: number; expenses: number; transactions: any[] }> = {};

    // Initialize all categories
    for (const cat of Object.keys(EVENT_CATEGORIES)) {
      categories[cat] = { income: 0, expenses: 0, transactions: [] };
    }

    for (const tx of (bankTxs || [])) {
      const tag = tx.manual_tag || tx.auto_tag || '';
      const amount = parseFloat(tx.amount || '0');

      // Find which category this tag belongs to
      for (const [category, tags] of Object.entries(EVENT_CATEGORIES)) {
        if (tags.includes(tag)) {
          if (amount > 0) {
            categories[category].income += amount;
          } else {
            categories[category].expenses += Math.abs(amount);
          }
          categories[category].transactions.push({
            id: tx.id,
            date: tx.date,
            concept: tx.concept,
            amount,
            tag,
          });
          break;
        }
      }
    }

    // Build response with net per category
    const result = Object.entries(categories).map(([name, data]) => ({
      name,
      income: data.income,
      expenses: data.expenses,
      net: data.income - data.expenses,
      count: data.transactions.length,
      transactions: data.transactions.slice(0, 20),
    })).filter(c => c.count > 0 || ['Viajes', 'Retiros', 'BAC'].includes(c.name));

    const totalIncome = result.reduce((s, c) => s + c.income, 0);
    const totalExpenses = result.reduce((s, c) => s + c.expenses, 0);

    return NextResponse.json({
      categories: result,
      totals: {
        income: totalIncome,
        expenses: totalExpenses,
        net: totalIncome - totalExpenses,
      },
    });
  } catch (error: any) {
    console.error('Viajes-Eventos API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
