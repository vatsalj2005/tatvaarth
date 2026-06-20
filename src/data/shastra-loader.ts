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

// 1. Eagerly load all index.json metadata files for the shastras (touched to force glob reload for yogsaar)
const shastraIndices = import.meta.glob('../content/granth/**/index.json', { eager: true }) as Record<string, any>;

// 2. Eagerly load all .txt gatha files for the shastras
const gathaTexts = import.meta.glob('../content/granth/**/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

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
  return globalManifest as ShastraMetadata[];
}

// Get the index.json metadata for a specific scripture
export function getShastraIndex(shastraSlug: string): ShastraIndex | null {
  const shastra = getShastras().find(s => s.shastraSlug === shastraSlug);
  if (!shastra) return null;

  // Build the relative path key for glob lookup
  // e.g. "../content/granth/01_द्रव्यानुयोग/01_समयसार--कुन्दकुन्दाचार्य/index.json"
  const key = `../content/granth/${shastra.path}/index.json`;
  const data = shastraIndices[key];
  return data ? (data.default || data) as ShastraIndex : null;
}

// Get parsed gatha content
export function getGathaContent(shastraSlug: string, file: string): GathaContent | null {
  const shastra = getShastras().find(s => s.shastraSlug === shastraSlug);
  if (!shastra) return null;

  // Build the relative path key for glob lookup
  // e.g. "../content/granth/01_द्रव्यानुयोग/01_समयसार--कुन्दकुन्दाचार्य/001.txt"
  const key = `../content/granth/${shastra.path}/${file}`;
  const rawText = gathaTexts[key];
  
  if (!rawText) return null;
  return parseGathaText(rawText);
}
