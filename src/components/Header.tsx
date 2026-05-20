import Clock from './Clock';
import type { SourceStatus } from '@/lib/types';

interface Props {
  eventCount: number;
  dataSource: 'loading' | 'live';
  fetchedAt: string | null;
  sources: SourceStatus[];
}

function SourceDot({ s }: { s: SourceStatus }) {
  // green: working with data, grey: working but quiet (no current data),
  // red: actually broken. Amber is reserved for stale/degraded states.
  const color = !s.ok ? 'bg-red-500' : s.count === 0 ? 'bg-zinc-500' : 'bg-emerald-500';
  const title = `${s.name}: ${s.ok ? `${s.count} items` : (s.error ?? 'failed')} · ${s.durationMs}ms`;
  return (
    <div className="flex items-center gap-1" title={title}>
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {/* Label hidden on mobile to fit; tooltip still works via title */}
      <span className="hidden text-[10px] font-medium tracking-wide text-zinc-400 md:inline">
        {s.name}
      </span>
    </div>
  );
}

export default function Header({ eventCount, dataSource, fetchedAt, sources }: Props) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-800 bg-[#0a0a0a] px-4 py-2.5 md:px-5 md:py-3">
      <div className="flex items-center gap-2.5 md:gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-gradient-to-br from-amber-500 to-red-600 text-[10px] font-bold text-black md:h-8 md:w-8 md:text-xs">
          EV
        </div>
        <div>
          <div className="text-xs font-semibold tracking-tight text-zinc-100 md:text-sm">
            East Vantage
          </div>
          <div className="hidden text-[10px] uppercase tracking-widest text-zinc-500 md:block">
            East Asia OSINT · Taiwan Strait · Korean Peninsula
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-zinc-400 md:gap-4">
        <Clock />
        <div className="hidden h-4 w-px bg-zinc-800 md:block" />
        {sources.length > 0 && (
          <div className="flex items-center gap-1.5 md:gap-3">
            {sources.map((s) => (
              <SourceDot key={s.name} s={s} />
            ))}
          </div>
        )}
        <div className="hidden h-4 w-px bg-zinc-800 md:block" />
        <div className="hidden items-center gap-2 md:flex">
          <span className="relative flex h-2 w-2">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                dataSource === 'live' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${
                dataSource === 'live' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </span>
          <span>
            <span className="text-zinc-200">{eventCount}</span> events
          </span>
        </div>
      </div>
    </header>
  );
}
