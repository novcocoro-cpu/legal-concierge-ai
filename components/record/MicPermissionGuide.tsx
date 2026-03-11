'use client';

import { useState } from 'react';
import type { MicStatus } from '@/hooks/useMicPermission';

// ──────────────────────────────────────────
// プラットフォーム判定
// ──────────────────────────────────────────
type Platform = 'ios' | 'android' | 'desktop';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

// ──────────────────────────────────────────
// ブラウザ別 設定手順
// ──────────────────────────────────────────
function IOSSteps() {
  return (
    <div className="w-full text-left space-y-4">
      <div
        className="rounded-2xl p-4 space-y-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <p style={{ color: 'var(--text)' }} className="text-xs font-bold uppercase tracking-wide">
          Safari の場合（推奨）
        </p>
        {[
          'アドレスバー左の「ぁあ」または「AA」をタップ',
          '「Webサイトの設定」を選択',
          '「マイク」→「許可」に変更',
          'このページを再読み込みする',
        ].map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <span
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: 'var(--accent)' }}
            >
              {i + 1}
            </span>
            <p style={{ color: 'var(--text)' }} className="text-sm leading-relaxed">{step}</p>
          </div>
        ))}
      </div>

      <div
        className="rounded-2xl p-4 space-y-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <p style={{ color: 'var(--text)' }} className="text-xs font-bold uppercase tracking-wide">
          設定アプリから変更する場合
        </p>
        {[
          'iPhoneの「設定」アプリを開く',
          '「Safari」をタップ',
          '「マイク」→「許可」を選択',
          'このページを再読み込みする',
        ].map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <span
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: 'var(--muted)' }}
            >
              {i + 1}
            </span>
            <p style={{ color: 'var(--text)' }} className="text-sm leading-relaxed">{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AndroidSteps() {
  return (
    <div
      className="w-full rounded-2xl p-4 space-y-3 text-left"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <p style={{ color: 'var(--text)' }} className="text-xs font-bold uppercase tracking-wide">
        Chrome の設定方法
      </p>
      {[
        'アドレスバー左の鍵（🔒）アイコンをタップ',
        '「権限」または「サイトの設定」を選択',
        '「マイク」→「許可」に変更',
        'このページを再読み込みする',
      ].map((step, i) => (
        <div key={i} className="flex items-start gap-3">
          <span
            className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'var(--accent)' }}
          >
            {i + 1}
          </span>
          <p style={{ color: 'var(--text)' }} className="text-sm leading-relaxed">{step}</p>
        </div>
      ))}
    </div>
  );
}

