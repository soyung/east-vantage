// Faction definitions — the interpretive backbone of Pekingology and
// Pyongyangology. A faction is NOT a fact: membership is an analyst
// judgment, often contested, and the classic PRC three-faction model
// (princelings / Shanghai Gang / Youth League) is partly historical now
// that Xi has subsumed his rivals. We keep the classic factions for
// lineage/context AND mark the current Xi-faction dominance.
//
// Entities carry these ids in `factionTags`. The graph clusters and
// draws a translucent hull per faction so the grouping is visible
// instead of hidden in a tooltip.

export interface FactionDef {
  id: string;
  label: string; // English (native)
  color: string;
  note: string;
}

export const FACTIONS: FactionDef[] = [
  {
    id: 'xi-faction',
    label: 'Xi faction (习派)',
    color: '#f59e0b',
    note: "Xi Jinping's loyalist network (Zhijiang Army, Fujian & Shaanxi ties). Dominant since 2012; packed the 20th Politburo Standing Committee.",
  },
  {
    id: 'princeling',
    label: 'Princelings (太子党)',
    color: '#c084fc',
    note: 'Descendants of veteran revolutionary leaders. Xi himself is one; cuts across other groupings rather than acting as a disciplined bloc.',
  },
  {
    id: 'shanghai-gang',
    label: 'Shanghai Gang (上海帮)',
    color: '#22d3ee',
    note: "Jiang Zemin's network, rooted in the Shanghai administration. Dominant 1990s–2000s; largely eclipsed after Jiang's 2022 death and Xi's consolidation.",
  },
  {
    id: 'tuanpai',
    label: 'Youth League (团派)',
    color: '#34d399',
    note: 'Communist Youth League faction around Hu Jintao. Once the counterweight to the Shanghai Gang; sidelined wholesale at the 2022 Congress.',
  },
  {
    id: 'kim-family',
    label: 'Kim family (백두혈통)',
    color: '#60a5fa',
    note: 'The Paektu bloodline — the hereditary core of the DPRK regime. Legitimacy in Pyongyang flows from descent from Kim Il-sung.',
  },
  {
    id: 'ogd',
    label: 'OGD bloc (조직지도부)',
    color: '#a78bfa',
    note: 'Figures tied to the Organization & Guidance Department, the party control organ that runs personnel and surveillance over the elite.',
  },
];

export const FACTION_BY_ID = new Map(FACTIONS.map((f) => [f.id, f]));
