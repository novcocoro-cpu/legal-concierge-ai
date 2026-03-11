'use client';

// ============================================================
// 会議議事録AI — 管理画面 (/meetings/admin)
// タブ: 会議一覧 / プロンプト管理 / 参加者情報 / システム設定
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatDuration, formatDate } from '@/lib/utils';
import type { Meeting, ActionItem, ErrorLog, Company, Member } from '@/types';

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────
type Tab = 'meetings' | 'prompts' | 'participants' | 'settings' | 'errors';

interface Stats {
  totalMeetings:  number;
  todayMeetings:  number;
  weekMeetings:   number;
  totalDuration:  number;
}

interface PromptRow {
  プロンプトID:   string;
  タイトル:       string;
  プロンプト本文: string;
  有効フラグ:     boolean;
  作成日時:       string;
  更新日時:       string;
}

interface Participant {
  user_id:        string;
  user_name:      string;
  meeting_count:  number;
  total_duration: number;
  last_meeting:   string;
  todo_count:     number;
}

// ─────────────────────────────────────────────
// 共通ユーティリティ
// ─────────────────────────────────────────────
function fmt(d: string) {
  return new Date(d).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────────
// 共通コンポーネント
// ─────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px] text-gray-400">
      <div className="animate-spin w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full" />
    </div>
  );
}

function ErrBanner({ msg }: { msg: string }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-3 flex-shrink-0">
      {msg.includes('does not exist') || msg.includes('relation') ? (
        <><strong>テーブルが未作成です。</strong> Supabase SQL Editor で migration を実行してください。</>
      ) : msg}
    </div>
  );
}

