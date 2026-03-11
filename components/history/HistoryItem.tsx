'use client';

import Link from 'next/link';
import { Meeting } from '@/types';
import { formatDate, formatDuration } from '@/lib/utils';

interface HistoryItemProps {
  meeting: Meeting;
}

export default function HistoryItem({ meeting }: HistoryItemProps) {
  return (
    <Link href={`/history/${meeting.id}`}>
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
        }}
        className="p-4 flex flex-col gap-2 active:opacity-70 transition-opacity"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 style={{ color: 'var(--text)' }} className="font-semibold text-sm flex-1 truncate">
            {meeting.title || '（タイトルなし）'}
          </h3>
          <span
            style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)', background: 'var(--surface2)', borderRadius: '4px' }}
            className="text-xs px-2 py-0.5 shrink-0"
          >
            {formatDuration(meeting.duration_seconds)}
          </span>
        </div>
        <p style={{ color: 'var(--muted)' }} className="text-xs">
          {formatDate(meeting.created_at)}
        </p>
        {meeting.summary && (
          <p style={{ color: 'var(--muted)' }} className="text-xs leading-relaxed line-clamp-1">
            {meeting.summary}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1">
          {meeting.action_plan?.length > 0 && (
            <span
              style={{ color: 'var(--accent)', background: 'var(--accent-dim)', borderRadius: '4px' }}
              className="text-xs px-2 py-0.5"
            >
              TODO {meeting.action_plan.length}件
            </span>
          )}
          {meeting.problems?.length > 0 && (
            <span
              style={{ color: 'var(--warning)', borderRadius: '4px' }}
              className="text-xs"
            >
              問題点 {meeting.problems.length}件
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
