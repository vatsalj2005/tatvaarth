import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDir = path.join(__dirname, '..', 'Database', 'shastra');
const outDir = path.join(__dirname, '..', 'src', 'content', 'granth');

// Helper to strip HTML tags
function stripHtml(html) {
  if (!html) return "";
  
  let text = html;
  
  // Convert <div class=gadya>...</div> to separate lines wrapped in { }
  text = text.replace(/<div[^>]*class=["']?gadya["']?[^>]*>([\s\S]*?)<\/div>/gi, (match, p1) => {
    let content = p1.replace(/<br\s*\/?>/gi, '\n');
    content = content.replace(/<[^>]+>/g, '').trim();
    return '\n' + content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => `{${line}}`)
      .join('\n') + '\n';
  });

  // Convert list items to markdown bullet points
  text = text.replace(/<li>/gi, '\n• ');
  text = text.replace(/<\/li>/gi, '');
  text = text.replace(/<ul[^>]*>/gi, '');
  text = text.replace(/<\/ul>/gi, '\n');
  text = text.replace(/<ol[^>]*>/gi, '');
  text = text.replace(/<\/ol>/gi, '\n');

  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/^\uFEFF/, '') // Strip BOM
    .trim();
}

// Clean up titles and other fields
function cleanText(text) {
  if (!text) return "";
  return text.trim().replace(/\s+/g, ' ');
}

