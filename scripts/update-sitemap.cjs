const fs = require('fs');
const path = require('path');

// Ported from src/lib/transliterate.ts
const vowels = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee',
  'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri', 'ॠ': 'ree',
  'ऌ': 'lri', 'ॡ': 'lree', 'ए': 'e', 'ऐ': 'ai',
  'ओ': 'o', 'औ': 'au', 'अं': 'an', 'अः': 'ah',
};

const matras = {
  'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u',
  'ू': 'oo', 'ृ': 'ri', 'ॄ': 'ree', 'ॢ': 'lri',
  'ॣ': 'lree', 'े': 'e', 'ै': 'ai', 'ो': 'o',
  'ौ': 'au', 'ं': 'n', 'ः': 'h', 'ँ': 'n',
};

const consonants = {
  'क': 'ka', 'ख': 'kha', 'ग': 'ga', 'घ': 'gha', 'ङ': 'nga',
  'च': 'cha', 'छ': 'chha', 'ज': 'ja', 'झ': 'jha', 'ञ': 'nya',
  'ट': 'ta', 'ठ': 'tha', 'ड': 'da', 'ढ': 'dha', 'ण': 'na',
  'त': 'ta', 'थ': 'tha', 'द': 'da', 'ध': 'dha', 'न': 'na',
  'प': 'pa', 'फ': 'pha', 'ब': 'ba', 'भ': 'bha', 'म': 'ma',
  'य': 'ya', 'र': 'ra', 'ल': 'la', 'व': 'va', 'w': 'wa',
  'श': 'sha', 'ष': 'sha', 'स': 'sa', 'ह': 'ha',
  'क़': 'qa', 'ख़': 'kha', 'ग़': 'gha', 'ज़': 'za',
  'ड़': 'da', 'ढ़': 'dha', 'फ़': 'fa',
  'ळ': 'la', 'क्ष': 'ksha', 'ज्ञ': 'gya',
};

const halant = '्';

const numbers = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
};

function transliterateToRoman(text) {
  if (!text) return '';
  
  let result = '';
  let i = 0;
  
  while (i < text.length) {
    const char = text[i];
    
    if (numbers[char]) {
      result += numbers[char];
      i++;
      continue;
    }

    if (vowels[char]) {
      result += vowels[char];
      i++;
      continue;
    }

    const twoChar = char + (text[i + 1] || '');
    const threeChar = char + (text[i + 1] || '') + (text[i + 2] || '');
    
    let matchLen = 0;
    let consonantStr = '';

    if (consonants[threeChar]) {
      consonantStr = consonants[threeChar];
      matchLen = 3;
    } else if (consonants[twoChar]) {
      consonantStr = consonants[twoChar];
      matchLen = 2;
    } else if (consonants[char]) {
      consonantStr = consonants[char];
      matchLen = 1;
    }

    if (matchLen > 0) {
      let consonant = consonantStr;
      i += matchLen;
      
      if (text[i] === halant) {
        consonant = consonant.slice(0, -1);
        i++;
      }
      
      if (matras[text[i]]) {
        if (text[i] === 'ं' || text[i] === 'ँ') {
          consonant = consonant + matras[text[i]];
        } else {
          consonant = consonant.slice(0, -1) + matras[text[i]];
        }
        i++;
        
        if ((text[i] === 'ं' || text[i] === 'ँ') && matras[text[i]]) {
          consonant = consonant + matras[text[i]];
          i++;
        }
      }
      
      result += consonant;
      continue;
    }
    
    if (matras[char]) {
      result += matras[char];
      i++;
      continue;
    }
    
    result += char;
    i++;
  }
  
  if ((text.endsWith('न') || text.endsWith('ल')) && result.endsWith('a')) {
    result = result.slice(0, -1);
  }
  
  return result;
}

function getRomanizedSlug(originalSlug) {
  const roman = transliterateToRoman(originalSlug);
  return roman
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const sitemapPath = path.join(__dirname, '..', 'public', 'sitemap.xml');
let content = fs.readFileSync(sitemapPath, 'utf8');

// Replace tatva-ka-arth with tatvaarth in sitemap.xml
content = content.replace(/tatva-ka-arth/g, 'tatvaarth');

// Find and romanize any loc tags that have Hindi in them
content = content.replace(/<loc>(https:\/\/vatsalj2005\.github\.io\/tatvaarth\/bhajan\/[a-z]+\/)([^<]+)<\/loc>/g, (match, prefix, pathSegment) => {
  try {
    const decoded = decodeURIComponent(pathSegment);
    const romanized = getRomanizedSlug(decoded);
    console.log(`Romanized: ${decoded} -> ${romanized}`);
    return `<loc>${prefix}${romanized}</loc>`;
  } catch (e) {
    console.error(`Error decoding: ${pathSegment}`, e);
    return match;
  }
});

fs.writeFileSync(sitemapPath, content, 'utf8');
console.log('Successfully updated sitemap.xml');
