/**
 * Smart Search Engine for Tatvaarth
 * 
 * Handles:
 * - Hinglish → Hindi transliteration
 * - Fuzzy / phonetic matching with vowel-length normalization
 * - 5-Tier Priority Search:
 *   1. Absolute string matches (Directories, Shastras, Bhajans)
 *   2. Closest absolute / phonetic / vowel-normalized matches
 *   3. Categories & Folders matching directory names
 *   4. Typo tolerance via Levenshtein distance
 *   5. Partial & semantic substring search
 * - Scoped local search with automatic global fallback
 */

import { BhajanData, bhajans } from '@/data/content-loader';
import { transliterateText } from '@/lib/transliterate';
import { getShastras, ShastraMetadata } from '@/data/shastra-loader';
import { siteDirectories, SiteDirectoryItem } from '@/data/site-directory';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  title: string;
  relevance_score: number;
  match_reason: string;
  matched_as: 'exact' | 'transliterated' | 'semantic' | 'phonetic' | 'partial';
  bhajan: BhajanData;
}

export interface UnifiedSearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: 'directory' | 'shastra' | 'bhajan';
  url: string;
  score: number;
  badge: string;
  icon?: string;
  matchedAs: 'exact' | 'phonetic' | 'category' | 'typo' | 'semantic' | 'partial';
}

export interface SmartSearchOptions {
  subdivisionId?: string;
  limit?: number;
}

// ─── Hinglish → Hindi Dictionary ─────────────────────────────────────────────

