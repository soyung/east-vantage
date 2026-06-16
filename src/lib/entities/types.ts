// Leadership / actor relationship graph for the closed regimes where
// OSINT "Kremlinology" is most tractable: the PRC (Pekingology) and the
// DPRK (Pyongyangology). Hierarchy in these systems is telegraphed
// through ritual — funeral-committee orderings, protocol seating, who
// appears next to the leader — which is exactly what makes a curated
// relationship graph a legitimate OSINT product.
//
// Honesty discipline (mirrors the source-tiering elsewhere in the app):
//   - FACTS (family ties, held positions) get confidence ~1.0.
//   - INTERPRETATION (factional alignment, patron-client) is an
//     analyst judgment, never a fact. Those relations carry a lower
//     confidence and SHOULD link to a source. The UI renders low-
//     confidence edges dashed so the reader can tell the difference.
//   - Nodes go stale (purges, deaths). `status` + `since`/`until` make
//     that visible instead of silently presenting dead data as live.
//   - This data is hand-curated, seedable from Wikidata. We never let an
//     LLM *generate* relationships (it fabricates) — only extract/match.

export type EntityCountry = 'cn' | 'kp';

export type EntityType = 'person' | 'org';

export type EntityStatus =
  | 'active' // currently in post / publicly active
  | 'purged' // removed / under investigation / disappeared
  | 'deceased'
  | 'retired'
  | 'unknown';

export type RelationType =
  | 'family' // blood / marriage — fact
  | 'successor' // dynastic / leadership succession line
  | 'command' // formal chain of command / reports-to — fact
  | 'member' // sits on / belongs to an organ — fact
  | 'patron' // patron → client; mentor advanced the protégé — interpretive
  | 'faction' // shares a factional alignment — interpretive
  | 'rival'; // factional / personal rivalry — interpretive

export interface Entity {
  id: string;
  name: string; // romanized / English display name
  nameNative?: string; // 한글 / 汉字
  aliases?: string[]; // for later event-text matching (NER linking)
  type: EntityType;
  country: EntityCountry;
  role?: string; // current or last-held title
  bio?: string; // 1–2 sentence analyst note
  factionTags?: string[]; // e.g. 'xi-faction', 'tuanpai', 'kim-family', 'ogd'
  status?: EntityStatus;
  /** Rough standing / prominence 0–1 — drives node size, NOT a fact. */
  prominence?: number;
  sourceUrl?: string; // stable reference (usually Wikipedia / Wikidata)
}

export interface Relation {
  from: string; // Entity.id
  to: string; // Entity.id
  type: RelationType;
  label?: string; // human label, e.g. "sister", "promoted", "purged rival"
  /** 0–1. Family/command/member ≈ 1.0 (fact); faction/patron/rival lower
   *  (interpretation). Edges below ~0.7 render dashed in the UI. */
  confidence: number;
  sourceUrl?: string;
  since?: string; // ISO date the relation began, if known
  until?: string; // ISO date it ended (e.g. predecessor relationship)
}

export interface EntityGraph {
  entities: Entity[];
  relations: Relation[];
}
