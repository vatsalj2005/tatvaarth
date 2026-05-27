/**
 * Smart Search Engine for Tatvaarth
 * 
 * Handles:
 * - Hinglish → Hindi transliteration
 * - Fuzzy / phonetic matching with vowel-length normalization
 * - Semantic & mood inference
 * - Partial / prefix matching
 * - Typo tolerance
 */

import { BhajanData, bhajans } from '@/data/content-loader';
import { transliterateText } from '@/lib/transliterate';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  title: string;
  relevance_score: number;
  match_reason: string;
  matched_as: 'exact' | 'transliterated' | 'semantic' | 'phonetic' | 'partial';
  bhajan: BhajanData;
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

// ─── Semantic Mood / Theme Mapping ───────────────────────────────────────────

const semanticMoodMap: Record<string, string[]> = {
  'devotion': ['भक्ति', 'प्रभु', 'भगवान', 'पूजा', 'आराधना', 'वंदना', 'स्तुति'],
  'devotional': ['भक्ति', 'प्रभु', 'भगवान', 'पूजा', 'आराधना'],
  'prayer': ['प्रार्थना', 'वंदना', 'स्तुति', 'नमन', 'नमस्कार'],
  'peace': ['शांति', 'शान्ति', 'विश्राम', 'सुख'],
  'peaceful': ['शांति', 'शान्ति', 'शीतल', 'सुख'],
  'surrender': ['समर्पण', 'शरण', 'चरण', 'प्रभु'],
  'renunciation': ['त्याग', 'वैराग्य', 'मोक्ष', 'तप', 'तपस्या'],
  'detachment': ['वैराग्य', 'विरक्ति', 'त्याग'],
  'liberation': ['मोक्ष', 'मुक्ति', 'निर्वाण', 'कैवल्य'],
  'freedom': ['मुक्ति', 'मोक्ष', 'स्वतंत्र'],
  'knowledge': ['ज्ञान', 'विद्या', 'बोध', 'प्रज्ञा'],
  'wisdom': ['ज्ञान', 'बुद्धि', 'विवेक'],
  'compassion': ['दया', 'करुणा', 'अहिंसा'],
  'love': ['प्रेम', 'प्यार', 'स्नेह', 'भक्ति'],
  'praise': ['स्तुति', 'महिमा', 'गुणगान', 'जय'],
  'morning': ['प्रभात', 'सुबह', 'भोर', 'उषा'],
  'evening': ['संध्या', 'शाम', 'सायं'],
  'celebration': ['जय', 'उत्सव', 'महोत्सव', 'जश्न'],
  'victory': ['जय', 'विजय'],
  'blessing': ['आशीर्वाद', 'कृपा', 'दया'],
  'grace': ['कृपा', 'दया', 'आशीर्वाद'],
  'sacred': ['पवित्र', 'शुद्ध', 'पावन'],
  'holy': ['पवित्र', 'पावन', 'पुण्य'],
  'beautiful': ['सुंदर', 'मनोहर', 'रूप'],
  'soul': ['आत्मा', 'जीव', 'अंतरात्मा'],
  'god': ['प्रभु', 'भगवान', 'ईश्वर', 'परमात्मा'],
  'lord': ['प्रभु', 'भगवान', 'स्वामी', 'नाथ'],
  'feet': ['चरण', 'पद', 'पाद'],
  'teacher': ['गुरु', 'आचार्य', 'उपाध्याय'],
  'saint': ['मुनि', 'साधु', 'संत'],
  'temple': ['मंदिर', 'जिनालय', 'देरासर'],
  'worship': ['पूजा', 'अर्चना', 'आराधना', 'भक्ति'],
  'meditation': ['ध्यान', 'समाधि', 'सामायिक'],
  'truth': ['सत्य', 'सच'],
  'nonviolence': ['अहिंसा'],
  'forgiveness': ['क्षमा', 'माफ़ी'],
  'happiness': ['सुख', 'आनंद', 'खुशी'],
  'happy': ['सुख', 'आनंद', 'खुशी'],
  'joy': ['आनंद', 'हर्ष', 'प्रसन्न'],
  'sad': ['दुख', 'पीड़ा', 'वेदना'],
  'suffering': ['दुख', 'पीड़ा', 'कष्ट'],
  'life': ['जीवन', 'जिंदगी', 'संसार'],
  'world': ['संसार', 'लोक', 'जग', 'जगत'],
  'shradha': ['श्रद्धा'], 'shraddha': ['श्रद्धा'],
  'samarpan': ['समर्पण'], 'sharan': ['शरण'],
  'kshama': ['क्षमा'], 'vinay': ['विनय'],
  'sukh': ['सुख'], 'dukh': ['दुख'], 'anand': ['आनंद'],
};