const hinglishToHindi: Record<string, string[]> = {
  'pyaar': ['प्यार', 'प्रेम'], 'pyar': ['प्यार', 'प्रेम'], 'prem': ['प्रेम', 'प्यार'],
  'dard': ['दर्द', 'पीड़ा'], 'drd': ['दर्द'],
  'zindagi': ['ज़िंदगी', 'जिंदगी', 'जीवन'], 'zingadi': ['ज़िंदगी', 'जिंदगी'], 'jindagi': ['जिंदगी', 'ज़िंदगी'],
  'gana': ['गाना', 'गान'], 'gaana': ['गाना', 'गान'],
  'khushi': ['खुशी', 'आनंद'], 'khusi': ['खुशी'],
  'gussa': ['गुस्सा', 'क्रोध'], 'dost': ['दोस्त', 'मित्र'],
  'bhajan': ['भजन'], 'bhakti': ['भक्ति'],
  'puja': ['पूजा'], 'pooja': ['पूजा'],
  'dev': ['देव', 'देवता'], 'deva': ['देव', 'देवता'],
  'guru': ['गुरु'], 'shastra': ['शास्त्र'], 'granth': ['ग्रंथ'],
  'mantra': ['मंत्र'], 'mandir': ['मंदिर'],
  'tirth': ['तीर्थ'], 'tirthankar': ['तीर्थंकर'], 'teerthankar': ['तीर्थंकर'],
  'mahavir': ['महावीर'], 'mahaveer': ['महावीर'],
  'parshvanath': ['पार्श्वनाथ'], 'parshwanath': ['पार्श्वनाथ'],
  'adinath': ['आदिनाथ'], 'rishabh': ['ऋषभ', 'ऋषभदेव'], 'rishabdev': ['ऋषभदेव'],
  'jain': ['जैन'], 'jinendra': ['जिनेन्द्र', 'जिनेंद्र'], 'jin': ['जिन'],
  'moksha': ['मोक्ष'], 'moksh': ['मोक्ष'], 'nirvana': ['निर्वाण'],
  'dharma': ['धर्म'], 'dharm': ['धर्म'], 'karma': ['कर्म'], 'karm': ['कर्म'],
  'jeevan': ['जीवन'], 'jiwan': ['जीवन'], 'jeewan': ['जीवन'],
  'prabhu': ['प्रभु'], 'prabho': ['प्रभो', 'प्रभु'],
  'swami': ['स्वामी'], 'bhagwan': ['भगवान'], 'bhagavan': ['भगवान'],
  'vandana': ['वंदना', 'वन्दना'], 'stuti': ['स्तुति'],
  'aarti': ['आरती'], 'arti': ['आरती'],
  'jai': ['जय'], 'jay': ['जय'],
  'shanti': ['शांति', 'शान्ति'], 'daya': ['दया'], 'seva': ['सेवा'],
  'satya': ['सत्य'], 'ahimsa': ['अहिंसा'],
  'tap': ['तप'], 'tapas': ['तपस्या'], 'tapasya': ['तपस्या'],
  'samyak': ['सम्यक'], 'darshan': ['दर्शन'], 'darsh': ['दर्श', 'दर्शन'],
  'gyan': ['ज्ञान'], 'gyaan': ['ज्ञान'],
  'charitra': ['चारित्र', 'चरित्र'],
  'siddh': ['सिद्ध'], 'siddha': ['सिद्ध'],
  'arihant': ['अरिहंत'], 'acharya': ['आचार्य'], 'upadhyay': ['उपाध्याय'],
  'sadhu': ['साधु'], 'sadhvi': ['साध्वी'], 'muni': ['मुनि'],
  'tyag': ['त्याग'], 'tyaag': ['त्याग'],
  'vairagya': ['वैराग्य'], 'vairaag': ['वैराग्य'],
  'param': ['परम'], 'atma': ['आत्मा'], 'aatma': ['आत्मा'],
  'charan': ['चरण'], 'pad': ['पद'], 'padam': ['पदम'], 'kamal': ['कमल'],
  'prabhat': ['प्रभात'], 'naman': ['नमन'], 'pranam': ['प्रणाम'], 'namaskar': ['नमस्कार'],
  'tera': ['तेरा'], 'mera': ['मेरा'], 'hamara': ['हमारा'],
  'tumhara': ['तुम्हारा'], 'tumhare': ['तुम्हारे', 'तुम्हारा'], 'tumhari': ['तुम्हारी'],
  'tumhaara': ['तुम्हारा'], 'tumhaare': ['तुम्हारे'], 'tumhaari': ['तुम्हारी'],
  'man': ['मन'], 'hriday': ['हृदय'], 'dil': ['दिल', 'हृदय'],
  'rang': ['रंग'], 'roop': ['रूप'],
  'sundar': ['सुंदर'], 'sunder': ['सुंदर'], 'madhur': ['मधुर'],
  'pavitra': ['पवित्र'], 'amrit': ['अमृत'],
  'chand': ['चंद', 'चांद', 'चन्द्र'], 'suraj': ['सूरज', 'सूर्य'],
  'phool': ['फूल'], 'vandan': ['वंदन'],
  'chalo': ['चलो'], 'dekho': ['देखो'], 'suno': ['सुनो'],
  'gao': ['गाओ'], 'bolo': ['बोलो'], 'karo': ['करो'],
  'namokar': ['णमोकार', 'नमोकार'], 'navkar': ['णवकार', 'नवकार'],
  'panch': ['पंच', 'पांच'], 'parmeshthi': ['परमेष्ठी'],
  'ratnatraya': ['रत्नत्रय'], 'samvar': ['सम्वर', 'संवर'], 'nirjara': ['निर्जरा'],
  'anekant': ['अनेकांत'], 'syadvad': ['स्यादवाद'],
  'digambar': ['दिगम्बर', 'दिगंबर'], 'shwetambar': ['श्वेतांबर', 'श्वेताम्बर'],
  'paryushan': ['पर्युषण'], 'daslakshan': ['दशलक्षण'],
  'pratikraman': ['प्रतिक्रमण'], 'samayik': ['सामायिक'], 'chaityavandan': ['चैत्यवंदन'],
  'sangeet': ['संगीत'], 'swar': ['स्वर'], 'raag': ['राग'],
  'sur': ['सुर'], 'taal': ['ताल'], 'dhun': ['धुन'],
  'nahi': ['नहीं'], 'nahin': ['नहीं'], 'kya': ['क्या'],
  'chain': ['चैन'], 'nayan': ['नयन'], 'nain': ['नैन'],
  'mujhe': ['मुझे'], 'mujhko': ['मुझको'],
  'tum': ['तुम'], 'hum': ['हम'],
  'bin': ['बिन', 'बिना'],
};

