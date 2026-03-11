import { createServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase.from('meetings').select('count');
    return NextResponse.json({
      ok: !error,
      data,
      error: error?.message ?? null,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
