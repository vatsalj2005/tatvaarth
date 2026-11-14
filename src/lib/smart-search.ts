/**
 * Smart Search Engine for Tatvaarth
 * 
 * Hierarchy:
 * Priority 1: Exact matches as typed. Vowel variations ("aa" vs "a", "ee" vs "i", "oo" vs "u", "ae" vs "ai", "w" vs "v")
 *             are normalized with full priority. Exact character matches ("dh" vs "d", "sh" vs "s") take absolute
 *             precedence over softened consonants (e.g., "dhan" -> "धन" over "दान"). Standalone whole words ("Guru")
 *             are strictly prioritized over partial prefixes of longer words ("Guruvar").
 * Priority 2: Substring & Compound/Sandhi roots anywhere in the word/title (e.g., "Saar" / "sar" -> "समयसार", "प्रवचनसार").
 * Priority 3: Lyrics matches for Bhajans (with contextual snippet preview).
 * 
 * Rules:
 * - Shastras show up before Bhajans on exact/comparable matches.
 * - Directories are placed below scriptures unless the query is an exact match for the directory name or alias (e.g. "guru" -> "Guru Bhajan").
 * - Local directory scope boosts matching items while preserving global exact matches.
 * - Minimum 10 results (graceful degradation with closest matches), maximum 20 results.
 */

import { BhajanData, bhajans } from '@/data/content-loader';
import { transliterateText } from '@/lib/transliterate';
import { getShastras, ShastraMetadata } from '@/data/shastra-loader';
import { siteDirectories, SiteDirectoryItem } from '@/data/site-directory';

// ─── Interfaces ─────────────────────────────────────────────────────────────

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

// ─── Dictionary & Synonym Mappings ──────────────────────────────────────────

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
  'swami': ['स्वामी'], 'bhagwan': ['भगवान'], 'bhagavan': ['भगवान'], 'bhagwaan': ['भगवान'],
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
  'sadhu': ['साधु'], 'sadhvi': ['साध्वी'],
  'muni': ['मुनि', 'मुनिवर'], 'munivar': ['मुनिवर'], 'munivara': ['मुनिवर'], 'mun': ['मुनि', 'मुनिवर'],
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
  'aise': ['ऐसे'], 'aese': ['ऐसे'], 'aisa': ['ऐसा'], 'aysa': ['ऐसा'],
  'kaise': ['कैसे'], 'kaese': ['कैसे'],
  'jaise': ['जैसे'], 'jaese': ['जैसे'],
  'vaise': ['वैसे'], 'vaese': ['वैसे'],
  'dekhe': ['देखे', 'देखें'], 'dekhen': ['देखें', 'देखे'],
  'ashariri': ['अशरीरी'], 'ashareeri': ['अशरीरी'],
  'dhan': ['धन'], 'daan': ['दान'], 'dan': ['दान'],
};

// ─── Normalization Functions ────────────────────────────────────────────────

/**
 * Normalizes vowel lengths & common phonetic representations (Priority 1: "aa" vs "a", "ee" vs "i", etc.)
 * Strictly preserves distinctive consonants like "dh" vs "d" and "sh" vs "s".
 */
