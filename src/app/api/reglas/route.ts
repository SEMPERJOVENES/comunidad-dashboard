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
      const keyword = body.keyword.toLowerCase().trim();
      const { data: existing } = await supabase
        .from('tagging_rules')
        .select('keyword')
        .eq('keyword', keyword)
        .single();

      if (existing) {
        return NextResponse.json({ error: 'Esa palabra clave ya existe' }, { status: 400 });
      }

      await supabase.from('tagging_rules').insert({ keyword, category: body.category });

      const { data } = await supabase.from('tagging_rules').select('keyword, category').order('keyword');
      return NextResponse.json({ rules: data || [] });
    }

    if (body.action === 'delete') {
      await supabase.from('tagging_rules').delete().eq('keyword', body.keyword);

      const { data } = await supabase.from('tagging_rules').select('keyword, category').order('keyword');
      return NextResponse.json({ rules: data || [] });
    }

    if (body.action === 'update') {
      const keyword = body.keyword.toLowerCase().trim();
      await supabase
        .from('tagging_rules')
        .update({ keyword, category: body.category })
        .eq('keyword', body.oldKeyword);

      const { data } = await supabase.from('tagging_rules').select('keyword, category').order('keyword');
      return NextResponse.json({ rules: data || [] });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
