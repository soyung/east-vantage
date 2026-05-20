'use client';

import { useEffect, useRef } from 'react';
import type { IntelEvent } from '@/lib/types';
import { CATEGORY_EMOJI, CATEGORY_LABEL, SEVERITY_COLOR, SEVERITY_RING, timeAgo } from '@/lib/format';

interface Props {
  event: IntelEvent;
  selected: boolean;
  onSelect: (id: string) => void;
}

const LANG_FLAG: Record<string, { label: string; tone: string }> = {
  en: { label: 'EN', tone: 'bg-zinc-700 text-zinc-300' },
  ko: { label: 'KR', tone: 'bg-blue-900/60 text-blue-200' },
  ja: { label: 'JP', tone: 'bg-rose-900/60 text-rose-200' },
  // Use CN (country code, matches KR/JP convention). ZH is technically
  // the ISO language code but reads as ambiguous in this UI; CH is
  // Switzerland so avoid that.
  zh: { label: 'CN', tone: 'bg-amber-900/60 text-amber-200' },
};

// Tags that are meta-signals about provenance / classifier confidence.
// These get rendered as inline icons, not as visible chips.
const META_TAGS = new Set(['unverified', 'low-confidence']);

function extractLang(tags: string[] | undefined): string | null {
  if (!tags) return null;
  for (const t of tags) {
    const m = /^lang:(\w+)$/.exec(t);
    if (m && LANG_FLAG[m[1]]) return m[1];
  }
  return null;
}

export default function EventCard({ event, selected, onSelect }: Props) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!selected) return;
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selected]);

  const lang = extractLang(event.tags);
  const isUnverified = event.tags?.includes('unverified');
  const isLowConfidence = event.tags?.includes('low-confidence');
  const visibleTags = event.tags?.filter((t) => !META_TAGS.has(t) && !t.startsWith('lang:')) ?? [];

  return (
    <button
      ref={ref}
      onClick={() => onSelect(event.id)}
      className={`group flex w-full flex-col gap-1.5 border-l-2 px-4 py-3 text-left transition hover:bg-zinc-900/60 ${
        selected
          ? `border-l-amber-500 bg-zinc-900/80 ring-1 ${SEVERITY_RING[event.severity]}`
          : 'border-l-transparent'
      }`}
    >
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-500">
        <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_COLOR[event.severity]}`} />
        <span className="text-sm leading-none" aria-hidden="true">
          {CATEGORY_EMOJI[event.category] ?? '·'}
        </span>
        <span>{CATEGORY_LABEL[event.category]}</span>
        <span className="text-zinc-700">·</span>
        <span>{timeAgo(event.timestamp)}</span>
        {lang && (
          <span
            className={`rounded px-1 py-px text-[9px] font-semibold tracking-wide ${LANG_FLAG[lang].tone}`}
            title={`Source language: ${LANG_FLAG[lang].label}`}
          >
            {LANG_FLAG[lang].label}
          </span>
        )}
        {isLowConfidence && (
          <span
            className="rounded bg-amber-900/40 px-1 py-px text-[9px] font-semibold tracking-wide text-amber-300"
            title="LLM classifier confidence below threshold"
          >
            LO-CONF
          </span>
        )}
        {isUnverified && !isLowConfidence && (
          <span
            className="text-zinc-700"
            title="No classifier verification (key not set or skipped)"
          >
            ⚬
          </span>
        )}
        <span className="ml-auto truncate text-zinc-600">{event.source}</span>
      </div>
      <div className="text-sm font-medium leading-snug text-zinc-100">{event.title}</div>
      <div className="line-clamp-2 text-xs leading-relaxed text-zinc-400">{event.summary}</div>
      {visibleTags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {visibleTags.map((t) => (
            <span
              key={t}
              className="rounded bg-zinc-800/60 px-1.5 py-0.5 text-[10px] text-zinc-400"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
