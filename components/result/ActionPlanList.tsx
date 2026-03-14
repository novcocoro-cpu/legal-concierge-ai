'use client';

import { ActionItem } from '@/types';
import { priorityLabel, priorityColor } from '@/lib/utils';

interface ActionPlanListProps {
  items: ActionItem[];
}

export default function ActionPlanList({ items }: ActionPlanListProps) {
  if (!items?.length) return <p style={{ color: 'var(--muted)' }} className="text-sm">宿題事項なし</p>;

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <div
          key={i}
          style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px' }}
          className="p-3"
        >
          <p style={{ color: 'var(--text)' }} className="text-sm font-medium mb-2">{item.task}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span
              style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: '6px' }}
              className="text-xs px-2 py-0.5 font-medium"
            >
              👤 {item.assignee}
            </span>
            <span
              style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)' }}
              className="text-xs"
            >
              📅 {item.deadline}
            </span>
            <span className={`text-xs font-semibold ${priorityColor(item.priority)}`}>
              [{priorityLabel(item.priority)}]
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
