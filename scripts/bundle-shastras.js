import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const granthDir = path.join(__dirname, '..', 'src', 'content', 'granth');
const manifestPath = path.join(granthDir, 'manifest.json');

export function parseGathaText(raw) {
  const sections = {};
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

  const teekas = [];
  const teekaKeys = Object.keys(sections).filter(
    (k) => k.startsWith("Teeka:") && !k.endsWith(": Sanskrit") && !k.endsWith(": Hindi")
  );

  for (const key of teekaKeys) {
    const name = key.replace("Teeka:", "").trim();
    const sanskritKey = `Teeka: ${name}: Sanskrit`;
    const hindiKey = `Teeka: ${name}: Hindi`;

    teekas.push({
      commentator: name,
      sanskrit: sections[sanskritKey] || undefined,
      hindi: sections[hindiKey] || "",
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
    teekas,
  };
}

async function bundleShastras() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`Starting bundling for ${manifest.length} shastras...`);

  let totalGathas = 0;
  const startTime = Date.now();

  for (const shastra of manifest) {
    const shastraDir = path.join(granthDir, shastra.path);
    if (!fs.existsSync(shastraDir)) {
      console.warn(`Directory not found: ${shastraDir}`);
      continue;
    }

    const files = fs.readdirSync(shastraDir).filter((f) => f.endsWith('.txt'));
    const bundle = {};

    for (const file of files) {
      const filePath = path.join(shastraDir, file);
      const raw = fs.readFileSync(filePath, 'utf8');
      bundle[file] = parseGathaText(raw);
    }

    const bundlePath = path.join(shastraDir, 'gathas.json');
    fs.writeFileSync(bundlePath, JSON.stringify(bundle), 'utf8');
    totalGathas += files.length;
    console.log(`✓ Bundled ${shastra.shastraSlug}: ${files.length} gathas -> ${(fs.statSync(bundlePath).size / 1024).toFixed(0)} KB`);
  }

  console.log(`Done! Bundled ${totalGathas} gathas in ${Date.now() - startTime}ms.`);
}

bundleShastras();
