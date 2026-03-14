import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  const sb = createServerClient();
  if (!sb) return NextResponse.json([]);
  const { data } = await sb.from('legal_firms').select('*').order('created_at', { ascending: false });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const sb = createServerClient();
  if (!sb) return NextResponse.json({ error: 'DB未接続' }, { status: 500 });
  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: 'name必須' }, { status: 400 });
  // upsert: 同名があればそれを返す
  const { data: existing } = await sb.from('legal_firms').select('*').eq('name', name).maybeSingle();
  if (existing) return NextResponse.json(existing);
  const { data, error } = await sb.from('legal_firms').insert({ name }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
