import Anthropic from '@anthropic-ai/sdk';
import type { EventCategory, EventSeverity, IntelEvent } from '../types';

// LLM-based triager that takes already-fetched events from upstream
// sources and:
//   1. drops items that don't actually describe a concrete East Asia
//      kinetic event (high-confidence, conservative default)
//   2. for kept items, produces a neutral English title + summary
//      (so CJK source items can stand alongside English ones)
//
// Design notes — borrowed from RAND-Lex evaluation discipline:
//   - Confidence threshold (0.85) gates default display
//   - Original-language title is preserved on the event so reviewers
//     can still see provenance
//   - Failure mode (no API key, classifier error) is graceful — the
//     unclassified items pass through with confidence: 0 and a tag
//     `unverified` so the UI can mark them
//
// Cost: Haiku 4.5 on ~50 items batched ≈ a few hundred input tokens
// per item + small output. Pennies per refresh. Cached 30 min.

const MODEL = 'claude-haiku-4-5-20251001';
const BATCH_SIZE = 40;
const CONFIDENCE_THRESHOLD = 0.85;
const CACHE_TTL_MS = 30 * 60 * 1000;

const SYSTEM = `You are a strict East Asia OSINT triager.

Input items may be in English, Korean, Chinese (Traditional/Simplified), or Japanese.

For each item, decide whether it describes a CONCRETE, ALREADY-OCCURRED OR IN-PROGRESS kinetic / sensor event in the Taiwan Strait or Korean peninsula region. Categories to keep:
- air (PLA aircraft incursion, scramble, ADIZ crossing, military flight)
- naval (warship/CCG movement, exercise, intercept)
- missile (test launch, projectile, ICBM/SRBM, launch detection)
- cyber (intrusion, breach, APT attribution to PRC/DPRK)
- satellite (FIRMS thermal anomaly, imagery analysis, reactor activity)
- seismic (earthquake near Punggye-ri, possible nuclear test)

Drop everything else, especially:
- Opinion/analysis articles ("Why China might invade…")
- Diplomatic talks, statements, summits, working-group meetings
- Sports, entertainment, cultural events
- Economic/business news unrelated to military or sanctions
- Anniversary commemorations (e.g. "30 years since missile crisis")
- Election news unless it's about a kinetic incident
- Generic "tensions rise" pieces with no specific event

Default to drop when ambiguous. For kept items, output a neutral English title (≤80 chars) and summary (≤140 chars). NEVER fabricate facts not in the source.

Reply ONLY with valid JSON matching this schema:
{
  "items": [
    {
      "id": "<the item id you were given>",
      "keep": true | false,
      "confidence": 0.0-1.0,
      "category": "air"|"naval"|"missile"|"cyber"|"satellite"|"seismic" (only if keep),
      "severity": "info"|"low"|"medium"|"high"|"critical" (only if keep),
      "title_en": "english title" (only if keep),
      "summary_en": "english summary" (only if keep),
      "reason": "≤60 chars why kept or dropped"
    }
  ]
}`;

interface ClassifierItem {
  id: string;
  keep: boolean;
  confidence: number;
  category?: EventCategory;
  severity?: EventSeverity;
  title_en?: string;
  summary_en?: string;
  reason: string;
}

interface CacheEntry {
  byId: Map<string, ClassifierItem>;
  at: number;
}
let cache: CacheEntry | null = null;

function isEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

async function classifyBatch(
  client: Anthropic,
  events: IntelEvent[],
): Promise<ClassifierItem[]> {
  const inputs = events.map((e) => ({
    id: e.id,
    source: e.source,
    title: e.title,
    summary: e.summary,
  }));

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify({ items: inputs }) }],
  });

  // Concatenate text blocks
  const text = msg.content
    .filter((b) => b.type === 'text')
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('');

  // Find the outermost JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`classifier non-JSON output: ${text.slice(0, 200)}`);
  const parsed = JSON.parse(jsonMatch[0]) as { items?: ClassifierItem[] };
  return parsed.items ?? [];
}

/** Pass an array of events through the classifier. When disabled (no
 * API key) or on failure, returns events unchanged with a fallback
 * tag so the UI can flag them. */
export async function classifyEvents(events: IntelEvent[]): Promise<IntelEvent[]> {
  if (!isEnabled() || events.length === 0) {
    return events.map((e) => ({ ...e, tags: [...(e.tags ?? []), 'unverified'] }));
  }

  const now = Date.now();
  let byId: Map<string, ClassifierItem>;
  if (cache && now - cache.at < CACHE_TTL_MS) {
    byId = cache.byId;
  } else {
    byId = new Map();
  }

  // Only classify items we haven't already seen (cache hit).
  const toClassify = events.filter((e) => !byId.has(e.id));

  if (toClassify.length > 0) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    for (let i = 0; i < toClassify.length; i += BATCH_SIZE) {
      const batch = toClassify.slice(i, i + BATCH_SIZE);
      try {
        const results = await classifyBatch(client, batch);
        for (const r of results) byId.set(r.id, r);
      } catch (err) {
        console.warn('[classifier] batch failed:', err);
        // mark these as unverified instead of dropping the whole batch
        for (const e of batch) {
          byId.set(e.id, { id: e.id, keep: true, confidence: 0, reason: 'classifier-failed' });
        }
      }
    }
    cache = { byId, at: now };
  }

  // Apply: drop low-confidence drops, keep verified-keeps with refined fields
  const out: IntelEvent[] = [];
  for (const e of events) {
    const c = byId.get(e.id);
    if (!c) {
      out.push({ ...e, tags: [...(e.tags ?? []), 'unverified'] });
      continue;
    }
    if (!c.keep && c.confidence >= CONFIDENCE_THRESHOLD) {
      continue; // confidently dropped
    }
    // keep or uncertain
    const tags = [...(e.tags ?? [])];
    if (c.confidence < CONFIDENCE_THRESHOLD) tags.push('low-confidence');
    if (c.confidence === 0) tags.push('unverified');
    out.push({
      ...e,
      title: c.title_en?.trim() || e.title,
      summary: c.summary_en?.trim() || e.summary,
      category: c.category ?? e.category,
      severity: c.severity ?? e.severity,
      tags,
    });
  }
  return out;
}