function StatCard({ label, value, accent, sub }: { label: string; value: string | number; accent?: boolean; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-2 ${accent ? 'text-blue-600' : 'text-gray-800'}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────
// ログイン画面
// ─────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (pw: string) => Promise<boolean> }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr('');
    const ok = await onLogin(pw);
    if (!ok) setErr('パスワードが違います');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-800">管理者ログイン</h1>
          <p className="text-sm text-gray-500 mt-1">会議議事録AI 管理画面</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <input
            type="password" value={pw} onChange={e => setPw(e.target.value)} autoFocus
            placeholder="管理者パスワード"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button type="submit" disabled={!pw || loading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm">
            {loading ? '認証中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 会議一覧タブ（3階層ドリルダウン）
// 会社一覧 → メンバー一覧 → 会議一覧 → 詳細
// ─────────────────────────────────────────────
type DrillLevel = 'companies' | 'members' | 'meetings';

function MeetingsTab({ pw }: { pw: string }) {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [members, setMembers]     = useState<Member[]>([]);
  const [meetings, setMeetings]   = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // ドリルダウン状態
  const [level, setLevel] = useState<DrillLevel>('companies');
  const [selCompany, setSelCompany] = useState<Company | null>(null);
  const [selMember, setSelMember]   = useState<Member | null>(null);
  const [selMeeting, setSelMeeting] = useState<Meeting | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState('');

  const headers = { 'x-admin-password': pw };

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = await fetch('/api/admin', { headers });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? '取得失敗');
      setStats(d.stats);
      setCompanies(d.companies ?? []);
      setMembers(d.members ?? []);
      setMeetings(d.meetings ?? []);
    } catch (e) { setErr(String(e)); }
    setLoading(false);
  }, [pw]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // ドリルダウン操作
  const openCompany = (c: Company) => {
    setSelCompany(c); setSelMember(null); setSelMeeting(null);
    setLevel('members'); setSearch('');
  };
  const openMember = (m: Member) => {
    setSelMember(m); setSelMeeting(null);
    setLevel('meetings'); setSearch('');
  };
  const goBack = () => {
    if (level === 'meetings') { setLevel('members'); setSelMember(null); setSelMeeting(null); setSearch(''); }
    else if (level === 'members') { setLevel('companies'); setSelCompany(null); setSearch(''); }
  };
  const selectMeeting = async (m: Meeting) => {
    setSelMeeting(m); setLoadingDetail(true);
    try {
      const r = await fetch(`/api/admin?id=${m.id}`, { headers });
      const d = await r.json();
      if (d.meeting) setSelMeeting(d.meeting);
    } catch { /* fallback */ }
    setLoadingDetail(false);
  };

  // フィルタ済みリスト
  const q = search.toLowerCase();
  const companyMemberCount = (cId: string) => members.filter(m => m.company_id === cId).length;
  const companyMeetingCount = (cId: string) => meetings.filter(m => m.company_id === cId).length;
  const filteredCompanies = companies.filter(c => c.name.toLowerCase().includes(q));
  const filteredMembers = selCompany
    ? members.filter(m => m.company_id === selCompany.id && m.name.toLowerCase().includes(q))
    : [];
  const memberMeetingCount = (mId: string) => meetings.filter(m => m.member_id === mId).length;
  const filteredMeetings = selMember
    ? meetings.filter(m => m.member_id === selMember.id &&
        ((m.title ?? '').toLowerCase().includes(q) || (m.summary ?? '').toLowerCase().includes(q)))
    : [];

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-4 h-full">
      {err && <ErrBanner msg={err} />}
      {stats && (
        <div className="grid grid-cols-4 gap-4 flex-shrink-0">
          <StatCard label="総会議数" value={stats.totalMeetings} />
          <StatCard label="今週" value={stats.weekMeetings} accent />
          <StatCard label="今日" value={stats.todayMeetings} accent />
          <StatCard label="総録音時間" value={formatDuration(stats.totalDuration)} sub="全会議合計" />
        </div>
      )}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* 左パネル：ドリルダウン */}
        <div className="w-80 flex-shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
          {/* ヘッダー */}
          <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0 space-y-2">
            {level !== 'companies' && (
              <button onClick={goBack} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium mb-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                戻る
              </button>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">
                {level === 'companies' && '🏢 会社一覧'}
                {level === 'members' && `👤 ${selCompany?.name} のメンバー`}
                {level === 'meetings' && `📋 ${selMember?.name} の会議`}
              </span>
              <span className="text-xs text-gray-400">
                {level === 'companies' && `${filteredCompanies.length} 社`}
                {level === 'members' && `${filteredMembers.length} 名`}
                {level === 'meetings' && `${filteredMeetings.length} 件`}
              </span>
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={level === 'companies' ? '会社名で検索...' : level === 'members' ? '名前で検索...' : 'タイトルで検索...'}
              className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300" />
          </div>

          {/* リスト */}
          <div className="flex-1 overflow-y-auto">
            {/* 会社一覧 */}
            {level === 'companies' && (
              filteredCompanies.length === 0
                ? <p className="text-sm text-gray-400 text-center py-10">会社なし</p>
                : filteredCompanies.map(c => (
                  <button key={c.id} onClick={() => openCompany(c)}
                    className="w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-blue-50 transition-colors group">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-800">{c.name}</span>
                      <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div className="flex gap-3 mt-1">
                      <span className="text-xs text-gray-400">👤 {companyMemberCount(c.id)} 名</span>
                      <span className="text-xs text-gray-400">📋 {companyMeetingCount(c.id)} 件</span>
                    </div>
                  </button>
                ))
            )}

            {/* メンバー一覧 */}
            {level === 'members' && (
              filteredMembers.length === 0
                ? <p className="text-sm text-gray-400 text-center py-10">メンバーなし</p>
                : filteredMembers.map(m => (
                  <button key={m.id} onClick={() => openMember(m)}
                    className="w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-blue-50 transition-colors group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {m.name.slice(0, 1)}
                        </div>
                        <span className="text-sm font-medium text-gray-800">{m.name}</span>
                      </div>
                      <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 ml-9">📋 {memberMeetingCount(m.id)} 件</p>
                  </button>
                ))
            )}

            {/* 会議一覧 */}
            {level === 'meetings' && (
              filteredMeetings.length === 0
                ? <p className="text-sm text-gray-400 text-center py-10">会議なし</p>
                : filteredMeetings.map(m => (
                  <button key={m.id} onClick={() => selectMeeting(m)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors ${selMeeting?.id === m.id ? 'bg-blue-50 border-l-2 border-l-blue-600' : 'hover:bg-gray-50'}`}>
                    <p className="text-sm font-medium text-gray-800 line-clamp-1">{m.title || '（タイトルなし）'}</p>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-xs text-gray-400">{fmt(m.created_at)}</span>
                      <span className="text-xs text-gray-400">{formatDuration(m.duration_seconds)}</span>
                    </div>
                  </button>
                ))
            )}
          </div>
        </div>

        {/* 右パネル：会議詳細 */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
          {selMeeting ? (
            <>
              <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-gray-800">{selMeeting.title}</p>
                    <div className="flex flex-wrap gap-3 mt-1">
                      <span className="text-xs text-gray-400">{fmt(selMeeting.created_at)}</span>
                      {selMeeting.company_name && <span className="text-xs text-gray-400">🏢 {selMeeting.company_name}</span>}
                      <span className="text-xs text-gray-400">👤 {selMeeting.user_name}</span>
                      <span className="text-xs text-gray-400">⏱ {formatDuration(selMeeting.duration_seconds)}</span>
                    </div>
                  </div>
                  <button onClick={() => router.push(`/history/${selMeeting.id}`)}
                    className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors">
                    詳細を開く
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
              {loadingDetail ? <Spinner /> : (
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  {selMeeting.summary && (
                    <section>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">📄 要約</h4>
                      <p className="text-sm text-gray-700 leading-relaxed">{selMeeting.summary}</p>
                    </section>
                  )}
                  {(selMeeting.problems?.length ?? 0) > 0 && (
                    <section>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">⚠️ 問題点</h4>
                      <ul className="space-y-1">
                        {selMeeting.problems.map((p, i) => (
                          <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-red-400">•</span>{p}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {(selMeeting.improvements?.length ?? 0) > 0 && (
                    <section>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">💡 改善策</h4>
                      <ul className="space-y-1">
                        {selMeeting.improvements.map((imp, i) => (
                          <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-green-400">•</span>{imp}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {(selMeeting.action_plan?.length ?? 0) > 0 && (
                    <section>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">🎯 アクションプラン</h4>
                      <div className="space-y-2">
                        {selMeeting.action_plan.map((a: ActionItem, i: number) => (
                          <div key={i} className="bg-gray-50 rounded-lg p-3">
                            <p className="text-sm font-medium text-gray-800">{a.task}</p>
                            <div className="flex gap-3 mt-1">
                              <span className="text-xs text-blue-600">👤 {a.assignee}</span>
                              <span className="text-xs text-gray-500">📅 {a.deadline}</span>
                              <span className={`text-xs font-semibold ${a.priority === 'high' ? 'text-red-500' : a.priority === 'medium' ? 'text-yellow-500' : 'text-green-500'}`}>
                                [{a.priority === 'high' ? '高' : a.priority === 'medium' ? '中' : '低'}]
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  {selMeeting.transcript && (
                    <section>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">📝 文字起こし</h4>
                      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{selMeeting.transcript}</p>
                    </section>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm">会社 → メンバー → 会議を選択</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// プロンプト管理タブ
// ─────────────────────────────────────────────
function PromptsTab({ pw }: { pw: string }) {
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState<PromptRow | null>(null);
  const [form, setForm] = useState({ タイトル: '', プロンプト本文: '', 有効フラグ: true });
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const headers = { 'x-admin-password': pw, 'Content-Type': 'application/json' };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/prompts', { headers });
    const d = await r.json();
    setPrompts(d.prompts ?? []);
    if (d.error) setErr(d.error);
    setLoading(false);
  }, [pw]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({ タイトル: '', プロンプト本文: '', 有効フラグ: true });
    setShowForm(true);
  };

  const openEdit = (p: PromptRow) => {
    setEditing(p);
    setForm({ タイトル: p.タイトル, プロンプト本文: p.プロンプト本文, 有効フラグ: p.有効フラグ });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    const method = editing ? 'PUT' : 'POST';
    const body = editing ? { ...form, プロンプトID: editing.プロンプトID } : form;
    const r = await fetch('/api/admin/prompts', { method, headers, body: JSON.stringify(body) });
    if (r.ok) { setShowForm(false); await load(); }
    else { const d = await r.json(); setErr(d.error ?? '保存失敗'); }
    setSaving(false);
  };

  const del = async (id: string) => {
    if (!confirm('削除しますか？')) return;
    await fetch(`/api/admin/prompts?id=${id}`, { method: 'DELETE', headers });
    await load();
  };

  const toggle = async (p: PromptRow) => {
    await fetch('/api/admin/prompts', {
      method: 'PUT', headers,
      body: JSON.stringify({ プロンプトID: p.プロンプトID, 有効フラグ: !p.有効フラグ }),
    });
    await load();
  };

  if (loading) return <Spinner />;

  return (
    <div className="flex gap-4 h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        {err && <ErrBanner msg={err} />}
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-700">プロンプト一覧 ({prompts.length}件)</h2>
          <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            新規追加
          </button>
        </div>
        <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-gray-200">
          {prompts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-16">プロンプトがありません</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 w-48">タイトル</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">プロンプト本文</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 w-16">有効</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 w-28">更新日時</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 w-24">操作</th>
                </tr>
              </thead>
              <tbody>
                {prompts.map(p => (
                  <tr key={p.プロンプトID} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{p.タイトル}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{p.プロンプト本文}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggle(p)} className={`w-10 h-5 rounded-full transition-colors ${p.有効フラグ ? 'bg-blue-600' : 'bg-gray-300'}`}>
                        <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${p.有効フラグ ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">{fmt(p.更新日時)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => del(p.プロンプトID)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showForm && (
        <div className="w-96 flex-shrink-0 bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">{editing ? 'プロンプト編集' : '新規プロンプト'}</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">タイトル <span className="text-red-500">*</span></label>
            <input value={form.タイトル} onChange={e => setForm(f => ({ ...f, タイトル: e.target.value }))}
              placeholder="例：会議分析プロンプト v1"
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs font-medium text-gray-700">プロンプト本文 <span className="text-red-500">*</span></label>
            <textarea value={form.プロンプト本文} onChange={e => setForm(f => ({ ...f, プロンプト本文: e.target.value }))}
              placeholder="この会議音声を分析してください。..."
              rows={12}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.有効フラグ} onChange={e => setForm(f => ({ ...f, 有効フラグ: e.target.checked }))} className="rounded text-blue-600" />
            有効にする
          </label>
          <button onClick={save} disabled={!form.タイトル || !form.プロンプト本文 || saving}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm">
            {saving ? '保存中...' : editing ? '更新する' : '作成する'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 参加者情報タブ
// ─────────────────────────────────────────────
function ParticipantsTab({ pw }: { pw: string }) {
  const router = useRouter();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [selected, setSelected] = useState<Participant | null>(null);
  const [search, setSearch] = useState('');

  const headers = { 'x-admin-password': pw };

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = await fetch('/api/admin', { headers });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? '取得失敗');

      const list: Meeting[] = d.meetings ?? [];
      setMeetings(list);

      // user_id でグループ化して参加者統計を作成
      const map = new Map<string, Participant>();
      for (const m of list) {
        const key = m.user_id;
        const existing = map.get(key);
        const todos = m.action_plan?.length ?? 0;
        if (existing) {
          existing.meeting_count++;
          existing.total_duration += m.duration_seconds ?? 0;
          existing.todo_count += todos;
          if (m.created_at > existing.last_meeting) existing.last_meeting = m.created_at;
        } else {
          map.set(key, {
            user_id: m.user_id,
            user_name: m.user_name,
            meeting_count: 1,
            total_duration: m.duration_seconds ?? 0,
            last_meeting: m.created_at,
            todo_count: todos,
          });
        }
      }
      setParticipants([...map.values()].sort((a, b) => b.last_meeting.localeCompare(a.last_meeting)));
    } catch (e) { setErr(String(e)); }
    setLoading(false);
  }, [pw]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const filtered = participants.filter(p => p.user_name.toLowerCase().includes(search.toLowerCase()));
  const userMeetings = selected ? meetings.filter(m => m.user_id === selected.user_id) : [];

  if (loading) return <Spinner />;

  return (
    <>

      <div className="flex gap-4 h-full">
        <div className="flex-1 flex flex-col overflow-hidden">
          {err && <ErrBanner msg={err} />}
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-700">参加者一覧 ({filtered.length}名)</h2>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="名前で検索..."
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300 w-40" />
          </div>
          <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-gray-200">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-16">参加者なし</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">名前</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 w-20">会議数</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 w-28">合計時間</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 w-20">TODO数</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 w-32">最終会議</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.user_id} onClick={() => setSelected(p)}
                      className={`border-b border-gray-50 cursor-pointer transition-colors ${selected?.user_id === p.user_id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {p.user_name.slice(0, 1)}
                          </div>
                          <span className="font-medium text-gray-800">{p.user_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">{p.meeting_count}回</td>
                      <td className="px-4 py-3 text-center text-gray-700">{formatDuration(p.total_duration)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.todo_count > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                          {p.todo_count}件
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400 text-xs">{fmt(p.last_meeting)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 参加者の会議一覧 */}
        {selected && (
          <div className="w-80 flex-shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
            <div className="px-4 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    {selected.user_name.slice(0, 1)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{selected.user_name}</p>
                    <p className="text-xs text-gray-400">{selected.meeting_count}回 · {formatDuration(selected.total_duration)}</p>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {userMeetings.map(m => (
                <div key={m.id} className="border-b border-gray-50">
                  <button
                    onClick={() => router.push(`/history/${m.id}`)}
                    className="w-full text-left px-4 pt-3 pb-1 hover:bg-blue-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-800 line-clamp-1">
                      {m.title || '（タイトルなし）'}
                    </p>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-400">{fmt(m.created_at)}</span>
                      <span className="text-xs text-gray-400">{formatDuration(m.duration_seconds)}</span>
                    </div>
                    {m.summary && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{m.summary}</p>}
                  </button>
                  <div className="px-4 pb-2">
                    <button onClick={() => router.push(`/history/${m.id}`)}
                      className="text-xs text-blue-500 hover:text-blue-700 hover:underline font-medium">
                      詳細を開く →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// エラーログタブ
// ─────────────────────────────────────────────
const PROCESS_TYPE_COLORS: Record<string, string> = {
  録音:           'bg-orange-100 text-orange-700',
  文字起こし:     'bg-purple-100 text-purple-700',
  保存:           'bg-blue-100 text-blue-700',
  マイクアクセス: 'bg-yellow-100 text-yellow-700',
};

function ProcessBadge({ label }: { label: string }) {
  const cls = PROCESS_TYPE_COLORS[label] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function ErrorLogsTab({ pw }: { pw: string }) {
  const [logs, setLogs]       = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [search, setSearch]   = useState('');
  const [query, setQuery]     = useState('');

  const headers = { 'x-admin-password': pw };

  const load = useCallback(async (searchTerm: string) => {
    setLoading(true); setErr('');
    try {
      const url = searchTerm
        ? `/api/error-logs?search=${encodeURIComponent(searchTerm)}`
        : '/api/error-logs';
      const r = await fetch(url, { headers });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? '取得失敗');
      setLogs(d.logs ?? []);
    } catch (e) { setErr(String(e)); }
    setLoading(false);
  }, [pw]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(''); }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(search);
    setQuery(search);
  };

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col h-full gap-4">
      {err && <ErrBanner msg={err} />}

      {/* 検索バー */}
      <form onSubmit={handleSearch} className="flex gap-2 flex-shrink-0">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="エラー内容で検索..."
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          検索
        </button>
        {query && (
          <button
            type="button"
            onClick={() => { setSearch(''); setQuery(''); load(''); }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg transition-colors"
          >
            クリア
          </button>
        )}
      </form>

      {/* 件数 */}
      <div className="flex items-center justify-between flex-shrink-0">
        <span className="text-sm font-semibold text-gray-700">
          エラーログ一覧
          {query && <span className="text-gray-400 font-normal ml-1">「{query}」の検索結果</span>}
        </span>
        <span className="text-xs text-gray-400">{logs.length} 件</span>
      </div>

      {/* テーブル */}
      <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-gray-200">
        {logs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">
            {query ? '該当するエラーログがありません' : 'エラーログがありません'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 w-36">発生日時</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 w-28">処理</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">エラー内容</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 w-24">デバイス</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 w-24">ブラウザ</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {fmt(log.occurred_at)}
                  </td>
                  <td className="px-4 py-3">
                    <ProcessBadge label={log.process_type} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-xs">
                    <p className="break-words">{log.error_message}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {log.device_info ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {log.browser_info ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// システム設定タブ
// ─────────────────────────────────────────────
const KNOWN_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-flash-latest', 'gemini-2.0-flash-lite'];

const DURATION_PRESETS = [10, 30, 60] as const;

function SettingsTab({ pw }: { pw: string }) {
  const [model, setModel]         = useState('gemini-2.5-flash');
  const [defDuration, setDefDuration] = useState<number>(30);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [durSaving, setDurSaving] = useState(false);
  const [durSaved, setDurSaved]   = useState(false);
  const [err, setErr]             = useState('');
  const [durErr, setDurErr]       = useState('');
  const [adminPw, setAdminPw]     = useState('');
  const [pwSaved, setPwSaved]     = useState(false);

  const headers = { 'x-admin-password': pw, 'Content-Type': 'application/json' };

  useEffect(() => {
    fetch('/api/admin/settings', { headers })
      .then(r => r.json())
      .then(d => {
        const rows = d.settings as Record<string, string>[] ?? [];
        const modelRow = rows.find(s => s['設定キー'] === 'gemini_model');
        if (modelRow?.['設定値']) setModel(modelRow['設定値']);
        const durRow = rows.find(s => s['設定キー'] === 'default_recording_minutes');
        if (durRow?.['設定値']) setDefDuration(parseInt(durRow['設定値'], 10) || 30);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true); setSaved(false); setErr('');
    const r = await fetch('/api/admin/settings', {
      method: 'PUT', headers,
      body: JSON.stringify({ 設定キー: 'gemini_model', 設定値: model.trim() }),
    });
    if (r.ok) setSaved(true);
    else { const d = await r.json(); setErr(d.error ?? '保存失敗'); }
    setSaving(false);
  };

  const saveDuration = async () => {
    setDurSaving(true); setDurSaved(false); setDurErr('');
    const r = await fetch('/api/admin/settings', {
      method: 'PUT', headers,
      body: JSON.stringify({ 設定キー: 'default_recording_minutes', 設定値: String(defDuration) }),
    });
    if (r.ok) setDurSaved(true);
    else { const d = await r.json(); setDurErr(d.error ?? '保存失敗'); }
    setDurSaving(false);
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-xl space-y-5">
      <h2 className="text-sm font-semibold text-gray-700">システム設定</h2>

      {/* Gemini モデル */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-4">
        <div>
          <h3 className="font-semibold text-gray-800 mb-1">Gemini モデル</h3>
          <p className="text-xs text-gray-500">音声解析に使用するGeminiモデルを設定します。変更は即時反映されます。</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">プリセット</p>
          <div className="flex flex-wrap gap-2">
            {KNOWN_MODELS.map(m => (
              <button key={m} onClick={() => { setModel(m); setSaved(false); }}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${model === m ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">モデル名（直接入力も可）</p>
          <input value={model} onChange={e => { setModel(e.target.value); setSaved(false); }}
            placeholder="gemini-2.5-flash"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={!model.trim() || saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            {saving ? '保存中...' : '保存する'}
          </button>
          {saved && <span className="text-sm text-green-600 font-medium">✅ 保存しました</span>}
          {err && <span className="text-sm text-red-500">{err}</span>}
        </div>
      </div>

      {/* デフォルト録音時間 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-4">
        <div>
          <h3 className="font-semibold text-gray-800 mb-1">デフォルト録音時間</h3>
          <p className="text-xs text-gray-500">録音画面で最初に選択される録音時間を設定します。</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">プリセット</p>
          <div className="flex gap-2">
            {DURATION_PRESETS.map(min => (
              <button key={min} onClick={() => { setDefDuration(min); setDurSaved(false); }}
                className={`px-4 py-2 text-sm rounded-lg border transition-colors font-medium ${defDuration === min ? 'bg-blue-50 border-blue-400 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {min}分
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={saveDuration} disabled={durSaving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            {durSaving ? '保存中...' : '保存する'}
          </button>
          {durSaved && <span className="text-sm text-green-600 font-medium">✅ 保存しました</span>}
          {durErr   && <span className="text-sm text-red-500">{durErr}</span>}
        </div>
      </div>

      {/* 管理者パスワード変更 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-4">
        <div>
          <h3 className="font-semibold text-gray-800 mb-1">管理者パスワード</h3>
          <p className="text-xs text-gray-500">現在のパスワードは .env.local の ADMIN_PASSWORD に設定されています。変更する場合はファイルを直接編集してください。</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 font-mono">
          ADMIN_PASSWORD=your_password_here
        </div>
        <p className="text-xs text-gray-400">※ パスワード変更後はサーバーの再起動が必要です。</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// メインページ
// ─────────────────────────────────────────────
const TAB_LABELS: { key: Tab; label: string }[] = [
  { key: 'meetings',     label: '会議一覧' },
  { key: 'prompts',      label: 'プロンプト管理' },
  { key: 'participants', label: '参加者情報' },
  { key: 'settings',     label: 'システム設定' },
  { key: 'errors',       label: 'エラーログ' },
];

export default function AdminPage() {
  const [pw, setPw]   = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('meetings');

  useEffect(() => {
    const stored = sessionStorage.getItem('mtg_admin_pw');
    if (stored) setPw(stored);
  }, []);

  const handleLogin = async (password: string): Promise<boolean> => {
    const r = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (r.ok) { sessionStorage.setItem('mtg_admin_pw', password); setPw(password); return true; }
    return false;
  };

  const logout = () => { sessionStorage.removeItem('mtg_admin_pw'); setPw(null); };

  if (!pw) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-base font-bold text-gray-800">管理画面</p>
              <p className="text-xs text-gray-500">会議議事録AI</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="/record" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              ユーザー画面
            </a>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* タブナビ */}
      <nav className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="max-w-[1600px] mx-auto px-4 flex gap-0">
          {TAB_LABELS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* コンテンツ */}
      <div className="flex-1 overflow-hidden max-w-[1600px] w-full mx-auto px-4 py-5">
        {tab === 'meetings'     && <MeetingsTab     pw={pw} />}
        {tab === 'prompts'      && <PromptsTab      pw={pw} />}
        {tab === 'participants' && <ParticipantsTab pw={pw} />}
        {tab === 'settings'     && <SettingsTab     pw={pw} />}
        {tab === 'errors'       && <ErrorLogsTab    pw={pw} />}
      </div>
    </div>
  );
}
