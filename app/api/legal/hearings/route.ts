import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const sb = createServerClient();
  if (!sb) return NextResponse.json([]);
  const firmId = req.nextUrl.searchParams.get('firm_id');
  let q = sb.from('legal_hearings').select('*').order('created_at', { ascending: false });
  if (firmId) q = q.eq('firm_id', firmId);
  const { data } = await q.limit(200);
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const sb = createServerClient();
  if (!sb) return NextResponse.json({ error: 'DB未接続' }, { status: 500 });
  const body = await req.json();
  const { data, error } = await sb.from('legal_hearings').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const sb = createServerClient();
  if (!sb) return NextResponse.json({ error: 'DB未接続' }, { status: 500 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id必須' }, { status: 400 });
  const { error } = await sb.from('legal_hearings').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
