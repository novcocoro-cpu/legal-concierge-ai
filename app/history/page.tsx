'use client';

import AppShell from '@/components/layout/AppShell';
import HistoryItem from '@/components/history/HistoryItem';
import EmptyState from '@/components/history/EmptyState';
import { useUserId } from '@/hooks/useUserId';
import { useMeetings } from '@/hooks/useMeetings';

export default function HistoryPage() {
  const { userId } = useUserId();
  const { meetings, loading, error } = useMeetings(userId);

  return (
    <AppShell title="📋 会議履歴">
      <div className="p-4">
        {loading && (
          <div className="flex justify-center py-20">
            <div
              className="w-8 h-8 rounded-full border-4 animate-spin"
              style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
            />
          </div>
        )}
        {error && (
          <p style={{ color: 'var(--danger)' }} className="text-sm text-center py-10">{error}</p>
        )}
        {!loading && !error && meetings.length === 0 && <EmptyState />}
        {!loading && !error && meetings.length > 0 && (
          <div className="flex flex-col gap-3">
            {meetings.map((m) => <HistoryItem key={m.id} meeting={m} />)}
          </div>
        )}
      </div>
    </AppShell>
  );
}
