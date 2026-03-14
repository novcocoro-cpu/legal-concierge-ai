import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const TABLE = '利用者情報';

export async function PUT(req: NextRequest) {
  try {
    const { userId, userName, companyName } = await req.json();
    if (!userId || !userName) return NextResponse.json({ error: 'userId と userName は必須です' }, { status: 400 });
    const client = createServerClient();
    if (!client) return NextResponse.json({ ok: true, user: null });
    const row = {
      'ユーザーID': userId,
      'ユーザー名': userName,
      '会社名':    companyName ?? '',
      '更新日時':  new Date().toISOString(),
    };
    const { data, error } = await client.from(TABLE).upsert(row as never).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, user: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
