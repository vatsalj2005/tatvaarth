import React from 'react';

/**
 * Shared Devanagari text parsing, diagram extraction, and bracketed highlighting
 * used across ShastraReader and ShastraPrintTemplate.
 */

let _measureCanvas: HTMLCanvasElement | null = null;
let _measureCtx: CanvasRenderingContext2D | null = null;

export const measureTextWidth = (text: string, font: string = '600 16px "Noto Sans Devanagari", sans-serif'): number => {
  if (typeof document === 'undefined') return text.length * 9.5;
  if (!_measureCanvas) {
    _measureCanvas = document.createElement('canvas');
    _measureCtx = _measureCanvas.getContext('2d');
  }
  if (!_measureCtx) return text.length * 9.5;
  _measureCtx.font = font;
  return _measureCtx.measureText(text).width;
};

export interface DynamicVerseFontOptions {
  minSize?: number;
  maxSize?: number;
  baseSize?: number;
  paddingBuffer?: number;
  fontFamily?: string;
}

export const getDynamicVerseFontSize = (
  lines: string[],
  availableWidth: number,
  options?: DynamicVerseFontOptions
): number => {
  const minSize = options?.minSize ?? 10;
  const maxSize = options?.maxSize ?? 32;
  const baseSize = options?.baseSize ?? 16;
  const paddingBuffer = options?.paddingBuffer ?? 12;
  const fontFamily = options?.fontFamily ?? '"Noto Sans Devanagari", "Noto Serif Devanagari", sans-serif';

  if (!lines || lines.length === 0 || availableWidth <= 0) return minSize;

  const font = `600 ${baseSize}px ${fontFamily}`;
  let maxLineWidth = 0;
  let longestLine = '';
  for (const line of lines) {
    const trimmed = line.replace(/^[!*]+\s*|\s*[!*]+$/g, '').trim();
    if (!trimmed) continue;
    const w = measureTextWidth(trimmed, font);
    if (w > maxLineWidth) {
      maxLineWidth = w;
      longestLine = trimmed;
    }
  }

  if (maxLineWidth <= 0) return baseSize;

  const targetWidth = Math.max(availableWidth - paddingBuffer, 80);
  let calculatedSize = baseSize * (targetWidth / maxLineWidth);

  // Verification pass at calculatedSize to guarantee zero overflow even with non-linear font scaling / ligatures
  if (_measureCtx && longestLine) {
    _measureCtx.font = `600 ${calculatedSize}px ${fontFamily}`;
    const actualWidth = _measureCtx.measureText(longestLine).width;
    if (actualWidth > targetWidth) {
      calculatedSize = calculatedSize * (targetWidth / actualWidth);
    }
  }

  return Math.round(Math.max(minSize, Math.min(calculatedSize, maxSize)) * 10) / 10;
};

export const groupIntoDohas = (text: string): string[][] => {
  if (!text) return [];
  const lines = text.split('\n');
  const dohas: string[][] = [];
  let currentDoha: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      if (currentDoha.length > 0) {
        dohas.push(currentDoha);
        currentDoha = [];
      }
      continue;
    }

    currentDoha.push(rawLine);

    // If this line ends with a doha/verse number marker like ॥1॥ or ॥५६॥ or ||1||
    const hasVerseEnd = /[॥|]+\s*[\d\u0966-\u096F]+\s*[॥|]+$/.test(trimmed);
    if (hasVerseEnd) {
      dohas.push(currentDoha);
      currentDoha = [];
    }
  }

  if (currentDoha.length > 0) {
    dohas.push(currentDoha);
  }

  return dohas;
};

export const devanagariToEnglish = (str: string): string => {
  const map: Record<string, string> = {
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
  };
  return str.replace(/[०-९]/g, d => map[d] || d);
};

export const getRowRange = (text: string): { start: number; end: number } | null => {
  if (!text) return null;
  const englishText = devanagariToEnglish(text);
  const match = englishText.match(/\(([^)]+)\)/);
  if (!match) return null;
  const rangeStr = match[1].trim();
  
  if (rangeStr.includes('-') || rangeStr.includes('से')) {
    const parts = rangeStr.split(/[-–]|से/).map(p => parseInt(p.trim(), 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return { start: parts[0], end: parts[1] };
    }
  }
  
  const numbers = rangeStr.split(/[,व\s]+/).map(p => parseInt(p.trim(), 10)).filter(n => !isNaN(n));
  if (numbers.length > 0) {
    return { start: Math.min(...numbers), end: Math.max(...numbers) };
  }
  
  return null;
};

