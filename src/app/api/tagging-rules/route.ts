import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('tagging_rules')
      .select('keyword, category')
      .order('keyword');

    if (error) throw error;
    return NextResponse.json({ rules: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'add') {
      await supabase.from('tagging_rules').insert({
        keyword: body.keyword.toLowerCase().trim(),
        category: body.category,
      });
      const { data } = await supabase.from('tagging_rules').select('keyword, category').order('keyword');
      return NextResponse.json({ rules: data || [] });
    }

    if (body.action === 'delete') {
      await supabase.from('tagging_rules').delete().match({
        keyword: body.keyword,
        category: body.category,
      });
      const { data } = await supabase.from('tagging_rules').select('keyword, category').order('keyword');
      return NextResponse.json({ rules: data || [] });
    }

    if (body.action === 'update_all') {
      // Delete all and re-insert
      await supabase.from('tagging_rules').delete().neq('id', 0);
      if (body.rules && body.rules.length > 0) {
        await supabase.from('tagging_rules').insert(
          body.rules.map((r: any) => ({ keyword: r.keyword, category: r.category }))
        );
      }
      const { data } = await supabase.from('tagging_rules').select('keyword, category').order('keyword');
      return NextResponse.json({ rules: data || [] });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
