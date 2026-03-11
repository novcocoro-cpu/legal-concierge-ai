// ============================================================
// 管理者 API
// POST /api/admin        → パスワード認証
// GET  /api/admin        → 統計情報 + 会議一覧
// GET  /api/admin?id=xxx → 特定会議の詳細
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123';

function checkAuth(req: NextRequest): boolean {
  return req.headers.get('x-admin-password') === ADMIN_PASSWORD;
}

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    if (password === ADMIN_PASSWORD) return NextResponse.json({ ok: true });
    return NextResponse.json({ error: 'パスワードが違います' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'リクエストが無効です' }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const meetingId = searchParams.get('id');

  const { createServerClient } = await import('@/lib/supabase');
  const client = createServerClient();

  try {
    // 特定会議の詳細
    if (meetingId) {
      const { data, error } = await client
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ meeting: data });
    }

    // 会社・メンバー・会議を一括取得
    const [companiesRes, membersRes, meetingsRes] = await Promise.all([
      client.from('companies').select('*').order('name'),
      client.from('members').select('*').order('name'),
      client.from('meetings')
        .select('id, user_id, user_name, company_name, company_id, member_id, title, summary, duration_seconds, created_at, action_plan, problems')
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    if (meetingsRes.error) throw new Error(meetingsRes.error.message);

    const companies = companiesRes.data ?? [];
    const members   = membersRes.data ?? [];
    const list      = meetingsRes.data ?? [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart  = new Date(todayStart.getTime() - 6 * 86400000);

    const stats = {
      totalMeetings:  list.length,
      todayMeetings:  list.filter(m => new Date(m.created_at) >= todayStart).length,
      weekMeetings:   list.filter(m => new Date(m.created_at) >= weekStart).length,
      totalDuration:  list.reduce((s, m) => s + (m.duration_seconds ?? 0), 0),
    };

    return NextResponse.json({ stats, companies, members, meetings: list });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
