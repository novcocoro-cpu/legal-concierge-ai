'use client';

interface ResultCardProps {
  title: string;
  icon?: string;
  children: React.ReactNode;
}

export default function ResultCard({ title, icon, children }: ResultCardProps) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
      }}
      className="p-4"
    >
      <h3
        style={{ color: 'var(--muted)' }}
        className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-1.5"
      >
        {icon && <span>{icon}</span>}
        {title}
      </h3>
      {children}
    </div>
  );
}
