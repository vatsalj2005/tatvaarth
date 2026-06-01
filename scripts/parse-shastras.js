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

  // Convert HTML tables to Markdown tables
  text = text.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (tableMatch, tableBody) => {
    const rows = [];
    const rowMatches = tableBody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    for (const rowMatch of rowMatches) {
      const rowContent = rowMatch[1];
      const cells = [];
      const cellMatches = [...rowContent.matchAll(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi)];
      
      if (cellMatches.length > 0) {
        for (const cellMatch of cellMatches) {
          let cellText = cellMatch[2].replace(/<br\s*\/?>/gi, ' ');
          cellText = cellText.replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
          cells.push(cellText);
        }
      } else {
        let rowText = rowContent.replace(/<br\s*\/?>/gi, ' ');
        rowText = rowText.replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
        if (rowText) {
          cells.push(rowText);
        }
      }
      
      if (cells.length > 0) {
        rows.push(cells);
      }
    }
    
    if (rows.length === 0) return "";
    
    let markdownTable = "\n\n";
    let startIndex = 0;
    if (rows[0].length === 1) {
      markdownTable += `**${rows[0][0]}**\n\n`;
      startIndex = 1;
    }
    
    if (startIndex < rows.length) {
      const headerRow = rows[startIndex];
      markdownTable += "| " + headerRow.join(" | ") + " |\n";
      markdownTable += "| " + headerRow.map(() => "---").join(" | ") + " |\n";
      
      for (let i = startIndex + 1; i < rows.length; i++) {
        markdownTable += "| " + rows[i].join(" | ") + " |\n";
      }
    }
    
    markdownTable += "\n";
    return markdownTable;
  });
  
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

// Find matching div to handle nested divs safely
function findMatchingDiv(html, startIdx) {
  let depth = 1;
  let pos = startIdx;
  
  // Find the end of the opening tag
  const openTagEnd = html.indexOf('>', pos);
  if (openTagEnd === -1) return null;
  pos = openTagEnd + 1;
  
  const tagReg = /<\/?div\b/gi;
  tagReg.lastIndex = pos;
  
  let match;
  while ((match = tagReg.exec(html)) !== null) {
    if (match[0].toLowerCase() === '<div') {
      depth++;
    } else {
      depth--;
      if (depth === 0) {
        const closeTagEnd = html.indexOf('>', match.index);
        return {
          start: startIdx,
          end: closeTagEnd !== -1 ? closeTagEnd + 1 : match.index + match[0].length,
          content: html.substring(openTagEnd + 1, match.index)
        };
      }
    }
  }
  return null;
}

