# Roadmap

Phased build plan. Each phase should ship as a working, demoable state.

## Phase 0 — Static scaffold ✅

- [x] Next.js 16 + TS + Tailwind v4
- [x] Cesium 3D globe (Resium wrapper) with East Asia camera focus
- [x] Hard-coded sample events (Taiwan Strait + Korean peninsula)
- [x] ADIZ overlay polygons (Taiwan ADIZ, KADIZ, Median Line)
- [x] Sidebar event feed with region + category filters
- [x] Click-to-select interaction between map and feed

## Phase 1 — First live feed

- [ ] Supabase project + Postgres schema (events table with PostGIS geometry)
- [ ] GDELT 2.0 fetcher → filter for East Asia coordinates → upsert to DB
- [ ] Taiwan MND daily PLA report scraper → events
- [ ] Replace sample data on page with DB query
- [ ] Vercel Cron job: every 15 min refresh

## Phase 2 — LLM event classification

- [ ] Anthropic API integration (Haiku 4.5)
- [ ] Pipeline: raw item → categorize + summarize + geocode + severity score
- [ ] Confidence threshold; low-confidence items routed to review queue
- [ ] Per-event provenance trail (raw source → classified output)

## Phase 3 — Aircraft tracking

- [ ] OpenSky Network REST integration
- [ ] Bounding-box queries for Taiwan ADIZ + KADIZ
- [ ] Live aircraft layer on globe (track, callsign, altitude)
- [ ] ADIZ crossing detection → auto-generated events

## Phase 4 — Maritime + thermal

- [ ] AISHub feed (requires contributing a feed station, or fall back to GFW)
- [ ] Naval vessel layer (carrier groups, coast guard, suspected "dark" vessels)
- [ ] NASA FIRMS thermal anomaly layer
- [ ] Yongbyon / known facility watch list with thermal change alerts

## Phase 5 — Polish + demo

- [ ] Right-side detail panel for selected event (full source quotes, related events)
- [ ] Timeline scrubber across last 7 days
- [ ] Prediction-market widget (Manifold + Polymarket contingency markets)
- [ ] Threat index per region (computed from event severity weighting)
- [ ] About / methodology page
- [ ] Static landing page for researchers

## Stretch — research features

- [ ] Pattern detection: ADIZ incursion clustering, missile launch periodicity
- [ ] Comparison view: PLAAF activity vs. announced US-ROK exercises
- [ ] Export: CSV / GeoJSON / Substack-embed widget
- [ ] Multi-language summary (KR / JP / TW)
