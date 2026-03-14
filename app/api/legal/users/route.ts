import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const sb = createServerClient();
  if (!sb) return NextResponse.json([]);
  const firmId = req.nextUrl.searchParams.get('firm_id');
  let q = sb.from('legal_users').select('*').order('created_at', { ascending: false });
  if (firmId) q = q.eq('firm_id', firmId);
  const { data } = await q;
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const sb = createServerClient();
  if (!sb) return NextResponse.json({ error: 'DB未接続' }, { status: 500 });
  const body = await req.json();
  if (!body.name || !body.firm_id) return NextResponse.json({ error: 'name, firm_id必須' }, { status: 400 });
  // 同名ユーザーがいればそれを返す
  const { data: existing } = await sb.from('legal_users').select('*')
    .eq('firm_id', body.firm_id).eq('name', body.name).maybeSingle();
  if (existing) return NextResponse.json(existing);
  const { data, error } = await sb.from('legal_users').insert({
    firm_id: body.firm_id, name: body.name, role: body.role || 'user',
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const sb = createServerClient();
  if (!sb) return NextResponse.json({ error: 'DB未接続' }, { status: 500 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id必須' }, { status: 400 });
  const { error } = await sb.from('legal_users').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