export const cleanAnvayarthText = (text: string): string => {
  if (!text) return '';
  return text
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return !(
        trimmed.startsWith('var mind') || 
        trimmed.startsWith('var options') || 
        trimmed.includes('new jsMind') || 
        trimmed.includes('jm.show') ||
        trimmed.startsWith('var oc') ||
        trimmed.includes('new OrgChart')
      );
    })
    .join('\n');
};

export const parseTextWithDiagrams = (text: string): { type: 'text' | 'diagram'; content: string }[] => {
  if (!text) return [];
  const parts: { type: 'text' | 'diagram'; content: string }[] = [];
  const regex = /\[DIAGRAM\]([\s\S]*?)\[\/DIAGRAM\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const textBefore = text.slice(lastIndex, match.index);
    if (textBefore.trim()) {
      parts.push({ type: 'text', content: textBefore });
    }
    parts.push({ type: 'diagram', content: match[1].trim() });
    lastIndex = regex.lastIndex;
  }

  const textAfter = text.slice(lastIndex);
  if (textAfter.trim()) {
    parts.push({ type: 'text', content: textAfter });
  }

  return parts;
};

export const highlightBracketedTerms = (text: string): React.ReactNode => {
  const processText = (t: string) => {
    const parts = t.split(/(\*\*\[[^\]]+\]\*\*|\[[^\]]+\]|\([^\)]+\)|\{[^\}]+\}|(?:समाधान|उत्तर)\s*[–-])/);
    return parts.map((part, index) => {
      const solutionMatch = part.match(/^(समाधान|उत्तर)\s*([–-])$/);
      if (solutionMatch) {
        return (
          <span key={index} className="text-emerald-700 dark:text-emerald-400 font-bold pr-1">
            {solutionMatch[1]} {solutionMatch[2]}
          </span>
        );
      }
      const boldMatch = part.match(/\*\*\[([^\]]+)\]\*\*/);
      if (boldMatch) {
        return (
          <span key={index} className="font-bold text-red-800 dark:text-gold px-0.5">
            [{boldMatch[1]}]
          </span>
        );
      }
      const normalMatch = part.match(/^\[([^\]]+)\]$/);
      if (normalMatch) {
        return (
          <span key={index} className="font-bold text-red-800 dark:text-gold px-0.5">
            [{normalMatch[1]}]
          </span>
        );
      }
      const parenMatch = part.match(/^\(([^\)]+)\)$/);
      if (parenMatch && !/^\(\s*\d+\s*\)$/.test(part) && !/^\(कलश-/.test(part)) {
        return (
          <span key={index} className="text-sky-700 dark:text-sky-400 font-medium px-0.5">
            ({parenMatch[1]})
          </span>
        );
      }
      const curlyMatch = part.match(/^\{([^\}]+)\}$/);
      if (curlyMatch) {
        return (
          <span key={index} className="text-orange-800 dark:text-orange-400 font-semibold px-0.5">
            {curlyMatch[1]}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Special philosophical schools prefix
  const specialPrefixMatch = text.match(/^(\s*[•◦▪▫\-*]\s+)?(सांख्य(?:\s*\([^)]+\))?(?:\s*[-–])?|नैयायिक(?:ादि)?\s*[-–]?|वैशेषिक\s*[-–]?|बौद्ध\s*[-–]?)\s*(.*)$/);
  if (specialPrefixMatch) {
    return (
      <span>
        {specialPrefixMatch[1] || ""}
        <span className="inline px-1 py-0 mr-1 rounded text-gold font-semibold bg-gold/10 border border-gold/10 align-baseline">
          {specialPrefixMatch[2].trim()}
        </span>
        {processText(specialPrefixMatch[3])}
      </span>
    );
  }

  // List items prefix (e.g., "१. जीवत्वशक्ति -")
  const prefixMatch = text.match(/^([०-९0-9]+(?:-[०-९0-9]+)?\.\s+)(.*?[\s]*[-–]+(?:[\s]+|$))(.*)$/);
  if (prefixMatch && (prefixMatch[1].length + prefixMatch[2].length) <= 60) {
    const trimmedTerm = prefixMatch[2].trim().replace(/[-–\s]+$/, '');
    const wordCount = trimmedTerm.split(/\s+/).filter(w => w.length > 0).length;
    const isQuestionOrSolution = ['प्रश्न', 'शंका', 'उत्तर', 'समाधान'].includes(trimmedTerm);
    const isInvalidTerm = wordCount > 4 || /[,，।?？]/.test(trimmedTerm);

    if (!isQuestionOrSolution && !isInvalidTerm) {
      return (
        <span>
          {prefixMatch[1]}
          <span className="inline px-1 py-0 mr-1 rounded text-gold font-semibold bg-gold/10 border border-gold/10 align-baseline">
            {prefixMatch[2].trim()}
          </span>
          {processText(prefixMatch[3])}
        </span>
      );
    }
  }

  return processText(text);
};
