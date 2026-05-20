'use client';

import type { EventCategory, EventRegion } from '@/lib/types';
import { CATEGORY_LABEL } from '@/lib/format';

const CATEGORIES: EventCategory[] = [
  'air',
  'naval',
  'missile',
  'cyber',
  'satellite',
  'diplomatic',
  'economic',
];

const REGIONS: { id: EventRegion | 'all'; label: string }[] = [
  { id: 'all', label: 'All regions' },
  { id: 'taiwan-strait', label: 'Taiwan Strait' },
  { id: 'korean-peninsula', label: 'Korean Peninsula' },
  { id: 'other', label: 'Other' },
];

interface Props {
  activeRegion: EventRegion | 'all';
  activeCategories: Set<EventCategory>;
  onRegionChange: (r: EventRegion | 'all') => void;
  onCategoryToggle: (c: EventCategory) => void;
}

export default function FilterChips({
  activeRegion,
  activeCategories,
  onRegionChange,
  onCategoryToggle,
}: Props) {
  return (
    <div className="space-y-3 border-b border-zinc-800 bg-[#0a0a0a] px-4 py-3">
      <div>
        <div className="mb-1.5 text-[10px] uppercase tracking-widest text-zinc-500">
          Region
        </div>
        <div className="flex flex-wrap gap-1.5">
          {REGIONS.map((r) => (
            <button
              key={r.id}
              onClick={() => onRegionChange(r.id)}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${
                activeRegion === r.id
                  ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-[10px] uppercase tracking-widest text-zinc-500">
          Category
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const active = activeCategories.has(c);
            return (
              <button
                key={c}
                onClick={() => onCategoryToggle(c)}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  active
                    ? 'border-zinc-300 bg-zinc-200/10 text-zinc-100'
                    : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
                }`}
              >
                {CATEGORY_LABEL[c]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