export function normalizeHinglish(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/ae/g, 'ai')
    .replace(/ou/g, 'au')
    .replace(/w/g, 'v')
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/ii/g, 'i')
    .replace(/uu/g, 'u')
    .replace(/[^\w\s\u0900-\u097F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Soft consonant normalization used ONLY as a lower-priority fallback (Tier 1C).
 * Preserves ranking difference between "dhan" (धन) and "dan" (दान).
 */
function softenConsonants(str: string): string {
  if (!str) return '';
  return normalizeHinglish(str)
    .replace(/dh/g, 'd')
    .replace(/th/g, 't')
    .replace(/sh/g, 's')
    .replace(/bh/g, 'b')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/ph/g, 'f')
    .replace(/ch/g, 'c');
}

/**
 * Normalizes Devanagari text variations (anusvara, chandrabindu, nasals)
 */
function normalizeDevanagari(str: string): string {
  if (!str) return '';
  return str
    .replace(/[\u0902\u0901]/g, 'ं') // Standardize anusvara & chandrabindu
    .replace(/णमोकार/g, 'नमोकार')
    .replace(/पांच/g, 'पंच')
    .replace(/संवर/g, 'सम्वर')
    .replace(/दिगम्बर/g, 'दिगंबर')
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

// ─── Compound Word Decomposer ───────────────────────────────────────────────

const commonCompoundRoots = [
  'sar', 'saar', 'सार',
  'sutra', 'sootra', 'सूत्र',
  'prakash', 'prakaash', 'प्रकाश',
  'sangraha', 'संग्रह',
  'tantra', 'तन्त्र', 'तंत्र',
  'upadesh', 'उपदेश',
  'prabhrat', 'प्राभृत',
  'tarangini', 'तरंगिणी',
  'doha', 'दोहा',
  'adhyayi', 'अध्यायी',
  'bhajan', 'भजन',
  'stuti', 'स्तुति',
  'pooja', 'puja', 'पूजा',
  'vidhi', 'विधि',
  'path', 'पाठ'
];

function extractCompoundRoots(title: string, romanTitle: string): string[] {
  const roots: string[] = [];
  const tNorm = normalizeHinglish(romanTitle);
  const devNorm = normalizeDevanagari(title);

  for (const root of commonCompoundRoots) {
    const rootNorm = normalizeHinglish(root);
    if (tNorm.includes(rootNorm) || devNorm.includes(root)) {
      roots.push(rootNorm);
      roots.push(root);
    }
  }

  return Array.from(new Set(roots));
}

// ─── Pre-computed Search Indices ────────────────────────────────────────────

interface IndexWord {
  dev: string;
  roman: string;
  vowelNorm: string;
  consonantNorm: string;
}

interface BhajanIndexEntry {
  bhajan: BhajanData;
  titleLower: string;
  romanTitle: string;
  romanTitleNorm: string;
  words: IndexWord[];
  compoundRoots: string[];
  lyricsLines: { dev: string; roman: string; romanNorm: string }[];
  tags: string[];
}

interface ShastraIndexEntry {
  shastra: ShastraMetadata;
  titleLower: string;
  romanTitle: string;
  romanTitleNorm: string;
  slugLower: string;
  idLower: string;
  words: IndexWord[];
  authorWords: IndexWord[];
  compoundRoots: string[];
  url: string;
  subtitle: string;
}

interface DirectoryIndexEntry {
  dir: SiteDirectoryItem;
  primaryNames: string[];
  primaryNamesNorm: string[];
  aliases: string[];
  aliasesNorm: string[];
  words: IndexWord[];
}

let _bhajanIndex: BhajanIndexEntry[] | null = null;
let _shastraIndex: ShastraIndexEntry[] | null = null;
let _dirIndex: DirectoryIndexEntry[] | null = null;

function tokenizeToWords(text: string): IndexWord[] {
  const rawWords = text.split(/[\s\-_/.,;:।॥|()]+/).filter(Boolean);
  return rawWords.map(w => {
    const dev = w.toLowerCase();
    const roman = transliterateText(w).toLowerCase();
    const vowelNorm = normalizeHinglish(roman);
    const consonantNorm = softenConsonants(vowelNorm);
    return { dev, roman, vowelNorm, consonantNorm };
  });
}

function getBhajanIndex(): BhajanIndexEntry[] {
  if (_bhajanIndex) return _bhajanIndex;

  _bhajanIndex = bhajans.map(b => {
    const titleLower = b.title.toLowerCase();
    const romanTitle = transliterateText(b.title).toLowerCase();
    const romanTitleNorm = normalizeHinglish(romanTitle);
    const words = tokenizeToWords(b.title);
    const compoundRoots = extractCompoundRoots(b.title, romanTitle);

    const rawLines = b.lyrics.split('\n').map(l => l.trim()).filter(Boolean);
    const lyricsLines = rawLines.map(line => {
      const dev = line.toLowerCase();
      const roman = transliterateText(line).toLowerCase();
      const romanNorm = normalizeHinglish(roman);
      return { dev, roman, romanNorm };
    });

    return {
      bhajan: b,
      titleLower,
      romanTitle,
      romanTitleNorm,
      words,
      compoundRoots,
      lyricsLines,
      tags: b.tags.map(t => t.toLowerCase())
    };
  });

  return _bhajanIndex;
}

function getShastraIndex(): ShastraIndexEntry[] {
  if (_shastraIndex) return _shastraIndex;

  _shastraIndex = getShastras().map(s => {
    const titleLower = s.title.toLowerCase();
    const romanTitle = transliterateText(s.title).toLowerCase();
    const romanTitleNorm = normalizeHinglish(romanTitle);
    const words = tokenizeToWords(s.title);
    const authorWords = tokenizeToWords(s.author);
    const compoundRoots = extractCompoundRoots(s.title, romanTitle);

    return {
      shastra: s,
      titleLower,
      romanTitle,
      romanTitleNorm,
      slugLower: s.shastraSlug.toLowerCase(),
      idLower: s.id.toLowerCase(),
      words,
      authorWords,
      compoundRoots,
      url: `/shastra/${s.categorySlug}/${s.shastraSlug}`,
      subtitle: `📚 ${s.author} • ${s.categoryHi} (${s.gathaCount} गाथाएं)`
    };
  });

  return _shastraIndex;
}

function getDirectoryIndex(): DirectoryIndexEntry[] {
  if (_dirIndex) return _dirIndex;

  _dirIndex = siteDirectories.map(dir => {
    const primaryNames = [dir.nameEn.toLowerCase(), dir.nameHi.toLowerCase()];
    const primaryNamesNorm = primaryNames.map(p => normalizeHinglish(p));
    const aliases = [...primaryNames, ...dir.aliases.map(a => a.toLowerCase())];
    const aliasesNorm = aliases.map(a => normalizeHinglish(a));
    const words = aliases.flatMap(a => tokenizeToWords(a));

    return {
      dir,
      primaryNames,
      primaryNamesNorm,
      aliases,
      aliasesNorm,
      words
    };
  });

  return _dirIndex;
}

// ─── Query Token Matching & Scoring Engine ──────────────────────────────────

interface MatchEvaluation {
  matched: boolean;
  score: number;
  matchedAs: UnifiedSearchResult['matchedAs'];
  snippet?: string;
}

/**
 * Evaluates how strongly a query matches an item's title words.
 * Considers exact word boundaries, trailing in-progress word prefixes,
 * compound roots, and soft phonetic fallbacks.
 */
function evaluateTitleMatch(
  qTokens: string[],
  fullQuery: string,
  fullQueryNorm: string,
  words: IndexWord[],
  compoundRoots: string[],
  fullTitleLower: string,
  fullTitleRomanNorm: string
): MatchEvaluation {
  if (words.length === 0 || qTokens.length === 0) {
    return { matched: false, score: 0, matchedAs: 'partial' };
  }

  // 1. Absolute Full Title Exact Match
  if (
    fullTitleLower === fullQuery ||
    fullTitleRomanNorm === fullQueryNorm ||
    fullTitleRomanNorm === normalizeHinglish(fullQuery)
  ) {
    return { matched: true, score: 980, matchedAs: 'exact' };
  }

  // 2. Direct Leading Prefix of Whole Title (e.g. "aese muni" -> "aise munivara dekhen...")
  if (fullTitleRomanNorm.startsWith(fullQueryNorm) || fullTitleLower.startsWith(fullQuery)) {
    // If the leading word in query is an exact standalone match on first word
    const firstWordExact = words[0] && (words[0].roman === qTokens[0] || words[0].vowelNorm === normalizeHinglish(qTokens[0]));
    const score = firstWordExact ? 940 : 910;
    return { matched: true, score, matchedAs: 'exact' };
  }

  // 3. Multi-token evaluation across individual words
  let matchedTokens = 0;
  let totalTokenScore = 0;
  let firstWordMatchedExactly = false;

  for (let qIdx = 0; qIdx < qTokens.length; qIdx++) {
    const q = qTokens[qIdx];
    const qNorm = normalizeHinglish(q);
    const qSoft = softenConsonants(qNorm);
    const isTrailingToken = qIdx === qTokens.length - 1;
    const syns = hinglishToHindi[q] || [];

    let bestScoreForToken = 0;

    for (let wIdx = 0; wIdx < words.length; wIdx++) {
      const w = words[wIdx];

      // Synonym match
      if (syns.some(s => w.dev.includes(s) || s.includes(w.dev))) {
        bestScoreForToken = Math.max(bestScoreForToken, 100);
        if (wIdx === 0 && qIdx === 0) firstWordMatchedExactly = true;
        break;
      }

      // Exact word match
      if (w.dev === q || w.roman === q || w.vowelNorm === qNorm) {
        bestScoreForToken = Math.max(bestScoreForToken, 100);
        if (wIdx === 0 && qIdx === 0) firstWordMatchedExactly = true;
        break;
      }

      // Standalone prefix match (especially for the trailing token being typed: "mun" -> "munivar")
      if (w.roman.startsWith(q) || w.vowelNorm.startsWith(qNorm) || w.dev.startsWith(q)) {
        // Penalize excess characters so "guru" strongly prefers "guru" over "guruvar"
        const excess = Math.max(0, w.vowelNorm.length - qNorm.length);
        const prefixScore = isTrailingToken
          ? Math.max(78, 92 - excess * 3)
          : Math.max(70, 85 - excess * 4);
        bestScoreForToken = Math.max(bestScoreForToken, prefixScore);
        continue;
      }

      // Compound root match (e.g. "saar" or "sar" in compound word)
      if (compoundRoots.some(r => r === qNorm || r === q)) {
        bestScoreForToken = Math.max(bestScoreForToken, 85);
        continue;
      }

      // Substring match in word
      if (w.vowelNorm.includes(qNorm) || (qNorm.length >= 3 && qNorm.includes(w.vowelNorm))) {
        bestScoreForToken = Math.max(bestScoreForToken, 72);
        continue;
      }

      // Soft consonant pardoning ("dh" vs "d", "sh" vs "s") - strictly ranked below exact
      if (w.consonantNorm.startsWith(qSoft) || w.consonantNorm === qSoft) {
        bestScoreForToken = Math.max(bestScoreForToken, 55);
        continue;
      }

      // Typo tolerance (Levenshtein <= 1, minimum length 4)
      if (qNorm.length >= 4 && Math.abs(qNorm.length - w.vowelNorm.length) <= 1) {
        if (levenshtein(qNorm, w.vowelNorm) <= 1) {
          bestScoreForToken = Math.max(bestScoreForToken, 48);
        }
      }
    }

    if (bestScoreForToken > 0) {
      matchedTokens++;
      totalTokenScore += bestScoreForToken;
    }
  }

  // All tokens found in title
  if (matchedTokens === qTokens.length) {
    const avgTokenScore = totalTokenScore / qTokens.length;
    let baseScore = 800 + (avgTokenScore / 100) * 110; // 880 - 910
    if (firstWordMatchedExactly) baseScore += 35; // Priority for exact first word
    return {
      matched: true,
      score: Math.min(945, Math.round(baseScore)),
      matchedAs: 'exact'
    };
  }

  // Single word query matching a compound root (e.g. "saar" -> "समयसार")
  if (qTokens.length === 1 && compoundRoots.some(r => r === qTokens[0] || r === normalizeHinglish(qTokens[0]))) {
    return {
      matched: true,
      score: 750,
      matchedAs: 'partial'
    };
  }

  // Substring anywhere in the normalized full title
  if (fullTitleRomanNorm.includes(fullQueryNorm) && fullQueryNorm.length >= 3) {
    return {
      matched: true,
      score: 680,
      matchedAs: 'partial'
    };
  }

  return { matched: false, score: 0, matchedAs: 'partial' };
}

// ─── Site-Wide Search ───────────────────────────────────────────────────────

export function siteWideSearch(query: string, options: { limit?: number } = {}): UnifiedSearchResult[] {
  if (!query || query.trim().length === 0) return [];

  const rawQuery = query.trim();
  const queryLower = rawQuery.toLowerCase();
  const queryNorm = normalizeHinglish(queryLower);
  const qTokens = queryLower.split(/[\s\-_/.,;:।॥|()]+/).filter(Boolean);
  const maxLimit = Math.max(10, Math.min(20, options.limit ?? 20));

  const candidates: UnifiedSearchResult[] = [];

  // ─── 1. DIRECTORIES ───────────────────────────────────────────────────────
  for (const entry of getDirectoryIndex()) {
    const dir = entry.dir;
    const isExactName = entry.primaryNames.includes(queryLower) || entry.primaryNamesNorm.includes(queryNorm);
    const isExactAlias = entry.aliases.includes(queryLower) || entry.aliasesNorm.includes(queryNorm);

    // Literal exact match on directory name or alias (e.g. "guru" -> "Guru Bhajan")
    if (isExactName || isExactAlias) {
      candidates.push({
        id: `dir-${dir.id}`,
        title: `${dir.nameHi} (${dir.nameEn})`,
        subtitle: `📂 ${dir.descHi}`,
        type: 'directory',
        url: dir.url,
        score: 935, // High priority matching exact word
        badge: dir.type === 'hub' ? 'Directory' : 'Category',
        icon: dir.icon,
        matchedAs: 'exact'
      });
      continue;
    }

    // Prefix match on primary directory name (e.g. "bha" -> "Bhajan Directory")
    const isPrimaryPrefix = entry.primaryNamesNorm.some(p => p.startsWith(queryNorm));
    if (isPrimaryPrefix) {
      candidates.push({
        id: `dir-${dir.id}`,
        title: `${dir.nameHi} (${dir.nameEn})`,
        subtitle: `📂 ${dir.descHi}`,
        type: 'directory',
        url: dir.url,
        score: 720,
        badge: dir.type === 'hub' ? 'Directory' : 'Category',
        icon: dir.icon,
        matchedAs: 'category'
      });
      continue;
    }

    // Word match in aliases
    const isAliasWordMatch = entry.aliasesNorm.some(a => {
      const words = a.split(/\s+/);
      return words.some(w => w === queryNorm || (queryNorm.length >= 3 && w.startsWith(queryNorm)));
    });

    if (isAliasWordMatch) {
      candidates.push({
        id: `dir-${dir.id}`,
        title: `${dir.nameHi} (${dir.nameEn})`,
        subtitle: `📂 ${dir.descHi}`,
        type: 'directory',
        url: dir.url,
        score: 640,
        badge: dir.type === 'hub' ? 'Directory' : 'Category',
        icon: dir.icon,
        matchedAs: 'category'
      });
    }
  }

  // ─── 2. SHASTRAS (Scriptures - Priority over Bhajans on exact matches) ─────
  for (const s of getShastraIndex()) {
    // Title evaluation
    const evalResult = evaluateTitleMatch(
      qTokens,
      queryLower,
      queryNorm,
      s.words,
      s.compoundRoots,
      s.titleLower,
      s.romanTitleNorm
    );

    if (evalResult.matched) {
      // Shastras get a +15 type bonus over Bhajans for equal match tier
      const finalScore = Math.min(1000, evalResult.score + 15);
      candidates.push({
        id: `shastra-${s.shastra.id}`,
        title: s.shastra.title,
        subtitle: s.subtitle,
        type: 'shastra',
        url: s.url,
        score: finalScore,
        badge: 'Shastra',
        icon: '📚',
        matchedAs: evalResult.matchedAs
      });
      continue;
    }

    // Author evaluation (e.g. Kundkund, Umaswami)
    const authorEval = evaluateTitleMatch(
      qTokens,
      queryLower,
      queryNorm,
      s.authorWords,
      [],
      s.shastra.author.toLowerCase(),
      normalizeHinglish(transliterateText(s.shastra.author))
    );

    if (authorEval.matched) {
      candidates.push({
        id: `shastra-${s.shastra.id}`,
        title: s.shastra.title,
        subtitle: s.subtitle,
        type: 'shastra',
        url: s.url,
        score: Math.min(850, authorEval.score - 50),
        badge: 'Author Match',
        icon: '✍️',
        matchedAs: authorEval.matchedAs
      });
    }
  }

  // ─── 3. BHAJANS ───────────────────────────────────────────────────────────
  for (const b of getBhajanIndex()) {
    const subdivisionCap = b.bhajan.subdivision.charAt(0).toUpperCase() + b.bhajan.subdivision.slice(1);
    const singerStr = b.bhajan.singer ? ` • 🎤 ${b.bhajan.singer}` : '';
    const baseSubtitle = `🎵 ${subdivisionCap} Bhajan${singerStr}`;
    const url = `/bhajan/${b.bhajan.subdivision}/${b.bhajan.slug}`;

    // Title evaluation
    const evalResult = evaluateTitleMatch(
      qTokens,
      queryLower,
      queryNorm,
      b.words,
      b.compoundRoots,
      b.titleLower,
      b.romanTitleNorm
    );

    if (evalResult.matched) {
      candidates.push({
        id: `bhajan-${b.bhajan.id}`,
        title: b.bhajan.title,
        subtitle: baseSubtitle,
        type: 'bhajan',
        url,
        score: evalResult.score,
        badge: 'Bhajan',
        icon: '🎵',
        matchedAs: evalResult.matchedAs
      });
      continue;
    }

    // Tag matching
    if (queryNorm.length >= 3 && b.tags.some(t => t.includes(queryNorm))) {
      candidates.push({
        id: `bhajan-${b.bhajan.id}`,
        title: b.bhajan.title,
        subtitle: baseSubtitle,
        type: 'bhajan',
        url,
        score: 610,
        badge: 'Tag Match',
        icon: '🏷️',
        matchedAs: 'partial'
      });
      continue;
    }

    // Lyrics Match (Priority 3: strictly below title matches)
    if (queryNorm.length >= 3) {
      let matchedSnippet: string | null = null;
      let lyricsScore = 0;

      for (const line of b.lyricsLines) {
        if (line.dev.includes(queryLower) || line.romanNorm.includes(queryNorm)) {
          matchedSnippet = line.dev.length > 55 ? `${line.dev.slice(0, 52)}...` : line.dev;
          lyricsScore = 490;
          break;
        }

        // Multi-token search in line
        if (qTokens.length > 1) {
          const allTokensInLine = qTokens.every(q => {
            const qN = normalizeHinglish(q);
            return line.romanNorm.includes(qN) || line.dev.includes(q);
          });
          if (allTokensInLine) {
            matchedSnippet = line.dev.length > 55 ? `${line.dev.slice(0, 52)}...` : line.dev;
            lyricsScore = 460;
            break;
          }
        }
      }

      if (matchedSnippet) {
        candidates.push({
          id: `bhajan-${b.bhajan.id}`,
          title: b.bhajan.title,
          subtitle: `📜 "... ${matchedSnippet} ..."`,
          type: 'bhajan',
          url,
          score: lyricsScore,
          badge: 'Lyrics Match',
          icon: '📜',
          matchedAs: 'partial'
        });
      }
    }
  }

  // ─── Deduplication, Scoring Sort & Results Windowing ──────────────────────
  const uniqueMap = new Map<string, UnifiedSearchResult>();
  for (const item of candidates) {
    const existing = uniqueMap.get(item.id);
    if (!existing || existing.score < item.score) {
      uniqueMap.set(item.id, item);
    }
  }

  const sorted = Array.from(uniqueMap.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-breaker: Shastras before Bhajans
    if (a.type !== b.type) {
      if (a.type === 'shastra') return -1;
      if (b.type === 'shastra') return 1;
    }
    // Shorter titles rank before longer titles on equal score
    return a.title.length - b.title.length;
  });

  // Result counts: 20 max, 10 minimum if available
  const topTier = sorted.filter(r => r.score >= 600);
  if (topTier.length >= 10) {
    return sorted.slice(0, maxLimit);
  }

  // If fewer than 10 top matches, include lower-tier lyrics & partial matches up to 10 minimum
  return sorted.slice(0, Math.max(10, Math.min(maxLimit, sorted.length)));
}

// ─── Scoped Search (Local Directory First with Global Fallback) ───────────────

export function scopedSiteSearch(query: string, options: ScopedSearchOptions = {}): ScopedSearchResponse {
  if (!query || query.trim().length === 0) {
    return { results: [], isFallback: false };
  }

  const allMatches = siteWideSearch(query, { limit: 30 });
  const limit = Math.max(10, Math.min(20, options.limit ?? 20));

  if (!options.scope || (!options.scope.pathPrefix && !options.scope.subdivisionId && !options.scope.categorySlug)) {
    return {
      results: allMatches.slice(0, limit),
      isFallback: false
    };
  }

  const { pathPrefix, subdivisionId, categorySlug, label } = options.scope;

  // Apply context boost (+50) to local scoped items so they float to the top
  const scoredScoped = allMatches.map(r => {
    let isLocal = false;
    if (pathPrefix && r.url.startsWith(pathPrefix)) isLocal = true;
    if (subdivisionId && r.url.startsWith(`/bhajan/${subdivisionId}`)) isLocal = true;
    if (categorySlug && r.url.startsWith(`/shastra/${categorySlug}`)) isLocal = true;

    if (isLocal) {
      return { ...r, score: r.score + 50 };
    }
    return r;
  });

  // Re-sort with scoped boost
  scoredScoped.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.title.length - b.title.length;
  });

  const localMatches = scoredScoped.filter(r => {
    if (pathPrefix && r.url.startsWith(pathPrefix)) return true;
    if (subdivisionId && r.url.startsWith(`/bhajan/${subdivisionId}`)) return true;
    if (categorySlug && r.url.startsWith(`/shastra/${categorySlug}`)) return true;
    return false;
  });

  if (localMatches.length > 0) {
    return {
      results: scoredScoped.slice(0, limit),
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
  const limit = options.limit ?? 20;
  const unified = siteWideSearch(query, { limit: 30 });
  const index = getBhajanIndex();
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
