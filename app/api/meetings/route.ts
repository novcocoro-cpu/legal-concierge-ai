import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const userId    = req.nextUrl.searchParams.get('userId');
  const meetingId = req.nextUrl.searchParams.get('id');

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    const supabase = createServerClient();

    // 単件取得
    if (meetingId) {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .eq('user_id', userId)
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }

    // 一覧取得
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[meetings GET] Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error('[meetings GET] Unexpected error:', e);
    const msg = e instanceof Error ? e.message : 'サーバーエラー';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// 会社を検索 or 作成して id を返す
async function resolveCompanyId(supabase: ReturnType<typeof createServerClient>, companyName: string): Promise<string | null> {
  const name = companyName.trim() || '個人 / 未設定';
  const { data: existing } = await supabase
    .from('companies').select('id').eq('name', name).maybeSingle();
  if (existing) return existing.id;
  const { data: created } = await supabase
    .from('companies').insert({ name }).select('id').single();
  return created?.id ?? null;
}

// メンバーを検索 or 作成して id を返す
async function resolveMemberId(supabase: ReturnType<typeof createServerClient>, companyId: string, memberName: string): Promise<string | null> {
  const name = memberName.trim() || '名無し';
  const { data: existing } = await supabase
    .from('members').select('id').eq('company_id', companyId).eq('name', name).maybeSingle();
  if (existing) return existing.id;
  const { data: created } = await supabase
    .from('members').insert({ company_id: companyId, name }).select('id').single();
  return created?.id ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = createServerClient();

    // 会社・メンバーを自動解決
    const companyId = await resolveCompanyId(supabase, body.company_name ?? '');
    const memberId  = companyId ? await resolveMemberId(supabase, companyId, body.user_name ?? '') : null;

    const row = { ...body, company_id: companyId, member_id: memberId };

    const { data, error } = await supabase
      .from('meetings')
      .insert([row])
      .select()
      .single();

    if (error) {
      console.error('[meetings POST]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error('[meetings POST]', e);
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id     = req.nextUrl.searchParams.get('id');
  const userId = req.nextUrl.searchParams.get('userId');

  if (!id || !userId) {
    return NextResponse.json({ error: 'id and userId are required' }, { status: 400 });
  }

  try {
    const supabase = createServerClient();
    const { error } = await supabase
      .from('meetings')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[meetings DELETE]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[meetings DELETE]', e);
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 });
  }
}
