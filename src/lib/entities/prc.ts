import type { EntityGraph } from './types';

// PRC leadership graph — "Pekingology". Centered on the 20th Politburo
// Standing Committee (seated Oct 2022), the Central Military Commission,
// and the factional currents that explain promotions and purges.
//
// Held posts are facts. Factional labels (xi-faction / tuanpai /
// princeling) are the interpretive core of China-watching and carry
// lower confidence. Purged figures (Qin Gang, Li Shangfu, Miao Hua) are
// retained: a removal in Beijing is a top-signal OSINT event, and the
// CCDI anti-corruption organ is itself a factional instrument.
//
// Maintenance note: the 2023–25 purge wave is still unfolding; figures
// marked 'unknown' have credible-but-unconfirmed investigation reports.

const WP = (slug: string) => `https://en.wikipedia.org/wiki/${slug}`;

export const PRC_GRAPH: EntityGraph = {
  entities: [
    // — Organs —
    { id: 'cn-ccp', name: 'Chinese Communist Party', nameNative: '中国共产党', type: 'org', country: 'cn', role: 'Ruling party', status: 'active', prominence: 0.9, sourceUrl: WP('Chinese_Communist_Party') },
    { id: 'cn-psc', name: 'Politburo Standing Committee', nameNative: '中央政治局常务委员会', type: 'org', country: 'cn', role: 'Apex decision body (7 members)', status: 'active', prominence: 0.85, sourceUrl: WP('Politburo_Standing_Committee_of_the_Chinese_Communist_Party') },
    { id: 'cn-cmc', name: 'Central Military Commission', nameNative: '中央军事委员会', type: 'org', country: 'cn', role: 'Supreme military command', status: 'active', prominence: 0.85, sourceUrl: WP('Central_Military_Commission_(China)') },
    { id: 'cn-pla', name: "People's Liberation Army", nameNative: '中国人民解放军', type: 'org', country: 'cn', role: 'Armed forces', status: 'active', prominence: 0.8, sourceUrl: WP('People%27s_Liberation_Army') },
    { id: 'cn-ccdi', name: 'Central Discipline Inspection Commission', nameNative: '中央纪律检查委员会', type: 'org', country: 'cn', role: 'Anti-corruption / discipline organ', bio: "The party's internal-control body; nominally anti-graft, in practice the chief instrument of factional purges.", status: 'active', prominence: 0.6, sourceUrl: WP('Central_Commission_for_Discipline_Inspection') },

    // — Politburo Standing Committee (20th, 2022) —
    { id: 'cn-xjp', name: 'Xi Jinping', nameNative: '习近平', aliases: ['Xi'], type: 'person', country: 'cn', role: 'General Secretary; President; CMC Chairman', bio: 'Paramount leader since 2012; consolidated a third term in 2022 and packed the PSC with allies.', factionTags: ['xi-faction', 'princeling'], status: 'active', prominence: 1.0, sourceUrl: WP('Xi_Jinping') },
    { id: 'cn-lq', name: 'Li Qiang', nameNative: '李强', type: 'person', country: 'cn', role: 'Premier', bio: "Rose under Xi in Zhejiang and Shanghai; the State Council's head and a core Xi loyalist.", factionTags: ['xi-faction'], status: 'active', prominence: 0.8, sourceUrl: WP('Li_Qiang') },
    { id: 'cn-zlj', name: 'Zhao Leji', nameNative: '赵乐际', type: 'person', country: 'cn', role: 'Chairman, NPC Standing Committee', factionTags: ['xi-faction'], status: 'active', prominence: 0.65, sourceUrl: WP('Zhao_Leji') },
    { id: 'cn-whn', name: 'Wang Huning', nameNative: '王沪宁', type: 'person', country: 'cn', role: 'Chairman, CPPCC; chief ideologue', bio: 'The party\'s leading theorist; architect of doctrine across three leaders.', factionTags: ['xi-faction'], status: 'active', prominence: 0.65, sourceUrl: WP('Wang_Huning') },
    { id: 'cn-cq', name: 'Cai Qi', nameNative: '蔡奇', type: 'person', country: 'cn', role: 'First Secretary of the Secretariat; Director, General Office', bio: "Runs the party apparatus and Xi's office; among the closest of the inner circle.", factionTags: ['xi-faction'], status: 'active', prominence: 0.7, sourceUrl: WP('Cai_Qi') },
    { id: 'cn-dxx', name: 'Ding Xuexiang', nameNative: '丁薛祥', type: 'person', country: 'cn', role: 'First Vice Premier', bio: "Xi's former chief of staff; manages the leader's portfolio.", factionTags: ['xi-faction'], status: 'active', prominence: 0.65, sourceUrl: WP('Ding_Xuexiang') },
    { id: 'cn-lx', name: 'Li Xi', nameNative: '李希', type: 'person', country: 'cn', role: 'Secretary, CCDI', bio: 'Heads the discipline-inspection machine driving the anti-corruption purges.', factionTags: ['xi-faction'], status: 'active', prominence: 0.6, sourceUrl: WP('Li_Xi_(politician)') },

    // — Diplomacy —
    { id: 'cn-wy', name: 'Wang Yi', nameNative: '王毅', type: 'person', country: 'cn', role: 'Director, CCP Foreign Affairs Commission Office; Foreign Minister', bio: "China's top diplomat; resumed the FM post after Qin Gang's removal.", factionTags: ['xi-faction'], status: 'active', prominence: 0.7, sourceUrl: WP('Wang_Yi_(politician)') },
    { id: 'cn-qg', name: 'Qin Gang', nameNative: '秦刚', type: 'person', country: 'cn', role: 'Foreign Minister (Dec 2022 – Jul 2023)', bio: 'Xi protégé and ex-ambassador to Washington; abruptly removed and vanished from public life in 2023 — an unexplained high-level purge.', factionTags: ['xi-faction'], status: 'purged', prominence: 0.4, sourceUrl: WP('Qin_Gang') },

    // — Military leadership —
    { id: 'cn-zyx', name: 'Zhang Youxia', nameNative: '张又侠', type: 'person', country: 'cn', role: 'Vice Chairman, CMC (first-ranked)', bio: 'Princeling and combat veteran with a personal bond to Xi; the senior uniformed officer.', factionTags: ['xi-faction', 'princeling'], status: 'active', prominence: 0.7, sourceUrl: WP('Zhang_Youxia') },
    { id: 'cn-hwd', name: 'He Weidong', nameNative: '何卫东', type: 'person', country: 'cn', role: 'Vice Chairman, CMC', bio: 'Taiwan-theater background. Subject of credible but unconfirmed 2025 investigation reports.', factionTags: ['xi-faction'], status: 'unknown', prominence: 0.5, sourceUrl: WP('He_Weidong') },
    { id: 'cn-dj', name: 'Dong Jun', nameNative: '董军', type: 'person', country: 'cn', role: 'Minister of National Defence', bio: 'First PLA Navy admiral to hold the post; appointed Dec 2023 after his predecessor was purged.', status: 'active', prominence: 0.55, sourceUrl: WP('Dong_Jun') },
    { id: 'cn-lsf', name: 'Li Shangfu', nameNative: '李尚福', type: 'person', country: 'cn', role: 'Minister of National Defence (2023)', bio: 'Removed after ~7 months and expelled from the party in 2024; part of the procurement/Rocket Force purge.', status: 'purged', prominence: 0.4, sourceUrl: WP('Li_Shangfu') },
    { id: 'cn-mh', name: 'Miao Hua', nameNative: '苗华', type: 'person', country: 'cn', role: 'Director, CMC Political Work Dept.', bio: 'Suspended and placed under investigation in late 2024 — a strike at the military political-loyalty apparatus.', status: 'purged', prominence: 0.45, sourceUrl: WP('Miao_Hua') },

    // — Former leaders / rival faction (tuanpai) —
    { id: 'cn-hjt', name: 'Hu Jintao', nameNative: '胡锦涛', type: 'person', country: 'cn', role: 'General Secretary, 2002–2012', bio: 'Patron of the Communist Youth League faction; his escorted exit from the 2022 Congress dais became its symbolic eclipse.', factionTags: ['tuanpai'], status: 'retired', prominence: 0.5, sourceUrl: WP('Hu_Jintao') },
    { id: 'cn-lkq', name: 'Li Keqiang', nameNative: '李克强', type: 'person', country: 'cn', role: 'Premier, 2013–2023', bio: 'Leading tuanpai figure sidelined under Xi; died of a heart attack in Oct 2023.', factionTags: ['tuanpai'], status: 'deceased', prominence: 0.5, sourceUrl: WP('Li_Keqiang') },
    { id: 'cn-hch', name: 'Hu Chunhua', nameNative: '胡春华', type: 'person', country: 'cn', role: 'Vice Chairman, CPPCC', bio: 'Once tipped for the top tier; dropped from the Politburo entirely in 2022 — the clearest marker of the tuanpai\'s fall.', factionTags: ['tuanpai'], status: 'active', prominence: 0.4, sourceUrl: WP('Hu_Chunhua') },

    // — Shanghai Gang (Jiang Zemin's network) —
    { id: 'cn-jzm', name: 'Jiang Zemin', nameNative: '江泽民', type: 'person', country: 'cn', role: 'General Secretary, 1989–2002', bio: 'Patron of the Shanghai Gang; dominated Chinese politics into the 2010s through protégés. Died Nov 2022, severing the network\'s last living anchor.', factionTags: ['shanghai-gang'], status: 'deceased', prominence: 0.55, sourceUrl: WP('Jiang_Zemin') },
    { id: 'cn-zqh', name: 'Zeng Qinghong', nameNative: '曾庆红', type: 'person', country: 'cn', role: 'Vice President, 2003–2008', bio: "Jiang's chief political fixer and kingmaker; credited by some analysts with backing Xi's early rise.", factionTags: ['shanghai-gang', 'princeling'], status: 'retired', prominence: 0.45, sourceUrl: WP('Zeng_Qinghong') },
    { id: 'cn-hz', name: 'Han Zheng', nameNative: '韩正', type: 'person', country: 'cn', role: 'Vice President (state)', bio: 'Former Shanghai party chief and the last Shanghai-Gang figure in high office, now in a largely ceremonial post.', factionTags: ['shanghai-gang'], status: 'active', prominence: 0.45, sourceUrl: WP('Han_Zheng') },
    { id: 'cn-zdj', name: 'Zhang Dejiang', nameNative: '张德江', type: 'person', country: 'cn', role: 'Chairman, NPC SC, 2013–2018', factionTags: ['shanghai-gang'], status: 'retired', prominence: 0.35, sourceUrl: WP('Zhang_Dejiang') },

    // — Princeling rival (purged) —
    { id: 'cn-bxl', name: 'Bo Xilai', nameNative: '薄熙来', type: 'person', country: 'cn', role: 'Party chief of Chongqing (purged 2012)', bio: 'Charismatic princeling and Xi peer whose 2012 downfall — life imprisonment after the Wang Lijun scandal — cleared a rival on Xi\'s path to the top.', factionTags: ['princeling'], status: 'purged', prominence: 0.4, sourceUrl: WP('Bo_Xilai') },
  ],

  relations: [
    // — Command & membership (fact) —
    { from: 'cn-xjp', to: 'cn-ccp', type: 'command', label: 'General Secretary', confidence: 1.0 },
    { from: 'cn-xjp', to: 'cn-cmc', type: 'command', label: 'Chairman', confidence: 1.0 },
    { from: 'cn-xjp', to: 'cn-pla', type: 'command', label: 'Commander-in-Chief', confidence: 1.0 },
    { from: 'cn-xjp', to: 'cn-psc', type: 'member', label: 'ranked 1st', confidence: 1.0 },
    { from: 'cn-lq', to: 'cn-psc', type: 'member', confidence: 1.0 },
    { from: 'cn-zlj', to: 'cn-psc', type: 'member', confidence: 1.0 },
    { from: 'cn-whn', to: 'cn-psc', type: 'member', confidence: 1.0 },
    { from: 'cn-cq', to: 'cn-psc', type: 'member', confidence: 1.0 },
    { from: 'cn-dxx', to: 'cn-psc', type: 'member', confidence: 1.0 },
    { from: 'cn-lx', to: 'cn-psc', type: 'member', confidence: 1.0 },
    { from: 'cn-lx', to: 'cn-ccdi', type: 'command', label: 'Secretary', confidence: 1.0 },
    { from: 'cn-zyx', to: 'cn-cmc', type: 'member', label: 'Vice Chairman', confidence: 1.0 },
    { from: 'cn-hwd', to: 'cn-cmc', type: 'member', label: 'Vice Chairman', confidence: 0.9 },
    { from: 'cn-mh', to: 'cn-cmc', type: 'member', label: 'Political Work Dept.', confidence: 0.9 },
    { from: 'cn-dj', to: 'cn-pla', type: 'command', label: 'Defence Minister', confidence: 0.9 },
    { from: 'cn-wy', to: 'cn-ccp', type: 'member', label: 'Politburo', confidence: 0.95 },

    // — Succession (fact) —
    { from: 'cn-hjt', to: 'cn-xjp', type: 'successor', label: 'succeeded by', confidence: 1.0, until: '2012-11-15' },
    { from: 'cn-lsf', to: 'cn-dj', type: 'successor', label: 'succeeded by', confidence: 1.0, until: '2023-10-24' },
    { from: 'cn-qg', to: 'cn-wy', type: 'successor', label: 'post resumed by', confidence: 0.95, until: '2023-07-25' },

    // — Factional alignment (interpretation) —
    { from: 'cn-xjp', to: 'cn-lq', type: 'patron', label: 'promoted', confidence: 0.85 },
    { from: 'cn-xjp', to: 'cn-cq', type: 'patron', label: 'promoted', confidence: 0.8 },
    { from: 'cn-xjp', to: 'cn-dxx', type: 'patron', label: 'former chief of staff', confidence: 0.85 },
    { from: 'cn-xjp', to: 'cn-qg', type: 'patron', label: 'fast-tracked', confidence: 0.7, until: '2023-07-25' },
    { from: 'cn-xjp', to: 'cn-zyx', type: 'faction', label: 'personal trust', confidence: 0.7 },
    { from: 'cn-hjt', to: 'cn-lkq', type: 'patron', label: 'tuanpai protégé', confidence: 0.75 },
    { from: 'cn-hjt', to: 'cn-hch', type: 'patron', label: 'tuanpai protégé', confidence: 0.7 },
    { from: 'cn-xjp', to: 'cn-hjt', type: 'rival', label: 'eclipsed tuanpai', confidence: 0.6 },

    // — Shanghai Gang lineage (interpretation) —
    { from: 'cn-jzm', to: 'cn-hjt', type: 'successor', label: 'succeeded by', confidence: 1.0, until: '2002-11-15' },
    { from: 'cn-jzm', to: 'cn-zqh', type: 'patron', label: 'right-hand man', confidence: 0.8 },
    { from: 'cn-jzm', to: 'cn-hz', type: 'patron', label: 'Shanghai protégé', confidence: 0.7 },
    { from: 'cn-jzm', to: 'cn-zdj', type: 'patron', label: 'Shanghai Gang', confidence: 0.65 },
    { from: 'cn-jzm', to: 'cn-whn', type: 'patron', label: 'brought to Beijing', confidence: 0.55 },
    { from: 'cn-zqh', to: 'cn-xjp', type: 'patron', label: 'backed early rise', confidence: 0.45 },
    { from: 'cn-jzm', to: 'cn-hjt', type: 'rival', label: 'curbed tuanpai', confidence: 0.5 },

    // — Princeling peers / rivalry —
    { from: 'cn-xjp', to: 'cn-bxl', type: 'rival', label: 'princeling rival, purged 2012', confidence: 0.6, since: '2012-03-15' },

    // — Purges (event-level, via the discipline organ) —
    { from: 'cn-ccdi', to: 'cn-bxl', type: 'rival', label: 'life sentence (2013)', confidence: 0.85, since: '2012-03-15', sourceUrl: WP('Bo_Xilai') },
    { from: 'cn-ccdi', to: 'cn-lsf', type: 'rival', label: 'expelled (2024)', confidence: 0.85, since: '2023-10-24', sourceUrl: WP('Li_Shangfu') },
    { from: 'cn-ccdi', to: 'cn-mh', type: 'rival', label: 'under investigation', confidence: 0.8, since: '2024-11-28', sourceUrl: WP('Miao_Hua') },
    { from: 'cn-xjp', to: 'cn-qg', type: 'rival', label: 'removed (2023)', confidence: 0.6, since: '2023-07-25' },
  ],
};
