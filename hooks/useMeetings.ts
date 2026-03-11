'use client';

import { useState, useEffect, useCallback } from 'react';
import { Meeting } from '@/types';

export function useMeetings(userId: string) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;   // userId が空のうちは絶対に fetch しない

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/meetings?userId=${encodeURIComponent(userId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status} エラー`);
        }
        return res.json() as Promise<Meeting[]>;
      })
      .then((data) => { if (!cancelled) setMeetings(data); })
      .catch((e)  => { if (!cancelled) setError(e.message); })
      .finally(()  => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [userId]);   // userId が確定してから1回だけ実行

  const refetch = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/meetings?userId=${encodeURIComponent(userId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status} エラー`);
        }
        return res.json() as Promise<Meeting[]>;
      })
      .then(setMeetings)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId]);

  return { meetings, loading, error, refetch };
}
