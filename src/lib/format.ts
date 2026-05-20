export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export const SEVERITY_COLOR: Record<string, string> = {
  info: 'bg-zinc-500',
  low: 'bg-emerald-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-red-600',
};

export const SEVERITY_RING: Record<string, string> = {
  info: 'ring-zinc-500/40',
  low: 'ring-emerald-500/40',
  medium: 'ring-amber-500/40',
  high: 'ring-orange-500/40',
  critical: 'ring-red-600/50',
};

export const CATEGORY_LABEL: Record<string, string> = {
  air: 'Air',
  naval: 'Naval',
  missile: 'Missile',
  cyber: 'Cyber',
  satellite: 'Satellite',
  seismic: 'Seismic',
  diplomatic: 'Diplomatic',
  economic: 'Economic',
};
