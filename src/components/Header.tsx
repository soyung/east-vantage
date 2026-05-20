import Clock from './Clock';
import { timeAgo } from '@/lib/format';

interface Props {
  eventCount: number;
  dataSource: 'loading' | 'gdelt' | 'sample';
  fetchedAt: string | null;
}

export default function Header({ eventCount, dataSource, fetchedAt }: Props) {
  const sourceLabel =
    dataSource === 'loading'
      ? 'loading…'
      : dataSource === 'gdelt'
        ? `GDELT 2.0${fetchedAt ? ` · ${timeAgo(fetchedAt)}` : ''}`
        : 'sample data';

  const sourceTone =
    dataSource === 'gdelt'
      ? 'text-emerald-400'
      : dataSource === 'sample'
        ? 'text-amber-400'
        : 'text-zinc-500';

  return (
    <header className="flex items-center justify-between border-b border-zinc-800 bg-[#0a0a0a] px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-gradient-to-br from-amber-500 to-red-600 text-xs font-bold text-black">
          EV
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight text-zinc-100">East Vantage</div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">
            East Asia OSINT · Taiwan Strait · Korean Peninsula
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-zinc-400">
        <Clock />
        <div className="hidden h-4 w-px bg-zinc-800 md:block" />
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                dataSource === 'gdelt' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${
                dataSource === 'gdelt' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </span>
          <span>
            LIVE · <span className="text-zinc-200">{eventCount}</span> events
          </span>
        </div>
        <div className={`hidden md:block ${sourceTone}`}>{sourceLabel}</div>
      </div>
    </header>
  );
}
