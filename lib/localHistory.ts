'use client';

import { GeminiResult } from '@/types';

const STORAGE_KEY = 'legal_concierge_history';

export interface HistoryEntry {
  id: string;
  title: string;
  caseName: string;
  result: GeminiResult;
  durationSec: number;
  userName: string;
  companyName: string;
  createdAt: string;
}

export function saveToHistory(entry: Omit<HistoryEntry, 'id' | 'createdAt'>): HistoryEntry {
  const full: HistoryEntry = {
    ...entry,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  const list = loadHistory();
  list.unshift(full);
  // 最大100件保持
  if (list.length > 100) list.length = 100;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return full;
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function getHistoryEntry(id: string): HistoryEntry | null {
  return loadHistory().find(e => e.id === id) ?? null;
}

export function deleteHistoryEntry(id: string): void {
  const list = loadHistory().filter(e => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function searchHistory(query: string): HistoryEntry[] {
  const q = query.toLowerCase();
  return loadHistory().filter(e =>
    e.title.toLowerCase().includes(q) ||
    e.caseName.toLowerCase().includes(q) ||
    e.result.summary?.toLowerCase().includes(q)
  );
}