// Parse a single HTML file of a gatha
function parseGathaHtml(filePath) {
  const html = fs.readFileSync(filePath, 'utf-8');

  // 1. Title
  let title = "";
  const titleMatch = html.match(/<div[^>]*class=["']?title["']?[^>]*>([\s\S]*?)<\/div>/i);
  if (titleMatch) {
    title = titleMatch[1]
      .replace(/<span[^>]*class=["']?incFontSz["']?[^>]*>[\s\S]*?<\/span>/gi, '')
      .replace(/<span[^>]*class=["']?decFontSz["']?[^>]*>[\s\S]*?<\/span>/gi, '')
      .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1');
    title = stripHtml(title);
  }

  // 2. Gatha (Prakrit)
  let gatha = "";
  const gathaMatch = html.match(/<div[^>]*class=["']?gatha["']?[^>]*>([\s\S]*?)<\/div>/i);
  if (gathaMatch) {
    gatha = stripHtml(gathaMatch[1]);
  }

  // 3. Sanskrit Equivalent (GathaS)
  let gathaS = "";
  const gathaSMatch = html.match(/<div[^>]*class=["']?gathaS["']?[^>]*>([\s\S]*?)<\/div>/i);
  if (gathaSMatch) {
    gathaS = stripHtml(gathaSMatch[1]);
  }

  // 4. Hindi Verse (Gadya)
  let gadya = "";
  const gadyaMatch = html.match(/<div[^>]*class=["']?gadya["']?[^>]*>([\s\S]*?)<\/div>/i);
  if (gadyaMatch) {
    gadya = stripHtml(gadyaMatch[1]);
  }

  // 5. Anvayarth (Paragraph)
  let anvayarth = "";
  const anvayarthMatch = html.match(/<div[^>]*class=["']?paragraph["']?[^>]*>([\s\S]*?)<\/div>/i);
  if (anvayarthMatch) {
    let content = anvayarthMatch[1];
    // Strip "अन्वयार्थ :" prefix if it exists
    content = content.replace(/<b><font color=[^>]*>अन्वयार्थ\s*:\s*<\/font><\/b>/i, '');
    content = content.replace(/<b>अन्वयार्थ\s*:\s*<\/b>/i, '');
    
    // Convert <font color=...>[word]</font> to **[word]**
    content = content.replace(/<font color=[^>]*>\s*(\[[^\]]+\])\s*<\/font>/gi, '**$1**');
    content = content.replace(/<font color=[^>]*>([\s\S]*?)<\/font>/gi, '$1');
    
    // Also, ensure any raw brackets [word] are wrapped in bold **[word]** for styling
    // unless they are already wrapped
    content = stripHtml(content);
    // Replace raw [word] with **[word]** if not already bolded
    content = content.replace(/(?<!\*\*)(\[[^\]]+\])(?!\*\*)/g, '**$1**');
    
    anvayarth = content;
  }

  // 6. English Meaning (ParagraphE)
  let english = "";
  const englishMatch = html.match(/<div[^>]*class=["']?paragraphE["']?[^>]*>([\s\S]*?)<\/div>/i);
  if (englishMatch) {
    let content = englishMatch[1];
    content = content.replace(/<b><font color=[^>]*>Meaning\s*:\s*<\/font><\/b>/i, '');
    content = content.replace(/<b>Meaning\s*:\s*<\/b>/i, '');
    english = stripHtml(content);
  }

  // 7. Teekas (Commentaries)
  // We parse the HTML structure for teekas.
  // There are typically div ids: teeka0, teeka1, teeka2...
  const teekas = [];
  const teekaMatches = html.matchAll(/<div[^>]*id=["']?teeka(\d+)["']?[^>]*class=["']?teeka["']?[^>]*>([\s\S]*?)<\/div>\s*<\/td>/gi);
  
  for (const match of teekaMatches) {
    const teekaId = match[1];
    let teekaHtml = match[2];

    // Find the commentator name
    let commentator = `Teeka ${teekaId}`;
    const nameMatch = teekaHtml.match(/<b><font color=[^>]*>([\s\S]*?)\s*:\s*<\/font><\/b>/i);
    if (nameMatch) {
      commentator = stripHtml(nameMatch[1]);
    } else {
      const altNameMatch = teekaHtml.match(/<b>([\s\S]*?)\s*:\s*<\/b>/i);
      if (altNameMatch) {
        commentator = stripHtml(altNameMatch[1]);
      }
    }

    // Extract Sanskrit commentary if present
    let sanskrit = "";
    const steekaMatch = teekaHtml.match(/<div[^>]*class=["']?steeka["']?[^>]*>([\s\S]*?)<\/div>/i);
    if (steekaMatch) {
      sanskrit = stripHtml(steekaMatch[1]);
      // Remove the steeka div from the main teeka HTML so we can extract the Hindi part
      teekaHtml = teekaHtml.replace(steekaMatch[0], '');
    }

    // Remove the title/header part
    teekaHtml = teekaHtml.replace(/<b><font color=[^>]*>[\s\S]*?<\/font><\/b>/i, '');
    teekaHtml = teekaHtml.replace(/<span[^>]*class=["']?stitle["']?[\s\S]*?<\/span>/gi, '');
    
    let hindi = stripHtml(teekaHtml);

    teekas.push({
      id: teekaId,
      commentator,
      sanskrit,
      hindi
    });
  }

  return {
    title,
    gatha,
    gathaS,
    gadya,
    anvayarth,
    english,
    teekas
  };
}

// Convert parsed gatha object to structured plain text format
function formatGathaText(data) {
  let out = `=== Title ===\n${data.title}\n\n`;
  out += `=== Gatha ===\n${data.gatha}\n\n`;
  out += `=== Sanskrit ===\n${data.gathaS}\n\n`;
  out += `=== Gadya ===\n${data.gadya}\n\n`;
  out += `=== Anvayarth ===\n${data.anvayarth}\n\n`;
  out += `=== English ===\n${data.english}\n\n`;

  for (const teeka of data.teekas) {
    out += `=== Teeka: ${teeka.commentator} ===\n`;
    if (teeka.sanskrit) {
      out += `=== Teeka: ${teeka.commentator}: Sanskrit ===\n${teeka.sanskrit}\n`;
    }
    out += `=== Teeka: ${teeka.commentator}: Hindi ===\n${teeka.hindi}\n\n`;
  }
  return out;
}

// Helper to parse chapters and options from a string block
function parseBlock(blockContent) {
  const chapters = [];
  let currentChapter = null;
  const lines = blockContent.split('\n');
  for (const line of lines) {
    const optgrpMatch = line.match(/label=["']?﻿?([^"']+)["']?/i);
    if (optgrpMatch && line.includes('optgroup')) {
      const chapterName = optgrpMatch[1].trim();
      currentChapter = {
        name: chapterName,
        items: []
      };
      chapters.push(currentChapter);
      continue;
    }

    const optionMatch = line.match(/value=['"]?([^'"]+)['"]?>\s*<b>([^<]+)<\/b>\s*-\s*﻿?([^<]+)<\/option>/i);
    if (optionMatch && currentChapter) {
      const filename = optionMatch[1];
      const gathaNum = optionMatch[2].trim();
      const title = optionMatch[3].trim().replace(/^\s*-\s*/, '');
      
      // Avoid duplicate gathaNum in the same chapter
      if (!currentChapter.items.some(item => item.gathaNum === gathaNum)) {
        currentChapter.items.push({
          file: filename.replace('.html', '.txt'),
          gathaNum,
          title
        });
      }
    }
  }
  return chapters;
}

// Parse myItem.js to extract chapters and their gathas
function parseMyItemJs(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Try to find select-native-1 (which has the complete standard numbering 1-439)
  const select1Start = content.indexOf("select-native-1");
  if (select1Start === -1) {
    // Fallback to parsing the whole file if select-native-1 is not found
    return parseBlock(content);
  }
  
  let select1End = content.indexOf("select-native-2", select1Start);
  if (select1End === -1) {
    select1End = content.length;
  }
  
  const select1Content = content.substring(select1Start, select1End);
  const chapters = parseBlock(select1Content);
  
  // Also grab the "परिशिष्ट" (Parishisht) from select-native-0 if it exists
  const select0Start = content.indexOf("select-native-0");
  if (select0Start !== -1) {
    const select0End = select1Start;
    const select0Content = content.substring(select0Start, select0End);
    const select0Chapters = parseBlock(select0Content);
    const parishisht = select0Chapters.find(c => c.name.includes("परिशिष्ट"));
    if (parishisht) {
      // Avoid adding duplicate if select-native-1 already has it
      if (!chapters.some(c => c.name.includes("परिशिष्ट"))) {
        chapters.push(parishisht);
      }
    }
  }
  
  // In case there is no chapters or optgroups, create a default one
  if (chapters.length === 0) {
    chapters.push({
      name: "मूल ग्रंथ",
      items: []
    });
  }

  return chapters;
}


// Pilot Run on Samaysar
function pilotRun() {
  const categoryDirName = "01_द्रव्यानुयोग";
  const shastraDirName = "01_समयसार--कुन्दकुन्दाचार्य";

  const sourceShastraPath = path.join(dbDir, categoryDirName, shastraDirName);
  if (!fs.existsSync(sourceShastraPath)) {
    console.error(`Source directory not found: ${sourceShastraPath}`);
    process.exit(1);
  }

  console.log(`Starting pilot conversion for Samaysar...`);

  const htmlFolder = path.join(sourceShastraPath, 'html');
  const myItemPath = path.join(htmlFolder, 'myItem.js');

  let chapters = [];
  if (fs.existsSync(myItemPath)) {
    chapters = parseMyItemJs(myItemPath);
    console.log(`Parsed chapters from myItem.js. Found ${chapters.length} chapters.`);
  }

  // Create output directory for this shastra
  const destShastraPath = path.join(outDir, categoryDirName, shastraDirName);
  fs.mkdirSync(destShastraPath, { recursive: true });

  // Read all HTML files in the directory
  const files = fs.readdirSync(htmlFolder).filter(f => f.endsWith('.html') && f !== 'index.html' && !f.startsWith('0000_'));
  
  let processedCount = 0;
  for (const file of files) {
    const htmlFilePath = path.join(htmlFolder, file);
    try {
      const parsedData = parseGathaHtml(htmlFilePath);
      const formattedText = formatGathaText(parsedData);
      
      const txtFileName = file.replace('.html', '.txt');
      const txtFilePath = path.join(destShastraPath, txtFileName);
      
      fs.writeFileSync(txtFilePath, formattedText, 'utf-8');
      processedCount++;
    } catch (err) {
      console.error(`Error parsing file ${file}:`, err);
    }
  }

  // If chapters items were empty (e.g. no myItem.js or failed parsing), build from processed files
  const defaultChapter = chapters[0];
  if (defaultChapter && defaultChapter.items.length === 0) {
    const sortedTxtFiles = fs.readdirSync(destShastraPath).filter(f => f.endsWith('.txt')).sort();
    for (const txtFile of sortedTxtFiles) {
      const baseName = path.basename(txtFile, '.txt');
      defaultChapter.items.push({
        file: txtFile,
        gathaNum: baseName,
        title: `गाथा ${baseName}`
      });
    }
  }

  // Write index.json manifest inside the shastra folder
  const destIndexJsonPath = path.join(destShastraPath, 'index.json');
  let existingIndex = {};
  if (fs.existsSync(destIndexJsonPath)) {
    try {
      existingIndex = JSON.parse(fs.readFileSync(destIndexJsonPath, 'utf-8'));
    } catch (e) {
      console.error("Failed to read existing index.json", e);
    }
  }

  const shastraIndexJson = {
    title: "समयसार",
    author: "कुन्दकुन्दाचार्य",
    category: "द्रव्यानुयोग",
    cover: existingIndex.cover,
    chapters: existingIndex.chapters || chapters
  };
  fs.writeFileSync(destIndexJsonPath, JSON.stringify(shastraIndexJson, null, 2), 'utf-8');

  // Generate the global manifest.json
  const globalManifest = [
    {
      id: "samaysar",
      title: "समयसार",
      author: "कुन्दकुन्दाचार्य",
      categoryHi: "द्रव्यानुयोग",
      categoryEn: "Dravyanuyog",
      categorySlug: "dravyanuyog",
      shastraSlug: "samaysar",
      path: `01_द्रव्यानुयोग/01_समयसार--कुन्दकुन्दाचार्य`,
      gathaCount: processedCount
    }
  ];
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(globalManifest, null, 2), 'utf-8');

  console.log(`Successfully converted ${processedCount} gatha HTML files into plain text.`);
  console.log(`Saved index.json and manifest.json.`);
}

pilotRun();
