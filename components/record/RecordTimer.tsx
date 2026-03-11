'use client';

import { formatDuration } from '@/lib/utils';

interface RecordTimerProps {
  seconds:     number;
  isRecording: boolean;
  totalSec?:   number;   // 設定された録音上限（秒）。指定時はカウントダウン表示
}

export default function RecordTimer({ seconds, isRecording, totalSec }: RecordTimerProps) {
  const showCountdown = isRecording && totalSec != null && totalSec > 0;
  const remaining     = showCountdown ? Math.max(0, totalSec! - seconds) : null;
  const progress      = showCountdown ? Math.min(1, seconds / totalSec!) : null;

  // 残り1分以下は赤で警告
  const danger = remaining != null && remaining <= 60;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* メインタイマー */}
      <div
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          color: showCountdown
            ? (danger ? 'var(--danger)' : 'var(--text)')
            : (isRecording ? 'var(--danger)' : 'var(--muted)'),
        }}
        className="text-4xl font-semibold tracking-widest flex items-center gap-2"
      >
        {isRecording && (
          <span className="blink inline-block w-2 h-2 rounded-full bg-[var(--danger)] align-middle" />
        )}
        {showCountdown ? formatDuration(remaining!) : formatDuration(seconds)}
      </div>

      {/* カウントダウン時のサブ表示 */}
      {showCountdown && (
        <>
          {/* 経過 / 合計 */}
          <p style={{ color: 'var(--muted)' }} className="text-xs font-mono">
            {formatDuration(seconds)} / {formatDuration(totalSec!)}
          </p>

          {/* プログレスバー */}
          <div
            className="w-48 h-1.5 rounded-full overflow-hidden"
            style={{ background: 'var(--border)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width:      `${(progress! * 100).toFixed(1)}%`,
                background: danger ? 'var(--danger)' : 'var(--accent)',
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