// ─── Normalization & Distance Helpers ─────────────────────────────────────────

function normalizeVowelLength(str: string): string {
  return str
    .toLowerCase()
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/ii/g, 'i')
    .replace(/uu/g, 'u');
}

function phoneticNormalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/ph/g, 'f')
    .replace(/sh/g, 's')
    .replace(/th/g, 't')
    .replace(/ch/g, 'c')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/dh/g, 'd')
    .replace(/bh/g, 'b')
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/ai/g, 'e')
    .replace(/au/g, 'o')
    .replace(/(.)\1+/g, '$1')
    .replace(/[aeiou]/g, '')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

// ─── Pre-computed Indices ────────────────────────────────────────────────────

interface BhajanIndexEntry {
  bhajan: BhajanData;
  titleLower: string;
  titleWords: string[];
  lyricsLower: string;
  romanTitle: string;
  romanWords: string[];
  romanLyrics: string;
  romanTitleNorm: string;
  romanLyricsNorm: string;
  titleWordsNorm: string[];
  titleWordsPhonetic: string[];
  tagsLower: string[];
}

let _bhajanIndex: BhajanIndexEntry[] | null = null;

function getSearchIndex(): BhajanIndexEntry[] {
  if (_bhajanIndex) return _bhajanIndex;

  _bhajanIndex = bhajans.map(b => {
    const titleLower = b.title.toLowerCase();
    const lyricsLower = b.lyrics.toLowerCase();
    const romanTitle = transliterateText(b.title).toLowerCase();
    const romanLyrics = transliterateText(b.lyrics).toLowerCase();
    const romanTitleNorm = normalizeVowelLength(romanTitle);
    const romanLyricsNorm = normalizeVowelLength(romanLyrics);
    const titleWords = titleLower.split(/[\s\-_/]+/).filter(Boolean);
    const romanWords = romanTitle.split(/[\s\-_/]+/).filter(Boolean);

    return {
      bhajan: b,
      titleLower,
      titleWords,
      lyricsLower,
      romanTitle,
      romanWords,
      romanLyrics,
      romanTitleNorm,
      romanLyricsNorm,
      titleWordsNorm: romanWords.map(w => normalizeVowelLength(w)),
      titleWordsPhonetic: romanWords.map(w => phoneticNormalize(w)),
      tagsLower: b.tags.map(t => t.toLowerCase()),
    };
  });

  return _bhajanIndex;
}

interface ShastraIndexEntry {
  shastra: ShastraMetadata;
  titleLower: string;
  titleWords: string[];
  romanTitle: string;
  romanWords: string[];
  romanTitleNorm: string;
  romanTitlePhonetic: string;
  slugLower: string;
  idLower: string;
  authorLower: string;
  authorWords: string[];
  romanAuthor: string;
  romanAuthorWords: string[];
  romanAuthorNorm: string;
  url: string;
  subtitle: string;
}

let _shastraIndex: ShastraIndexEntry[] | null = null;

