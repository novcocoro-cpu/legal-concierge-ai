'use client';

interface HeaderProps {
  title: string;
  right?: React.ReactNode;
}

export default function Header({ title, right }: HeaderProps) {
  return (
    <header
      style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #0f1d32 100%)',
        borderBottom: '1px solid var(--border)',
      }}
      className="sticky top-0 z-20 flex items-center justify-between px-4 h-14"
    >
      <h1 style={{ color: 'var(--accent)', fontFamily: "'Noto Serif JP', serif" }} className="text-base font-bold tracking-tight">
        {title}
      </h1>
      {right && <div>{right}</div>}
    </header>
  );
}
