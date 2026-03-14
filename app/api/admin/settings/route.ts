// ============================================================
// システム設定 API
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123';
const TABLE = 'システム設定';

function auth(req: NextRequest) {
  return req.headers.get('x-admin-password') === ADMIN_PASSWORD;
}

async function getClient() {
  const { createServerClient } = await import('@/lib/supabase');
  return createServerClient();
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  try {
    const client = await getClient();
    if (!client) return NextResponse.json({ settings: [] });
    const { data, error } = await client.from(TABLE).select('*');
    if (error) throw new Error(error.message);
    return NextResponse.json({ settings: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e), settings: [] }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  try {
    const body = await req.json();
    const key   = body['設定キー']  as string | undefined;
    const value = body['設定値'] as string | undefined;
    if (!key || value === undefined || value === '') return NextResponse.json({ error: '設定キーと設定値は必須です' }, { status: 400 });
    const client = await getClient();
    if (!client) return NextResponse.json({ error: 'Supabase未接続です' }, { status: 500 });
    const row = { '設定キー': key, '設定値': value, '更新日時': new Date().toISOString() };
    const { data, error } = await client.from(TABLE).upsert(row as never).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, item: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