// ─── Vowel-Length Normalization ───────────────────────────────────────────────

/**
 * Normalize a romanized string by collapsing vowel-length differences.
 * "tumhaare" and "tumhare" both become "tumhare".
 * This is the KEY fix for Hinglish matching.
 */
function normalizeVowelLength(str: string): string {
  return str
    .toLowerCase()
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/ii/g, 'i')
    .replace(/uu/g, 'u');
}

/**
 * Normalize for phonetic comparison — collapse aspirates and vowels entirely.
 */
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

/**
 * Levenshtein distance for typo tolerance
 */
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

// ─── Pre-computed Search Index ───────────────────────────────────────────────

interface SearchIndexEntry {
  bhajan: BhajanData;
  titleLower: string;
  lyricsLower: string;
  romanTitle: string;
  romanLyrics: string;
  // Vowel-normalized versions for flexible matching
  romanTitleNorm: string;
  romanLyricsNorm: string;
  singerLower: string;
  tagsLower: string[];
  allText: string;
}

let _searchIndex: SearchIndexEntry[] | null = null;

function getSearchIndex(): SearchIndexEntry[] {
  if (_searchIndex) return _searchIndex;

  _searchIndex = bhajans.map(b => {
    const romanTitle = transliterateText(b.title).toLowerCase();
    const romanLyrics = transliterateText(b.lyrics).toLowerCase();
    const titleLower = b.title.toLowerCase();
    const lyricsLower = b.lyrics.toLowerCase();
    const singerLower = (b.singer || '').toLowerCase();
    const tagsLower = b.tags.map(t => t.toLowerCase());

    return {
      bhajan: b,
      titleLower,
      lyricsLower,
      romanTitle,
      romanLyrics,
      romanTitleNorm: normalizeVowelLength(romanTitle),
      romanLyricsNorm: normalizeVowelLength(romanLyrics),
      singerLower,
      tagsLower,
      allText: `${titleLower} ${lyricsLower} ${romanTitle} ${romanLyrics} ${singerLower} ${tagsLower.join(' ')}`,
    };
  });

  return _searchIndex;
}

// ─── Core Search Function ────────────────────────────────────────────────────

export interface SmartSearchOptions {
  /** If set, only return results from this subdivision */
  subdivisionId?: string;
  /** Maximum results to return */
  limit?: number;
}

