// ============================================================
// パブリック設定取得 API（認証不要・読み取り専用）
// GET /api/settings?key=default_recording_minutes
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

// 外部に公開して良い設定キーのホワイトリスト
const PUBLIC_KEYS = ['default_recording_minutes'] as const;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');

  if (!key || !PUBLIC_KEYS.includes(key as (typeof PUBLIC_KEYS)[number])) {
    return NextResponse.json({ error: '無効なキーです' }, { status: 400 });
  }

  try {
    const { createServerClient } = await import('@/lib/supabase');
    const client = createServerClient();
    const { data } = await client
      .from('システム設定')
      .select('設定値')
      .eq('設定キー', key)
      .maybeSingle();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = data ? (data as any)['設定値'] ?? null : null;
    return NextResponse.json({ value });
  } catch {
    return NextResponse.json({ value: null });
  }
}
