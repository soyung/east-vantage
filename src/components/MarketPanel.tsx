'use client';

import type { MarketCard } from '@/lib/types';

interface Props {
  markets: MarketCard[];
}

function probToBar(p: number): string {
  const pct = Math.round(p * 100);
  return `${pct}%`;
}

function probTone(p: number): string {
  if (p >= 0.5) return 'text-emerald-400';
  if (p >= 0.2) return 'text-amber-400';
  return 'text-zinc-400';
}

export default function MarketPanel({ markets }: Props) {
  return (
    <div className="border-b border-zinc-800 bg-[#0a0a0a]">
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-2 text-[10px] uppercase tracking-widest text-zinc-500">
        <span>Forecast markets</span>
        <span>Polymarket</span>
      </div>
      <div className="divide-y divide-zinc-900">
        {markets.map((m) => (
          <a
            key={m.id}
            href={m.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 px-4 py-2.5 transition hover:bg-zinc-900/40"
          >
            <div className={`min-w-[42px] font-mono text-sm font-semibold tabular-nums ${probTone(m.yesPrice)}`}>
              {probToBar(m.yesPrice)}
            </div>
            <div className="flex-1 text-xs leading-snug text-zinc-300">{m.title}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
