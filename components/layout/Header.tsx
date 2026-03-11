'use client';

interface HeaderProps {
  title: string;
  right?: React.ReactNode;
}

export default function Header({ title, right }: HeaderProps) {
  return (
    <header
      style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}
      className="sticky top-0 z-20 flex items-center justify-between px-4 h-14"
    >
      <h1 style={{ color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }} className="text-base font-semibold tracking-tight">
        {title}
      </h1>
      {right && <div>{right}</div>}
    </header>
  );
}
