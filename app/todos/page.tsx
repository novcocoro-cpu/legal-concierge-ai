'use client';

import { useState, useEffect, useMemo } from 'react';
import AppShell from '@/components/layout/AppShell';
import TodoGroup from '@/components/todos/TodoGroup';
import TodoFilterChips, { FilterType } from '@/components/todos/TodoFilterChips';
import EmptyState from '@/components/history/EmptyState';
import { useUserId } from '@/hooks/useUserId';
import { useMeetings } from '@/hooks/useMeetings';
import { ActionItem } from '@/types';

const DONE_KEY = 'mtg_todos_done';

function loadDone(): Set<string> {
  try {
    const raw = localStorage.getItem(DONE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDone(set: Set<string>) {
  localStorage.setItem(DONE_KEY, JSON.stringify([...set]));
}

export default function TodosPage() {
  const { userId } = useUserId();
  const { meetings, loading } = useMeetings(userId);
  const [doneSet, setDoneSet] = useState<Set<string>>(new Set());
  const [filter, setFilter]   = useState<FilterType>('all');

  useEffect(() => {
    setDoneSet(loadDone());
  }, []);

  const allItems = useMemo(() => {
    const result: { item: ActionItem; key: string }[] = [];
    meetings.forEach((m) => {
      m.action_plan?.forEach((item, idx) => {
        result.push({ item, key: `${m.id}-${idx}` });
      });
    });
    return result;
  }, [meetings]);

  const grouped = useMemo(() => {
    const map = new Map<string, { item: ActionItem; key: string }[]>();
    allItems.forEach((entry) => {
      const name = entry.item.assignee || '未割り当て';
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(entry);
    });
    return map;
  }, [allItems]);

  const handleToggle = (key: string) => {
    setDoneSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveDone(next);
      return next;
    });
  };

  return (
    <AppShell title="✅ TODO">
      <div className="p-4 flex flex-col gap-4">
        <TodoFilterChips current={filter} onChange={setFilter} />

        {loading && (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 rounded-full border-4 animate-spin"
              style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
          </div>
        )}

        {!loading && allItems.length === 0 && (
          <EmptyState message="アクションプランがありません" />
        )}

        {!loading && [...grouped.entries()].map(([assignee, items]) => (
          <TodoGroup
            key={assignee}
            assignee={assignee}
            items={items}
            doneSet={doneSet}
            filter={filter}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </AppShell>
  );
}
