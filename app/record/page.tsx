'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import RecordButton from '@/components/record/RecordButton';
import RecordTimer from '@/components/record/RecordTimer';
import Waveform from '@/components/record/Waveform';
import ResultCard from '@/components/result/ResultCard';
import ActionPlanList from '@/components/result/ActionPlanList';
import TranscriptAccordion from '@/components/result/TranscriptAccordion';
import NextMeetingCard from '@/components/result/NextMeetingCard';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useUserId } from '@/hooks/useUserId';
import { useMicPermission } from '@/hooks/useMicPermission';
import { GeminiResult } from '@/types';
import { logError } from '@/lib/logError';
import MicPermissionGuide from '@/components/record/MicPermissionGuide';
import { saveRecordingBackup, loadRecordingBackup, clearRecordingBackup } from '@/lib/recordingBackup';

type Phase = 'idle' | 'recording' | 'analyzing' | 'result';

const STEPS = ['音声変換中…', '文字起こし中…', '解析中…', '解析完了！'];

// 録音時間の選択肢（分）
const DURATION_OPTIONS = [10, 30, 60] as const;
const DEFAULT_LIMIT_MIN = 30;
// チャンク保存間隔（ミリ秒）
const CHUNK_SAVE_INTERVAL_MS = 5 * 60 * 1000;

// ──────────────────────────────────────────
// サブコンポーネント
// ──────────────────────────────────────────

function SuccessToast({ message }: { message: string }) {
  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-xl"
      style={{ background: 'var(--success)', color: '#fff', maxWidth: '90vw' }}
    >
      {message}
    </div>
  );
}

function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-xl shadow-xl"
      style={{ width: 'calc(100% - 32px)', maxWidth: '448px' }}
    >
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-xl"
        style={{ background: 'var(--danger)', color: '#fff' }}
      >
        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <p className="text-sm font-medium flex-1 leading-relaxed whitespace-pre-line">{message}</p>
        <button
          onClick={onClose}
          className="flex-shrink-0 opacity-80 hover:opacity-100 transition-opacity ml-1"
          aria-label="閉じる"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// 録音時間選択ボタン
function DurationSelector({
  selected,
  onChange,
}: {
  selected: number;
  onChange: (min: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p style={{ color: 'var(--muted)' }} className="text-xs font-medium">
        録音時間
      </p>
      <div className="flex gap-2">
        {DURATION_OPTIONS.map((min) => (
          <button
            key={min}
            onClick={() => onChange(min)}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={
              selected === min
                ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }
                : { background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }
            }
          >
            {min}分
          </button>
        ))}
      </div>
    </div>
  );
}

