import type { IntelEvent } from './types';

// Lightweight in-memory event accumulator. Each call to /api/events
// records the latest snapshot here so we can serve historical queries.
//
// Constraints / honest limits:
// - Lives only inside a single Vercel function container — cold starts
//   reset it. A truly persistent timeline needs Supabase / KV; this is
//   a step in that direction without adding infra.
// - Capped at MAX_ENTRIES (5000). Oldest entries are dropped first.
// - Dedupe by event.id; on duplicate we keep the LATER record so
//   timestamps stay fresh (some sources, e.g. ADSB, re-emit a moving
//   aircraft with the same id but a newer position).

const MAX_ENTRIES = 5_000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 h sliding window

const store = new Map<string, IntelEvent>();
let lastPrune = 0;

export function record(events: IntelEvent[]): void {
  const now = Date.now();
  for (const e of events) {
    store.set(e.id, e);
  }
  // Prune every minute at most — cheaper than every insert.
  if (now - lastPrune > 60_000) {
    prune(now);
    lastPrune = now;
  }
}

function prune(now: number): void {
  const cutoff = now - MAX_AGE_MS;
  // Drop too-old entries.
  for (const [id, e] of store) {
    const t = new Date(e.timestamp).getTime();
    if (!isNaN(t) && t < cutoff) store.delete(id);
  }
  // If still too many, drop oldest by timestamp.
  if (store.size > MAX_ENTRIES) {
    const sorted = [...store.values()].sort(
      (a, b) => +new Date(a.timestamp) - +new Date(b.timestamp),
    );
    const toDrop = sorted.slice(0, store.size - MAX_ENTRIES);
    for (const e of toDrop) store.delete(e.id);
  }
}

export function getInRange(startMs: number, endMs: number): IntelEvent[] {
  const out: IntelEvent[] = [];
  for (const e of store.values()) {
    const t = new Date(e.timestamp).getTime();
    if (isNaN(t)) continue;
    if (t < startMs || t > endMs) continue;
    out.push(e);
  }
  return out;
}

export function getAll(): IntelEvent[] {
  return [...store.values()];
}

export function size(): number {
  return store.size;
}