// Parse a single HTML file of a gatha
function parseGathaHtml(filePath) {
  const html = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);

  if (fileName.startsWith('0000_शास्त्र-मंगलाचरण')) {
    const title = "शास्त्र-मंगलाचरण";
    
    // Gatha
    let gatha = "";
    const bronzeMatch = html.match(/<span[^>]*?(?:color=["']?bronze["']?|color:\s*bronze)[^>]*?>([\s\S]*?)<\/span>/i);
    if (bronzeMatch) {
      gatha = "!! नम: श्रीसर्वज्ञवीतरागाय !!\n\n" + stripHtml(bronzeMatch[1]);
    } else {
      const gathaMatch = html.match(/<div[^>]*class=["']?gatha["']?[^>]*>([\s\S]*?)<\/div>/i);
      if (gathaMatch) {
        gatha = stripHtml(gathaMatch[1]);
      }
    }
    
    // Anvayarth
    let anvayarth = "";
    const commentMatch = html.match(/<div[^>]*class=["']?comment["']?[^>]*>([\s\S]*?)<\/div>/i);
    if (commentMatch) {
      anvayarth = stripHtml(commentMatch[1]);
    }
    
    // Bhavarth
    let bhavarth = "";
    if (commentMatch) {
      const firstCommentEndIndex = commentMatch.index + commentMatch[0].length;
      const restHtml = html.substring(firstCommentEndIndex);
      const endBlockIndex = restHtml.indexOf('<br><div class=teekakaar>');
      const rawBhavarth = endBlockIndex !== -1 ? restHtml.substring(0, endBlockIndex) : restHtml;
      bhavarth = stripHtml(rawBhavarth);
    }
    
    return {
      title,
      gatha,
      gathaS: "",
      gadya: "",
      anvayarth,
      english: "",
      bhavarth,
      teekas: []
    };
  }

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
  const anvayarthMatches = html.matchAll(/<div[^>]*class=["']?paragraph\b[^>]*>([\s\S]*?)<\/div>/gi);
  const anvayarthContents = [];
  for (const match of anvayarthMatches) {
    let content = match[1];
    // Strip "अन्वयार्थ :" prefix if it exists
    content = content.replace(/<b><font color=[^>]*>अन्वयार्थ\s*:\s*<\/font><\/b>/i, '');
    content = content.replace(/<b>अन्वयार्थ\s*:\s*<\/b>/i, '');
    
    // Convert <font color=...>[word]</font> to **[word]**
    content = content.replace(/<font color=[^>]*>\s*(\[[^\]]+\])\s*<\/font>/gi, '**$1**');
    content = content.replace(/<font color=[^>]*>([\s\S]*?)<\/font>/gi, '$1');
    
    content = stripHtml(content);
    // Replace raw [word] with **[word]** if not already bolded
    content = content.replace(/(?<!\*\*)(\[[^\]]+\])(?!\*\*)/g, '**$1**');
    
    if (content.trim()) {
      anvayarthContents.push(content.trim());
    }
  }
  anvayarth = anvayarthContents.join('\n\n');

  // 6. English Meaning (ParagraphE)
  let english = "";
  const englishMatches = html.matchAll(/<div[^>]*class=["']?paragraphE\b[^>]*>([\s\S]*?)<\/div>/gi);
  const englishContents = [];
  for (const match of englishMatches) {
    let content = match[1];
    content = content.replace(/<b><font color=[^>]*>Meaning\s*:\s*<\/font><\/b>/i, '');
    content = content.replace(/<b>Meaning\s*:\s*<\/b>/i, '');
    content = stripHtml(content);
    if (content.trim()) {
      englishContents.push(content.trim());
    }
  }
  english = englishContents.join('\n\n');

  // 7. Teekas (Commentaries)
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
    const steekaIndex = teekaHtml.search(/<div[^>]*class=["']?steeka["']?[^>]*>/i);
    if (steekaIndex !== -1) {
      const matchedDiv = findMatchingDiv(teekaHtml, steekaIndex);
      if (matchedDiv) {
        sanskrit = stripHtml(matchedDiv.content);
        teekaHtml = teekaHtml.substring(0, matchedDiv.start) + teekaHtml.substring(matchedDiv.end);
      }
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
  if (data.bhavarth) {
    out += `=== Bhavarth ===\n${data.bhavarth}\n\n`;
  }
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
    if (optionMatch) {
      const filename = optionMatch[1];
      const gathaNum = optionMatch[2].trim();
      const title = optionMatch[3].trim().replace(/^\s*-\s*/, '');
      
      if (filename.includes('index')) {
        continue;
      }
      
      if (!currentChapter) {
        currentChapter = {
          name: "मंगलाचरण",
          items: []
        };
        chapters.push(currentChapter);
      }
      
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
  
  // Try to find select-native-1 (which has the complete standard numbering)
  const select1Start = content.indexOf("select-native-1");
  if (select1Start === -1) {
    return parseBlock(content);
  }
  
  let select1End = content.indexOf("select-native-2", select1Start);
  if (select1End === -1) {
    select1End = content.indexOf("select-native-3", select1Start);
  }
  if (select1End === -1) {
    select1End = content.length;
  }
  
  const select1Content = content.substring(select1Start, select1End);
  const chapters = parseBlock(select1Content);
  
  // Also grab the "परिशिष्ट" or "मंगलाचरण" from select-native-0 if it exists
  const select0Start = content.indexOf("select-native-0");
  if (select0Start !== -1) {
    const select0End = select1Start;
    const select0Content = content.substring(select0Start, select0End);
    const select0Chapters = parseBlock(select0Content);
    
    for (const c of select0Chapters) {
      if (c.name.includes("परिशिष्ट") || c.name.includes("मंगलाचरण")) {
        if (!chapters.some(ch => ch.name.includes(c.name))) {
          if (c.name.includes("मंगलाचरण")) {
            chapters.unshift(c);
          } else {
            chapters.push(c);
          }
        }
      }
    }
  }
  
  if (chapters.length === 0) {
    chapters.push({
      name: "मूल ग्रंथ",
      items: []
    });
  }

  return chapters;
}

// Convert a single shastra
function convertShastra(config) {
  const { categoryDirName, shastraDirName, title, author, category } = config;
  const sourceShastraPath = path.join(dbDir, categoryDirName, shastraDirName);
  if (!fs.existsSync(sourceShastraPath)) {
    console.error(`Source directory not found: ${sourceShastraPath}`);
    return 0;
  }

  console.log(`Starting conversion for ${title}...`);

  const htmlFolder = path.join(sourceShastraPath, 'html');
  const myItemPath = path.join(htmlFolder, 'myItem.js');

  let chapters = [];
  if (fs.existsSync(myItemPath)) {
    chapters = parseMyItemJs(myItemPath);
    console.log(`Parsed chapters from myItem.js. Found ${chapters.length} chapters.`);
  }

  // Prepend 0000_शास्त्र-मंगलाचरण if it exists but is not in chapters
  const hasMangalacharan = fs.existsSync(path.join(htmlFolder, '0000_शास्त्र-मंगलाचरण.html'));
  if (hasMangalacharan) {
    let firstChapter = chapters[0];
    if (!firstChapter) {
      firstChapter = { name: "मंगलाचरण", items: [] };
      chapters.unshift(firstChapter);
    }
    if (!firstChapter.items.some(item => item.file.startsWith('0000_शास्त्र-मंगलाचरण'))) {
      firstChapter.items.unshift({
        file: '0000_शास्त्र-मंगलाचरण.txt',
        gathaNum: '000',
        title: 'शास्त्र-मंगलाचरण'
      });
    }
  }

  // Create output directory for this shastra
  const destShastraPath = path.join(outDir, categoryDirName, shastraDirName);
  fs.mkdirSync(destShastraPath, { recursive: true });

  // Read all HTML files in the directory, excluding indexes
  const files = fs.readdirSync(htmlFolder).filter(f => f.endsWith('.html') && !f.includes('index'));
  
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
    title,
    author,
    category,
    cover: existingIndex.cover || {
      invocation: "!! श्रीसर्वज्ञवीतरागाय नमः !!",
      authorPrefix: `श्रीमद्-भगवत्${author}-प्रणीत`,
      title: `श्री ${title}`,
      subtitle: `मूल प्राकृत गाथा, श्री अमृतचंद्राचार्य विरचित 'समय-व्याख्या' नामक संस्कृत टीका का हिंदी अनुवाद, श्री जयसेनाचार्य विरचित 'तात्पर्य-वृत्ति' नामक संस्कृत टीका का हिंदी अनुवाद सहित`,
      credits: "आभार : विजय कुमार जैन"
    },
    chapters: existingIndex.chapters || chapters
  };
  fs.writeFileSync(destIndexJsonPath, JSON.stringify(shastraIndexJson, null, 2), 'utf-8');

  console.log(`Successfully converted ${processedCount} gatha HTML files into plain text.`);
  return processedCount;
}

const configs = [
  {
    id: "samaysar",
    title: "समयसार",
    author: "कुन्दकुन्दाचार्य",
    category: "द्रव्यानुयोग",
    categoryHi: "द्रव्यानुयोग",
    categoryEn: "Dravyanuyog",
    categorySlug: "dravyanuyog",
    shastraSlug: "samaysar",
    categoryDirName: "01_द्रव्यानुयोग",
    shastraDirName: "01_समयसार--कुन्दकुन्दाचार्य"
  },
  {
    id: "pravachansar",
    title: "प्रवचनसार",
    author: "कुन्दकुन्दाचार्य",
    category: "द्रव्यानुयोग",
    categoryHi: "द्रव्यानुयोग",
    categoryEn: "Dravyanuyog",
    categorySlug: "dravyanuyog",
    shastraSlug: "pravachansar",
    categoryDirName: "01_द्रव्यानुयोग",
    shastraDirName: "02_प्रवचनसार--कुन्दकुन्दाचार्य"
  }
];

function main() {
  const globalManifest = [];
  for (const config of configs) {
    const processedCount = convertShastra(config);
    if (processedCount > 0) {
      globalManifest.push({
        id: config.id,
        title: config.title,
        author: config.author,
        categoryHi: config.categoryHi,
        categoryEn: config.categoryEn,
        categorySlug: config.categorySlug,
        shastraSlug: config.shastraSlug,
        path: `${config.categoryDirName}/${config.shastraDirName}`,
        gathaCount: processedCount
      });
    }
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(globalManifest, null, 2), 'utf-8');
  console.log(`Saved manifest.json.`);
}

main();
