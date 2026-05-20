# Roadmap

What's shipped, what's next. See [DATA_SOURCES.md](DATA_SOURCES.md) for the
as-built source catalog.

## Phase 0 — Static scaffold ✅

- Next.js 16 + TS + Tailwind v4
- Cesium 3D globe (script-tag loaded, not bundled) with East Asia camera focus
- Sidebar event feed with region + category filters
- Click-to-select interaction between map and feed (map↔card focus sync)

## Phase 1 — First live feed ✅

- GDELT 2.0 (DOC API, CJK-aware filter, in-memory cache + Vercel `iad1` region)
- Page wired to `/api/events` with 5-min refresh
- Viewer-local clock with timezone in header

## Phase 2 — Multi-source OSINT ✅

- NASA FIRMS thermal anomalies (sensor)
- adsb.lol military aircraft (sensor)
- USGS Earthquake + Punggye-ri geofence (sensor)
- Polymarket prediction-market panel (separate sidebar block)
- Per-source health dots in header (green/grey/red)
- Severity legend + single-select category chips with counts
- Mobile layout: drag-handle split between globe and sidebar

## Phase 2.5 — Government + multilingual + classifier ✅

- Taiwan MND daily PLA activity scraper (sortie + crossing + vessel counts)
- Reddit OSINT subreddits (RSS endpoint to survive Vercel IP blocks)
- Multilingual wire RSS: Yonhap (EN+KR), NHK (JP), Japan Times, 38 North, SCMP
- Telegram public-channel scraper (4 channels)
- **LLM classifier** (Claude Haiku 4.5) gating free-text sources, with
  `evals/classifier-set.jsonl` + `npm run eval-classifier` precision/recall harness
- UI: per-card language badge (EN/KR/JP/CN), LO-CONF / unverified indicators
- Removed sample-event placeholder; proper loading + empty states

## Phase 3 — Persistence + history (next)

- [ ] Supabase project + Postgres + PostGIS for events table
- [ ] Vercel Cron (15 min) to push fresh events into DB
- [ ] Page reads from DB (not just live merge) → enables timeline scrubbing
- [ ] Move classifier output into DB so we can audit precision over time
- [ ] Backfill: replay last 7 days of events into DB on first deploy

## Phase 4 — Maritime + facility watch

- [ ] AIS coverage — requires deciding on paid option (Spire/Orbcomm) or
      contributing an AIS feed station to AISHub
- [ ] Watch-list of fixed facilities (Yongbyon, Sohae, PLA bases) — FIRMS
      anomaly threshold + alert when active
- [ ] Naval vessel registry: match AIS MMSI to known military / coast guard hulls

## Phase 5 — Detail panel + analysis layer

- [ ] Right-side detail panel for selected event (full source quotes, related
      events by region/time proximity)
- [ ] Timeline scrubber across last 7 days
- [ ] Threat index per region (computed from event severity weighting + recency decay)
- [ ] About / methodology page (public-facing transparency for researchers)
- [ ] Static landing page

## Stretch — analytical features

- [ ] Real ADIZ GeoJSON polygons (current rendering disabled because rough
      rectangles looked bad; replace before re-enabling)
- [ ] Pattern detection: ADIZ incursion clustering, missile launch periodicity
- [ ] Comparison view: PLAAF activity vs. announced US-ROK exercises
- [ ] Export: CSV / GeoJSON / Substack-embed widget
- [ ] Korean + Japanese UI mirror (currently UI is English-only, sources are multilingual)