// バックアップ復旧バナー
function BackupBanner({
  savedAt,
  durationSec,
  onRestore,
  onDiscard,
}: {
  savedAt: Date;
  durationSec: number;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  const timeStr = savedAt.toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const min     = Math.floor(durationSec / 60);
  return (
    <div
      className="mx-4 mt-4 rounded-xl p-4 flex flex-col gap-3"
      style={{ background: 'var(--surface)', border: '2px solid var(--warning)' }}
    >
      <div className="flex items-start gap-2">
        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <div>
          <p style={{ color: 'var(--text)' }} className="text-sm font-semibold">
            保存済みの録音があります
          </p>
          <p style={{ color: 'var(--muted)' }} className="text-xs mt-0.5">
            {timeStr} 保存（約{min}分）
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onRestore}
          className="flex-1 py-2 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          文字起こしする
        </button>
        <button
          onClick={onDiscard}
          className="px-4 py-2 rounded-xl text-sm"
          style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' }}
        >
          削除
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// メインページ
// ──────────────────────────────────────────
export default function RecordPage() {
  const { userId, userName, companyName, setUserName, setCompanyName } = useUserId();
  const { isRecording, seconds, startRecording, stopRecording, getSnapshot, error: recError } = useAudioRecorder();
  const { status: micStatus, requestPermission } = useMicPermission();

  const [phase, setPhase]           = useState<Phase>('idle');
  const [stepIndex, setStepIndex]   = useState(0);
  const [result, setResult]         = useState<GeminiResult | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [nameInput, setNameInput]     = useState('');
  const [companyInput, setCompanyInput] = useState('');
  const [limitMin, setLimitMin]       = useState<number>(DEFAULT_LIMIT_MIN);
  const [backup, setBackup]         = useState<{ savedAt: Date; durationSec: number; blob: Blob } | null>(null);
  const savingRef     = useRef(false);
  const autoStopRef   = useRef(false);   // 自動停止の二重実行防止

  // ── デフォルト録音時間をAPIから取得 ──
  useEffect(() => {
    fetch('/api/settings?key=default_recording_minutes')
      .then(r => r.json())
      .then(d => {
        const v = parseInt(d.value, 10);
        if (!isNaN(v) && v > 0) setLimitMin(v);
      })
      .catch(() => {});
  }, []);

  // ── バックアップを確認（起動時） ──
  useEffect(() => {
    loadRecordingBackup().then(b => {
      if (!b) return;
      // 24時間以内のバックアップのみ表示
      if (Date.now() - b.savedAt.getTime() < 24 * 60 * 60 * 1000) {
        setBackup({ savedAt: b.savedAt, durationSec: b.durationSec, blob: b.blob });
      } else {
        clearRecordingBackup();
      }
    });
  }, []);

  // ── 5分ごとにチャンクをバックアップ ──
  useEffect(() => {
    if (phase !== 'recording') return;
    const interval = setInterval(async () => {
      const snap = getSnapshot();
      if (snap) {
        await saveRecordingBackup(snap.chunks, snap.mimeType, seconds);
      }
    }, CHUNK_SAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [phase, getSnapshot, seconds]);

  // ── 時間上限に達したら自動停止 ──
  useEffect(() => {
    if (phase !== 'recording') { autoStopRef.current = false; return; }
    if (seconds >= limitMin * 60 && !autoStopRef.current) {
      autoStopRef.current = true;
      handleStopAndAnalyze();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, phase, limitMin]);

  const showSuccess = (message: string) => {
    setSuccessMsg(message);
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const showError = (message: string) => setErrorMsg(message);

  const autoSave = async (data: GeminiResult, dur: number, uid: string, uname: string, cname: string) => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id:          uid,
          user_name:        uname || '名無し',
          company_name:     cname,
          title:            data.title,
          transcript:       data.transcript,
          summary:          data.summary,
          problems:         data.problems,
          improvements:     data.improvements,
          action_plan:      data.action_plan,
          next_meeting:     data.next_meeting,
          duration_seconds: dur,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTPエラー ${res.status}`);
      }
      showSuccess('議事録を保存しました ✅');
      await clearRecordingBackup();   // 保存成功したらバックアップ削除
      setBackup(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '保存に失敗しました';
      showError(`保存エラー: ${msg}`);
      logError(msg, '保存');
    } finally {
      savingRef.current = false;
    }
  };

  // 音声 Blob を受け取って文字起こし → 保存
  const analyzeBlob = useCallback(async (blob: Blob, dur: number) => {
    setPhase('analyzing');
    setStepIndex(0);
    const stepTimer = setInterval(() => setStepIndex(i => Math.min(i + 1, STEPS.length - 1)), 1200);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
      clearInterval(stepTimer);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `文字起こしに失敗しました（HTTPエラー ${res.status}）`);
      }
      const data: GeminiResult = await res.json();
      setResult(data);
      setPhase('result');
      if (userId) autoSave(data, dur, userId, userName || '名無し', companyName);
    } catch (e) {
      clearInterval(stepTimer);
      const msg = e instanceof Error ? e.message : '解析に失敗しました';
      showError(`文字起こしエラー: ${msg}`);
      logError(msg, '文字起こし');
      setPhase('idle');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userName]);

  // 録音停止 → 文字起こし（手動 or 自動タイムアップ共通）
  const handleStopAndAnalyze = useCallback(async () => {
    const dur  = seconds;
    const blob = await stopRecording();
    setDurationSec(dur);
    // 最終バックアップを保存してから解析
    const snap = getSnapshot();
    if (snap) await saveRecordingBackup(snap.chunks, snap.mimeType, dur);
    await analyzeBlob(blob, dur);
  }, [seconds, stopRecording, getSnapshot, analyzeBlob]);

  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      await handleStopAndAnalyze();
    } else {
      try {
        await startRecording();
        setPhase('recording');
        setResult(null);
        autoStopRef.current = false;
      } catch (e) {
        const err  = e instanceof DOMException ? e : null;
        const isPerm = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' || err?.name === 'SecurityError';
        const msg  = e instanceof Error ? e.message : (recError || 'マイクにアクセスできません');
        if (!isPerm) {
          showError(`マイクアクセスエラー: ${msg}`);
        }
        logError(msg, 'マイクアクセス');
      }
    }
  }, [isRecording, handleStopAndAnalyze, startRecording, recError]);

  // ── バックアップからの復旧 ──
  const handleRestoreBackup = useCallback(async () => {
    if (!backup) return;
    setBackup(null);
    await analyzeBlob(backup.blob, backup.durationSec);
  }, [backup, analyzeBlob]);

  const handleDiscardBackup = useCallback(async () => {
    setBackup(null);
    await clearRecordingBackup();
  }, []);

  // ── マイク許可チェック ──
  if (userName !== null && userId) {
    if (micStatus === 'checking') {
      return (
        <div style={{ background: 'var(--bg)', maxWidth: '480px' }} className="mx-auto min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        </div>
      );
    }
    if (micStatus === 'prompt' || micStatus === 'denied' || micStatus === 'unavailable') {
      return <MicPermissionGuide status={micStatus} onRequest={requestPermission} />;
    }
  }

  // ── 名前入力画面 ──
  if (userName === null && userId) {
    const handleStart = () => {
      if (!companyInput.trim() || !nameInput.trim()) return;
      setCompanyName(companyInput.trim());
      setUserName(nameInput.trim());
    };
    return (
      <div style={{ background: 'var(--bg)', maxWidth: '480px' }} className="mx-auto min-h-screen flex items-center justify-center p-6">
        <div className="w-full flex flex-col items-center gap-5">
          <span className="text-6xl">🎙</span>
          <div className="text-center">
            <h1 style={{ color: 'var(--text)' }} className="text-2xl font-bold mb-2">会議議事録 AI</h1>
            <p style={{ color: 'var(--muted)' }} className="text-sm leading-relaxed">
              録音するだけで、要約・問題点<br />改善策・アクションプランを<br />Gemini AI が自動生成します。
            </p>
          </div>

          {/* 会社名（必須） */}
          <div className="w-full">
            <label style={{ color: 'var(--muted)' }} className="text-xs font-medium mb-1.5 block">
              会社名・組織名 <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text" placeholder="例：株式会社サンプル"
              value={companyInput} onChange={e => setCompanyInput(e.target.value)}
              autoFocus
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>

          {/* 個人名（必須） */}
          <div className="w-full">
            <label style={{ color: 'var(--muted)' }} className="text-xs font-medium mb-1.5 block">
              あなたのお名前 <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text" placeholder="例：田中 太郎"
              value={nameInput} onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStart()}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>

          <button
            onClick={handleStart}
            disabled={!companyInput.trim() || !nameInput.trim()}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            はじめる →
          </button>
        </div>
      </div>
    );
  }

  // ── メイン録音画面 ──
  return (
    <AppShell title="🎙 録音">
      {successMsg && <SuccessToast message={successMsg} />}
      {errorMsg   && <ErrorBanner message={errorMsg} onClose={() => setErrorMsg(null)} />}

      {/* バックアップ復旧バナー（待機中のみ表示） */}
      {phase === 'idle' && backup && (
        <BackupBanner
          savedAt={backup.savedAt}
          durationSec={backup.durationSec}
          onRestore={handleRestoreBackup}
          onDiscard={handleDiscardBackup}
        />
      )}

      {/* 待機中 */}
      {phase === 'idle' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 px-6">
          <RecordTimer seconds={seconds} isRecording={false} />
          <DurationSelector selected={limitMin} onChange={setLimitMin} />
          <RecordButton isRecording={false} onClick={handleToggleRecording} />
          <p style={{ color: 'var(--muted)' }} className="text-sm text-center">
            ボタンを押して録音を開始
          </p>
        </div>
      )}

      {/* 録音中 */}
      {phase === 'recording' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-6">
          <RecordTimer seconds={seconds} isRecording totalSec={limitMin * 60} />
          <Waveform />
          <RecordButton isRecording onClick={handleToggleRecording} />
          <p style={{ color: 'var(--muted)' }} className="text-sm text-center">
            ボタンを押して停止・文字起こし開始
          </p>
          {/* 自動停止予告 */}
          {seconds >= (limitMin * 60 - 60) && (
            <p style={{ color: 'var(--warning)' }} className="text-xs font-medium animate-pulse">
              まもなく自動停止します
            </p>
          )}
        </div>
      )}

      {/* 解析中 */}
      {phase === 'analyzing' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-6">
          <div className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          <div className="text-center">
            <p style={{ color: 'var(--text)' }} className="font-semibold">{STEPS[stepIndex]}</p>
            <p style={{ color: 'var(--muted)' }} className="text-xs mt-1">Gemini AI が解析中です</p>
          </div>
          <div className="flex gap-2">
            {STEPS.map((_, i) => (
              <div key={i} className="w-2 h-2 rounded-full transition-colors"
                style={{ background: i <= stepIndex ? 'var(--accent)' : 'var(--border)' }} />
            ))}
          </div>
        </div>
      )}

      {/* 結果表示 */}
      {phase === 'result' && result && (
        <div className="flex flex-col gap-4 p-4">
          <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)' }} className="p-4">
            <h2 style={{ color: 'var(--text)' }} className="font-bold text-lg mb-1">{result.title}</h2>
            <p style={{ color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }} className="text-xs">
              {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <TranscriptAccordion transcript={result.transcript} />
          <ResultCard title="会議の要約" icon="📄">
            <p style={{ color: 'var(--text)' }} className="text-sm leading-relaxed">{result.summary}</p>
          </ResultCard>
          <ResultCard title="問題点" icon="⚠️">
            <ul className="flex flex-col gap-2">
              {result.problems?.map((p, i) => (
                <li key={i} style={{ color: 'var(--text)' }} className="text-sm flex items-start gap-2">
                  <span style={{ color: 'var(--danger)' }}>•</span>{p}
                </li>
              ))}
            </ul>
          </ResultCard>
          <ResultCard title="改善策" icon="💡">
            <ul className="flex flex-col gap-2">
              {result.improvements?.map((imp, i) => (
                <li key={i} style={{ color: 'var(--text)' }} className="text-sm flex items-start gap-2">
                  <span style={{ color: 'var(--success)' }}>•</span>{imp}
                </li>
              ))}
            </ul>
          </ResultCard>
          <ResultCard title="実践計画" icon="🎯">
            <ActionPlanList items={result.action_plan} />
          </ResultCard>
          <NextMeetingCard data={result.next_meeting} />

          <button
            onClick={() => { setPhase('idle'); setResult(null); }}
            className="w-full py-3 rounded-xl text-sm font-medium"
            style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' }}
          >
            新しい録音を開始
          </button>
        </div>
      )}
    </AppShell>
  );
}
