'use client';

import { NextMeeting } from '@/types';
import ResultCard from './ResultCard';

interface NextMeetingCardProps {
  data: NextMeeting;
}

export default function NextMeetingCard({ data }: NextMeetingCardProps) {
  if (!data) return null;

  return (
    <ResultCard title="次回期日の提案" icon="📅">
      <div className="flex flex-col gap-2">
        <div>
          <span style={{ color: 'var(--muted)' }} className="text-xs">次回期日 </span>
          <span style={{ color: 'var(--accent)' }} className="text-sm font-medium">{data.suggested_timing}</span>
        </div>
        {data.agenda?.length > 0 && (
          <div>
            <p style={{ color: 'var(--muted)' }} className="text-xs mb-1">検討事項</p>
            <ul className="flex flex-col gap-1">
              {data.agenda.map((a, i) => (
                <li key={i} style={{ color: 'var(--text)' }} className="text-sm flex items-start gap-2">
                  <span style={{ color: 'var(--accent)' }}>•</span>{a}
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.notes && (
          <div>
            <p style={{ color: 'var(--muted)' }} className="text-xs mb-1">申し送り</p>
            <p style={{ color: 'var(--text)' }} className="text-sm">{data.notes}</p>
          </div>
        )}
      </div>
    </ResultCard>
  );
}
