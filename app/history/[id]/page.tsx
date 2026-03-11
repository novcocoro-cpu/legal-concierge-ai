'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import ResultCard from '@/components/result/ResultCard';
import ActionPlanList from '@/components/result/ActionPlanList';
import TranscriptAccordion from '@/components/result/TranscriptAccordion';
import NextMeetingCard from '@/components/result/NextMeetingCard';
import { useUserId } from '@/hooks/useUserId';
import { Meeting } from '@/types';
import { formatDate, formatDuration } from '@/lib/utils';

const PRIORITY_JA: Record<string, string> = { high: '高', medium: '中', low: '低' };

function buildPlainText(m: Meeting): string {
  const lines: string[] = [
    `【会議タイトル】\n${m.title}`,
    `【日付】\n${formatDate(m.created_at)}`,
    `【録音時間】\n${formatDuration(m.duration_seconds)}`,
  ];
  if (m.summary)
    lines.push(`【要約】\n${m.summary}`);
  if (m.problems?.length)
    lines.push(`【問題点】\n${m.problems.map(p => `• ${p}`).join('\n')}`);
  if (m.improvements?.length)
    lines.push(`【改善策・コンサルコメント】\n${m.improvements.map(i => `• ${i}`).join('\n')}`);
  if (m.action_plan?.length)
    lines.push(`【TODOリスト】\n${m.action_plan.map(a =>
      `• ${a.task}（担当: ${a.assignee}、期限: ${a.deadline}、優先度: ${PRIORITY_JA[a.priority] ?? a.priority}）`
    ).join('\n')}`);
  if (m.transcript)
    lines.push(`【文字起こし全文】\n${m.transcript}`);
  return lines.join('\n\n');
}

function buildCsv(m: Meeting): string {
  const rows: string[][] = [['項目名', '内容', '優先度']];
  if (m.summary)
    rows.push(['要約', m.summary, '']);
  for (const p of m.problems ?? [])
    rows.push(['問題点', p, '高']);
  for (const imp of m.improvements ?? [])
    rows.push(['改善策', imp, '中']);
  for (const a of m.action_plan ?? [])
    rows.push([`TODO: ${a.task}`, `担当: ${a.assignee} / 期限: ${a.deadline}`, PRIORITY_JA[a.priority] ?? a.priority]);
  return rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\r\n');
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useUserId();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleCopy = async () => {
    if (!meeting) return;
    try {
      await navigator.clipboard.writeText(buildPlainText(meeting));
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { showToast('コピーに失敗しました'); }
  };

  const handleWord = async () => {
    if (!meeting) return;
    try {
      const { downloadDocx } = await import('@/lib/exportDocument');
      await downloadDocx(meeting as Parameters<typeof downloadDocx>[0]);
    } catch { showToast('Word出力に失敗しました'); }
  };

  const handleCsv = () => {
    if (!meeting) return;
    const name = (meeting.title ?? '会議').replace(/[\\/:*?"<>|]/g, '_').slice(0, 50);
    downloadBlob('\uFEFF' + buildCsv(meeting), `${name}_議事録.csv`, 'text/csv;charset=utf-8');
  };

  useEffect(() => {
    if (!userId || !id) return;
    fetch(`/api/meetings?userId=${encodeURIComponent(userId)}&id=${encodeURIComponent(id)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: Meeting | null) => setMeeting(data))
      .finally(() => setLoading(false));
  }, [userId, id]);

  const handleDelete = async () => {
    if (!userId || !id) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/meetings?id=${id}&userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      router.push('/history');
    } catch {
      setToast('削除に失敗しました');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <AppShell title="詳細">
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 rounded-full border-4 animate-spin"
            style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
        </div>
      </AppShell>
    );
  }

  if (!meeting) {
    return (
      <AppShell title="詳細">
        <p style={{ color: 'var(--muted)' }} className="text-center py-20 text-sm">会議が見つかりません</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="詳細">
      {toast && (
        <div className="toast fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: 'var(--danger)', color: '#fff' }}>
          {toast}
        </div>
      )}

      <div className="flex flex-col gap-4 p-4">
        <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)' }} className="p-4">
          <h2 style={{ color: 'var(--text)' }} className="font-bold text-lg mb-1">{meeting.title}</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <span style={{ color: 'var(--muted)' }} className="text-xs">{formatDate(meeting.created_at)}</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)', background: 'var(--surface2)', borderRadius: '4px' }}
              className="text-xs px-2 py-0.5">
              {formatDuration(meeting.duration_seconds)}
            </span>
            {meeting.user_name && (
              <span style={{ color: 'var(--accent)', background: 'var(--accent-dim)', borderRadius: '4px' }} className="text-xs px-2 py-0.5">
                {meeting.user_name}
              </span>
            )}
          </div>
        </div>

        <TranscriptAccordion transcript={meeting.transcript} />

        <ResultCard title="会議の要約" icon="📄">
          <p style={{ color: 'var(--text)' }} className="text-sm leading-relaxed">{meeting.summary}</p>
        </ResultCard>

        <ResultCard title="問題点" icon="⚠️">
          <ul className="flex flex-col gap-2">
            {meeting.problems?.map((p, i) => (
              <li key={i} style={{ color: 'var(--text)' }} className="text-sm flex items-start gap-2">
                <span style={{ color: 'var(--danger)' }}>•</span>{p}
              </li>
            ))}
          </ul>
        </ResultCard>

        <ResultCard title="改善策" icon="💡">
          <ul className="flex flex-col gap-2">
            {meeting.improvements?.map((imp, i) => (
              <li key={i} style={{ color: 'var(--text)' }} className="text-sm flex items-start gap-2">
                <span style={{ color: 'var(--success)' }}>•</span>{imp}
              </li>
            ))}
          </ul>
        </ResultCard>

        <ResultCard title="実践計画" icon="🎯">
          <ActionPlanList items={meeting.action_plan} />
        </ResultCard>

        <NextMeetingCard data={meeting.next_meeting} />

        {/* エクスポートボタン */}
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{ background: copied ? 'var(--success)' : 'var(--surface)', color: copied ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}
          >
            {copied ? '✓ コピー済み' : '📋 コピー'}
          </button>
          <button
            onClick={handleWord}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{ background: '#2563eb', color: '#fff' }}
          >
            📄 Word
          </button>
          <button
            onClick={handleCsv}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{ background: '#16a34a', color: '#fff' }}
          >
            📊 CSV
          </button>
        </div>

        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--surface2)', color: 'var(--danger)', border: '1px solid var(--danger)' }}
          >
            🗑 削除
          </button>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--danger)', borderRadius: '12px' }} className="p-4 flex flex-col gap-3">
            <p style={{ color: 'var(--text)' }} className="text-sm text-center">本当に削除しますか？</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 rounded-xl text-sm"
                style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' }}
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ background: 'var(--danger)', color: '#fff' }}
              >
                {deleting ? '削除中…' : '削除する'}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
