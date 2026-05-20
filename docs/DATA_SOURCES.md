# Data Sources

This doc is **as-built**: it describes the sources actually wired into
`src/lib/sources/` and what they produce in production, plus a short
section on what was deliberately skipped and why.

For a deeper plan of what's coming next, see [ROADMAP.md](ROADMAP.md).

## Open-source intelligence — provenance and scope

Every data point displayed in East Vantage comes from publicly available
feeds:

- **Government press releases** that are already published online by the
  agency that produced them (Taiwan MND daily PLA activity reports, USGS
  earthquake catalog, NASA FIRMS fire detections, Polymarket public
  contracts).
- **Commercial open APIs** designed for public use (adsb.lol for ADS-B
  broadcasts that aircraft *voluntarily* transmit, GDELT 2.0 for news
  events).
- **News wire RSS** (Yonhap, NHK, Japan Times, 38 North, SCMP, CNA) —
  feeds the outlets publish for syndication.
- **Public discussion** on Reddit and Telegram channels, none of them
  private or invitation-only.
- **Wikipedia / OpenStreetMap** for military installation coordinates —
  these are matters of public record published by the operating
  governments themselves.

**What we do not include:** classified or leaked material, non-public
ADS-B data, full satellite imagery (we only carry FIRMS point markers,
not pixels), real-time positions of aircraft whose operators have
disabled their transponders, or any feed obtained without permission.

This is the same posture as Bellingcat, 38 North, CSIS China Power
Project, Taiwan Security Monitor, and PLATracker — standard public-OSINT
practice that has been operated in many jurisdictions for years without
legal issue.

## Live sources

All sources are aggregated through [`src/lib/sources/index.ts`](../src/lib/sources/index.ts)
via `Promise.all` + a `timed()` wrapper, so any one source failing leaves
the others unaffected. Each source maintains its own in-memory cache and
inflight-coalescer to absorb concurrent requests on a warm container.

### Sensor / structured (bypass LLM classifier)

These return already-verified, structured data — no need for further triage.

| Code | Source | File | Endpoint | Auth | Cache | What you get |
|---|---|---|---|---|---|---|
| FIRMS | NASA FIRMS thermal anomalies | [firms.ts](../src/lib/sources/firms.ts) | `firms.modaps.eosdis.nasa.gov/api/area/csv` | Free MAP_KEY (env `NASA_FIRMS_MAP_KEY`) | 10 min | VIIRS thermal hotspots in Korea + Taiwan Strait bounding boxes. Severity scaled by FRP (fire radiative power). |
| ADSB | adsb.lol military aircraft | [adsb.ts](../src/lib/sources/adsb.ts) | `api.adsb.lol/v2/mil` | None | 1 min | All globally-tracked military aircraft, then filtered to Taiwan + Korea bboxes. Includes callsign, altitude, heading. |
| USGS | USGS Earthquake | [usgs.ts](../src/lib/sources/usgs.ts) | `earthquake.usgs.gov/fdsnws/event/1/query` | None | 10 min | M3+ quakes in East Asia bbox, last 7 days. Quakes within 50 km of Punggye-ri auto-tagged `possible-nuclear-test`. |
| MND | Taiwan MND daily PLA activity | [mnd.ts](../src/lib/sources/mnd.ts) | `mnd.gov.tw/en/news/plaactlist` | None (UA-identified) | 1 hour | PLA sortie + median-line crossing + PLAN/CCG ship counts for last 3 days. One event per (date × ADIZ zone). |

### Free-text (gated by LLM classifier when key is set)

These produce free-text items that pass through [`_classifier.ts`](../src/lib/sources/_classifier.ts)
when `ANTHROPIC_API_KEY` is set. Without the key, items pass through with
an `unverified` tag; the regex pre-filter alone catches most obvious
noise.