function DesktopSteps() {
  return (
    <div className="w-full text-left space-y-4">
      <div
        className="rounded-2xl p-4 space-y-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <p style={{ color: 'var(--text)' }} className="text-xs font-bold uppercase tracking-wide">
          Chrome / Edge
        </p>
        {[
          'アドレスバー右のカメラ/マイクアイコンをクリック',
          '「マイクを常に許可する」を選択',
          '「完了」をクリック',
        ].map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <span
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: 'var(--accent)' }}
            >
              {i + 1}
            </span>
            <p style={{ color: 'var(--text)' }} className="text-sm leading-relaxed">{step}</p>
          </div>
        ))}
      </div>

      <div
        className="rounded-2xl p-4 space-y-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <p style={{ color: 'var(--text)' }} className="text-xs font-bold uppercase tracking-wide">
          Firefox
        </p>
        {[
          'アドレスバーの鍵アイコンをクリック',
          '「接続の安全性」→「マイクの使用許可」を確認',
          '「マイクを使用する」→「許可する」を選択',
        ].map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <span
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: 'var(--muted)' }}
            >
              {i + 1}
            </span>
            <p style={{ color: 'var(--text)' }} className="text-sm leading-relaxed">{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────
interface Props {
  status: MicStatus;
  onRequest: () => Promise<MicStatus>;
}

export default function MicPermissionGuide({ status, onRequest }: Props) {
  const [requesting, setRequesting] = useState(false);
  const platform = detectPlatform();

  const handleRequest = async () => {
    setRequesting(true);
    await onRequest();
    setRequesting(false);
  };

  const reload = () => window.location.reload();

  // ─── マイクが使えない環境（HTTP等）───
  if (status === 'unavailable') {
    return (
      <div
        style={{ background: 'var(--bg)', maxWidth: '480px' }}
        className="mx-auto min-h-screen flex items-center justify-center p-6"
      >
        <div className="w-full flex flex-col items-center gap-6 text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: 'var(--surface)', border: '2px solid var(--border)' }}
          >
            <svg className="w-10 h-10" style={{ color: 'var(--muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <div>
            <h2 style={{ color: 'var(--text)' }} className="text-xl font-bold mb-2">
              マイクを利用できません
            </h2>
            <p style={{ color: 'var(--muted)' }} className="text-sm leading-relaxed">
              このブラウザまたは環境ではマイクにアクセスできません。<br />
              <strong>HTTPS</strong>（https://）で接続されているか確認してください。<br />
              また、最新のブラウザをお使いください。
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── 許可ダイアログを表示する（初回・未許可）───
  if (status === 'prompt') {
    return (
      <div
        style={{ background: 'var(--bg)', maxWidth: '480px' }}
        className="mx-auto min-h-screen flex items-center justify-center p-6"
      >
        <div className="w-full flex flex-col items-center gap-6 text-center">
          {/* マイクアイコン */}
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center"
            style={{ background: 'var(--accent)' }}
          >
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>

          <div>
            <h2 style={{ color: 'var(--text)' }} className="text-xl font-bold mb-2">
              マイクの許可が必要です
            </h2>
            <p style={{ color: 'var(--muted)' }} className="text-sm leading-relaxed">
              会議を録音するために<br />マイクへのアクセスを許可してください。<br />
              次の画面で「<strong>許可</strong>」をタップしてください。
            </p>
          </div>

          <button
            onClick={handleRequest}
            disabled={requesting}
            className="w-full py-4 rounded-2xl font-bold text-base transition-opacity disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {requesting ? '確認中…' : 'マイクを許可する'}
          </button>

          <p style={{ color: 'var(--muted)' }} className="text-xs">
            ダイアログが表示されたら「許可」をタップしてください
          </p>
        </div>
      </div>
    );
  }

  // ─── 拒否済み：ブラウザ設定の手順を表示 ───
  if (status === 'denied') {
    return (
      <div
        style={{ background: 'var(--bg)', maxWidth: '480px' }}
        className="mx-auto min-h-screen p-6 overflow-y-auto"
      >
        <div className="flex flex-col items-center gap-6 py-8">
          {/* 警告アイコン */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: '#FEF2F2' }}
          >
            <svg className="w-10 h-10" style={{ color: 'var(--danger)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>

          <div className="text-center">
            <h2 style={{ color: 'var(--text)' }} className="text-xl font-bold mb-2">
              マイクを許可してください
            </h2>
            <p style={{ color: 'var(--muted)' }} className="text-sm leading-relaxed">
              マイクへのアクセスがブロックされています。<br />
              以下の手順でブラウザの設定を変更してください。
            </p>
          </div>

          {/* プラットフォーム別手順 */}
          {platform === 'ios'     && <IOSSteps />}
          {platform === 'android' && <AndroidSteps />}
          {platform === 'desktop' && <DesktopSteps />}

          {/* 再読み込みボタン */}
          <button
            onClick={reload}
            className="w-full py-4 rounded-2xl font-bold text-base"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            設定変更後に再読み込み
          </button>

          <p style={{ color: 'var(--muted)' }} className="text-xs text-center">
            設定を変更したらこのボタンをタップしてください
          </p>
        </div>
      </div>
    );
  }

  // granted / checking はここに来ない（呼び出し元で制御）
  return null;
}
