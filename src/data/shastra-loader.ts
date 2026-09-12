import globalManifest from '../content/granth/manifest.json';

export interface ShastraMetadata {
  id: string;
  title: string;
  author: string;
  categoryHi: string;
  categoryEn: string;
  categorySlug: string;
  shastraSlug: string;
  path: string;
  gathaCount: number;
}

export interface GathaItem {
  file: string;
  gathaNum: string;
  title: string;
}

export interface Chapter {
  name: string;
  items: GathaItem[];
}

export interface ShastraCover {
  invocation?: string;
  authorPrefix?: string;
  title?: string;
  subtitle?: string;
  credits?: string;
}

export interface ShastraIndex {
  title: string;
  author: string;
  category: string;
  cover?: ShastraCover;
  chapters: Chapter[];
}

export interface TeekaData {
  commentator: string;
  sanskrit?: string;
  hindi: string;
}

export interface GathaContent {
  title: string;
  gatha: string;
  gathaS: string;
  gadya: string;
  anvayarth: string;
  bhavarth: string;
  english: string;
  teekas: TeekaData[];
}

// 1. Eagerly load all index.json metadata files for the shastras
const shastraIndices = import.meta.glob('../content/granth/**/index.json', { eager: true }) as Record<string, any>;

// 2. Lazily load gatha text files on-demand for the active scripture
const gathaTextLoaders = import.meta.glob('../content/granth/**/*.txt', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

// Pre-indexed scripture metadata map for O(1) slug lookups
const shastrasList = globalManifest as ShastraMetadata[];
const shastraBySlug = new Map<string, ShastraMetadata>(shastrasList.map(s => [s.shastraSlug, s]));

// Memory caches for parsed indices and gathas
const shastraIndexCache = new Map<string, ShastraIndex | null>();
const gathaParsedCache = new Map<string, GathaContent | null>();

// Helper: Parse the custom formatted gatha text
export function parseGathaText(raw: string): GathaContent {
  const sections: Record<string, string> = {};
  
  // Split on "=== Section Name ==="
  const regex = /^===\s*([\s\S]+?)\s*===$/gm;
  const parts = raw.split(regex);
  
  for (let i = 1; i < parts.length; i += 2) {
    const key = parts[i].trim();
    const val = parts[i + 1] ? parts[i + 1].trim() : "";
    sections[key] = val;
  }
  
  const title = sections["Title"] || "";
  const gatha = sections["Gatha"] || "";
  const gathaS = sections["Sanskrit"] || "";
  const gadya = sections["Gadya"] || "";
  const anvayarth = sections["Anvayarth"] || "";
  const bhavarth = sections["Bhavarth"] || "";
  const english = sections["English"] || "";
  
  const teekas: TeekaData[] = [];
  
  // Find commentator keys
  const teekaKeys = Object.keys(sections).filter(k => k.startsWith("Teeka:") && !k.endsWith(": Sanskrit") && !k.endsWith(": Hindi"));
  
  for (const key of teekaKeys) {
    const name = key.replace("Teeka:", "").trim();
    const sanskritKey = `Teeka: ${name}: Sanskrit`;
    const hindiKey = `Teeka: ${name}: Hindi`;
    
    teekas.push({
      commentator: name,
      sanskrit: sections[sanskritKey] || undefined,
      hindi: sections[hindiKey] || ""
    });
  }
  
  return {
    title,
    gatha,
    gathaS,
    gadya,
    anvayarth,
    bhavarth,
    english,
    teekas
  };
}

// Get the list of all available scriptures
export function getShastras(): ShastraMetadata[] {
  return shastrasList;
}

// Get the index.json metadata for a specific scripture
export function getShastraIndex(shastraSlug: string): ShastraIndex | null {
  if (shastraIndexCache.has(shastraSlug)) {
    return shastraIndexCache.get(shastraSlug)!;
  }

  const shastra = shastraBySlug.get(shastraSlug);
  if (!shastra) {
    shastraIndexCache.set(shastraSlug, null);
    return null;
  }

  // Build the relative path key for glob lookup
  // e.g. "../content/granth/01_द्रव्यानुयोग/01_समयसार--कुन्दकुन्दाचार्य/index.json"
  const key = `../content/granth/${shastra.path}/index.json`;
  const data = shastraIndices[key];
  const index = data ? ((data.default || data) as ShastraIndex) : null;
  shastraIndexCache.set(shastraSlug, index);
  return index;
}

// Asynchronously load all gathas for a specific scripture on-demand
export async function loadGathasForShastra(
  shastraSlug: string,
  chapters: Chapter[]
): Promise<{ item: GathaItem; content: GathaContent; chapterName: string }[]> {
  const shastra = shastraBySlug.get(shastraSlug);
  if (!shastra) return [];

  const itemsToLoad: { item: GathaItem; chapterName: string; key: string; cacheKey: string }[] = [];
  for (const chapter of chapters) {
    for (const item of chapter.items) {
      itemsToLoad.push({
        item,
        chapterName: chapter.name,
        key: `../content/granth/${shastra.path}/${item.file}`,
        cacheKey: `${shastraSlug}/${item.file}`,
      });
    }
  }

  const results = await Promise.all(
    itemsToLoad.map(async ({ item, chapterName, key, cacheKey }) => {
      const cached = gathaParsedCache.get(cacheKey);
      if (cached) {
        return { item, content: cached, chapterName };
      }

      const loader = gathaTextLoaders[key];
      if (!loader) return null;

      try {
        const rawText = await loader();
        const content = parseGathaText(rawText);
        gathaParsedCache.set(cacheKey, content);
        return { item, content, chapterName };
      } catch (err) {
        console.error(`Failed to load gatha ${key}:`, err);
        return null;
      }
    })
  );

  return results.filter((r): r is { item: GathaItem; content: GathaContent; chapterName: string } => r !== null);
}

// Synchronously get already-loaded gatha content from cache
export function getGathaContent(shastraSlug: string, file: string): GathaContent | null {
  return gathaParsedCache.get(`${shastraSlug}/${file}`) || null;
}
