'use client';

import { useEffect, useState } from 'react';

export default function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    // Skip SSR to avoid timezone mismatch hydration warnings.
    return <div className="font-mono text-[11px] text-zinc-600 tabular-nums">—</div>;
  }

  const fmt = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const time = `${get('hour')}:${get('minute')}:${get('second')}`;
  const tz = get('timeZoneName');

  return (
    <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
      <span className="text-zinc-400">{date}</span>
      <span className="text-zinc-100">{time}</span>
      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">{tz}</span>
    </div>
  );
}
