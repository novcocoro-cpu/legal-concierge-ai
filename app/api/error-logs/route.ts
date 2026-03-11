// ============================================================
// エラーログ API
// POST /api/error-logs        → エラーログを保存（認証不要）
// GET  /api/error-logs        → エラーログ一覧を取得（管理者のみ）
// GET  /api/error-logs?search=xxx → エラー内容で絞り込み
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { error_message, process_type, device_info, browser_info, user_agent } = body;

    if (!error_message || !process_type) {
      return NextResponse.json(
        { error: 'error_message と process_type は必須です' },
        { status: 400 }
      );
    }

    const { createServerClient } = await import('@/lib/supabase');
    const client = createServerClient();

    const { error } = await client.from('error_logs').insert({
      error_message: String(error_message).slice(0, 2000),
      process_type: String(process_type).slice(0, 100),
      device_info: device_info ? String(device_info).slice(0, 100) : null,
      browser_info: browser_info ? String(browser_info).slice(0, 100) : null,
      user_agent: user_agent ? String(user_agent).slice(0, 500) : null,
      occurred_at: new Date().toISOString(),
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e) {
    // ログ保存エラーは500で返すが、クライアントでは無視してOK
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin-password') !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') ?? '';

  try {
    const { createServerClient } = await import('@/lib/supabase');
    const client = createServerClient();

    let query = client
      .from('error_logs')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(500);

    if (search) {
      query = query.ilike('error_message', `%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ logs: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
