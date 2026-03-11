'use client';

interface EmptyStateProps {
  message?: string;
}

export default function EmptyState({ message = '会議記録がありません' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <span className="text-5xl">📭</span>
      <p style={{ color: 'var(--muted)' }} className="text-sm">{message}</p>
    </div>
  );
}
