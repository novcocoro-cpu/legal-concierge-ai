'use client';

import Header from './Header';
import BottomNav from './BottomNav';

interface AppShellProps {
  title: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

export default function AppShell({ title, headerRight, children }: AppShellProps) {
  return (
    <div
      style={{ background: 'var(--bg)', maxWidth: '480px' }}
      className="mx-auto min-h-screen flex flex-col relative"
    >
      <Header title={title} right={headerRight} />
      <main className="flex-1 overflow-y-auto pb-[76px]">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
