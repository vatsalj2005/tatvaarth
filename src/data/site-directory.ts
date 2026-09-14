export interface SiteDirectoryItem {
  id: string;
  nameHi: string;
  nameEn: string;
  descHi: string;
  descEn: string;
  url: string;
  type: 'hub' | 'bhajan-category' | 'shastra-category';
  icon: string;
  aliases: string[]; // Variations, transliterations, synonyms
}

export const siteDirectories: SiteDirectoryItem[] = [
  // ─── Top-Level Hubs ──────────────────────────────────────────────────────────
  {
    id: 'hub-bhajan',
    nameHi: 'भजन संग्रह',
    nameEn: 'Bhajans Directory',
    descHi: 'सभी जैन भक्ति भजन, गीत और आरतियाँ',
    descEn: 'All Jain devotional bhajans, songs and aartis',
    url: '/bhajan',
    type: 'hub',
    icon: '🎵',
    aliases: ['bhajan', 'bhajans', 'bhakti geet', 'geet', 'songs', 'भजन', 'गीत']
  },
  {
    id: 'hub-shastra',
    nameHi: 'शास्त्र एवं ग्रंथ',
    nameEn: 'Shastras & Scriptures',
    descHi: 'मूल गाथाएं, सूत्र, अन्वयार्थ एवं आचार्य टीकाएं',
    descEn: 'Original gathas, sutras, meanings and acharya commentaries',
    url: '/shastra',
    type: 'hub',
    icon: '📚',
    aliases: ['shastra', 'sastra', 'shastras', 'granth', 'teeka', 'tika', 'scriptures', 'books', 'शास्त्र', 'ग्रंथ', 'टीका']
  },
  {
    id: 'hub-pooja',
    nameHi: 'पूजा एवं विधान',
    nameEn: 'Pooja & Vidhi',
    descHi: 'जैन पूजा विधि, अष्टद्रव्य एवं मंत्र',
    descEn: 'Jain worship rituals, offerings and mantras',
    url: '/pooja',
    type: 'hub',
    icon: '🪔',
    aliases: ['pooja', 'puja', 'poojan', 'pujan', 'vidhi', 'aradhana', 'पूजा', 'पूजन']
  },
  {
    id: 'hub-paath',
    nameHi: 'दैनिक पाठ एवं स्तोत्र',
    nameEn: 'Daily Paath & Prayers',
    descHi: 'नित्य नियम पाठ, सामायिक एवं स्तुति',
    descEn: 'Daily recitations, prayers and praises',
    url: '/paath',
    type: 'hub',
    icon: '📜',
    aliases: ['paath', 'path', 'stotra', 'stuti', 'prarthana', 'पाठ', 'स्तोत्र', 'स्तुति']
  },

  // ─── Bhajan Categories ───────────────────────────────────────────────────────
  {
    id: 'bhajan-dev',
    nameHi: 'देव भजन',
    nameEn: 'Dev Bhajan',
    descHi: 'तीर्थंकर और देवों के भजन (160+ भजन)',
    descEn: 'Bhajans of Tirthankaras and Deities (160+ songs)',
    url: '/bhajan/dev',
    type: 'bhajan-category',
    icon: '🙏',
    aliases: ['dev', 'dev bhajan', 'देव', 'देव भजन']
  },
  {
    id: 'bhajan-shastra',
    nameHi: 'शास्त्र भजन',
    nameEn: 'Shastra Bhajan',
    descHi: 'शास्त्रों एवं तत्त्वज्ञान पर आधारित भजन',
    descEn: 'Bhajans based on scriptures and philosophy',
    url: '/bhajan/shastra',
    type: 'bhajan-category',
    icon: '📜',
    aliases: ['shastra bhajan', 'sastra bhajan', 'granth bhajan', 'tattva bhajan', 'शास्त्र भजन']
  },
  {
    id: 'bhajan-guru',
    nameHi: 'गुरु भजन',
    nameEn: 'Guru Bhajan',
    descHi: 'गुरु महिमा, मुनिराज एवं आचार्यों के भजन',
    descEn: 'Bhajans glorifying Gurus and Acharyas',
    url: '/bhajan/guru',
    type: 'bhajan-category',
    icon: '🧘',
    aliases: ['guru', 'guru bhajan', 'गुरु', 'गुरु भजन']
  },
  {
    id: 'bhajan-bhakti',
    nameHi: 'भक्ति भजन',
    nameEn: 'Bhakti Bhajan',
    descHi: 'वैराग्य, भक्ति और अंतर्मुखी आराधना के भजन',
    descEn: 'Devotional, contemplation and renunciation songs',
    url: '/bhajan/bhakti',
    type: 'bhajan-category',
    icon: '💖',
    aliases: ['bhakti', 'bhakti bhajan', 'vairagya', 'भक्ति', 'भक्ति भजन']
  },

  // ─── Shastra Categories (Anuyogas) ──────────────────────────────────────────
  {
    id: 'shastra-dravyanuyog',
    nameHi: 'द्रव्यानुयोग',
    nameEn: 'Dravyanuyog',
    descHi: 'जीव, अजीव, शुद्धात्मा और तत्त्वों का आध्यात्मिक विवेचन (13 शास्त्र)',
    descEn: 'Metaphysics, soul, substance and spiritual philosophy (13 scriptures)',
    url: '/shastra/dravyanuyog',
    type: 'shastra-category',
    icon: '💎',
    aliases: ['dravyanuyog', 'dravya', 'dravyanyog', 'dravyanuyoga', 'द्रव्यानुयोग', 'द्रव्य']
  },
  {
    id: 'shastra-charananuyog',
    nameHi: 'चरणानुयोग',
    nameEn: 'Charananuyog',
    descHi: 'गृहस्थ और मुनियों के सदाचार, व्रत, आचरण और नियम',
    descEn: 'Ethics, conduct, vows and rules for householders and monks',
    url: '/shastra/charananuyog',
    type: 'shastra-category',
    icon: '🚶',
    aliases: ['charananuyog', 'charan', 'charananyog', 'charananuyoga', 'चरणानुयोग', 'चरण']
  },
  {
    id: 'shastra-karananuyog',
    nameHi: 'करणानुयोग',
    nameEn: 'Karananuyog',
    descHi: 'तीन लोक की रचना, भूगोल, खगोल और कर्म सिद्धांत',
    descEn: 'Cosmology, geography, time cycles and karma mathematics',
    url: '/shastra/karananuyog',
    type: 'shastra-category',
    icon: '🌌',
    aliases: ['karananuyog', 'karan', 'karananyog', 'karananuyoga', 'करणानुयोग', 'करण']
  },
  {
    id: 'shastra-prathmanuyog',
    nameHi: 'प्रथमानुयोग',
    nameEn: 'Prathmanuyog',
    descHi: 'शलाका पुरुषों के पावन चरित्र, कथाएं एवं इतिहास',
    descEn: 'Sacred biographies, legends, stories and ancient history',
    url: '/shastra/prathmanuyog',
    type: 'shastra-category',
    icon: '👑',
    aliases: ['prathmanuyog', 'pratham', 'prathama', 'prathmanuyoga', 'प्रथमानुयोग', 'चरित्र']
  },
  {
    id: 'shastra-nyay',
    nameHi: 'न्याय एवं तर्कशास्त्र',
    nameEn: 'Nyay & Logic',
    descHi: 'जैन दर्शन का प्रमाण, नय, स्याद्वाद एवं अनेकांतवाद',
    descEn: 'Epistemology, logic, Anekantavada and Syadvada',
    url: '/shastra/nyay',
    type: 'shastra-category',
    icon: '⚖️',
    aliases: ['nyay', 'nyaya', 'tark', 'logic', 'praman', 'syadvad', 'anekant', 'न्याय', 'तर्क']
  },
  {
    id: 'shastra-itihas',
    nameHi: 'इतिहास एवं पुरातत्त्व',
    nameEn: 'Itihas & Heritage',
    descHi: 'जैन धर्म का ऐतिहासिक विकास, शिलालेख और तीर्थ',
    descEn: 'Historical development, inscriptions, archaeology and pilgrimages',
    url: '/shastra/itihas',
    type: 'shastra-category',
    icon: '🏛️',
    aliases: ['itihas', 'itihaas', 'history', 'teerth', 'tirth', 'इतिहास', 'तीर्थ']
  },
  {
    id: 'shastra-notes',
    nameHi: 'स्वाध्याय नोट्स',
    nameEn: 'Study Notes',
    descHi: 'स्वाध्याय के सारगर्भित बिन्दु, संकलन और संदर्भ',
    descEn: 'Key study notes, digests and reference compilations',
    url: '/shastra/notes',
    type: 'shastra-category',
    icon: '📝',
    aliases: ['notes', 'swadhyay', 'swadhyay notes', 'नोट्स', 'स्वाध्याय']
  }
];