function getShastraSearchIndex(): ShastraIndexEntry[] {
  if (_shastraIndex) return _shastraIndex;

  const shastras = getShastras();
  _shastraIndex = shastras.map(s => {
    const titleLower = s.title.toLowerCase();
    const romanTitle = transliterateText(s.title).toLowerCase();
    const romanTitleNorm = normalizeVowelLength(romanTitle);
    const authorLower = s.author.toLowerCase();
    const romanAuthor = transliterateText(s.author).toLowerCase();

    return {
      shastra: s,
      titleLower,
      titleWords: titleLower.split(/[\s\-_/]+/).filter(Boolean),
      romanTitle,
      romanWords: romanTitle.split(/[\s\-_/]+/).filter(Boolean),
      romanTitleNorm,
      romanTitlePhonetic: phoneticNormalize(romanTitle),
      slugLower: s.shastraSlug.toLowerCase(),
      idLower: s.id.toLowerCase(),
      authorLower,
      authorWords: authorLower.split(/[\s\-_/]+/).filter(Boolean),
      romanAuthor,
      romanAuthorWords: romanAuthor.split(/[\s\-_/]+/).filter(Boolean),
      romanAuthorNorm: normalizeVowelLength(romanAuthor),
      url: `/shastra/${s.categorySlug}/${s.shastraSlug}`,
      subtitle: `📚 ${s.author} • ${s.categoryHi} (${s.gathaCount} गाथाएं)`,
    };
  });

  return _shastraIndex;
}

interface DirectoryIndexEntry {
  dir: SiteDirectoryItem;
  allAliases: string[];
  aliasesNorm: string[];
  aliasesPhonetic: string[];
}

let _dirIndex: DirectoryIndexEntry[] | null = null;

function getDirectorySearchIndex(): DirectoryIndexEntry[] {
  if (_dirIndex) return _dirIndex;

  _dirIndex = siteDirectories.map(dir => {
    const allAliases = [
      dir.nameEn.toLowerCase(),
      dir.nameHi.toLowerCase(),
      ...dir.aliases.map(a => a.toLowerCase())
    ];
    return {
      dir,
      allAliases,
      aliasesNorm: allAliases.map(a => normalizeVowelLength(a)),
      aliasesPhonetic: allAliases.map(a => phoneticNormalize(a)),
    };
  });

  return _dirIndex;
}

// ─── Site-Wide 5-Tier Priority Search ────────────────────────────────────────