| Code | Source | File | Endpoint | Auth | Cache | Notes |
|---|---|---|---|---|---|---|
| GDELT | GDELT 2.0 DOC API | [gdelt.ts](../src/lib/sources/gdelt.ts) | `api.gdeltproject.org/api/v2/doc/doc` | None | 15 min (success), 90 s (after 429 rate-limit) | Geocoded global news. Custom undici dispatcher (25 s connect timeout) + force-region `iad1` to handle Vercel SFO ↔ Georgetown latency. CJK keyword filter. Often rate-limited; graceful degrade. |
| WIRE | Multilingual wire RSS | [wires.ts](../src/lib/sources/wires.ts) | 6 feeds: Yonhap (EN+KR), NHK (JP), Japan Times, 38 North, SCMP | None | 15 min | Region + kinetic filter, CJK-aware. Each event carries `lang:` tag → UI shows EN/KR/JP/CN badge. |
| RDDT | Reddit OSINT subreddits | [reddit.ts](../src/lib/sources/reddit.ts) | `reddit.com/r/{sub}/new.rss` | None (UA-identified) | 15 min | 6 subreddits: CredibleDefense, LessCredibleDefence, aiwar, IndoPacificNews, korea, taiwan. RSS endpoint (not JSON) because Reddit blocks Vercel IPs without OAuth on the JSON path. |
| TGRM | Telegram public channels | [telegram.ts](../src/lib/sources/telegram.ts) | `t.me/s/{channel}` | None | 15 min | 4 channels: OSINTtechnical, GeoPWatch, WarMonitor3, Faytuks. ~10 % East Asia signal in these mostly-Russia-Ukraine channels — relies on classifier for noise reduction. Some channels gate the preview page; detected via response size and silently skipped. |

### Prediction markets (separate UI panel)

| Code | Source | File | Endpoint | Auth | Cache | Notes |
|---|---|---|---|---|---|---|
| POLY | Polymarket Gamma API | [polymarket.ts](../src/lib/sources/polymarket.ts) | `gamma-api.polymarket.com/markets` | None | 5 min | Two-stage keyword filter (region AND topic, exclude meme markets like "Will Trump say X"). Returns `MarketCard[]` rendered in a sidebar panel, not on the globe. |

## LLM classifier

[`_classifier.ts`](../src/lib/sources/_classifier.ts) — Claude Haiku 4.5 batched
triage. Takes free-text events, applies strict keep/drop with confidence
score and English title/summary normalization (regardless of input
language). Threshold 0.85 for default display; below that, items still
show but tagged `low-confidence` (LO-CONF badge on card).

- Eval set: [evals/classifier-set.jsonl](../evals/classifier-set.jsonl) (40 hand-labeled items, 20 TP + 20 hard TN incl. CJK)
- Eval script: `npm run eval-classifier` — runs the set, reports precision/recall, exits non-zero if precision <0.90 or recall <0.80
- Cache: 30 min per item ID
- Fail-open: when API key missing or call fails, items pass through with `unverified` tag (no silent data loss)

## Environment variables

| Var | Required? | Purpose |
|---|---|---|
| `NEXT_PUBLIC_CESIUM_ION_TOKEN` | Recommended | Cesium globe imagery. Default public token works but rate-limited. |
| `NASA_FIRMS_MAP_KEY` | For FIRMS | Free instant signup at firms.modaps.eosdis.nasa.gov/api/area/ |
| `ANTHROPIC_API_KEY` | For LLM classifier | Without it, free-text sources pass through with `unverified` tag. |

## Deliberately skipped (evaluated, not integrated)

These were researched and ruled out — listed so you don't re-spend time
re-evaluating them.

| Source | Why skipped |
|---|---|
| AIS (any free option) | AIS Stream is WebSocket-only (incompatible with Vercel 30 s functions). MyShipTracking is 10-day trial. AISHub requires contributing a physical AIS station. Global Fishing Watch has undefined rate limits + manual approval. No free, serverless-friendly AIS path for East Asia. |
| X (Twitter) API | 2026 pricing is credit-based; effectively no usable free tier. |
| Sentinel Hub imagery | 30-day trial, then paid. Free Copernicus Open Access Hub serves full scenes (GB-scale), not lightweight queries. |
| ACLED API | Paid. Free tier is web-only viewer; no programmatic access. |
| Taiwan MND Twitter (@MoNDefense) | Same daily data as the website scraper, but needs X API key (paid). Website is already integrated. |
| OpenSky Network (as primary) | 4000 calls/day with OAuth account is fine; kept as fallback option, but adsb.lol's `/v2/mil` endpoint gives us cleaner military-only filtering with zero auth. |
| Nitter (Twitter mirror) | Has been intermittently shut down by Twitter's rate-limiting; not reliable enough to depend on. |

## Known production issues

| Source | Issue | Mitigation |
|---|---|---|
| GDELT | Frequent 429 / connect-timeout from Vercel iad1's shared egress IPs | Custom undici dispatcher + 15 min success cache + 90 s rate-limit cooldown + graceful degrade to grey dot (not red) |
| RDDT | Reddit blocks Vercel IPs on JSON endpoint without OAuth | Switched to RSS endpoint; failures across all subs surface as red dot |
| TGRM | Telegram serves "open in app" landing page (~10 KB) for some channels; East Asia signal naturally ~10 % even when preview works | Detected via response size + silently skip; classifier downstream filters noise |
| ADSB | Naturally 0 events when no military aircraft is in our bbox | Expected; gray dot is correct status |
