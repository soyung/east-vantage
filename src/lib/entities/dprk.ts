import type { EntityGraph } from './types';

// DPRK leadership graph — "Pyongyangology". The Kim family dynasty plus
// the party/military elite that orbits it. Family ties and held posts
// are facts (confidence ~1.0); the rest (who is rising, who is OGD-
// aligned) is interpretation and tagged lower.
//
// Seed snapshot reflects the post-2024 lineup. Maintenance note: the
// Premiership and Defence portfolio rotate often — re-check before
// relying on those nodes. Purged/executed figures are KEPT in the graph
// (status: 'purged'/'deceased') because their removal is itself the
// highest-signal OSINT event in this system (e.g. Jang Song-thaek 2013).

const WP = (slug: string) => `https://en.wikipedia.org/wiki/${slug}`;

export const DPRK_GRAPH: EntityGraph = {
  entities: [
    // — Organs —
    { id: 'kp-wpk', name: "Workers' Party of Korea", nameNative: '조선로동당', type: 'org', country: 'kp', role: 'Ruling party', status: 'active', prominence: 0.9, sourceUrl: WP('Workers%27_Party_of_Korea') },
    { id: 'kp-sac', name: 'State Affairs Commission', nameNative: '국무위원회', type: 'org', country: 'kp', role: 'Supreme governing body', status: 'active', prominence: 0.8, sourceUrl: WP('State_Affairs_Commission') },
    { id: 'kp-kpa', name: "Korean People's Army", nameNative: '조선인민군', type: 'org', country: 'kp', role: 'Armed forces', status: 'active', prominence: 0.8, sourceUrl: WP('Korean_People%27s_Army') },
    { id: 'kp-ogd', name: 'Organization & Guidance Dept.', nameNative: '조직지도부', type: 'org', country: 'kp', role: 'WPK control organ — personnel & surveillance', bio: 'The most powerful party organ; controls cadre appointments and monitors the elite. Factional currents in Pyongyang run through it.', factionTags: ['ogd'], status: 'active', prominence: 0.7, sourceUrl: WP('Organization_and_Guidance_Department') },

    // — Kim family core —
    { id: 'kp-kju', name: 'Kim Jong-un', nameNative: '김정은', aliases: ['Kim Jong Un'], type: 'person', country: 'kp', role: 'General Secretary, WPK; President of State Affairs', bio: 'Supreme Leader since 2011. Third-generation hereditary ruler.', factionTags: ['kim-family'], status: 'active', prominence: 1.0, sourceUrl: WP('Kim_Jong_Un') },
    { id: 'kp-kyj', name: 'Kim Yo-jong', nameNative: '김여정', aliases: ['Kim Yo Jong'], type: 'person', country: 'kp', role: 'Deputy Dept. Director, WPK Central Committee', bio: "Kim Jong-un's sister and chief propagandist; issues the regime's sharpest statements on Seoul and Washington.", factionTags: ['kim-family'], status: 'active', prominence: 0.85, sourceUrl: WP('Kim_Yo-jong') },
    { id: 'kp-kja', name: 'Kim Ju-ae', nameNative: '김주애', type: 'person', country: 'kp', role: 'Daughter of Kim Jong-un', bio: 'Publicly surfaced at a 2022 ICBM launch; widely read as a succession signal, though unconfirmed.', factionTags: ['kim-family'], status: 'active', prominence: 0.45, sourceUrl: WP('Kim_Ju-ae') },
    { id: 'kp-rsj', name: 'Ri Sol-ju', nameNative: '리설주', type: 'person', country: 'kp', role: 'First Lady', factionTags: ['kim-family'], status: 'active', prominence: 0.35, sourceUrl: WP('Ri_Sol-ju') },
    { id: 'kp-kji', name: 'Kim Jong-il', nameNative: '김정일', type: 'person', country: 'kp', role: 'Leader, 1994–2011', factionTags: ['kim-family'], status: 'deceased', prominence: 0.6, sourceUrl: WP('Kim_Jong_Il') },
    { id: 'kp-kis', name: 'Kim Il-sung', nameNative: '김일성', type: 'person', country: 'kp', role: 'Founding leader, 1948–1994', factionTags: ['kim-family'], status: 'deceased', prominence: 0.6, sourceUrl: WP('Kim_Il_Sung') },
    { id: 'kp-kkh', name: 'Kim Kyong-hui', nameNative: '김경희', type: 'person', country: 'kp', role: 'Aunt of Kim Jong-un', factionTags: ['kim-family'], status: 'retired', prominence: 0.3, sourceUrl: WP('Kim_Kyong-hui') },
    { id: 'kp-jst', name: 'Jang Song-thaek', nameNative: '장성택', type: 'person', country: 'kp', role: 'Vice-Chairman, NDC (executed 2013)', bio: "Kim Jong-un's uncle by marriage and one-time regent; executed Dec 2013 — the defining purge of the early Kim Jong-un era.", factionTags: ['kim-family'], status: 'deceased', prominence: 0.4, sourceUrl: WP('Jang_Song-thaek') },
    { id: 'kp-kjn', name: 'Kim Jong-nam', nameNative: '김정남', type: 'person', country: 'kp', role: 'Half-brother of Kim Jong-un', bio: 'Eldest son of Kim Jong-il; assassinated with VX nerve agent in Kuala Lumpur, 2017.', factionTags: ['kim-family'], status: 'deceased', prominence: 0.3, sourceUrl: WP('Kim_Jong-nam') },

    // — Party / state elite —
    { id: 'kp-crh', name: 'Choe Ryong-hae', nameNative: '최룡해', type: 'person', country: 'kp', role: 'President of the SPA Presidium', bio: 'Nominal head of state and long-standing top-tier figure.', status: 'active', prominence: 0.7, sourceUrl: WP('Choe_Ryong-hae') },
    { id: 'kp-jyw', name: 'Jo Yong-won', nameNative: '조용원', type: 'person', country: 'kp', role: 'Secretary for Organizational Affairs, WPK', bio: 'Runs party personnel via the OGD; effectively the #2 in day-to-day party control.', factionTags: ['ogd'], status: 'active', prominence: 0.7, sourceUrl: WP('Jo_Yong-won') },
    { id: 'kp-pts', name: 'Pak Thae-song', nameNative: '박태성', type: 'person', country: 'kp', role: 'Premier (from late 2024)', status: 'active', prominence: 0.55, sourceUrl: WP('Pak_Thae-song') },
    { id: 'kp-csh', name: 'Choe Son-hui', nameNative: '최선희', type: 'person', country: 'kp', role: 'Minister of Foreign Affairs', bio: "First woman to lead the DPRK foreign ministry; veteran of the US nuclear talks.", status: 'active', prominence: 0.6, sourceUrl: WP('Choe_Son-hui') },
    { id: 'kp-rpc', name: 'Ri Pyong-chol', nameNative: '리병철', type: 'person', country: 'kp', role: 'Secretary, WPK; munitions / missile program', bio: 'Routinely pictured at major missile launches; oversees strategic weapons development.', status: 'active', prominence: 0.6, sourceUrl: WP('Ri_Pyong-chol') },
    { id: 'kp-pjc', name: 'Pak Jong-chon', nameNative: '박정천', type: 'person', country: 'kp', role: 'Marshal; Secretary of the Central Military Commission', status: 'active', prominence: 0.55, sourceUrl: WP('Pak_Jong-chon') },
    { id: 'kp-ngc', name: 'No Kwang-chol', nameNative: '노광철', type: 'person', country: 'kp', role: 'Minister of National Defence', status: 'active', prominence: 0.5, sourceUrl: WP('No_Kwang-chol') },
    { id: 'kp-kyc', name: 'Kim Yong-chol', nameNative: '김영철', type: 'person', country: 'kp', role: 'Ex-intelligence chief; US-relations hand', status: 'active', prominence: 0.45, sourceUrl: WP('Kim_Yong-chol') },
  ],

  relations: [
    // — Dynastic succession (fact) —
    { from: 'kp-kis', to: 'kp-kji', type: 'successor', label: 'succeeded by', confidence: 1.0, until: '1994-07-08' },
    { from: 'kp-kji', to: 'kp-kju', type: 'successor', label: 'succeeded by', confidence: 1.0, until: '2011-12-17' },
    { from: 'kp-kju', to: 'kp-kja', type: 'successor', label: 'presumed heir', confidence: 0.4, sourceUrl: WP('Kim_Ju-ae') },

    // — Family (fact) —
    { from: 'kp-kis', to: 'kp-kji', type: 'family', label: 'father', confidence: 1.0 },
    { from: 'kp-kji', to: 'kp-kju', type: 'family', label: 'father', confidence: 1.0 },
    { from: 'kp-kju', to: 'kp-kyj', type: 'family', label: 'brother', confidence: 1.0 },
    { from: 'kp-kju', to: 'kp-kja', type: 'family', label: 'father', confidence: 1.0 },
    { from: 'kp-kju', to: 'kp-rsj', type: 'family', label: 'husband', confidence: 1.0 },
    { from: 'kp-kju', to: 'kp-kjn', type: 'family', label: 'half-brother', confidence: 1.0 },
    { from: 'kp-kji', to: 'kp-kjn', type: 'family', label: 'father', confidence: 1.0 },
    { from: 'kp-kji', to: 'kp-kkh', type: 'family', label: 'sister', confidence: 1.0 },
    { from: 'kp-kkh', to: 'kp-jst', type: 'family', label: 'husband', confidence: 1.0 },

    // — Purge / rivalry (event-level) —
    { from: 'kp-kju', to: 'kp-jst', type: 'rival', label: 'purged & executed (2013)', confidence: 0.9, since: '2013-12-12', sourceUrl: WP('Jang_Song-thaek') },

    // — Command & membership (fact) —
    { from: 'kp-kju', to: 'kp-wpk', type: 'command', label: 'General Secretary', confidence: 1.0 },
    { from: 'kp-kju', to: 'kp-sac', type: 'command', label: 'President', confidence: 1.0 },
    { from: 'kp-kju', to: 'kp-kpa', type: 'command', label: 'Supreme Commander', confidence: 1.0 },
    { from: 'kp-jyw', to: 'kp-wpk', type: 'member', label: 'Secretariat', confidence: 1.0 },
    { from: 'kp-jyw', to: 'kp-ogd', type: 'command', label: 'oversees', confidence: 0.8 },
    { from: 'kp-crh', to: 'kp-sac', type: 'member', confidence: 1.0 },
    { from: 'kp-csh', to: 'kp-sac', type: 'member', confidence: 0.9 },
    { from: 'kp-rpc', to: 'kp-wpk', type: 'member', label: 'Secretary', confidence: 1.0 },
    { from: 'kp-pjc', to: 'kp-kpa', type: 'member', label: 'Marshal', confidence: 1.0 },
    { from: 'kp-ngc', to: 'kp-kpa', type: 'command', label: 'Defence Minister', confidence: 0.9 },
    { from: 'kp-pts', to: 'kp-sac', type: 'member', confidence: 0.85 },
    { from: 'kp-kyc', to: 'kp-wpk', type: 'member', confidence: 0.8 },

    // — Patron-client (interpretation) —
    { from: 'kp-kju', to: 'kp-kyj', type: 'patron', label: 'elevated', confidence: 0.7 },
    { from: 'kp-kju', to: 'kp-jyw', type: 'patron', label: 'promoted', confidence: 0.6 },
    { from: 'kp-jst', to: 'kp-kju', type: 'patron', label: 'early regent', confidence: 0.5, until: '2013-12-12' },
  ],
};
