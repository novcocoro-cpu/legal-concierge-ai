'use client';

export type FilterType = 'all' | 'pending' | 'done';

interface TodoFilterChipsProps {
  current: FilterType;
  onChange: (f: FilterType) => void;
}

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all',     label: 'すべて' },
  { value: 'pending', label: '未完了' },
  { value: 'done',    label: '完了済み' },
];

export default function TodoFilterChips({ current, onChange }: TodoFilterChipsProps) {
  return (
    <div className="flex gap-2">
      {FILTERS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
          style={{
            background: current === value ? 'var(--accent)' : 'var(--surface2)',
            color:      current === value ? '#fff'          : 'var(--muted)',
            border: `1px solid ${current === value ? 'var(--accent)' : 'var(--border)'}`,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
