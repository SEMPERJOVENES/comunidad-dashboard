import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Intentar insertar en una tabla inexistente para ver si ya existe
    const { error: checkError } = await supabase
      .from('community_members')
      .select('id')
      .limit(1);

    if (!checkError) {
      return NextResponse.json({ status: 'table_exists' });
    }

    return NextResponse.json({
      status: 'needs_creation',
      error: checkError.message,
      sql: `CREATE TABLE community_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL,
  apellido text NOT NULL,
  fecha_nacimiento date NOT NULL,
  created_at timestamptz DEFAULT now()
);`
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
