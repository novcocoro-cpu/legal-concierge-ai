'use client';

interface ResultCardProps {
  title: string;
  icon?: string;
  children: React.ReactNode;
}

export default function ResultCard({ title, icon, children }: ResultCardProps) {
  return (
    <div className="card-legal p-4">
      <h3
        style={{ color: 'var(--accent)', fontFamily: "'Noto Serif JP', serif" }}
        className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5"
      >
        {icon && <span>{icon}</span>}
        {title}
      </h3>
      {children}
    </div>
  );
}
