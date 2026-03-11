'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/record',  label: '録音', icon: '🎙' },
  { href: '/history', label: '履歴', icon: '📋' },
  { href: '/todos',   label: 'TODO', icon: '✅' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
      }}
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-20 safe-bottom"
    >
      <div className="flex h-[60px]">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/record' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
              style={{ color: active ? 'var(--accent)' : 'var(--muted)' }}
            >
              <span className="text-xl">{icon}</span>
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
