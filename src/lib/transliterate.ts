/**
 * Hindi to Roman (Latin) transliteration utility
 * Converts Devanagari script to simple ASCII romanization (no diacritics)
 */

// Vowels - using simple ASCII
const vowels: Record<string, string> = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee',
  'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri', 'ॠ': 'ree',
  'ऌ': 'lri', 'ॡ': 'lree', 'ए': 'e', 'ऐ': 'ai',
  'ओ': 'o', 'औ': 'au', 'अं': 'an', 'अः': 'ah',
};

// Vowel signs (matras) - using simple ASCII
const matras: Record<string, string> = {
  'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u',
  'ू': 'oo', 'ृ': 'ri', 'ॄ': 'ree', 'ॢ': 'lri',
  'ॣ': 'lree', 'े': 'e', 'ै': 'ai', 'ो': 'o',
  'ौ': 'au', 'ं': 'n', 'ः': 'h', 'ँ': 'n',
};

// Consonants - using simple ASCII
const consonants: Record<string, string> = {
  'क': 'ka', 'ख': 'kha', 'ग': 'ga', 'घ': 'gha', 'ङ': 'nga',
  'च': 'cha', 'छ': 'chha', 'ज': 'ja', 'झ': 'jha', 'ञ': 'nya',
  'ट': 'ta', 'ठ': 'tha', 'ड': 'da', 'ढ': 'dha', 'ण': 'na',
  'त': 'ta', 'थ': 'tha', 'द': 'da', 'ध': 'dha', 'न': 'na',
  'प': 'pa', 'फ': 'pha', 'ब': 'ba', 'भ': 'bha', 'म': 'ma',
  'य': 'ya', 'र': 'ra', 'ल': 'la', 'व': 'va', 'w': 'wa',
  'श': 'sha', 'ष': 'sha', 'स': 'sa', 'ह': 'ha',
  'क़': 'qa', 'ख़': 'kha', 'ग़': 'ga', 'ज़': 'za',
  'ड़': 'da', 'ढ़': 'dha', 'फ़': 'fa',
  '\u0958': 'qa', '\u0959': 'kha', '\u095a': 'ga', '\u095b': 'za',
  '\u095c': 'da', '\u095d': 'dha', '\u095e': 'fa', '\u095f': 'ya',
  '\u0915\u093c': 'qa', '\u0916\u093c': 'kha', '\u0917\u093c': 'ga', '\u091c\u093c': 'za',
  '\u0921\u093c': 'da', '\u0922\u093c': 'dha', '\u092b\u093c': 'fa', '\u092f\u093c': 'ya',
  'ळ': 'la', 'क्ष': 'ksha', 'ज्ञ': 'gya',
};

// Halant (virama) - removes inherent 'a'
const halant = '्';

// Hindi numbers
const numbers: Record<string, string> = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
};

/**
 * Transliterate Hindi/Devanagari text to Roman script (simple ASCII)
 */
export function transliterateToRoman(text: string): string {
  if (!text) return '';
  
  let result = '';
  let i = 0;
  
  while (i < text.length) {
    const char = text[i];
    
    // Skip standalone nukta
    if (char === '\u093c') {
      i++;
      continue;
    }

    // Check if it's a number
    if (numbers[char]) {
      result += numbers[char];
      i++;
      continue;
    }

    // Check if it's a vowel
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

    // Check if it's a consonant
    if (matchLen > 0) {
      let consonant = consonantStr;
      i += matchLen;
      
      // Check for halant (virama)
      if (text[i] === halant) {
        // Remove the inherent 'a' from consonant
        consonant = consonant.slice(0, -1);
        i++;
      }
      
      // Check for matra (vowel sign)
      if (matras[text[i]]) {
        // Special case for Anusvara and Chandrabindu: they don't replace the inherent 'a'
        if (text[i] === 'ं' || text[i] === 'ँ') {
          consonant = consonant + matras[text[i]];
        } else {
          // Remove inherent 'a' and add matra
          consonant = consonant.slice(0, -1) + matras[text[i]];
        }
        i++;
        
        // If there's an Anusvara/Chandrabindu after a matra (e.g. ों)
        if ((text[i] === 'ं' || text[i] === 'ँ') && matras[text[i]]) {
          consonant = consonant + matras[text[i]];
          i++;
        }
      }
      
      result += consonant;
      continue;
    }
    
    // Check if it's a matra (shouldn't happen in well-formed text)
    if (matras[char]) {
      result += matras[char];
      i++;
      continue;
    }
    
    // If it's punctuation, number, or other character, keep as is
    result += char;
    i++;
  }
  
  // Schwa deletion rule for words ending in "न" or "ल"
  if ((text.endsWith('न') || text.endsWith('ल')) && result.endsWith('a')) {
    result = result.slice(0, -1);
  }
  
  return result;
}

/**
 * Transliterate with word boundaries preserved
 */
export function transliterateText(text: string): string {
  if (!text) return '';
  // Split by lines and process each line
  return text
    .split('\n')
    .map(line => {
      // Split by words (spaces and punctuation)
      return line
        .split(/(\s+|[।॥,;.!?—\-()[\]{}])/g)
        .map(word => {
          // If it's whitespace or punctuation, keep as is
          if (/^[\s।॥,;.!?—\-()[\]{}]+$/.test(word)) {
            return word;
          }
          // Otherwise transliterate
          return transliterateToRoman(word);
        })
        .join('');
    })
    .join('\n');
}
