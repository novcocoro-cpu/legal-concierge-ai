'use client';

import { ActionItem } from '@/types';
import { priorityLabel, priorityColor } from '@/lib/utils';

interface TodoItemProps {
  item: ActionItem;
  todoKey: string;
  done: boolean;
  onToggle: (key: string) => void;
}

export default function TodoItem({ item, todoKey, done, onToggle }: TodoItemProps) {
  return (
    <button
      onClick={() => onToggle(todoKey)}
      className="w-full flex items-start gap-3 text-left"
    >
      <div
        className="mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0"
        style={{
          background: done ? 'var(--success)' : 'transparent',
          border: `2px solid ${done ? 'var(--success)' : 'var(--border)'}`,
        }}
      >
        {done && <span className="text-white text-xs">✓</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm leading-snug"
          style={{
            color: done ? 'var(--muted)' : 'var(--text)',
            textDecoration: done ? 'line-through' : 'none',
          }}
        >
          {item.task}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span
            style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)' }}
            className="text-xs"
          >
            {item.deadline}
          </span>
          <span className={`text-xs font-semibold ${priorityColor(item.priority)}`}>
            [{priorityLabel(item.priority)}]
          </span>
        </div>
      </div>
    </button>
  );
}
