import type { Entity, EntityCountry, EntityGraph, Relation } from './types';
import { DPRK_GRAPH } from './dprk';
import { PRC_GRAPH } from './prc';

export type { Entity, EntityCountry, EntityGraph, Relation } from './types';
export type { RelationType, EntityType, EntityStatus } from './types';

// Merge the per-country seed graphs into one. Today the PRC and DPRK
// graphs are disjoint; keeping them separate keeps curation tractable
// and lets the UI filter by country. Cross-regime relations (e.g.
// DPRK–PLA cooperation) can be added here later.
const FULL: EntityGraph = {
  entities: [...PRC_GRAPH.entities, ...DPRK_GRAPH.entities],
  relations: [...PRC_GRAPH.relations, ...DPRK_GRAPH.relations],
};

export function getEntityGraph(country?: EntityCountry | 'all'): EntityGraph {
  if (!country || country === 'all') return FULL;
  const entities = FULL.entities.filter((e) => e.country === country);
  const ids = new Set(entities.map((e) => e.id));
  // Keep only relations whose endpoints both survive the country filter.
  const relations = FULL.relations.filter((r) => ids.has(r.from) && ids.has(r.to));
  return { entities, relations };
}

export function getEntityById(id: string): Entity | undefined {
  return FULL.entities.find((e) => e.id === id);
}

/** Relations touching an entity, in either direction. */
export function relationsFor(id: string): Relation[] {
  return FULL.relations.filter((r) => r.from === id || r.to === id);
}

/** Flat alias index for later event-text → entity matching (NER linking).
 * Maps a lowercased name/alias to the entity id. */
export function buildAliasIndex(): Map<string, string> {
  const idx = new Map<string, string>();
  for (const e of FULL.entities) {
    if (e.type !== 'person') continue;
    idx.set(e.name.toLowerCase(), e.id);
    if (e.nameNative) idx.set(e.nameNative.toLowerCase(), e.id);
    for (const a of e.aliases ?? []) idx.set(a.toLowerCase(), e.id);
  }
  return idx;
}
