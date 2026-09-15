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
    // Split by <tr tags to handle unclosed rows
    const rowSegments = tableBody.split(/<tr\b[^>]*>/gi);
    
    // Check if the very first segment (before the first <tr) has any th/td cells
    const firstSegment = rowSegments[0];
    const firstSegmentCells = [];
    const cellRegex = /<(td|th)\b[^>]*>([\s\S]*?)(?:<\/\1>|(?=<(td|th)\b)|$)/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(firstSegment)) !== null) {
      let cellText = cellMatch[2].replace(/<br\s*\/?>/gi, ' ');
      cellText = cellText.replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
      firstSegmentCells.push(cellText);
    }
    if (firstSegmentCells.length === 0) {
      let segmentText = firstSegment.replace(/<br\s*\/?>/gi, ' ');
      segmentText = segmentText.replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
      if (segmentText) {
        firstSegmentCells.push(segmentText);
      }
    }
    if (firstSegmentCells.length > 0) {
      rows.push(firstSegmentCells);
    }

    // Process all segments starting from index 1 (each is a row)
    for (let i = 1; i < rowSegments.length; i++) {
      const rowContent = rowSegments[i];
      const cells = [];
      const cellRegex = /<(td|th)\b[^>]*>([\s\S]*?)(?:<\/\1>|(?=<(td|th)\b)|$)/gi;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        let cellText = cellMatch[2].replace(/<br\s*\/?>/gi, ' ');
        cellText = cellText.replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
        cells.push(cellText);
      }
      if (cells.length === 0) {
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
        const rowCells = [...rows[i]];
        while (rowCells.length < headerRow.length) {
          rowCells.push("");
        }
        markdownTable += "| " + rowCells.slice(0, headerRow.length).join(" | ") + " |\n";
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

  // Helper to convert integer to Devanagari numerals
  function toDevanagari(num) {
    const digits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
    return String(num).split('').map(char => digits[parseInt(char)] || char).join('');
  }

  // Stateful parser to handle ordered and unordered lists (and nested lists)
  function parseLists(html) {
    if (!html) return "";
    
    const tagRegex = /<\/?(ol|ul|li)\b[^>]*>/gi;
    let result = "";
    let lastIndex = 0;
    const listStack = [];
    
    let match;
    while ((match = tagRegex.exec(html)) !== null) {
      result += html.substring(lastIndex, match.index);
      lastIndex = tagRegex.lastIndex;
      
      const tag = match[0].toLowerCase();
      
      if (tag.startsWith('<ol')) {
        listStack.push({ type: 'ol', count: 0 });
      } else if (tag.startsWith('<ul')) {
        listStack.push({ type: 'ul', count: 0 });
      } else if (tag.startsWith('</ol') || tag.startsWith('</ul')) {
        listStack.pop();
        result += '\n';
      } else if (tag.startsWith('<li')) {
        const activeList = listStack[listStack.length - 1];
        const indentSpaces = "  ".repeat(listStack.length);
        if (activeList) {
          if (activeList.type === 'ol') {
            activeList.count++;
            const numStr = toDevanagari(activeList.count);
            result += `\n${indentSpaces}${numStr}. `;
          } else {
            result += `\n${indentSpaces}• `;
          }
        } else {
          result += `\n${indentSpaces}• `;
        }
      }
    }
    
    result += html.substring(lastIndex);
    return result;
  }

  // Convert list items dynamically based on ol vs ul
  text = parseLists(text);

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

// Parse OrgChart HTML lists to tree node structures
function parseOrgChart(orgchartHtml) {
  const nodes = [];
  const tagRegex = /(<ul\b|<li\b|<\/ul\b|<\/li\b|<div\b class=["']?nodecontent["']?>|<\/div\b)/gi;
  
  let match;
  let currentParentId = undefined;
  const parentStack = [];
  let nextNodeId = 1;
  
  const matches = [];
  while ((match = tagRegex.exec(orgchartHtml)) !== null) {
    matches.push({
      tag: match[0].toLowerCase(),
      index: match.index,
      length: match[0].length
    });
  }
  
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (m.tag.startsWith('<ul')) {
      parentStack.push(currentParentId);
    } else if (m.tag.startsWith('</ul')) {
      currentParentId = parentStack.pop();
    } else if (m.tag.startsWith('<div')) {
      const contentStart = m.index + m.length;
      const nextM = matches[i + 1];
      if (nextM && nextM.tag.startsWith('</div')) {
        const text = orgchartHtml.substring(contentStart, nextM.index).trim();
        const id = nextNodeId === 1 ? 'root' : `sub${nextNodeId}`;
        nextNodeId++;
        
        nodes.push({
          id,
          parentid: parentStack[parentStack.length - 1],
          isroot: id === 'root' ? true : undefined,
          topic: text
        });
        
        currentParentId = id;
      }
    }
  }
  return nodes;
}

// Parse a single HTML file of a gatha
function parseGathaHtml(filePath) {
  const html = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);

  if (fileName.startsWith('0000_शास्त्र-मंगलाचरण') || fileName.startsWith('000_शास्त्र-मंगलाचरण')) {
    const title = "शास्त्र-मंगलाचरण";
    
    // Gatha
    let gatha = "";
    const bronzeMatch = html.match(/<span[^>]*?(?:color=["']?bronze["']?|color:\s*bronze)[^>]*?>([\s\S]*?)<\/span>/i);
    if (bronzeMatch) {
      gatha = "!! नम: श्रीसर्वज्ञवीतरागाय !!\n\n" + stripHtml(bronzeMatch[1]);
    } else {
      const gathaMatch = html.match(/<div[^>]*class=["']?gatha["']?[^>]*>([\s\S]*?)<\/div>/i);
      if (gathaMatch) {
        let gathaHtml = gathaMatch[1];
        // Strip out nested comment div (with or without closing tag) to prevent repeating the arth inside the gatha section
        gathaHtml = gathaHtml.replace(/<div[^>]*class=["']?comment["']?[^>]*>([\s\S]*?)(?:<\/div>|$)/gi, '');
        gatha = stripHtml(gathaHtml);
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
    } else {
      const splitIdx = gatha.indexOf("॥ श्रीपरमगुरुवे");
      if (splitIdx !== -1) {
        bhavarth = gatha.substring(splitIdx).trim();
        gatha = gatha.substring(0, splitIdx).trim();
      }
    }

    if (bhavarth && bhavarth.includes("मंगलं भगवान् वीरो") && !bhavarth.includes("{मंगलं भगवान् वीरो}")) {
      bhavarth = bhavarth.replace(
        /(मंगलं भगवान् वीरो[^\n\r]*)\r?\n(मंगलं कुन्दकुन्दार्यो[^\n\r]*)\r?\n(सर्वमंगलमांगल्यं[^\n\r]*)\r?\n(प्रधानं सर्वधर्माणां[^\n\r]*)/,
        "(मंगल)\n{$1}\n{$2}\n{$3}\n{$4}"
      );
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

  // Get main body HTML before teekakaar section to avoid matching gadya/paragraph/paragraphE from commentaries
  const teekakaarIdx = html.search(/<div[^>]*class=["']?teekakaar["']?[^>]*>/i);
  const mainHtml = teekakaarIdx !== -1 ? html.substring(0, teekakaarIdx) : html;

  // 1. Title
  let title = "";
  const titleMatch = mainHtml.match(/<div[^>]*class=["']?title["']?[^>]*>([\s\S]*?)<\/div>/i);
  if (titleMatch) {
    title = titleMatch[1]
      .replace(/<span[^>]*class=["']?incFontSz["']?[^>]*>[\s\S]*?<\/span>/gi, '')
      .replace(/<span[^>]*class=["']?decFontSz["']?[^>]*>[\s\S]*?<\/span>/gi, '')
      .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1');
    title = stripHtml(title);
  } else if (fileName === '001.html' && (filePath.includes('द्रव्यसंग्रह') || filePath.includes('dravyasangrah'))) {
    title = "टीकाकार (ब्रह्मदेव सूरि) द्वारा मंगलाचरण";
  }

  // 2. Gatha (Prakrit)
  let gatha = "";
  const gathaMatch = mainHtml.match(/<div[^>]*class=["']?gatha["']?[^>]*>([\s\S]*?)<\/div>/i);
  if (gathaMatch) {
    gatha = stripHtml(gathaMatch[1]);
  }

  if (!title && gatha) {
    const rawLines = gatha.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    let firstLine = rawLines[0] || '';
    if (firstLine.match(/^\([^\)]+\)$/) && rawLines.length > 1) {
      firstLine = rawLines[1];
    }
    firstLine = firstLine.replace(/[॥।\d\-–\s]+$/, '').trim();
    if (firstLine) {
      const dandaPart = firstLine.split(/[।॥]/)[0].trim();
      title = dandaPart.length > 5 ? dandaPart : firstLine;
      if (title.length > 60) {
        title = title.substring(0, 60).trim() + '...';
      }
    }
  }

  // 3. Sanskrit Equivalent (GathaS)
  let gathaS = "";
  const gathaSMatch = mainHtml.match(/<div[^>]*class=["']?gathaS["']?[^>]*>([\s\S]*?)<\/div>/i);
  if (gathaSMatch) {
    gathaS = stripHtml(gathaSMatch[1]);
  }

  // 4. Hindi Verse (Gadya)
  let gadya = "";
  const gadyaMatch = mainHtml.match(/<div[^>]*class=["']?gadya["']?[^>]*>([\s\S]*?)<\/div>/i);
  if (gadyaMatch) {
    gadya = stripHtml(gadyaMatch[1]);
  }

  // 5. Anvayarth (Paragraph)
  let anvayarth = "";
  const anvayarthContents = [];
  const paragraphRegex = /<div[^>]*class=["']?paragraph\b[^>]*>/gi;
  let match;
  while ((match = paragraphRegex.exec(mainHtml)) !== null) {
    const startIdx = match.index;
    const matchedDiv = findMatchingDiv(mainHtml, startIdx);
    if (matchedDiv) {
      let content = matchedDiv.content;

      // Look for OrgChart inside the content
      const orgchartRegex = /<ul\b[^>]*class=["']?orgchart["']?[^>]*>([\s\S]*?)<\/ul>/gi;
      let ocMatch;
      let diagramsInPara = [];
      while ((ocMatch = orgchartRegex.exec(content)) !== null) {
        const fullOcHtml = ocMatch[0];
        const nodes = parseOrgChart(fullOcHtml);
        if (nodes && nodes.length > 0) {
          diagramsInPara.push(`[DIAGRAM]\n${JSON.stringify({ type: 'vertical', nodes })}\n[/DIAGRAM]`);
        }
      }

      // Remove the OrgChart elements from the HTML before stripping tags
      content = content.replace(/<div[^>]*class=["']?oc["']?[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi, '');
      content = content.replace(/<div[^>]*class=["']?oc["']?[^>]*>[\s\S]*?<\/div>/gi, '');
      content = content.replace(/<ul\b[^>]*class=["']?orgchart["']?[^>]*>[\s\S]*?<\/ul>/gi, '');

      // Strip "अन्वयार्थ :" prefix if it exists
      content = content.replace(/<b><font color=[^>]*>अन्वयार्थ\s*:\s*<\/font><\/b>/i, '');
      content = content.replace(/<b>अन्वयार्थ\s*:\s*<\/b>/i, '');
      
      // Convert <font color=...>[word]</font> to **[word]**
      content = content.replace(/<font color=[^>]*>\s*(\[[^\]]+\])\s*<\/font>/gi, '**$1**');
      content = content.replace(/<font color=[^>]*>([\s\S]*?)<\/font>/gi, '$1');
      
      content = stripHtml(content);
      // Replace raw [word] with **[word]** if not already bolded
      content = content.replace(/(?<!\*\*)(\[[^\]]+\])(?!\*\*)/g, '**$1**');
      
      const paraText = content.trim();
      if (paraText) {
        anvayarthContents.push(paraText);
      }
      for (const diag of diagramsInPara) {
        anvayarthContents.push(diag);
      }

      paragraphRegex.lastIndex = matchedDiv.end;
    }
  }

  // Look for jsMind script in mainHtml
  const jsmindRegex = /var\s+mind\d+\s*=\s*(\{[\s\S]*?\});/gi;
  let jsmindMatch;
  const jsMindDiagrams = [];
  while ((jsmindMatch = jsmindRegex.exec(mainHtml)) !== null) {
    try {
      let dataStr = jsmindMatch[1];
      const evalObj = new Function(`return ${dataStr}`)();
      if (evalObj && evalObj.data) {
        const nodes = evalObj.data.map(n => ({
          id: n.id,
          parentid: n.parentid || undefined,
          isroot: n.isroot || undefined,
          topic: n.topic
        }));
        jsMindDiagrams.push(`[DIAGRAM]\n${JSON.stringify({ type: 'horizontal', nodes })}\n[/DIAGRAM]`);
      }
    } catch (e) {
      console.error("Error parsing jsMind data:", e);
    }
  }

  for (const diag of jsMindDiagrams) {
    anvayarthContents.push(diag);
  }

  anvayarth = anvayarthContents.join('\n\n');

  // 6. English Meaning (ParagraphE)
  let english = "";
  const englishContents = [];
  const paragraphERegex = /<div[^>]*class=["']?paragraphE\b[^>]*>/gi;
  let matchE;
  while ((matchE = paragraphERegex.exec(mainHtml)) !== null) {
    const startIdx = matchE.index;
    const matchedDiv = findMatchingDiv(mainHtml, startIdx);
    if (matchedDiv) {
      let content = matchedDiv.content;
      content = content.replace(/<b><font color=[^>]*>Meaning\s*:\s*<\/font><\/b>/i, '');
      content = content.replace(/<b>Meaning\s*:\s*<\/b>/i, '');
      content = stripHtml(content);
      if (content.trim()) {
        englishContents.push(content.trim());
      }
      paragraphERegex.lastIndex = matchedDiv.end;
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
        let matchedContent = matchedDiv.content;
        if (fileName === '001.html' && filePath.includes('द्रव्यसंग्रह')) {
          // Remove the duplicate <div class=gadya>...</div> block (and any surrounding <b> tags)
          matchedContent = matchedContent.replace(/<b>\s*<div[^>]*class=["']?gadya["']?[^>]*>([\s\S]*?)<\/div>\s*<\/b>/gi, '');
          matchedContent = matchedContent.replace(/<div[^>]*class=["']?gadya["']?[^>]*>([\s\S]*?)<\/div>/gi, '');
        }
        sanskrit = stripHtml(matchedContent);
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
  
  // Find all starts of select-native-X
  const selectRegex = /select-native-(\d+)/g;
  const blocks = [];
  let match;
  while ((match = selectRegex.exec(content)) !== null) {
    blocks.push({
      num: parseInt(match[1], 10),
      start: match.index
    });
  }
  
  if (blocks.length === 0) {
    return parseBlock(content);
  }
  
  // Sort blocks by start index ascending
  blocks.sort((a, b) => a.start - b.start);
  
  // Slice content for each block
  const parsedBlocks = [];
  for (let i = 0; i < blocks.length; i++) {
    const startIdx = blocks[i].start;
    const endIdx = (i + 1 < blocks.length) ? blocks[i + 1].start : content.length;
    const blockContent = content.substring(startIdx, endIdx);
    const chapters = parseBlock(blockContent);
    
    // Count total items in this block
    let itemCount = 0;
    for (const ch of chapters) {
      itemCount += ch.items.length;
    }
    
    parsedBlocks.push({
      num: blocks[i].num,
      chapters,
      itemCount
    });
  }
  
  // Find the block with the maximum items
  let mainBlock = parsedBlocks[0];
  for (const pb of parsedBlocks) {
    if (pb.itemCount > mainBlock.itemCount) {
      mainBlock = pb;
    }
  }
  
  const mainChapters = [...mainBlock.chapters];
  
  // If the main chapters default to a single chapter named "मंगलाचरण" but has a lot of items,
  // let's rename it to "मूल ग्रंथ" for clarity if it contains many items and no optgroup.
  if (mainChapters.length === 1 && mainChapters[0].name === "मंगलाचरण" && mainBlock.itemCount > 10) {
    mainChapters[0].name = "मूल ग्रंथ";
  }
  
  // Merge other blocks if they have "परिशिष्ट" or "मंगलाचरण" chapters
  for (const pb of parsedBlocks) {
    if (pb.num === mainBlock.num) continue;
    
    for (const c of pb.chapters) {
      if (c.name.includes("परिशिष्ट") || c.name.includes("मंगलाचरण")) {
        // Only merge if not already containing the same items or similar name
        const alreadyHasName = mainChapters.some(ch => ch.name.includes(c.name));
        if (!alreadyHasName) {
          if (c.name.includes("मंगलाचरण")) {
            mainChapters.unshift(c);
          } else {
            mainChapters.push(c);
          }
        }
      }
    }
  }
  
  if (mainChapters.length === 0) {
    mainChapters.push({
      name: "मूल ग्रंथ",
      items: []
    });
  }
  
  return mainChapters;
}

// Helper to read title from generated .txt file
function readTitleFromTxt(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const titleIdx = lines.indexOf('=== Title ===');
      if (titleIdx !== -1 && lines[titleIdx + 1]) {
        return lines[titleIdx + 1].trim();
      }
    }
  } catch (e) {
    console.error(`Failed to read title from ${filePath}:`, e);
  }
  return "";
}

// Convert a single shastra
function convertShastra(config) {
  const { categoryDirName, shastraDirName, title, author, category } = config;
  const sourceShastraPath = path.join(dbDir, categoryDirName, config.sourceShastraDirName || shastraDirName);
  if (!fs.existsSync(sourceShastraPath)) {
    console.error(`Source directory not found: ${sourceShastraPath}`);
    return 0;
  }

  console.log(`Starting conversion for ${title}...`);

  const htmlFolder = path.join(sourceShastraPath, 'html');
  const myItemPath = path.join(htmlFolder, 'myItem.js');

  // Determine existingIndex and shastraChapters first to preserve custom list items
  const destShastraPath = path.join(outDir, categoryDirName, shastraDirName);
  fs.mkdirSync(destShastraPath, { recursive: true });

  const destIndexJsonPath = path.join(destShastraPath, 'index.json');
  let existingIndex = {};
  let chapters = [];
  if (fs.existsSync(myItemPath)) {
    chapters = parseMyItemJs(myItemPath);
    console.log(`Parsed chapters from myItem.js. Found ${chapters.length} chapters.`);
  }

  const hasNoChapters = chapters.length === 0;

  let shastraChapters = chapters;
  if (fs.existsSync(destIndexJsonPath)) {
    try {
      existingIndex = JSON.parse(fs.readFileSync(destIndexJsonPath, 'utf-8'));
      if (existingIndex.chapters && existingIndex.chapters.length > 0) {
        shastraChapters = existingIndex.chapters;
      }
    } catch (e) {
      console.error("Failed to read existing index.json", e);
    }
  }

  // Prepend 0000_शास्त्र-मंगलाचरण or 000_शास्त्र-मंगलाचरण if it exists but is not in chapters
  const hasMangalacharan = fs.existsSync(path.join(htmlFolder, '0000_शास्त्र-मंगलाचरण.html')) || fs.existsSync(path.join(htmlFolder, '000_शास्त्र-मंगलाचरण.html'));
  if (hasMangalacharan) {
    const fileName = fs.existsSync(path.join(htmlFolder, '0000_शास्त्र-मंगलाचरण.html')) ? '0000_शास्त्र-मंगलाचरण' : '000_शास्त्र-मंगलाचरण';
    let firstChapter = shastraChapters[0];
    if (!firstChapter) {
      firstChapter = { name: "मंगलाचरण", items: [] };
      shastraChapters.unshift(firstChapter);
    }
    if (!firstChapter.items.some(item => item.file.startsWith(fileName))) {
      firstChapter.items.unshift({
        file: `${fileName}.txt`,
        gathaNum: '000',
        title: 'शास्त्र-मंगलाचरण'
      });
    }
  }

  // Prepend 000_मंगलाचरण if it exists but is not in chapters
  const hasTeekaMangalacharan = fs.existsSync(path.join(htmlFolder, '000_मंगलाचरण.html'));
  if (hasTeekaMangalacharan) {
    let firstChapter = shastraChapters[0];
    if (!firstChapter) {
      firstChapter = { name: "मंगलाचरण", items: [] };
      shastraChapters.unshift(firstChapter);
    }
    const alreadyExists = shastraChapters.some(ch => ch.items.some(item => item.file.startsWith('000_मंगलाचरण')));
    if (!alreadyExists) {
      const index = firstChapter.items.findIndex(item => item.file.startsWith('0000_शास्त्र-मंगलाचरण'));
      const newItem = {
        file: '000_मंगलाचरण.txt',
        gathaNum: '000_मंगलाचरण',
        title: 'टीकाकार (अमृतचंद्रआचार्य और जयसेनाचार्य) द्वारा मंगलाचरण'
      };
      if (index !== -1) {
        firstChapter.items.splice(index + 1, 0, newItem);
      } else {
        firstChapter.items.unshift(newItem);
      }
    }
  }

  // Prepend 001.html if it exists but is not in chapters
  const has001Html = fs.existsSync(path.join(htmlFolder, '001.html')) && !shastraDirName.includes('पाहुड-दोहा') && !shastraDirName.includes('pahuddoha') && !shastraDirName.includes('pahud-doha');
  if (has001Html) {
    let firstChapter = shastraChapters[0];
    if (!firstChapter) {
      firstChapter = { name: "मंगलाचरण", items: [] };
      shastraChapters.unshift(firstChapter);
    }
    
    let existingItem = null;
    for (const ch of shastraChapters) {
      existingItem = ch.items.find(item => item.file === '001.txt');
      if (existingItem) break;
    }

    if (existingItem) {
      if (shastraDirName.includes('द्रव्यसंग्रह')) {
        existingItem.gathaNum = '000_मंगलाचरण';
      }
      if (shastraDirName.includes('स्वरूप-संबोधन')) {
        existingItem.gathaNum = '001';
        existingItem.title = 'मंगलाचरण';
      }
      if (shastraDirName.includes('योगसार-प्राभृत') || shastraDirName.includes('yogsaarprabhrat')) {
        existingItem.gathaNum = '001';
        existingItem.title = 'जीव अधिकार - ग्रंथकार का मंगलाचरण एवं उद्देश्य';
      }
      if (shastraDirName.includes('योगसार--योगींदुदेव') || shastraDirName.includes('yogsaar')) {
        existingItem.gathaNum = '001';
        existingItem.title = 'सिद्धों को नमस्कार';
      }
    } else {
      let insertIndex = firstChapter.items.findIndex(item => item.file.startsWith('000_मंगलाचरण'));
      if (insertIndex === -1) {
        insertIndex = firstChapter.items.findIndex(item => item.file.startsWith('0000_शास्त्र-मंगलाचरण'));
      }
      let gathaNum = '000_मंगलाचरण';
      let title = 'टीकाकार (ब्रह्मदेव सूरि) द्वारा मंगलाचरण';
      if (shastraDirName.includes('स्वरूप-संबोधन')) {
        gathaNum = '001';
        title = 'मंगलाचरण';
      }
      if (shastraDirName.includes('योगसार-प्राभृत') || shastraDirName.includes('yogsaarprabhrat')) {
        gathaNum = '001';
        title = 'जीव अधिकार - ग्रंथकार का मंगलाचरण एवं उद्देश्य';
      }
      if (shastraDirName.includes('योगसार--योगींदुदेव') || shastraDirName.includes('yogsaar')) {
        gathaNum = '001';
        title = 'सिद्धों को नमस्कार';
      }
      const newItem = {
        file: '001.txt',
        gathaNum,
        title
      };
      if (insertIndex !== -1) {
        firstChapter.items.splice(insertIndex + 1, 0, newItem);
      } else {
        firstChapter.items.unshift(newItem);
      }
    }
  }

  // Check if external teeka file exists in Database/teeka/
  const teekaIndexPath = path.join(__dirname, '..', 'Database', 'teeka', categoryDirName, config.sourceShastraDirName || shastraDirName, 'html', 'index.html');
  let teekaBlocks = null;
  if (fs.existsSync(teekaIndexPath)) {
    try {
      const teekaIndexContent = fs.readFileSync(teekaIndexPath, 'utf-8');
      teekaBlocks = teekaIndexContent.split(/<hr class=type_7>/i);
      console.log(`Loaded external teeka index with ${teekaBlocks.length} blocks for ${title}.`);
    } catch (e) {
      console.error(`Failed to load external teeka file for ${title}:`, e);
    }
  }

  // Read all HTML files in the directory, excluding indexes and incomplete placeholders
  const files = fs.readdirSync(htmlFolder).filter(f => f.endsWith('.html') && !f.includes('index') && f !== '3-0000.html');
  
  let processedCount = 0;
  for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
    const file = files[fileIdx];
    const htmlFilePath = path.join(htmlFolder, file);
    try {
      const parsedData = parseGathaHtml(htmlFilePath);

      // If no teekas were found in the file itself, check external teeka blocks
      if (parsedData.teekas.length === 0 && teekaBlocks && teekaBlocks[fileIdx + 1]) {
        let block = teekaBlocks[fileIdx + 1];
        // Fix database typo where div is closed prematurely inside span
        block = block.replace(/\(पक्का घड़ा<\/div><\/b>/g, '(पक्का घड़ा)। ');
        const teekaMatches = [...block.matchAll(/<div[^>]*class=["']?teeka["']?[^>]*>([\s\S]*?)<\/div>/gi)];
        if (teekaMatches.length > 0) {
          const paras = [];
          let commentatorName = "विशेषार्थ";
          for (const tm of teekaMatches) {
            let tHtml = tm[1];
            const commMatch = tHtml.match(/teeka\d+\s*([^<:]+)\s*:/i);
            if (commMatch) {
              commentatorName = commMatch[1].trim();
            }
            if (/teeka\d+\s*[^<:]+\s*:/i.test(tHtml) && !tHtml.replace(/<[^>]+>/g, '').replace(/teeka\d+\s*[^<:]+\s*:/i, '').trim()) {
              continue;
            }
            tHtml = tHtml.replace(/<b><font color=[^>]*>teeka\d+\s*[^<:]+\s*:\s*<\/font><\/b>/i, '');
            tHtml = tHtml.replace(/<b>teeka\d+\s*[^<:]+\s*:\s*<\/b>/i, '');
            tHtml = tHtml.replace(/teeka\d+\s*[^<:]+\s*:\s*/i, '');
            
            const clean = stripHtml(tHtml);
            if (clean) {
              paras.push(clean);
            }
          }
          if (paras.length > 0) {
            parsedData.teekas.push({
              id: 'teeka00',
              commentator: commentatorName,
              sanskrit: '',
              hindi: paras.join('\n\n')
            });
          }
        }
      }

      const isMangala = file.startsWith('0000_') || file.startsWith('000_');
      const isPahudDoha = shastraDirName.includes('पाहुड-दोहा') || shastraDirName.includes('pahuddoha');
      const isTarangini = shastraDirName.includes('परम-अध्यात्म-तरंगिणी') || shastraDirName.includes('paramadhyatmatarangini');

      if (isPahudDoha && !isMangala) {
        if (file === '001.html') {
          parsedData.title = 'मंगलाचरण';
        } else {
          const rangeMatch = file.match(/^(\d+)[-–](\d+)/);
          if (rangeMatch) {
            parsedData.title = `गाथा ${parseInt(rangeMatch[1], 10)}-${parseInt(rangeMatch[2], 10)}`;
          } else {
            const numMatch = file.match(/^(\d+)/);
            if (numMatch) {
              parsedData.title = `गाथा ${parseInt(numMatch[1], 10)}`;
            }
          }
        }
      }

      const formattedText = formatGathaText(parsedData);
      
      const txtFileName = file.replace('.html', '.txt');
      const txtFilePath = path.join(destShastraPath, txtFileName);
      
      // Do not overwrite existing txt files to prevent losing manual formatting/edits (e.g. Mangalacharans)
      // BUT if the file exists and is missing teekas while parsedData has teekas, update it (except mangalacharan files).
      if (!fs.existsSync(txtFilePath)) {
        fs.writeFileSync(txtFilePath, formattedText, 'utf-8');
      } else if ((isPahudDoha || isTarangini) && !isMangala) {
        let content = fs.readFileSync(txtFilePath, 'utf-8');
        content = content.replace(/^=== Title ===\r?\n[^\r\n]+/m, `=== Title ===\n${parsedData.title}`);
        fs.writeFileSync(txtFilePath, content, 'utf-8');
      } else if (!isMangala && parsedData.teekas.length > 0) {
        const existingTxt = fs.readFileSync(txtFilePath, 'utf-8');
        if (!existingTxt.includes('=== Teeka:')) {
          fs.writeFileSync(txtFilePath, formattedText, 'utf-8');
        }
      }
      processedCount++;
    } catch (err) {
      console.error(`Error parsing file ${file}:`, err);
    }
  }

  // If chapters items were empty (e.g. no myItem.js or failed parsing), build from processed files
  if (!fs.existsSync(myItemPath) || hasNoChapters) {
    // No chapters parsed from myItem.js. We need to build a "मूल ग्रंथ" chapter with all files not already in other chapters
    let mainChapter = shastraChapters.find(ch => ch.name === "मूल ग्रंथ");
    if (!mainChapter) {
      mainChapter = { name: "मूल ग्रंथ", items: [] };
      shastraChapters.push(mainChapter);
    }
    
    const sortedTxtFiles = fs.readdirSync(destShastraPath).filter(f => f.endsWith('.txt')).sort();
    for (const txtFile of sortedTxtFiles) {
      const baseName = path.basename(txtFile, '.txt');
      
      // Check if already in some chapter
      const alreadyExists = shastraChapters.some(ch => ch !== mainChapter && ch.items.some(item => item.file === txtFile));
      const alreadyInMain = mainChapter.items.some(item => item.file === txtFile);
      if (!alreadyExists && !alreadyInMain) {
        const txtFilePath = path.join(destShastraPath, txtFile);
        const fileTitle = readTitleFromTxt(txtFilePath);
        mainChapter.items.push({
          file: txtFile,
          gathaNum: baseName,
          title: fileTitle || `गाथा ${baseName}`
        });
      }
    }
  }
  // Post-processing for specific scriptures
  if (shastraDirName.includes('समाधितन्त्र')) {
    // 1. Remove '000_मंगलाचरण.txt' from all chapters
    for (const chapter of shastraChapters) {
      chapter.items = chapter.items.filter(item => item.file !== '000_मंगलाचरण.txt');
    }
    
    // 2. Find '001.txt' and move it to the "मंगलाचरण" chapter
    let item001 = null;
    for (const chapter of shastraChapters) {
      const idx = chapter.items.findIndex(item => item.file === '001.txt');
      if (idx !== -1) {
        item001 = chapter.items.splice(idx, 1)[0];
        break;
      }
    }
    
    if (item001) {
      let mangalaChapter = shastraChapters.find(ch => ch.name === 'मंगलाचरण');
      if (!mangalaChapter) {
        mangalaChapter = { name: 'मंगलाचरण', items: [] };
        shastraChapters.unshift(mangalaChapter);
      }
      const insertIdx = mangalaChapter.items.findIndex(item => item.file.startsWith('0000_शास्त्र-मंगलाचरण'));
      if (insertIdx !== -1) {
        mangalaChapter.items.splice(insertIdx + 1, 0, item001);
      } else {
        mangalaChapter.items.unshift(item001);
      }
    }
  }

  // Auto-append any converted .txt files that are not referenced in the manifest chapters
  const allTxtFiles = fs.readdirSync(destShastraPath).filter(f => f.endsWith('.txt')).sort();
  for (const txtFile of allTxtFiles) {
    const alreadyExists = shastraChapters.some(ch => ch.items.some(item => item.file === txtFile));
    if (!alreadyExists) {
      const baseName = path.basename(txtFile, '.txt');
      const txtFilePath = path.join(destShastraPath, txtFile);
      const fileTitle = readTitleFromTxt(txtFilePath);
      
      const item = {
        file: txtFile,
        gathaNum: baseName,
        title: fileTitle || `गाथा ${baseName}`
      };

      const getNumeric = (itm) => {
        const base = path.basename(itm.file, '.txt');
        const numStr = itm.gathaNum || base;
        if (shastraDirName.includes('paramatmaprakash') || shastraDirName.includes('परमात्मप्रकाश') ||
            shastraDirName.includes('tatvaarthsutra') || shastraDirName.includes('तत्त्वार्थसूत्र')) {
          const secMatch = numStr.match(/^(\d+)[-–](\d+)/);
          if (secMatch) {
            const major = parseInt(secMatch[1], 10);
            const minor = parseInt(secMatch[2], 10);
            return major * 10000 + minor;
          }
        }
        const numMatch = numStr.match(/^(\d+)/);
        if (numMatch) {
          return parseInt(numMatch[1], 10);
        }
        return null;
      };

      const val = getNumeric(item);
      
      // Find the best chapter for this item
      let targetChapter = null;
      if (val !== null) {
        // 1. Look for a chapter where the item fits within its min/max range
        for (const chapter of shastraChapters) {
          if (chapter.name === "मंगलाचरण") continue; // Keep Mangalacharan isolated
          const numericItems = chapter.items
            .map(itm => getNumeric(itm))
            .filter(n => n !== null);
          
          if (numericItems.length > 0) {
            const min = Math.min(...numericItems);
            const max = Math.max(...numericItems);
            if (val >= min && val <= max) {
              targetChapter = chapter;
              break;
            }
          }
        }

        // 2. If not inside any chapter's range, find the chapter whose end is closest but before val
        if (!targetChapter) {
          let minDiff = Infinity;
          for (const chapter of shastraChapters) {
            if (chapter.name === "मंगलाचरण") continue;
            const numericItems = chapter.items
              .map(itm => getNumeric(itm))
              .filter(n => n !== null);
            if (numericItems.length > 0) {
              const max = Math.max(...numericItems);
              if (val > max && (val - max) < minDiff) {
                minDiff = val - max;
                targetChapter = chapter;
              }
            }
          }
        }
      }

      if (!targetChapter) {
        // Fallback to the last chapter or "मूल ग्रंथ"
        targetChapter = shastraChapters.find(ch => ch.name === "मूल ग्रंथ") || shastraChapters[shastraChapters.length - 1];
      }

      if (!targetChapter) {
        targetChapter = { name: "मूल ग्रंथ", items: [] };
        shastraChapters.push(targetChapter);
      }

      targetChapter.items.push(item);
    }
  }

  // Deduplicate files across all chapters, keeping only the first occurrence of each file
  const seenFiles = new Set();
  for (const chapter of shastraChapters) {
    chapter.items = chapter.items.filter(item => {
      if (seenFiles.has(item.file)) {
        return false;
      }
      seenFiles.add(item.file);
      return true;
    });

    // Sort items in the chapter numerically
    chapter.items.sort((a, b) => {
      const getNumeric = (item) => {
        const base = path.basename(item.file, '.txt');
        const numStr = item.gathaNum || base;
        
        // Match major-minor pattern (like 1-002 or 2-025)
        if (shastraDirName.includes('paramatmaprakash') || shastraDirName.includes('परमात्मप्रकाश') ||
            shastraDirName.includes('tatvaarthsutra') || shastraDirName.includes('तत्त्वार्थसूत्र')) {
          const secMatch = numStr.match(/^(\d+)[-–](\d+)/);
          if (secMatch) {
            const major = parseInt(secMatch[1], 10);
            const minor = parseInt(secMatch[2], 10);
            return major * 10000 + minor;
          }
        }

        // Match standard leading number pattern (like 019 or 13-14 or 13)
        const numMatch = numStr.match(/^(\d+)/);
        if (numMatch) {
          return parseInt(numMatch[1], 10);
        }
        
        return 999999;
      };

      const valA = getNumeric(a);
      const valB = getNumeric(b);
      
      if (valA !== valB) {
        return valA - valB;
      }
      return a.file.localeCompare(b.file);
    });
  }

  // Move Mangalacharan items into their own "मंगलाचरण" chapter
  const mangalaItems = [];
  for (const chapter of shastraChapters) {
    if (chapter.name === "मंगलाचरण") {
      mangalaItems.push(...chapter.items);
      chapter.items = [];
      continue;
    }
    
    const toMove = chapter.items.filter(item => {
      const base = path.basename(item.file, '.txt');
      const isMangalaFile = 
        base.startsWith('0000_शास्त्र-मंगलाचरण') || 
        base.startsWith('000_शास्त्र-मंगलाचरण') || 
        base.startsWith('000_मंगलाचरण') || 
        (base === '001' && !shastraDirName.includes('योगसार-प्राभृत') && !shastraDirName.includes('yogsaarprabhrat') && !shastraDirName.includes('panchadhyayi') && !shastraDirName.includes('पंचाध्यायी') && !shastraDirName.includes('पाहुड-दोहा') && !shastraDirName.includes('pahuddoha')) || 
        base === '01' ||
        (base === '1-001' && !shastraDirName.includes('panchadhyayi') && !shastraDirName.includes('पंचाध्यायी'));
      
      const isMangalaTitle = 
        (item.title.includes('मंगलाचरण') && !shastraDirName.includes('योगसार-प्राभृत') && !shastraDirName.includes('yogsaarprabhrat') && !shastraDirName.includes('panchadhyayi') && !shastraDirName.includes('पंचाध्यायी') && !shastraDirName.includes('पाहुड-दोहा') && !shastraDirName.includes('pahuddoha')) || 
        item.gathaNum === '000' || 
        (item.gathaNum === '001' && !shastraDirName.includes('योगसार-प्राभृत') && !shastraDirName.includes('yogsaarprabhrat') && !shastraDirName.includes('panchadhyayi') && !shastraDirName.includes('पंचाध्यायी') && !shastraDirName.includes('पाहुड-दोहा') && !shastraDirName.includes('pahuddoha')) || 
        item.gathaNum === '01' ||
        (item.gathaNum === '1-001' && !shastraDirName.includes('panchadhyayi') && !shastraDirName.includes('पंचाध्यायी')) ||
        item.gathaNum === '000_मंगलाचरण';

      return isMangalaFile || isMangalaTitle;
    });

    chapter.items = chapter.items.filter(item => !toMove.includes(item));
    mangalaItems.push(...toMove);
  }

  // Remove empty chapters except "मंगलाचरण"
  shastraChapters = shastraChapters.filter(ch => ch.items.length > 0 || ch.name === "मंगलाचरण");

  if (mangalaItems.length > 0) {
    let mangalaChapter = shastraChapters.find(ch => ch.name === 'मंगलाचरण');
    if (!mangalaChapter) {
      mangalaChapter = { name: 'मंगलाचरण', items: [] };
      shastraChapters.unshift(mangalaChapter);
    }
    const seen = new Set();
    mangalaChapter.items = mangalaItems.filter(item => {
      if (seen.has(item.file)) return false;
      seen.add(item.file);
      return true;
    });

    // Sort Mangalacharan items numerically (000 before 001/01/1-001)
    mangalaChapter.items.sort((a, b) => {
      const getNum = (itm) => {
        const base = path.basename(itm.file, '.txt');
        if (base.startsWith('0000_शास्त्र-मंगलाचरण') || base.startsWith('000_शास्त्र-मंगलाचरण')) return 0;
        if (base.startsWith('000_मंगलाचरण')) return 1;
        if (base === '001' || base === '01' || base === '1-001') return 2;
        return 9;
      };
      return getNum(a) - getNum(b);
    });
  }



  if (config.id === 'paramadhyatmatarangini') {
    const taranginiChapters = [
      { name: "मंगलाचरण", items: [] },
      { name: "मूल ग्रंथ", items: [] }
    ];

    const allTxtFiles = fs.readdirSync(destShastraPath).filter(f => f.endsWith('.txt')).sort();
    for (const txtFile of allTxtFiles) {
      const baseName = path.basename(txtFile, '.txt');
      if (baseName.startsWith('0000_शास्त्र-मंगलाचरण') || baseName.startsWith('000_शास्त्र-मंगलाचरण')) {
        taranginiChapters[0].items.push({
          file: txtFile,
          gathaNum: '000',
          title: 'शास्त्र-मंगलाचरण'
        });
      } else {
        const txtFilePath = path.join(destShastraPath, txtFile);
        const fileTitle = readTitleFromTxt(txtFilePath);
        const numMatch = baseName.match(/^(\d+)/);
        const shlokaNumber = numMatch ? parseInt(numMatch[1], 10) : baseName;
        taranginiChapters[1].items.push({
          file: txtFile,
          gathaNum: baseName,
          title: fileTitle || `श्लोक ${shlokaNumber}`
        });
      }
    }

    taranginiChapters[0].items.sort((a, b) => a.file.localeCompare(b.file));

    taranginiChapters[1].items.sort((a, b) => {
      const numA = parseInt(a.gathaNum.match(/\d+/)?.[0] || '0', 10);
      const numB = parseInt(b.gathaNum.match(/\d+/)?.[0] || '0', 10);
      return numA - numB;
    });

    shastraChapters = taranginiChapters;
  }

  const shastraIndexJson = {
    title,
    author,
    category,
    cover: config.cover || existingIndex.cover || {
      invocation: "!! श्रीसर्वज्ञवीतरागाय नमः !!",
      authorPrefix: `श्रीमद्-भगवत्${author}-प्रणीत`,
      title: `श्री ${title}`,
      subtitle: `मूल प्राकृत गाथा, श्री अमृतचंद्राचार्य विरचित 'समय-व्याख्या' नामक संस्कृत टीका का हिंदी अनुवाद, श्री जयसेनाचार्य विरचित 'तात्पर्य-वृत्ति' नामक संस्कृत टीका का हिंदी अनुवाद सहित`,
      credits: "आभार : विजय कुमार जैन"
    },
    chapters: shastraChapters
  };
  fs.writeFileSync(destIndexJsonPath, JSON.stringify(shastraIndexJson, null, 2), 'utf-8');

  console.log(`Successfully converted ${processedCount} gatha HTML files into plain text.`);
  return processedCount;
}

const configs = [
  {
    id: "paramadhyatmatarangini",
    title: "परम-अध्यात्म-तरंगिणी",
    author: "अमृतचंद्राचार्य",
    category: "द्रव्यानुयोग",
    categoryHi: "द्रव्यानुयोग",
    categoryEn: "Dravyanuyog",
    categorySlug: "dravyanuyog",
    shastraSlug: "paramadhyatmatarangini",
    categoryDirName: "01_द्रव्यानुयोग",
    sourceShastraDirName: "17_परम-अध्यात्म-तरंगिणी--अमृतचंद्राचार्य",
    shastraDirName: "14_परम-अध्यात्म-तरंगिणी--अमृतचंद्राचार्य",
    gathaCount: 112,
    cover: {
      invocation: "!! श्रीसर्वज्ञवीतरागाय नम: !!",
      authorPrefix: "श्रीमद्-अमृतचंद्राचार्य-प्रणीत",
      title: "श्री परम-अध्यात्म-तरंगिणी",
      subtitle: "मूल संस्कृत श्लोक एवं हिंदी अन्वयार्थ",
      credits: ""
    }
  }
  // To upload a new shastra in the future, simply add its config object here:
  // e.g.
  // {
  //   id: "tattvajnanatarangini",
  //   title: "तत्त्वज्ञान-तरंगिणी",
  //   author: "भट्टारक-ज्ञानभूषण",
  //   category: "द्रव्यानुयोग",
  //   categoryHi: "द्रव्यानुयोग",
  //   categoryEn: "Dravyanuyog",
  //   categorySlug: "dravyanuyog",
  //   shastraSlug: "tattvajnanatarangini",
  //   categoryDirName: "01_द्रव्यानुयोग",
  //   sourceShastraDirName: "18_तत्त्वज्ञान-तरंगिणी--भट्टारक-ज्ञानभूषण",
  //   shastraDirName: "15_तत्त्वज्ञान-तरंगिणी--भट्टारक-ज्ञानभूषण"
  // }
];

function getActualGathaCount(chapters, configId, explicitCount) {
  if (explicitCount) return explicitCount;
  if (configId === 'paramadhyatmatarangini') return 112;

  let maxGatha = 0;
  let totalValidItems = 0;
  for (const chapter of chapters) {
    for (const item of chapter.items) {
      const numStr = item.gathaNum.trim();
      // Skip Mangalacharans and non-numbered items
      if (numStr.startsWith("000") || numStr.includes("मंगलाचरण") || item.title.includes("मंगलाचरण")) {
        continue;
      }
      
      // Skip Parishisht and non-gatha text items by checking gathaNum, title and file
      const hasParishisht = 
        numStr.toLowerCase().includes("parishisht") || numStr.includes("परिशिष्ट") ||
        item.title.toLowerCase().includes("parishisht") || item.title.includes("परिशिष्ट") ||
        item.file.toLowerCase().includes("parishisht") || item.file.includes("परिशिष्ट");
        
      if (hasParishisht || numStr.includes("प्रस्तावना") || numStr.includes("चूलिका")) {
        continue;
      }
      
      totalValidItems++;

      const rangeMatch = numStr.match(/^(\d+)[-–](\d+)$/);
      if (rangeMatch) {
        const end = parseInt(rangeMatch[2], 10);
        if (!isNaN(end) && end > maxGatha) {
          maxGatha = end;
        }
        continue;
      }
      
      const singleMatch = numStr.match(/^(\d+)/);
      if (singleMatch) {
        const val = parseInt(singleMatch[1], 10);
        if (!isNaN(val) && val > maxGatha) {
          maxGatha = val;
        }
        continue;
      }
    }
  }
  return maxGatha || totalValidItems;
}

function main() {
  const manifestPath = path.join(outDir, 'manifest.json');
  let globalManifest = [];

  // Preserve existing manifest entries for already uploaded scriptures
  if (fs.existsSync(manifestPath)) {
    try {
      globalManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (e) {
      console.error("Failed to parse existing manifest.json:", e);
    }
  }

  for (const config of configs) {
    const processedCount = convertShastra(config);
    if (processedCount > 0) {
      // Load chapters from newly generated index.json to calculate the actual gatha count
      const destShastraPath = path.join(outDir, config.categoryDirName, config.shastraDirName);
      const destIndexJsonPath = path.join(destShastraPath, 'index.json');
      let gathaCount = config.gathaCount || processedCount;
      if (!config.gathaCount && fs.existsSync(destIndexJsonPath)) {
        try {
          const indexJson = JSON.parse(fs.readFileSync(destIndexJsonPath, 'utf-8'));
          if (indexJson && indexJson.chapters) {
            gathaCount = getActualGathaCount(indexJson.chapters, config.id, config.gathaCount);
          }
        } catch (e) {
          console.error(`Failed to read index.json for ${config.title}:`, e);
        }
      }

      const entry = {
        id: config.id,
        title: config.title,
        author: config.author,
        categoryHi: config.categoryHi,
        categoryEn: config.categoryEn,
        categorySlug: config.categorySlug,
        shastraSlug: config.shastraSlug,
        path: `${config.categoryDirName}/${config.shastraDirName}`,
        gathaCount: gathaCount
      };

      // Upsert: update existing entry or append new one
      const existingIdx = globalManifest.findIndex(
        m => m.id === config.id || m.shastraSlug === config.shastraSlug
      );
      if (existingIdx !== -1) {
        globalManifest[existingIdx] = entry;
      } else {
        globalManifest.push(entry);
      }
    }
  }

  fs.writeFileSync(manifestPath, JSON.stringify(globalManifest, null, 2), 'utf-8');
  console.log(`Updated manifest.json (${globalManifest.length} scriptures in registry).`);
}

main();
