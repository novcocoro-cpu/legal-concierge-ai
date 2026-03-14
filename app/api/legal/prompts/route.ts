import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const sb = createServerClient();
  if (!sb) return NextResponse.json({ content: '', key: 'legal_analysis' });
  const firmId = req.nextUrl.searchParams.get('firm_id');
  const key = req.nextUrl.searchParams.get('key') || 'legal_analysis';
  let q = sb.from('legal_prompts').select('*').eq('key', key);
  if (firmId) q = q.eq('firm_id', firmId);
  const { data } = await q.order('updated_at', { ascending: false }).limit(1).maybeSingle();
  return NextResponse.json(data ?? { content: '', key });
}

export async function POST(req: NextRequest) {
  const sb = createServerClient();
  if (!sb) return NextResponse.json({ error: 'DB未接続' }, { status: 500 });
  const body = await req.json();
  const { firm_id, key, content } = body;
  if (!key) return NextResponse.json({ error: 'key必須' }, { status: 400 });

  // 既存レコードがあればupdate、なければinsert
  const { data: existing } = await sb.from('legal_prompts').select('id')
    .eq('key', key).eq('firm_id', firm_id).maybeSingle();

  if (existing) {
    const { data, error } = await sb.from('legal_prompts')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', existing.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } else {
    const { data, error } = await sb.from('legal_prompts')
      .insert({ firm_id, key, content, updated_at: new Date().toISOString() })
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
}
