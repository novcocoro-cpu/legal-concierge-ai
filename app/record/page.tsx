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
import { uploadAndTranscribe } from '@/lib/audioUploader';
import GoogleDriveButton from '@/components/record/GoogleDriveButton';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

type Phase = 'idle' | 'recording' | 'analyzing' | 'result';

const STEPS = ['音声変換中…', '文字起こし中…', '解析中…', '解析完了！'];

// 録音時間の選択肢（分）
const DURATION_OPTIONS = [30, 60, 90, 120] as const;
const DEFAULT_LIMIT_MIN = 60;
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
  const [audioBlob, setAudioBlob]   = useState<Blob | null>(null);
  const [audioSavedToStorage, setAudioSavedToStorage] = useState(false);
  const isSupabaseAvailable = typeof window !== 'undefined' && !!createSupabaseBrowser();
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
      showSuccess('相談記録を保存しました ✅');
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
    setAudioBlob(blob);
    setPhase('analyzing');
    setStepIndex(0);
    const stepTimer = setInterval(() => setStepIndex(i => Math.min(i + 1, STEPS.length - 1)), 1200);
    try {
      const data: GeminiResult = await uploadAndTranscribe(blob, (step) => {
        // 進捗メッセージが来たらステップを進める
        if (step.includes('文字起こし')) setStepIndex(1);
        else if (step.includes('解析')) setStepIndex(2);
      });
      clearInterval(stepTimer);
      setStepIndex(STEPS.length - 1);
      setResult(data);
      setPhase('result');
      // Supabase接続時は音声をStorageに永続保存
      if (isSupabaseAvailable) {
        try {
          const sb = createSupabaseBrowser();
          if (sb) {
            const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const caseName = (data.title ?? '案件').replace(/[\\/:*?"<>|]/g, '_').slice(0, 30);
            const audioPath = `recordings/${date}_${caseName}_${Date.now()}.webm`;
            await sb.storage.from('audio-uploads').upload(audioPath, blob, {
              contentType: blob.type || 'audio/webm',
              upsert: true,
            });
            setAudioSavedToStorage(true);
          }
        } catch {
          // Storage保存失敗はサイレントに無視（ダウンロードで代替可能）
        }
      }
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
          <span className="text-6xl">⚖️</span>
          <div className="text-center">
            <h1 style={{ color: 'var(--text)' }} className="text-2xl font-bold mb-2">法務コンシェルジュ</h1>
            <p style={{ color: 'var(--muted)' }} className="text-sm leading-relaxed">
              録音するだけで、相談要約・法的論点<br />対応方針・訴訟リスク評価を<br />Gemini AI が自動生成します。
            </p>
          </div>

          {/* 事務所名（必須） */}
          <div className="w-full">
            <label style={{ color: 'var(--muted)' }} className="text-xs font-medium mb-1.5 block">
              法律事務所名 <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text" placeholder="例：○○法律事務所"
              value={companyInput} onChange={e => setCompanyInput(e.target.value)}
              autoFocus
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>

          {/* 弁護士名（必須） */}
          <div className="w-full">
            <label style={{ color: 'var(--muted)' }} className="text-xs font-medium mb-1.5 block">
              弁護士名 <span style={{ color: 'var(--danger)' }}>*</span>
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
    <AppShell title="⚖️ ヒアリング録音">
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

          {/* Google ドライブから読み込み */}
          <div className="w-full max-w-xs">
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <span style={{ color: 'var(--muted)' }} className="text-xs">または</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>
            <GoogleDriveButton
              disabled={false}
              onFileSelected={(blob, fileName) => {
                // Google Drive から取得したファイルを文字起こし
                const ext = fileName.split('.').pop()?.toLowerCase() || 'webm';
                const mimeMap: Record<string, string> = {
                  mp3: 'audio/mpeg', mp4: 'video/mp4', m4a: 'audio/mp4',
                  wav: 'audio/wav', ogg: 'audio/ogg', webm: 'audio/webm',
                  flac: 'audio/flac', aac: 'audio/aac',
                };
                const mime = mimeMap[ext] || blob.type || 'audio/webm';
                const typedBlob = new Blob([blob], { type: mime });
                analyzeBlob(typedBlob, 0);
              }}
              onError={(msg) => showError(msg)}
              onProgress={(step) => {
                // Google Drive の進捗は analyzing フェーズに入る前に表示
              }}
            />
          </div>
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
            <p style={{ color: 'var(--muted)' }} className="text-xs mt-1">AI が法律相談を解析中です</p>
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
          <ResultCard title="相談内容の要約" icon="📄">
            <p style={{ color: 'var(--text)' }} className="text-sm leading-relaxed">{result.summary}</p>
          </ResultCard>
          <ResultCard title="法的論点・争点" icon="⚠️">
            <ul className="flex flex-col gap-2">
              {result.problems?.map((p, i) => (
                <li key={i} style={{ color: 'var(--text)' }} className="text-sm flex items-start gap-2">
                  <span style={{ color: 'var(--danger)' }}>•</span>{p}
                </li>
              ))}
            </ul>
          </ResultCard>
          <ResultCard title="対応方針" icon="💡">
            <ul className="flex flex-col gap-2">
              {result.improvements?.map((imp, i) => (
                <li key={i} style={{ color: 'var(--text)' }} className="text-sm flex items-start gap-2">
                  <span style={{ color: 'var(--success)' }}>•</span>{imp}
                </li>
              ))}
            </ul>
          </ResultCard>
          {result.litigation_risk && (
            <ResultCard title="訴訟リスク評価" icon="🔥">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{
                    background: result.litigation_risk.level === '高' ? 'var(--danger)' : result.litigation_risk.level === '中' ? 'var(--warning)' : 'var(--success)',
                    color: '#fff'
                  }}>{result.litigation_risk.level}</span>
                  <span style={{ color: 'var(--text)' }} className="text-sm">{result.litigation_risk.description}</span>
                </div>
                <ul className="flex flex-col gap-1">
                  {result.litigation_risk.factors?.map((f, i) => (
                    <li key={i} style={{ color: 'var(--text)' }} className="text-sm flex items-start gap-2">
                      <span style={{ color: 'var(--warning)' }}>•</span>{f}
                    </li>
                  ))}
                </ul>
              </div>
            </ResultCard>
          )}
          {result.negotiation_strategy && (
            <ResultCard title="交渉戦略・心理的分析" icon="🧠">
              <div className="flex flex-col gap-2">
                <div>
                  <p style={{ color: 'var(--muted)' }} className="text-xs mb-1">戦略</p>
                  <p style={{ color: 'var(--text)' }} className="text-sm">{result.negotiation_strategy.approach}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--muted)' }} className="text-xs mb-1">心理的分析</p>
                  <p style={{ color: 'var(--text)' }} className="text-sm">{result.negotiation_strategy.psychological_notes}</p>
                </div>
                <ul className="flex flex-col gap-1">
                  {result.negotiation_strategy.key_points?.map((kp, i) => (
                    <li key={i} style={{ color: 'var(--text)' }} className="text-sm flex items-start gap-2">
                      <span style={{ color: 'var(--accent)' }}>•</span>{kp}
                    </li>
                  ))}
                </ul>
              </div>
            </ResultCard>
          )}
          <ResultCard title="宿題事項・期日" icon="🎯">
            <ActionPlanList items={result.action_plan} />
          </ResultCard>
          <NextMeetingCard data={result.next_meeting} />

          {audioBlob && (
            <div className="flex flex-col gap-2">
              {audioSavedToStorage && (
                <div className="flex items-center justify-center gap-2 py-2 rounded-xl text-sm"
                  style={{ background: 'var(--surface)', border: '1px solid var(--success)', color: 'var(--success)' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  クラウドに保存済み
                </div>
              )}
              <button
                onClick={() => {
                  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                  const caseName = (result?.title ?? '案件').replace(/[\\/:*?"<>|]/g, '_').slice(0, 30);
                  const fileName = `${date}_${caseName}.mp3`;
                  const url = URL.createObjectURL(audioBlob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = fileName;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                style={audioSavedToStorage
                  ? { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }
                  : { background: 'var(--accent)', color: '#fff' }
                }
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {audioSavedToStorage ? '端末にもダウンロード' : '録音データを端末にダウンロード'}
              </button>
            </div>
          )}

          <button
            onClick={() => { setPhase('idle'); setResult(null); setAudioBlob(null); setAudioSavedToStorage(false); }}
            className="w-full py-3 rounded-xl text-sm font-medium"
            style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' }}
          >
            新しいヒアリングを開始
          </button>
        </div>
      )}
    </AppShell>
  );
}
