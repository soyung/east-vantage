import type { EventCategory, EventSeverity, IntelEvent } from '../types';
import { geocode, jitter } from '../geocode';

// Telegram public channel scraper. Uses the unauthenticated
// https://t.me/s/{channel} preview which returns the last ~20 messages
// as HTML. No auth, no API key. Some channels gate the preview behind
// an "Open in Telegram" landing page; those return ~10KB instead of
// ~120KB and are silently skipped.
//
// Telegram OSINT channels are mostly Russia-Ukraine; East Asia signal is
// ~10% per channel. We aggressively pre-filter on region + kinetic keywords
// and pair this source with the LLM classifier (see _classifier.ts) to
// further drop false positives. Expect 1–4 high-signal items per day.

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const REQUEST_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 15 * 60 * 1000;

const CHANNELS = ['OSINTtechnical', 'GeoPWatch', 'WarMonitor3', 'Faytuks'];

const REGION_RX =
  /(taiwan|china|chinese|pla\b|plaaf|plan\b|adiz|taipei|kaohsiung|tsmc|north korea|dprk|kim jong|pyongyang|yongbyon|korean peninsula|south korea|seoul|jeju|ieodo|japan|japanese|jsdf|yokota|kadena|misawa|iwakuni|sasebo|okinawa|senkaku|diaoyu|hong kong|beijing|shanghai|xinjiang|tibet|台|中|韓|朝|日|防空|海峡|미사일|북한|대만|중국|自衛隊)/i;
const KINETIC_RX =
  /(missile|icbm|srbm|ballistic|hwasong|adiz|plaaf|plan navy|warship|aircraft carrier|frigate|destroyer|submarine|nuclear test|airspace (?:violation|incursion)|median line|j-?\d{1,2}\b|f-?\d{1,2}\b|戰機|战机|軍機|军机|미사일|핵실험)/i;

const NEGATIVE_RX =
  /(working group|diplomat|envoy|summit|talks|cooperation|partnership|trade deal|economic\b|cultural|business owner|visa|immigration|migrant|refugee|tourism|tourist|celebrity|stock|earnings|finance|entertainment|drama|k-pop|sport|olympic|movie|film|festival)/i;

const CATEGORY_RULES: Array<[RegExp, EventCategory]> = [
  [/missile|projectile|icbm|srbm|cruise missile|hwasong|ballistic|launch(?:\s+(?:vehicle|pad|test|complex|of))/i, 'missile'],
  [/pla\s+aircraft|adiz (?:incursion|violation)|airspace (?:violation|incursion)|fighter scramble|crossed median|median line|j-?\d{1,2}\b|f-?\d{1,2}\b|戰機|战机|軍機|军机/i, 'air'],
  [/pla(n|\s+navy)|naval (?:vessel|exercise|drill)|warship|aircraft carrier|frigate|destroyer|submarine|coast guard (?:vessel|incursion)/i, 'naval'],
  [/(?:cyber|hack|apt|malware)(?:\s+(?:attack|intrusion|attribution|breach|campaign))/i, 'cyber'],
  [/satellite (?:imagery|image)|thermal anomaly|reactor (?:activity|test)|enrichment/i, 'satellite'],
];

function classifyCategory(text: string): EventCategory | null {
  for (const [rx, cat] of CATEGORY_RULES) if (rx.test(text)) return cat;
  return null;
}

function classifySeverity(text: string): EventSeverity {
  if (/\b(icbm|nuclear test|war|invasion|attack|killed)\b/i.test(text)) return 'critical';
  if (/\b(launch|missile|incursion|scramble|breach)\b/i.test(text)) return 'high';
  if (/\b(exercise|drill|patrol|sortie|warning)\b/i.test(text)) return 'medium';
  return 'low';
}

interface TgMessage {
  channel: string;
  id: string; // postId
  text: string;
  timestamp: string; // ISO
  link: string;
}

function parseChannelHtml(channel: string, html: string): TgMessage[] {
  // tgme_widget_message has data-post like "OSINTtechnical/12345"
  // text is inside tgme_widget_message_text
  // datetime is inside <time datetime="...">
  const blocks = [...html.matchAll(/<div class="tgme_widget_message[^"]*"[^>]*data-post="([^"]+)"[^>]*>([\s\S]*?)<div class="tgme_widget_message_footer/g)];
  const out: TgMessage[] = [];
  for (const block of blocks) {
    const post = block[1]; // "ChannelName/12345"
    const body = block[2];

    const textM = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(body);
    const timeM = /<time datetime="([^"]+)"/.exec(body);
    if (!textM) continue;
    const text = textM[1]
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
      .replace(/\s+/g, ' ')
      .trim();

    if (!text) continue;

    const [, postId] = post.split('/');
    out.push({
      channel,
      id: postId,
      text,
      timestamp: timeM ? new Date(timeM[1]).toISOString() : new Date().toISOString(),
      link: `https://t.me/${post}`,
    });
  }
  return out;
}

async function fetchChannel(channel: string): Promise<IntelEvent[]> {
  const res = await fetch(`https://t.me/s/${channel}`, {
    headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`tg ${channel} ${res.status}`);
  const html = await res.text();

  // Telegram gates some channels behind the small "open in app" page.
  // That page is ~10KB and has no tgme_widget_message blocks. Skip
  // silently — return [] without error so the source still reports ok.
  if (html.length < 30_000) return [];

  const msgs = parseChannelHtml(channel, html);
  const events: IntelEvent[] = [];
  for (const m of msgs) {
    // Use first 200 chars of text as effective "title"
    const title = m.text.slice(0, 200);
    if (NEGATIVE_RX.test(title)) continue;
    if (!REGION_RX.test(title)) continue;
    if (!KINETIC_RX.test(title)) continue;
    const category = classifyCategory(title);
    if (!category) continue;
    const hit = geocode(title);
    if (!hit) continue;
    const { lat, lon } = jitter(hit.lat, hit.lon, m.id);

    events.push({
      id: `tg-${channel.toLowerCase()}-${m.id}`,
      title: title.slice(0, 180),
      summary: `Telegram · @${channel}`,
      category,
      severity: classifySeverity(title),
      region: hit.region,
      lat,
      lon,
      timestamp: m.timestamp,
      source: `Telegram/@${channel}`,
      sourceUrl: m.link,
      tags: [`channel:${channel}`],
    });
  }
  return events;
}

interface CacheEntry {
  events: IntelEvent[];
  at: number;
}
let cache: CacheEntry | null = null;
let inflight: Promise<IntelEvent[]> | null = null;

export async function getTelegramEvents(): Promise<IntelEvent[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.events;

  if (!inflight) {
    inflight = (async () => {
      const all: IntelEvent[] = [];
      for (let i = 0; i < CHANNELS.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 1200));
        try {
          all.push(...(await fetchChannel(CHANNELS[i])));
        } catch (err) {
          console.warn(`[telegram] ${CHANNELS[i]} failed:`, err);
        }
      }
      return all;
    })().finally(() => {
      inflight = null;
    });
  }

  try {
    const events = await inflight;
    cache = { events, at: now };
    return events;
  } catch (err) {
    if (cache) return cache.events;
    throw err;
  }
}
