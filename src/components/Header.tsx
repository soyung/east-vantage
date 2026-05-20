export default function Header({ eventCount }: { eventCount: number }) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-800 bg-[#0a0a0a] px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-gradient-to-br from-amber-500 to-red-600 text-xs font-bold text-black">
          EV
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight text-zinc-100">
            East Vantage
          </div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">
            East Asia OSINT · Taiwan Strait · Korean Peninsula
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span>LIVE · {eventCount} events</span>
        </div>
        <div className="hidden md:block text-zinc-600">v0.1 · sample data</div>
      </div>
    </header>
  );
}