export function siteWideSearch(query: string, options: { limit?: number } = {}): UnifiedSearchResult[] {
  if (!query || query.trim().length === 0) return [];

  const rawQuery = query.trim();
  const queryLower = rawQuery.toLowerCase();
  const romanQuery = transliterateText(rawQuery).toLowerCase();
  const queryNorm = normalizeVowelLength(queryLower);
  const romanQueryNorm = normalizeVowelLength(romanQuery);
  const queryPhonetic = phoneticNormalize(queryLower);
  const limit = options.limit ?? 10;

  const results = new Map<string, UnifiedSearchResult>();

  function addResult(res: UnifiedSearchResult) {
    const existing = results.get(res.id);
    if (!existing || existing.score < res.score) {
      results.set(res.id, res);
    }
  }

  // 1. DIRECTORIES & CATEGORIES (Top Priority when matched)
  for (const { dir, allAliases, aliasesNorm, aliasesPhonetic } of getDirectorySearchIndex()) {
    // Priority 1: Exact Absolute String Match
    if (allAliases.includes(queryLower) || allAliases.includes(romanQuery)) {
      addResult({
        id: `dir-${dir.id}`,
        title: `${dir.nameHi} (${dir.nameEn})`,
        subtitle: `📂 ${dir.descHi}`,
        type: 'directory',
        url: dir.url,
        score: 1.15,
        badge: dir.type === 'hub' ? 'Directory' : 'Category',
        icon: dir.icon,
        matchedAs: 'exact'
      });
      continue;
    }

    // Priority 2: Closest Absolute / Phonetic Match (requires >= 3 chars)
    const isPhonetic = (queryNorm.length >= 3 && (aliasesNorm.includes(queryNorm) || aliasesNorm.includes(romanQueryNorm))) ||
                       (queryPhonetic.length >= 3 && aliasesPhonetic.includes(queryPhonetic));
    if (isPhonetic) {
      addResult({
        id: `dir-${dir.id}`,
        title: `${dir.nameHi} (${dir.nameEn})`,
        subtitle: `📂 ${dir.descHi}`,
        type: 'directory',
        url: dir.url,
        score: 1.05,
        badge: dir.type === 'hub' ? 'Directory' : 'Category',
        icon: dir.icon,
        matchedAs: 'phonetic'
      });
      continue;
    }

    // Priority 3: Directory / Category Prefix or Word-Initial Match
    const isPrefixOrWord = allAliases.some((a, idx) => {
      // Direct prefix
      if (a.startsWith(queryLower) || a.startsWith(romanQuery)) return true;
      if (queryLower.length >= 3) {
        const aNorm = aliasesNorm[idx];
        if (aNorm.startsWith(queryNorm) || aNorm.startsWith(romanQueryNorm)) return true;
      }

      // Word-initial match
      const words = a.split(/[\s\-_/]+/);
      if (words.some(w => w.startsWith(queryLower) || w.startsWith(romanQuery))) return true;
      if (queryLower.length >= 3) {
        const normWords = aliasesNorm[idx].split(/[\s\-_/]+/);
        return normWords.some(w => w.startsWith(queryNorm) || w.startsWith(romanQueryNorm));
      }
      return false;
    });

    if (isPrefixOrWord) {
      addResult({
        id: `dir-${dir.id}`,
        title: `${dir.nameHi} (${dir.nameEn})`,
        subtitle: `📂 ${dir.descHi}`,
        type: 'directory',
        url: dir.url,
        score: 0.95,
        badge: dir.type === 'hub' ? 'Directory' : 'Category',
        icon: dir.icon,
        matchedAs: 'category'
      });
      continue;
    }

    // Priority 4: Typo / Levenshtein Distance (requires >= 4 chars to prevent false positives)
    if (queryLower.length >= 4) {
      let minLev = Infinity;
      for (const aNorm of aliasesNorm) {
        if (Math.abs(aNorm.length - queryNorm.length) > 1) continue;
        const d = levenshtein(queryNorm, aNorm);
        if (d < minLev) minLev = d;
      }
      if (minLev <= 1 || (queryLower.length >= 6 && minLev <= 2)) {
        addResult({
          id: `dir-${dir.id}`,
          title: `${dir.nameHi} (${dir.nameEn})`,
          subtitle: `📂 ${dir.descHi}`,
          type: 'directory',
          url: dir.url,
          score: 0.86,
          badge: dir.type === 'hub' ? 'Directory' : 'Category',
          icon: dir.icon,
          matchedAs: 'typo'
        });
      }
    }
  }

  // 2. SHASTRAS (Scriptures)
  for (const s of getShastraSearchIndex()) {
    // Priority 1: Exact Absolute Match
    if (s.titleLower === queryLower || s.romanTitle === queryLower || s.slugLower === queryLower || s.idLower === queryLower || s.romanTitle === romanQuery) {
      addResult({
        id: `shastra-${s.shastra.id}`,
        title: s.shastra.title,
        subtitle: s.subtitle,
        type: 'shastra',
        url: s.url,
        score: 1.00,
        badge: 'Shastra',
        icon: '📚',
        matchedAs: 'exact'
      });
      continue;
    }

    // Priority 2: Closest Absolute String (Phonetic / Vowel Normalized) - min 3 chars
    if ((queryNorm.length >= 3 && (s.romanTitleNorm === queryNorm || s.romanTitleNorm === romanQueryNorm)) ||
        (queryPhonetic.length >= 3 && s.romanTitlePhonetic === queryPhonetic)) {
      addResult({
        id: `shastra-${s.shastra.id}`,
        title: s.shastra.title,
        subtitle: s.subtitle,
        type: 'shastra',
        url: s.url,
        score: 0.95,
        badge: 'Shastra',
        icon: '📚',
        matchedAs: 'phonetic'
      });
      continue;
    }

    // Priority 3: Title Prefix or Word-Initial Match (Top priority for queries like "sa", "samay", "pravachan")
    const isTitlePrefix =
      s.titleLower.startsWith(queryLower) ||
      s.romanTitle.startsWith(queryLower) ||
      (romanQuery && s.romanTitle.startsWith(romanQuery)) ||
      s.slugLower.startsWith(queryLower) ||
      s.idLower.startsWith(queryLower) ||
      s.titleWords.some(w => w.startsWith(queryLower)) ||
      s.romanWords.some(w => w.startsWith(queryLower) || (romanQuery && w.startsWith(romanQuery)));

    if (isTitlePrefix) {
      addResult({
        id: `shastra-${s.shastra.id}`,
        title: s.shastra.title,
        subtitle: s.subtitle,
        type: 'shastra',
        url: s.url,
        score: 0.88,
        badge: 'Shastra',
        icon: '📚',
        matchedAs: 'exact'
      });
      continue;
    }

    // Author Exact Match
    if (s.authorLower === queryLower || s.romanAuthor === queryLower || (queryNorm.length >= 3 && s.romanAuthorNorm === queryNorm)) {
      addResult({
        id: `shastra-${s.shastra.id}`,
        title: s.shastra.title,
        subtitle: s.subtitle,
        type: 'shastra',
        url: s.url,
        score: 0.90,
        badge: 'Author Match',
        icon: '✍️',
        matchedAs: 'exact'
      });
      continue;
    }

    // Author Prefix Match
    const isAuthorPrefix =
      s.authorLower.startsWith(queryLower) ||
      s.romanAuthor.startsWith(queryLower) ||
      s.authorWords.some(w => w.startsWith(queryLower)) ||
      s.romanAuthorWords.some(w => w.startsWith(queryLower));

    if (isAuthorPrefix) {
      addResult({
        id: `shastra-${s.shastra.id}`,
        title: s.shastra.title,
        subtitle: s.subtitle,
        type: 'shastra',
        url: s.url,
        score: 0.82,
        badge: 'Author Match',
        icon: '✍️',
        matchedAs: 'exact'
      });
      continue;
    }

    // Priority 4: Typo / Levenshtein Distance (requires >= 4 chars to prevent false positives)
    if (queryLower.length >= 4) {
      const dTitle = levenshtein(queryNorm, s.romanTitleNorm);
      if (dTitle <= 2 || dTitle / Math.max(queryNorm.length, s.romanTitleNorm.length) <= 0.3) {
        addResult({
          id: `shastra-${s.shastra.id}`,
          title: s.shastra.title,
          subtitle: s.subtitle,
          type: 'shastra',
          url: s.url,
          score: 0.83,
          badge: 'Shastra',
          icon: '📚',
          matchedAs: 'typo'
        });
        continue;
      }

      const dAuthor = levenshtein(queryNorm, s.romanAuthorNorm);
      if (dAuthor <= 2 || dAuthor / Math.max(queryNorm.length, s.romanAuthorNorm.length) <= 0.3) {
        addResult({
          id: `shastra-${s.shastra.id}`,
          title: s.shastra.title,
          subtitle: s.subtitle,
          type: 'shastra',
          url: s.url,
          score: 0.80,
          badge: 'Author Match',
          icon: '✍️',
          matchedAs: 'typo'
        });
        continue;
      }
    }

    // Priority 5: Partial Substring Match (ONLY for queries >= 3 characters)
    if (queryLower.length >= 3) {
      if (s.titleLower.includes(queryLower) || s.romanTitle.includes(queryLower) || (romanQuery && s.romanTitle.includes(romanQuery))) {
        addResult({
          id: `shastra-${s.shastra.id}`,
          title: s.shastra.title,
          subtitle: s.subtitle,
          type: 'shastra',
          url: s.url,
          score: 0.74,
          badge: 'Shastra',
          icon: '📚',
          matchedAs: 'partial'
        });
        continue;
      }

      if (s.authorLower.includes(queryLower) || s.romanAuthor.includes(queryLower)) {
        addResult({
          id: `shastra-${s.shastra.id}`,
          title: s.shastra.title,
          subtitle: s.subtitle,
          type: 'shastra',
          url: s.url,
          score: 0.70,
          badge: 'Author Match',
          icon: '✍️',
          matchedAs: 'partial'
        });
        continue;
      }
    }
  }

  // 3. BHAJANS
  const bhajanIndex = getSearchIndex();
  for (const entry of bhajanIndex) {
    const b = entry.bhajan;
    const url = `/bhajan/${b.subdivision}/${b.slug}`;
    const singerStr = b.singer ? ` • 🎤 ${b.singer}` : '';
    const subtitle = `🎵 ${b.subdivision.charAt(0).toUpperCase() + b.subdivision.slice(1)} Bhajan${singerStr}`;

    // Priority 1: Exact Absolute String Match on Bhajan Title
    if (entry.titleLower === queryLower || entry.romanTitle === queryLower || (romanQuery && entry.romanTitle === romanQuery)) {
      addResult({
        id: `bhajan-${b.id}`,
        title: b.title,
        subtitle,
        type: 'bhajan',
        url,
        score: 0.98,
        badge: 'Bhajan',
        icon: '🎵',
        matchedAs: 'exact'
      });
      continue;
    }

    // Priority 2: Closest Absolute String in Title Words (min 3 chars)
    if (queryNorm.length >= 3) {
      const isWordMatch = entry.titleWordsNorm.some((wNorm, idx) => {
        if (wNorm === queryNorm || (romanQueryNorm && wNorm === romanQueryNorm)) return true;
        return queryPhonetic.length >= 3 && entry.titleWordsPhonetic[idx] === queryPhonetic;
      });

      if (isWordMatch) {
        addResult({
          id: `bhajan-${b.id}`,
          title: b.title,
          subtitle,
          type: 'bhajan',
          url,
          score: 0.93,
          badge: 'Bhajan',
          icon: '🎵',
          matchedAs: 'phonetic'
        });
        continue;
      }
    }

    // Priority 3: Bhajan Title Prefix or Word-Initial Match
    const isBhajanPrefix =
      entry.titleLower.startsWith(queryLower) ||
      entry.romanTitle.startsWith(queryLower) ||
      (romanQuery && entry.romanTitle.startsWith(romanQuery)) ||
      entry.titleWords.some(w => w.startsWith(queryLower)) ||
      entry.romanWords.some(w => w.startsWith(queryLower) || (romanQuery && w.startsWith(romanQuery)));

    if (isBhajanPrefix) {
      addResult({
        id: `bhajan-${b.id}`,
        title: b.title,
        subtitle,
        type: 'bhajan',
        url,
        score: 0.85,
        badge: 'Bhajan',
        icon: '🎵',
        matchedAs: 'exact'
      });
      continue;
    }

    // Priority 4: Typo / Levenshtein Distance (min 4 chars)
    if (queryLower.length >= 4) {
      let isTypo = false;
      for (const wNorm of entry.titleWordsNorm) {
        if (Math.abs(wNorm.length - queryNorm.length) > 2) continue;
        const d = levenshtein(queryNorm, wNorm);
        if (d <= 1 || (queryNorm.length >= 6 && d <= 2)) {
          isTypo = true;
          break;
        }
      }
      if (isTypo) {
        addResult({
          id: `bhajan-${b.id}`,
          title: b.title,
          subtitle,
          type: 'bhajan',
          url,
          score: 0.81,
          badge: 'Bhajan',
          icon: '🎵',
          matchedAs: 'typo'
        });
        continue;
      }
    }

    // Priority 5: Partial Substring in Title or Tags (ONLY if queryLower.length >= 3)
    if (queryLower.length >= 3) {
      if (entry.titleLower.includes(queryLower) || entry.romanTitle.includes(queryLower) || (romanQuery && entry.romanTitle.includes(romanQuery))) {
        addResult({
          id: `bhajan-${b.id}`,
          title: b.title,
          subtitle,
          type: 'bhajan',
          url,
          score: 0.72,
          badge: 'Bhajan',
          icon: '🎵',
          matchedAs: 'partial'
        });
        continue;
      }

      if (entry.tagsLower.some(t => t.includes(queryLower))) {
        addResult({
          id: `bhajan-${b.id}`,
          title: b.title,
          subtitle,
          type: 'bhajan',
          url,
          score: 0.65,
          badge: 'Tag Match',
          icon: '🏷️',
          matchedAs: 'partial'
        });
        continue;
      }

      // Lyrics Match (min 4 chars)
      if (entry.lyricsLower.includes(queryLower) || (queryLower.length >= 4 && entry.romanLyrics.includes(queryLower))) {
        addResult({
          id: `bhajan-${b.id}`,
          title: b.title,
          subtitle,
          type: 'bhajan',
          url,
          score: 0.55,
          badge: 'Lyrics Match',
          icon: '📜',
          matchedAs: 'partial'
        });
        continue;
      }
    }

    // Hinglish Mapping
    const hindiSynonyms = hinglishToHindi[queryLower];
    if (hindiSynonyms) {
      const synMatch = hindiSynonyms.some(s => entry.titleLower.includes(s) || entry.lyricsLower.includes(s));
      if (synMatch) {
        addResult({
          id: `bhajan-${b.id}`,
          title: b.title,
          subtitle,
          type: 'bhajan',
          url,
          score: 0.58,
          badge: 'Semantic Match',
          icon: '✨',
          matchedAs: 'semantic'
        });
      }
    }
  }

  return Array.from(results.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ─── Scoped Search (Local Directory First with Global Fallback) ───────────────

export interface ScopedSearchOptions {
  limit?: number;
  scope?: {
    pathPrefix?: string;
    subdivisionId?: string;
    categorySlug?: string;
    label?: string;
  };
}

export interface ScopedSearchResponse {
  results: UnifiedSearchResult[];
  isFallback: boolean;
  scopeLabel?: string;
}

export function scopedSiteSearch(query: string, options: ScopedSearchOptions = {}): ScopedSearchResponse {
  if (!query || query.trim().length === 0) {
    return { results: [], isFallback: false };
  }

  const allMatches = siteWideSearch(query, { limit: 50 });
  const limit = options.limit ?? 10;

  if (!options.scope || (!options.scope.pathPrefix && !options.scope.subdivisionId && !options.scope.categorySlug)) {
    return {
      results: allMatches.slice(0, limit),
      isFallback: false
    };
  }

  const { pathPrefix, subdivisionId, categorySlug, label } = options.scope;

  const localMatches = allMatches.filter(r => {
    if (pathPrefix && r.url.startsWith(pathPrefix)) return true;
    if (subdivisionId && r.url.startsWith(`/bhajan/${subdivisionId}`)) return true;
    if (categorySlug && r.url.startsWith(`/shastra/${categorySlug}`)) return true;
    return false;
  });

  if (localMatches.length > 0) {
    return {
      results: localMatches.slice(0, limit),
      isFallback: false,
      scopeLabel: label
    };
  }

  return {
    results: allMatches.slice(0, limit),
    isFallback: true,
    scopeLabel: label
  };
}

// ─── Backward-Compatibility Adapter ──────────────────────────────────────────

export function smartSearch(query: string, options: SmartSearchOptions = {}): SearchResult[] {
  if (!query || query.trim().length === 0) return [];
  const limit = options.limit ?? 10;
  const unified = siteWideSearch(query, { limit: 50 });
  const index = getSearchIndex();
  const bhajanMap = new Map(index.map(e => [e.bhajan.id, e.bhajan]));

  return unified
    .filter(r => r.type === 'bhajan')
    .map(r => {
      const id = r.id.replace('bhajan-', '');
      const bhajan = bhajanMap.get(id);
      if (!bhajan) return null;
      return {
        id,
        title: r.title,
        relevance_score: r.score,
        match_reason: r.subtitle,
        matched_as: (r.matchedAs === 'category' ? 'partial' : r.matchedAs === 'typo' ? 'phonetic' : r.matchedAs) as SearchResult['matched_as'],
        bhajan,
      };
    })
    .filter((r): r is SearchResult => r !== null && (!options.subdivisionId || r.bhajan.subdivision === options.subdivisionId))
    .slice(0, limit);
}
