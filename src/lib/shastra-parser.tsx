import React from 'react';

/**
 * Shared Devanagari text parsing, diagram extraction, and bracketed highlighting
 * used across ShastraReader and ShastraPrintTemplate.
 */

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
        <span className="px-1 py-0.5 mr-1 rounded text-gold font-semibold bg-gold/10 border border-gold/10">
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
          <span className="px-1 py-0.5 mr-1 rounded text-gold font-semibold bg-gold/10 border border-gold/10">
            {prefixMatch[2].trim()}
          </span>
          {processText(prefixMatch[3])}
        </span>
      );
    }
  }

  return processText(text);
};
