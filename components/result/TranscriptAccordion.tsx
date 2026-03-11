'use client';

import { useState } from 'react';

interface TranscriptAccordionProps {
  transcript: string;
}

export default function TranscriptAccordion({ transcript }: TranscriptAccordionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}
      className="overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ color: 'var(--muted)' }}
      >
        <span className="text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5">
          📝 文字起こし
        </span>
        <span className="text-sm">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div
          className="px-4 pb-4 text-sm leading-relaxed whitespace-pre-wrap"
          style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)' }}
        >
          <div className="pt-3">{transcript || '（文字起こしなし）'}</div>
        </div>
      )}
    </div>
  );
}
