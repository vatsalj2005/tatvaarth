/**
 * Filesystem-based content loader using Vite's import.meta.glob
 * Automatically discovers bhajans from /src/content/ at build time.
 */

import { transliterateToRoman } from '../lib/transliterate';

export interface BhajanData {
  id: string;
  slug: string;
  subdivision: string;
  title: string;
  singer?: string;
  tags: string[];
  lyrics: string;
  audioUrl?: string;
}

export interface SubdivisionData {
  id: string;
  nameHi: string;
  nameEn: string;
  descHi: string;
  descEn: string;
  icon: string;
}

export const subdivisions: SubdivisionData[] = [
  { id: 'dev', nameHi: 'देव भजन', nameEn: 'Dev Bhajan', descHi: 'तीर्थंकर और देवों के भजन', descEn: 'Bhajans of Tirthankaras and Deities', icon: '🙏' },
  { id: 'shastra', nameHi: 'शास्त्र भजन', nameEn: 'Shastra Bhajan', descHi: 'शास्त्रों पर आधारित भजन', descEn: 'Bhajans based on scriptures', icon: '📜' },
  { id: 'guru', nameHi: 'गुरु भजन', nameEn: 'Guru Bhajan', descHi: 'गुरु महिमा के भजन', descEn: 'Bhajans glorifying Gurus', icon: '🙏' },
  { id: 'bhakti', nameHi: 'भक्ति भजन', nameEn: 'Bhakti Bhajan', descHi: 'भक्ति और आराधना के भजन', descEn: 'Devotional and worship bhajans', icon: '🎵' },
];

// Hindi stopwords to exclude from tag generation
const hindiStopwords = new Set([
  'का', 'के', 'की', 'को', 'में', 'से', 'है', 'हैं', 'था', 'थे', 'थी', 'हो', 'और', 'या', 'तो', 'ही',
  'भी', 'तुम', 'तुम्हारी', 'तुम्हारा', 'मैं', 'हम', 'यह', 'वह', 'इस', 'उस', 'एक', 'दो', 'तीन',
]);

/**
 * Clean and romanize Devanagari slugs for URLs
 */
function getRomanizedSlug(originalSlug: string): string {
  const roman = transliterateToRoman(originalSlug);
  return roman
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate title from filename
 * If filename contains Hindi characters, use as-is
 * If filename is in English (hyphens/underscores), convert to title case
 * Example: mahavir-prabhu-vandana -> Mahavir Prabhu Vandana
 * Example: महावीर_स्वामी_की_जय -> महावीर स्वामी की जय
 */
function generateTitleFromFilename(filename: string): string {
  // Replace double dashes with colon and space
  let title = filename.replace(/--/g, ': ');
  // Replace remaining hyphens and underscores with spaces
  title = title.replace(/[-_]/g, ' ');
  // Clean up extra spaces
  title = title.replace(/\s+/g, ' ').trim();

  // Check if filename contains Devanagari characters
  const hasHindi = /[\u0900-\u097F]/.test(title);
  
  if (hasHindi) {
    return title;
  } else {
    // English filename - convert to title case
    return title
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

/**
 * Extract meaningful tags from Hindi text
 */
function extractTags(text: string): string[] {
  // Split by whitespace and punctuation
  const words = text.split(/[\s।॥,;.!?\-—()[\]{}]+/);
  const wordFreq: Record<string, number> = {};
  
  words.forEach(word => {
    const cleaned = word.trim();
    if (cleaned.length > 2 && !hindiStopwords.has(cleaned)) {
      wordFreq[cleaned] = (wordFreq[cleaned] || 0) + 1;
    }
  });
  
  // Get top 5 most frequent meaningful words
  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word.toLowerCase());
}

/**
 * Parse frontmatter if exists, otherwise return raw content
 */
function parseFrontmatter(raw: string): { metadata: Record<string, string>; content: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { metadata: {}, content: raw.trim() };
  const metadata: Record<string, string> = {};
  match[1].split('\n').forEach(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      if (key && value) metadata[key] = value;
    }
  });
  return { metadata, content: match[2].trim() };
}

const bhajanFiles = import.meta.glob('../content/bhajans/**/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function buildBhajans(): BhajanData[] {
  const results: BhajanData[] = [];

  for (const [filePath, rawContent] of Object.entries(bhajanFiles)) {
    const pathMatch = filePath.match(/\/content\/bhajans\/([^/]+)\/([^/]+)\.txt$/);
    if (!pathMatch) continue;

    const subdivision = pathMatch[1];
    const originalSlug = pathMatch[2];
    const romanizedSlug = getRomanizedSlug(originalSlug);
    
    // Parse content (support both old metadata format and new plain text)
    const { metadata, content } = parseFrontmatter(rawContent);
    
    // Generate title from filename
    const title = metadata.title || generateTitleFromFilename(originalSlug);
    
    // Extract tags dynamically from content
    const tags = extractTags(content);

    results.push({
      id: `${subdivision}/${romanizedSlug}`,
      slug: romanizedSlug,
      subdivision,
      title,
      singer: metadata.singer,
      tags,
      lyrics: content,
      audioUrl: undefined,
    });
  }

  return results;
}

export const bhajans: BhajanData[] = buildBhajans();

export const getBhajansBySubdivision = (subdivisionId: string) =>
  bhajans.filter(b => b.subdivision === subdivisionId);

export const getBhajanById = (subdivisionId: string, bhajanSlug: string) =>
  bhajans.find(b => b.subdivision === subdivisionId && b.slug === bhajanSlug);

export const getRelatedBhajans = (bhajan: BhajanData, limit = 4): BhajanData[] => {
  if (!bhajan.tags.length) {
    return bhajans.filter(b => b.id !== bhajan.id && b.subdivision === bhajan.subdivision).slice(0, limit);
  }
  const scored = bhajans
    .filter(b => b.id !== bhajan.id)
    .map(b => ({
      bhajan: b,
      score: b.tags.filter(t => bhajan.tags.includes(t)).length + (b.subdivision === bhajan.subdivision ? 0.5 : 0),
    }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.bhajan);
};
