export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function priorityLabel(p: string): string {
  return p === 'high' ? '高' : p === 'medium' ? '中' : '低';
}

export function priorityColor(p: string): string {
  return p === 'high'
    ? 'text-[var(--danger)]'
    : p === 'medium'
    ? 'text-[var(--warning)]'
    : 'text-[var(--success)]';
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
