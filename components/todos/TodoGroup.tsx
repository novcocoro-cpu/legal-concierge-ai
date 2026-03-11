'use client';

import { ActionItem } from '@/types';
import TodoItem from './TodoItem';
import { FilterType } from './TodoFilterChips';

interface TodoGroupProps {
  assignee: string;
  items: { item: ActionItem; key: string }[];
  doneSet: Set<string>;
  filter: FilterType;
  onToggle: (key: string) => void;
}

export default function TodoGroup({ assignee, items, doneSet, filter, onToggle }: TodoGroupProps) {
  const filtered = items.filter(({ key }) => {
    if (filter === 'pending') return !doneSet.has(key);
    if (filter === 'done')    return doneSet.has(key);
    return true;
  });

  if (filtered.length === 0) return null;

  const doneCount = items.filter(({ key }) => doneSet.has(key)).length;

  return (
    <div
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}
      className="overflow-hidden"
    >
      <div
        style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}
        className="px-4 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: '50%' }}
            className="w-7 h-7 flex items-center justify-center text-sm font-bold"
          >
            {assignee.slice(0, 1)}
          </span>
          <span style={{ color: 'var(--text)' }} className="font-semibold text-sm">{assignee}</span>
        </div>
        <span style={{ color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }} className="text-xs">
          {doneCount}/{items.length} 件
        </span>
      </div>
      <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
        {filtered.map(({ item, key }) => (
          <div key={key} className="px-4 py-3">
            <TodoItem item={item} todoKey={key} done={doneSet.has(key)} onToggle={onToggle} />
          </div>
        ))}
      </div>
    </div>
  );
}
