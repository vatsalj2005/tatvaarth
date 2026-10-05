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

export const renderShastraTable = (
  tableRows: string[] | string,
  keyIndex: string | number,
  activeGathaNum?: string,
  isPrint: boolean = false
): React.ReactNode => {
  const rawRows: string[] = Array.isArray(tableRows) ? tableRows : tableRows.split('\n');
  const tableData: string[][] = [];

  rawRows.forEach(row => {
    const trimmed = row.trim();
    if (!trimmed.startsWith('|')) return;
    const cells = trimmed.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    if (!cells.every(c => /^---+$/.test(c) || c === '')) {
      tableData.push(cells);
    }
  });

  if (tableData.length === 0) return null;

  // Determine if this is a 2-tier header table (e.g. Tatvaarthsutra 3-6)
  let isTwoTier = false;
  if (tableData.length >= 2) {
    const row0 = tableData[0];
    const row1 = tableData[1];
    const hasSubheaderKeywords = row1.some(c => c === 'जघन्य' || c === 'उत्कृष्ट' || c.includes('जघन्य') || c.includes('उत्कृष्ट'));
    const hasRepeatedSuperHeaders = row0.some((h, i) => i > 0 && h !== '' && h === row0[i - 1]);
    if (hasSubheaderKeywords || hasRepeatedSuperHeaders) {
      isTwoTier = true;
    }
  }

  const headerRow = tableData[0];
  const subHeaderRow = isTwoTier ? tableData[1] : null;
  const bodyRows = isTwoTier ? tableData.slice(2) : tableData.slice(1);

  if (bodyRows.length === 0 && !subHeaderRow) return null;

  // Structure super headers with colSpan / rowSpan
  interface SuperHeaderItem {
    text: string;
    colSpan: number;
    rowSpan: number;
  }
  const superHeaders: SuperHeaderItem[] = [];
  if (isTwoTier && subHeaderRow) {
    let colIdx = 0;
    while (colIdx < headerRow.length) {
      const text = headerRow[colIdx];
      if (colIdx === 0 && (!subHeaderRow[0] || subHeaderRow[0] === '')) {
        superHeaders.push({ text, colSpan: 1, rowSpan: 2 });
        colIdx++;
        continue;
      }
      let nextCol = colIdx + 1;
      while (nextCol < headerRow.length && headerRow[nextCol] === text && text !== '') {
        nextCol++;
      }
      superHeaders.push({
        text,
        colSpan: nextCol - colIdx,
        rowSpan: 1
      });
      colIdx = nextCol;
    }
  }

  // Row spans for body cells
  const numRows = bodyRows.length;
  const numCols = headerRow.length;
  const spans: { rowSpan: number; skip: boolean }[][] = Array.from(
    { length: numRows }, 
    () => Array(numCols).fill({ rowSpan: 1, skip: false })
  );

  for (let colIdx = 0; colIdx < numCols; colIdx++) {
    let rowIdx = 0;
    while (rowIdx < numRows) {
      const cellVal = bodyRows[rowIdx][colIdx] || "";
      const isCurrentTotal = rowIdx === numRows - 1 && 
                             bodyRows[rowIdx][0] === '' && 
                             bodyRows[rowIdx].some(c => c.includes('अधिकार') || c.includes('कुल') || c.includes('योग') || c.includes('जोड़') || c.includes('Total') || c.includes('Sum'));

      if (isCurrentTotal) {
        spans[rowIdx][colIdx] = { rowSpan: 1, skip: false };
        rowIdx++;
        continue;
      }

      if (cellVal !== "") {
        let nextRowIdx = rowIdx + 1;
        while (nextRowIdx < numRows) {
          const isNextTotal = nextRowIdx === numRows - 1 && 
                              bodyRows[nextRowIdx][0] === '' && 
                              bodyRows[nextRowIdx].some(c => c.includes('अधिकार') || c.includes('कुल') || c.includes('योग') || c.includes('जोड़') || c.includes('Total') || c.includes('Sum'));
          if (isNextTotal || bodyRows[nextRowIdx][colIdx] !== "") break;
          nextRowIdx++;
        }
        const spanCount = nextRowIdx - rowIdx;
        spans[rowIdx][colIdx] = { rowSpan: spanCount, skip: false };
        for (let r = rowIdx + 1; r < nextRowIdx; r++) {
          spans[r][colIdx] = { rowSpan: 1, skip: true };
        }
        rowIdx = nextRowIdx;
      } else {
        spans[rowIdx][colIdx] = { rowSpan: 1, skip: false };
        rowIdx++;
      }
    }
  }

  const activeGathaVal = activeGathaNum ? parseInt(devanagariToEnglish(activeGathaNum), 10) : NaN;

  const resolvedSubGroups: string[] = [];
  let currentSubGroupText = "";
  bodyRows.forEach((row) => {
    const col1Text = row[1] || "";
    const col0Text = row[0] || "";
    if (col1Text) currentSubGroupText = col1Text;
    else if (col0Text && !col1Text) currentSubGroupText = col0Text;
    resolvedSubGroups.push(currentSubGroupText);
  });

  const isRowActive = (row: string[], resolvedSubGroupText: string) => {
    if (isNaN(activeGathaVal)) return false;
    const sgRange = getRowRange(resolvedSubGroupText);
    if (sgRange && activeGathaVal >= sgRange.start && activeGathaVal <= sgRange.end) return true;
    for (const cell of row) {
      const range = getRowRange(cell);
      if (range && activeGathaVal >= range.start && activeGathaVal <= range.end) return true;
    }
    return false;
  };

  const isSubGroupActive = resolvedSubGroups.map((sgText, rowIdx) => isRowActive(bodyRows[rowIdx], sgText));

  const isCellActive = (cellText: string, rowActive: boolean) => {
    if (isNaN(activeGathaVal)) return false;
    const range = getRowRange(cellText);
    if (range) return activeGathaVal >= range.start && activeGathaVal <= range.end;
    return rowActive;
  };

  // Significantly increased table sizing for optimal legibility:
  // Headers: text-base sm:text-lg md:text-xl font-bold
  // Body cells: text-base sm:text-lg font-medium
  // Padding: generous cell spacing
  // Sizing: Compact cell padding while preserving generous font sizes for optimal readability
  const headerCellClass = isPrint
    ? "px-3 py-2 text-center font-bold text-xs text-amber-950 border border-amber-800/40 bg-[#FFE699]"
    : "px-3.5 py-1.5 sm:px-4 sm:py-2 text-center font-bold text-base sm:text-lg md:text-xl text-amber-950 dark:text-amber-200 border border-amber-600/35 dark:border-gold/35 bg-[#FFE699] dark:bg-amber-950/60 rounded-md shadow-sm whitespace-nowrap";

  const subHeaderCellClass = isPrint
    ? "px-2 py-1.5 text-center font-semibold text-[11px] text-amber-900 border border-amber-800/40 bg-[#FFF2CC]"
    : "px-2.5 py-1 sm:px-3 sm:py-1.5 text-center font-bold text-sm sm:text-base md:text-lg text-amber-900 dark:text-amber-300 border border-amber-600/30 dark:border-gold/30 bg-[#FFF2CC] dark:bg-amber-900/40 rounded-md whitespace-nowrap";

  const tableBaseClass = isPrint
    ? "w-full text-xs devanagari-safe font-heading border-collapse"
    : "text-base sm:text-lg md:text-[18px] devanagari-safe font-heading";

  const containerClass = isPrint
    ? "w-full my-3 overflow-hidden"
    : "w-full flex justify-center my-5 overflow-hidden";

  const innerWrapperClass = isPrint
    ? "w-full overflow-x-auto"
    : "inline-block max-w-full overflow-x-auto rounded-xl shadow-lg border border-gold/30 bg-card/60 p-1 sm:p-1.5";

  return (
    <div key={`table-${keyIndex}`} className={containerClass}>
      <div className={innerWrapperClass}>
        <table 
          className={tableBaseClass}
          style={{ borderCollapse: 'separate', borderSpacing: isPrint ? '1px' : '2px' }}
        >
          <thead>
            {isTwoTier && subHeaderRow ? (
              <>
                <tr>
                  {superHeaders.map((grp, idx) => (
                    <th
                      key={idx}
                      colSpan={grp.colSpan}
                      rowSpan={grp.rowSpan}
                      className={headerCellClass}
                    >
                      {highlightBracketedTerms(grp.text)}
                    </th>
                  ))}
                </tr>
                <tr>
                  {subHeaderRow.map((sub, sIdx) => {
                    if (sIdx === 0 && (!sub || sub === '')) return null;
                    return (
                      <th
                        key={sIdx}
                        className={subHeaderCellClass}
                      >
                        {highlightBracketedTerms(sub)}
                      </th>
                    );
                  })}
                </tr>
              </>
            ) : (
              <tr>
                {headerRow.map((cell, cellIdx) => (
                  <th 
                    key={cellIdx} 
                    className={headerCellClass}
                  >
                    {highlightBracketedTerms(cell)}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {bodyRows.map((row, rowIdx) => {
              const isTotalRow = rowIdx === bodyRows.length - 1 && 
                                 row[0] === '' && 
                                 row.some(c => c.includes('अधिकार') || c.includes('कुल') || c.includes('योग') || c.includes('जोड़') || c.includes('Total') || c.includes('Sum'));

              const isActive = isSubGroupActive[rowIdx];

              return (
                <tr key={rowIdx}>
                  {row.map((cell, cellIdx) => {
                    const cellSpan = spans[rowIdx]?.[cellIdx];
                    if (cellSpan?.skip) return null;

                    const isSpanned = cellSpan && cellSpan.rowSpan > 1;
                    const cellActive = !isTotalRow && (isSpanned ? isCellActive(cell, false) : isActive);

                    let cellBgClass = "";
                    let cellBorderClass = isPrint ? "border border-amber-800/30" : "border border-amber-600/30 dark:border-gold/30";

                    if (isTotalRow) {
                      cellBgClass = "bg-[#FFE699] dark:bg-amber-950/50 text-amber-950 dark:text-amber-100 font-bold";
                    } else if (cellActive) {
                      cellBgClass = "bg-[#A9F531] dark:bg-lime-600/70 text-black dark:text-white font-semibold";
                      cellBorderClass = isPrint ? "border border-emerald-600/60" : "border border-emerald-600/50 dark:border-emerald-500/50";
                    } else if (rowIdx % 2 === 0) {
                      cellBgClass = "bg-[#DDEBF7] dark:bg-sky-950/40 text-sky-950 dark:text-sky-100";
                    } else {
                      cellBgClass = "bg-[#E2EFDA] dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100";
                    }

                    const cellPaddingClass = isPrint
                      ? "px-2 py-1.5 text-xs text-center rounded"
                      : "px-3 py-1.5 sm:px-3.5 sm:py-2 text-center font-medium rounded-md whitespace-nowrap";

                    return (
                      <td 
                        key={cellIdx} 
                        rowSpan={cellSpan?.rowSpan || 1}
                        className={`${cellPaddingClass} ${cellBorderClass} ${cellBgClass}`}
                      >
                        {cell === '-' ? '—' : highlightBracketedTerms(cell)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

