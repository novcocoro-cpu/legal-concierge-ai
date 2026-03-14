'use client';

import { useState } from 'react';

interface TranscriptAccordionProps {
  transcript: string;
}

export default function TranscriptAccordion({ transcript }: TranscriptAccordionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card-legal overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ color: 'var(--accent)' }}
      >
        <span className="text-xs font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ fontFamily: "'Noto Serif JP', serif" }}>
          📝 文字起こし
        </span>
        <span className="text-sm" style={{ color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div
          className="px-4 pb-4 text-sm leading-relaxed whitespace-pre-wrap"
          style={{ color: 'var(--text)', borderTop: '1px solid var(--border)' }}
        >
          <div className="pt-3">{transcript || '（文字起こしなし）'}</div>
        </div>
      )}
    </div>
  );
}
