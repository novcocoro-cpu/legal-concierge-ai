// ============================================================
// プロンプト管理 CRUD API
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123';
const TABLE = 'プロンプト管理';

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
    const { data, error } = await client.from(TABLE).select('*').order('作成日時', { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json({ prompts: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e), prompts: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  try {
    const body = await req.json();
    const { タイトル, プロンプト本文, 有効フラグ = true } = body;
    if (!タイトル || !プロンプト本文) return NextResponse.json({ error: 'タイトルと本文は必須です' }, { status: 400 });
    const client = await getClient();
    const { data, error } = await client.from(TABLE).insert({ タイトル, プロンプト本文, 有効フラグ }).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ prompt: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  try {
    const body = await req.json();
    const { プロンプトID, ...fields } = body;
    if (!プロンプトID) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 });
    const client = await getClient();
    const { data, error } = await client.from(TABLE).update({ ...fields, 更新日時: new Date().toISOString() }).eq('プロンプトID', プロンプトID).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ prompt: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 });
  try {
    const client = await getClient();
    const { error } = await client.from(TABLE).delete().eq('プロンプトID', id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