export function smartSearch(query: string, options: SmartSearchOptions = {}): SearchResult[] {
  if (!query || query.trim().length === 0) return [];

  const rawQuery = query.trim();
  const queryLower = rawQuery.toLowerCase();
  const queryNorm = normalizeVowelLength(queryLower);
  const limit = options.limit ?? 10;

  let index = getSearchIndex();

  // Filter by subdivision if specified
  if (options.subdivisionId) {
    index = index.filter(e => e.bhajan.subdivision === options.subdivisionId);
  }

  const results: Map<string, SearchResult> = new Map();

  function addResult(
    entry: SearchIndexEntry,
    score: number,
    reason: string,
    matchType: SearchResult['matched_as']
  ) {
    const existing = results.get(entry.bhajan.id);
    if (!existing || existing.relevance_score < score) {
      results.set(entry.bhajan.id, {
        id: entry.bhajan.id,
        title: entry.bhajan.title,
        relevance_score: Math.min(score, 1.0),
        match_reason: reason,
        matched_as: matchType,
        bhajan: entry.bhajan,
      });
    }
  }

  // ── Pass 1: Exact & partial matching on Hindi text ────────────────────────

  for (const entry of index) {
    if (entry.titleLower === queryLower || entry.titleLower.includes(queryLower)) {
      const isExact = entry.titleLower === queryLower;
      addResult(entry, isExact ? 1.0 : 0.95, entry.bhajan.title, 'exact');
      continue;
    }
    if (entry.lyricsLower.includes(queryLower)) {
      addResult(entry, 0.85, entry.bhajan.title, 'exact');
    }
    if (entry.singerLower && entry.singerLower.includes(queryLower)) {
      addResult(entry, 0.8, `🎤 ${entry.bhajan.singer}`, 'exact');
    }
    if (entry.tagsLower.some(t => t.includes(queryLower))) {
      addResult(entry, 0.75, entry.bhajan.title, 'exact');
    }
  }

  // ── Pass 2: Romanized matching (exact + vowel-normalized) ─────────────────

  for (const entry of index) {
    if (results.has(entry.bhajan.id) && results.get(entry.bhajan.id)!.relevance_score >= 0.85) continue;

    // Exact roman match
    if (entry.romanTitle.includes(queryLower)) {
      addResult(entry, 0.92, entry.bhajan.title, 'transliterated');
      continue;
    }

    // Vowel-normalized match (this is what catches "tumhare" → "tumhaare")
    if (entry.romanTitleNorm.includes(queryNorm)) {
      addResult(entry, 0.9, entry.bhajan.title, 'transliterated');
      continue;
    }

    // Roman lyrics match
    if (entry.romanLyrics.includes(queryLower)) {
      addResult(entry, 0.8, entry.bhajan.title, 'transliterated');
      continue;
    }

    // Vowel-normalized lyrics match
    if (entry.romanLyricsNorm.includes(queryNorm)) {
      addResult(entry, 0.78, entry.bhajan.title, 'transliterated');
    }
  }

  // ── Pass 3: Hinglish → Hindi transliteration lookup ───────────────────────

  const queryWords = queryLower.split(/\s+/);
  const hindiExpansions: string[] = [];

  for (const word of queryWords) {
    // Direct match
    if (hinglishToHindi[word]) {
      hindiExpansions.push(...hinglishToHindi[word]);
    }
    // Also try vowel-normalized key lookup
    const wordNorm = normalizeVowelLength(word);
    for (const [key, vals] of Object.entries(hinglishToHindi)) {
      const keyNorm = normalizeVowelLength(key);
      if (keyNorm === wordNorm && key !== word) {
        hindiExpansions.push(...vals);
      }
      // Prefix match
      if (key.startsWith(word) && key !== word) {
        hindiExpansions.push(...vals);
      }
      if (keyNorm.startsWith(wordNorm) && keyNorm !== wordNorm) {
        hindiExpansions.push(...vals);
      }
    }
  }

  if (hindiExpansions.length > 0) {
    const uniqueExpansions = [...new Set(hindiExpansions)];
    for (const entry of index) {
      if (results.has(entry.bhajan.id) && results.get(entry.bhajan.id)!.relevance_score >= 0.85) continue;

      for (const hindiWord of uniqueExpansions) {
        if (entry.titleLower.includes(hindiWord)) {
          addResult(entry, 0.88, entry.bhajan.title, 'transliterated');
          break;
        }
        if (entry.lyricsLower.includes(hindiWord)) {
          addResult(entry, 0.78, entry.bhajan.title, 'transliterated');
          break;
        }
      }
    }
  }

  // ── Pass 4: Semantic / mood inference ─────────────────────────────────────

  const semanticHindiKeywords: string[] = [];
  for (const word of queryWords) {
    if (semanticMoodMap[word]) {
      semanticHindiKeywords.push(...semanticMoodMap[word]);
    }
    for (const [key, vals] of Object.entries(semanticMoodMap)) {
      if (key.startsWith(word) && word.length >= 3) {
        semanticHindiKeywords.push(...vals);
      }
    }
  }

  if (semanticHindiKeywords.length > 0) {
    const uniqueSemantic = [...new Set(semanticHindiKeywords)];
    for (const entry of index) {
      if (results.has(entry.bhajan.id) && results.get(entry.bhajan.id)!.relevance_score >= 0.75) continue;

      let matchCount = 0;
      for (const kw of uniqueSemantic) {
        if (entry.lyricsLower.includes(kw) || entry.titleLower.includes(kw)) {
          matchCount++;
        }
      }

      if (matchCount > 0) {
        const score = Math.min(0.5 + matchCount * 0.1, 0.72);
        addResult(entry, score, entry.bhajan.title, 'semantic');
      }
    }
  }

  // ── Pass 5: Partial / prefix matching on romanized words ──────────────────

  if (queryLower.length >= 2) {
    for (const entry of index) {
      if (results.has(entry.bhajan.id)) continue;

      // Check title words (both exact and normalized)
      const romanWords = entry.romanTitle.split(/\s+/);
      const matchedWord = romanWords.find(w =>
        w.startsWith(queryLower) || normalizeVowelLength(w).startsWith(queryNorm)
      );
      if (matchedWord) {
        addResult(entry, 0.6, entry.bhajan.title, 'partial');
        continue;
      }

      // Check lyrics prefix (first 500 chars)
      const lyricsSnippet = entry.romanLyrics.slice(0, 500);
      const lyricWords = lyricsSnippet.split(/\s+/);
      const lyricMatch = lyricWords.find(w =>
        w.startsWith(queryLower) || normalizeVowelLength(w).startsWith(queryNorm)
      );
      if (lyricMatch) {
        addResult(entry, 0.5, entry.bhajan.title, 'partial');
      }
    }
  }

  // ── Pass 6: Phonetic / typo tolerance ─────────────────────────────────────

  if (results.size < 5 && queryLower.length >= 3) {
    const queryPhonetic = phoneticNormalize(queryLower);

    for (const entry of index) {
      if (results.has(entry.bhajan.id)) continue;

      const titleWords = entry.romanTitle.split(/\s+/);
      for (const tw of titleWords) {
        const twPhonetic = phoneticNormalize(tw);
        if (twPhonetic.length === 0 || queryPhonetic.length === 0) continue;

        if (twPhonetic.includes(queryPhonetic) || queryPhonetic.includes(twPhonetic)) {
          addResult(entry, 0.45, entry.bhajan.title, 'phonetic');
          break;
        }

        if (queryLower.length <= 10 && tw.length <= 12) {
          const dist = levenshtein(queryLower, tw);
          const maxLen = Math.max(queryLower.length, tw.length);
          if (dist <= Math.ceil(maxLen * 0.35)) {
            addResult(entry, Math.max(0.3, 0.5 - dist * 0.05), entry.bhajan.title, 'phonetic');
            break;
          }
        }
      }
    }
  }

  // ── Pass 7: Fuzzy substring in all text ───────────────────────────────────

  if (results.size === 0 && queryLower.length >= 2) {
    for (const word of queryWords) {
      if (word.length < 2) continue;
      const wordNorm = normalizeVowelLength(word);
      for (const entry of index) {
        if (results.has(entry.bhajan.id)) continue;
        if (entry.allText.includes(word) || normalizeVowelLength(entry.allText).includes(wordNorm)) {
          addResult(entry, 0.3, entry.bhajan.title, 'partial');
        }
      }
    }
  }

  // ── Last resort: phonetically closest ─────────────────────────────────────

  if (results.size === 0 && queryLower.length >= 2) {
    const scored: { entry: SearchIndexEntry; dist: number }[] = [];
    for (const entry of index) {
      const titleWords = entry.romanTitle.split(/\s+/);
      let bestDist = Infinity;
      for (const tw of titleWords) {
        if (tw.length < 2) continue;
        const dist = levenshtein(queryNorm, normalizeVowelLength(tw));
        if (dist < bestDist) bestDist = dist;
      }
      scored.push({ entry, dist: bestDist });
    }
    scored.sort((a, b) => a.dist - b.dist);
    for (const { entry } of scored.slice(0, 3)) {
      addResult(entry, 0.15, entry.bhajan.title, 'phonetic');
    }
  }

  // Sort and limit
  return Array.from(results.values())
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, limit);
}
