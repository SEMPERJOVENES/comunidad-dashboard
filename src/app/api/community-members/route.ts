import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('community_members')
      .select('id, nombre, apellido, fecha_nacimiento')
      .order('apellido');
    if (error) throw error;
    return NextResponse.json({ members: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'add') {
      const { error } = await supabase.from('community_members').insert({
        nombre: body.nombre.trim(),
        apellido: body.apellido.trim(),
        fecha_nacimiento: body.fecha_nacimiento,
      });
      if (error) throw error;
    } else if (body.action === 'update') {
      const { error } = await supabase.from('community_members').update({
        nombre: body.nombre.trim(),
        apellido: body.apellido.trim(),
        fecha_nacimiento: body.fecha_nacimiento,
      }).eq('id', body.id);
      if (error) throw error;
    } else if (body.action === 'delete') {
      const { error } = await supabase.from('community_members').delete().eq('id', body.id);
      if (error) throw error;
    } else {
      return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }

    const { data } = await supabase
      .from('community_members')
      .select('id, nombre, apellido, fecha_nacimiento')
      .order('apellido');
    return NextResponse.json({ members: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
