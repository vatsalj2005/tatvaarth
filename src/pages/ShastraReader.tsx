import { useState, useEffect, useLayoutEffect, useMemo, useRef, memo, Fragment } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { getShastraIndex, loadGathasForShastra, ShastraIndex, GathaContent, GathaItem } from '@/data/shastra-loader';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ChevronRight, ListCollapse, Download, Eye, EyeOff, LocateFixed, X } from 'lucide-react';
import ShastraPrintTemplate from '@/components/ShastraPrintTemplate';
import DiagramRenderer from '@/components/DiagramRenderer';
import ShrutskandhImg from '../content/granth/Shrutskandh.jpg';

import {
  devanagariToEnglish,
  getRowRange,
  cleanAnvayarthText,
  parseTextWithDiagrams,
  highlightBracketedTerms,
} from '@/lib/shastra-parser';

const formatGathaText = (text: string, isGadya: boolean = false) => {
  if (!text) return null;
  return text.split('\n').map((line, i, arr) => {
    const parts = line.split(/(\(\s*\d+\s*\)|[॥|]+\s*[\d\u0966-\u096F]+\s*[॥|]+)/);
    return (
      <span key={i}>
        {parts.map((part, j) => {
          if (/^\(\s*\d+\s*\)$/.test(part)) {
            return (
              <span key={j} className="text-[0.55em] text-teal-700 dark:text-teal-400 align-middle inline-block ml-1">
                {part}
              </span>
            );
          }
          if (/^[॥|]+\s*[\d\u0966-\u096F]+\s*[॥|]+$/.test(part)) {
            if (isGadya) {
              return (
                <span key={j} className="text-teal-700 dark:text-teal-400 font-semibold ml-1">
                  {part}
                </span>
              );
            }
            return <span key={j}>{part}</span>;
          }
          return <span key={j}>{part}</span>;
        })}
        {i < arr.length - 1 && <br />}
      </span>
    );
  });
};

const renderHighlightedAnvayarth = (text: string) => {
  return text.split('\n').map((line, lineIndex) => {
    const trimmed = line.trim();
    const isStarLine = 
      (trimmed.startsWith('*') && !trimmed.startsWith('**')) || 
      (trimmed.includes(' = ') && !trimmed.startsWith('|') && !trimmed.startsWith('**')) ||
      (/^[०-९0-9]+(?:\s+)?[a-zA-Z\u0900-\u0965\u0970-\u097F]/.test(trimmed) && !trimmed.startsWith('|') && !trimmed.startsWith('**'));
    
    const parts = line.split(/(\*\*\[[^\]]+\]\*\*|\([^\)]+\))/);
    
    const displayClasses = isStarLine
      ? "block mb-1 last:mb-0 text-gold-light font-medium leading-normal"
      : "block mb-2 last:mb-0";
      
    const displayStyle = isStarLine ? { fontSize: '0.55em', marginLeft: '2rem' } : undefined;

    return (
      <span key={lineIndex} className={displayClasses} style={displayStyle}>
        {parts.map((part, index) => {
          const boldMatch = part.match(/\*\*\[([^\]]+)\]\*\*/);
          if (boldMatch) {
            return (
              <span 
                key={index} 
                className={isStarLine 
                  ? "text-gold font-bold px-0.5"
                  : "inline-block px-1 py-0.5 mx-0.5 rounded text-gold font-semibold bg-gold/10 border border-gold/10"
                }
              >
                {boldMatch[1]}
              </span>
            );
          }
          const parenMatch = part.match(/^\(([^\)]+)\)$/);
          if (parenMatch) {
            return (
              <span key={index} className="text-sky-700 dark:text-sky-400 font-medium px-0.5">
                ({parenMatch[1]})
              </span>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </span>
    );
  });
};

const renderFormattedCommentary = (
  text: string, 
  colorClass: string = "text-foreground/90", 
  centerAlign: boolean = false,
  activeGathaNum: string = ''
) => {
  if (!text) return null;

  const paragraphs = text.split('\n');
  let inVerse = false;
  let wasLastLineWrapped = false;

  const renderedElements: React.ReactNode[] = [];
  let currentTableRows: string[] = [];

  const flushTable = (keyIndex: number) => {
    if (currentTableRows.length === 0) return;

    const tableData: string[][] = [];
    currentTableRows.forEach(row => {
      const cells = row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      if (!cells.every(c => /^---+$/.test(c) || c === '')) {
        tableData.push(cells);
      }
    });

    currentTableRows = [];
    if (tableData.length === 0) return;

    const headerRow = tableData[0];
    const bodyRows = tableData.slice(1);

    const resolvedSubGroups: string[] = [];
    let currentSubGroupText = "";
    bodyRows.forEach((row) => {
      const col1Text = row[1] || "";
      const col0Text = row[0] || "";
      if (col1Text) currentSubGroupText = col1Text;
      else if (col0Text && !col1Text) currentSubGroupText = col0Text;
      resolvedSubGroups.push(currentSubGroupText);
    });

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

    renderedElements.push(
      <div key={`table-${keyIndex}`} className="w-full flex justify-center my-6">
        <div className="inline-block max-w-full overflow-x-auto rounded-xl shadow-md bg-card/25 p-0.5">
          <table 
            className="text-sm devanagari-safe font-heading"
            style={{ borderCollapse: 'separate', borderSpacing: '3px' }}
          >
            <thead>
              <tr>
                {headerRow.map((cell, cellIdx) => (
                  <th 
                    key={cellIdx} 
                    className="px-4 py-3 text-center font-bold text-amber-950 dark:text-amber-200 border-2 border-amber-600/30 dark:border-gold/30 bg-[#FFE699] dark:bg-amber-950/50 rounded"
                  >
                    {highlightBracketedTerms(cell)}
                  </th>
                ))}
              </tr>
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
                      let cellBorderClass = "border-amber-600/30 dark:border-gold/30";

                      if (isTotalRow) {
                        cellBgClass = "bg-[#FFE699] dark:bg-amber-950/50 text-amber-950 dark:text-amber-100 font-bold";
                      } else if (cellActive) {
                        cellBgClass = "bg-[#A9F531] dark:bg-lime-600/70 text-black dark:text-white font-semibold";
                        cellBorderClass = "border-emerald-600/40 dark:border-emerald-500/50";
                      } else if (rowIdx % 2 === 0) {
                        cellBgClass = "bg-[#DDEBF7] dark:bg-sky-950/40 text-sky-950 dark:text-sky-100";
                      } else {
                        cellBgClass = "bg-[#E2EFDA] dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100";
                      }

                      return (
                        <td 
                          key={cellIdx} 
                          rowSpan={cellSpan?.rowSpan || 1}
                          className={`px-4 py-2.5 text-center border-2 rounded ${cellBorderClass} ${cellBgClass}`}
                        >
                          {cell === '-' ? '' : highlightBracketedTerms(cell)}
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

  paragraphs.forEach((paragraph, index) => {
    const clean = paragraph.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

    if (clean.startsWith('|')) {
      currentTableRows.push(clean);
      return;
    } else {
      flushTable(index);
    }

    if (!clean) {
      inVerse = false;
      renderedElements.push(<div key={index} className="h-2" />);
      return;
    }

    const isWrapped = clean.startsWith('{') && clean.endsWith('}');
    const unwrapped = isWrapped ? clean.slice(1, -1).trim() : clean;
    const isMeterHeader = /^[(（].*?[)）]$/.test(unwrapped) && unwrapped.length <= 50;

    if (isMeterHeader) {
      inVerse = true;
      wasLastLineWrapped = isWrapped;
      renderedElements.push(
        <div 
          key={index} 
          className="text-center font-bold text-pink-700 dark:text-pink-400 my-3 devanagari-safe"
          style={{ fontSize: "1.05em" }}
        >
          {unwrapped}
        </div>
      );
      return;
    }

    if (inVerse) {
      if (unwrapped.startsWith('[') || unwrapped.startsWith('**[')) {
        inVerse = false;
      } else if (wasLastLineWrapped && !isWrapped) {
        inVerse = false;
      } else if (unwrapped.length > 100 || unwrapped.startsWith('-')) {
        inVerse = false;
      }
    }
    
    wasLastLineWrapped = isWrapped;

    const isBoldTitle = unwrapped.startsWith('**') && unwrapped.endsWith('**') && !unwrapped.startsWith('**[');
    if (isBoldTitle) {
      const unwrappedTitle = unwrapped.slice(2, -2).trim();
      renderedElements.push(
        <div 
          key={index} 
          className="text-center font-bold text-gold my-4 devanagari-safe"
          style={{ fontSize: "1.15em" }}
        >
          {highlightBracketedTerms(unwrappedTitle)}
        </div>
      );
      return;
    }

    const isGreenMangal = 
      unwrapped.startsWith("मंगलं भगवान् वीरो") || 
      unwrapped.startsWith("मंगलं कुन्दकुन्दार्यो") || 
      unwrapped.startsWith("सर्वमंगलमांगल्यं") || 
      unwrapped.startsWith("प्रधानं सर्वधर्माणां");

    if (inVerse || isGreenMangal) {
      renderedElements.push(
        <div 
          key={index} 
          className="text-center text-green-800 dark:text-green-600 font-semibold !m-0 !leading-tight devanagari-safe"
          style={{ fontSize: "1.2em" }}
        >
          {unwrapped}
        </div>
      );
      return;
    }

    const getIndentLevel = (line: string): number => {
      const match = line.match(/^([ \t]+)/);
      if (!match) return 0;
      let spaces = 0;
      for (const char of match[1]) {
        if (char === '\t') spaces += 2;
        else if (char === ' ') spaces += 1;
      }
      return Math.floor(spaces / 2);
    };

    const indentLevel = getIndentLevel(paragraph);

    const isMangalacharanOrange = [
      "॥ श्रीपरमगुरुवे नमः, परम्पराचार्यगुरुवे नमः ॥",
      "॥ श्रीपरमगुरुवे नम:, परम्पराचार्यगुरुवे नम: ॥",
      "॥ श्रोतारः सावधानतया शृणवन्तु ॥",
      "॥ श्रोतार: सावधानतया शृणवन्तु ॥",
      "॥ श्रोतारः सावधान-तया शृणवन्तु ॥",
      "॥ श्रोतार: सावधान-तया शृणवन्तु ॥"
    ].includes(unwrapped);

    const isSanskritColor = [
      "(देव वंदना)",
      "(शास्त्र वंदना)",
      "(गुरु वंदना)",
      "आर्हत भक्ति",
      "पण्डित-जुगल-किशोर कृत"
    ].includes(unwrapped);

    const isOrangeColor = 
      unwrapped.startsWith("त्रैकाल्यं") || 
      unwrapped.startsWith("पंचान्ये") || 
      unwrapped.startsWith("इत्येतन्मोक्षमूलं") || 
      unwrapped.startsWith("प्रत्येति") ||
      unwrapped.startsWith("मोक्षमार्गस्य") || 
      unwrapped.startsWith("ज्ञातारं") ||
      unwrapped.startsWith("सिद्धे जयप्पसिद्धे") ||
      unwrapped.startsWith("वंदित्ता अरहंते") ||
      unwrapped.startsWith("उज्जोवणमुज्जवणं") ||
      unwrapped.startsWith("दंसण-णाण-चरित्तं");

    const isStarLine = 
      (unwrapped.startsWith('*') && !unwrapped.startsWith('**')) || 
      (unwrapped.includes(' = ') && !unwrapped.startsWith('|') && !unwrapped.startsWith('**')) ||
      (/^[०-९0-9]+[a-zA-Z\u0900-\u0965\u0970-\u097F]/.test(unwrapped) && !unwrapped.startsWith('|') && !unwrapped.startsWith('**'));

    const cleanPrefix = unwrapped.replace(/^[०-९0-9]+(?:-[०-९0-9]+)?\.\s*/, '');
    const isQuestion = cleanPrefix.startsWith('प्रश्न –') || cleanPrefix.startsWith('प्रश्न -') || cleanPrefix.startsWith('शंका –') || cleanPrefix.startsWith('शंका -');
    const isCenteredOrange = isWrapped && !isMeterHeader;
    const isBullet = clean.startsWith('•');
    const isNumber = /^[०-९0-9]+(?:-[०-९0-9]+)?[.\s]/.test(clean);
    
    let displayClasses = '';
    if (isStarLine) {
      displayClasses = 'text-gold-light text-left font-medium leading-normal';
    } else if (isQuestion) {
      displayClasses = 'text-red-600 dark:text-red-400 font-semibold text-left';
    } else if (isCenteredOrange) {
      displayClasses = 'text-orange-800 dark:text-orange-400 font-semibold text-center !m-0 !leading-tight';
    } else if (isMangalacharanOrange || isOrangeColor) {
      displayClasses = `text-orange-800 dark:text-orange-400 font-semibold ${centerAlign ? 'text-center' : 'text-left'}`;
    } else if (isSanskritColor) {
      displayClasses = `text-pink-700 dark:text-pink-400 font-semibold ${centerAlign ? 'text-center' : 'text-left'}`;
    } else {
      displayClasses = `${colorClass} ${centerAlign ? 'text-center' : 'text-left'}`;
    }

    let displayStyle = isStarLine 
      ? { fontSize: '0.85em', marginLeft: '2rem', marginTop: '0px', marginBottom: '0px', lineHeight: '1.3' }
      : (isBullet || isNumber)
        ? { marginLeft: `${1.5 + indentLevel * 1.5}rem`, paddingLeft: '1.5rem', textIndent: '-1.5rem', marginTop: '2px', marginBottom: '2px', lineHeight: '1.4' } 
        : undefined;

    if (unwrapped === "आर्हत भक्ति") {
      displayStyle = { ...displayStyle, fontSize: '2.15em', lineHeight: '1.1', textAlign: 'center', marginTop: '0.5rem', marginBottom: '0.5rem' } as any;
    } else if (unwrapped === "पण्डित-जुगल-किशोर कृत") {
      displayStyle = { ...displayStyle, fontSize: '0.8em', lineHeight: '1.1', textAlign: 'center', marginTop: '0.25rem', marginBottom: '1.5rem' } as any;
    }

    let displayText = unwrapped;
    if (isBullet && indentLevel > 0) displayText = unwrapped.replace(/^•/, '◦');

    const goldenHeadingMatch = !isStarLine && !isQuestion && !isCenteredOrange && !isBullet && !isNumber && !isMangalacharanOrange && !isSanskritColor && !isOrangeColor
      ? unwrapped.match(/^([\u0900-\u097F\u200C\u200D]+(?:-[\u0900-\u097F\u200C\u200D]+)*)-(\ .*)$/)
      : null;

    let renderedContent;
    if (goldenHeadingMatch) {
      renderedContent = (
        <>
          <span className="text-gold font-bold">{goldenHeadingMatch[1]}-</span>
          {highlightBracketedTerms(goldenHeadingMatch[2])}
        </>
      );
    } else if (isQuestion) {
      const match = displayText.match(/^([०-९0-9]+(?:-[०-९0-9]+)?\.\s*)(.*)$/);
      if (match) {
        renderedContent = (
          <>
            <span className={`${colorClass} font-normal`}>{match[1]}</span>
            {highlightBracketedTerms(match[2])}
          </>
        );
      } else {
        renderedContent = highlightBracketedTerms(displayText);
      }
    } else {
      renderedContent = highlightBracketedTerms(displayText);
    }

    renderedElements.push(
      <div 
        key={index} 
        className={`${displayClasses} ${isStarLine ? 'my-0.5' : isCenteredOrange ? '' : (isBullet || isNumber) ? 'my-0.5' : 'my-2'} ${isCenteredOrange ? '' : 'leading-loose'} devanagari-safe`}
        style={displayStyle}
      >
        {renderedContent}
      </div>
    );
  });

  flushTable(paragraphs.length);
  return renderedElements;
};

const renderCommentaryWithDiagrams = (text: string, colorClass?: string, activeGathaNum: string = '') => {
  return parseTextWithDiagrams(cleanAnvayarthText(text)).map((part, idx) => {
    if (part.type === 'diagram') {
      try {
        const data = JSON.parse(part.content);
        return (
          <DiagramRenderer
            key={`diag-${idx}`}
            type={data.type}
            nodes={data.nodes}
          />
        );
      } catch (e) {
        console.error('Failed to parse diagram JSON', e);
        return null;
      }
    }
    return <Fragment key={`text-${idx}`}>{renderFormattedCommentary(part.content, colorClass, false, activeGathaNum)}</Fragment>;
  });
};

const ChapterDivider = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center pt-8 pb-16 space-y-6">
    <div className="w-full max-w-2xl h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
    <h2 className="text-2xl md:text-4xl font-heading font-bold text-gold tracking-widest devanagari-safe text-center px-4">
      ------ {title} ------
    </h2>
    <div className="w-full max-w-2xl h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
  </div>
);

/* -------------------------------------------------------------------------- */
/*                         MEMOIZED VERSE ITEM VIEW                           */
/* -------------------------------------------------------------------------- */

interface GathaVerseItemProps {
  item: GathaItem;
  content: GathaContent;
  chapterName: string;
  isFirstOfChapter: boolean;
  contentFontSize: number;
  lineSpacing: number;
  readingClass: string;
  activeTeekaTabs: Record<string, string>;
  setActiveTeekaTabs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  showSanskritTeeka: Record<string, boolean>;
  setShowSanskritTeeka: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  activeGathaNum: string;
  t: (key: string) => string;
  onRegisterRef: (num: string, el: HTMLDivElement | null) => void;
}

const GathaVerseItem = memo(({
  item,
  content,
  chapterName,
  isFirstOfChapter,
  contentFontSize,
  lineSpacing,
  readingClass,
  activeTeekaTabs,
  setActiveTeekaTabs,
  showSanskritTeeka,
  setShowSanskritTeeka,
  activeGathaNum,
  t,
  onRegisterRef,
}: GathaVerseItemProps) => {
  const gathaNum = item.gathaNum;
  const currentComm = activeTeekaTabs[gathaNum] || (content.teekas[0]?.commentator);
  const activeTeeka = content.teekas.find(tk => tk.commentator === currentComm);
  const showSanskrit = showSanskritTeeka[`${gathaNum}_${currentComm}`] || false;

  return (
    <Fragment>
      {isFirstOfChapter && <ChapterDivider title={chapterName} />}

      <div
        id={`gatha-${gathaNum}`}
        data-gatha-num={gathaNum}
        ref={(el) => onRegisterRef(gathaNum, el)}
        className="scroll-mt-20 border-b border-border/20 pb-16"
      >
        {/* Chapter Subtitle & Badge */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <span className="text-xs px-2.5 py-1 bg-secondary text-gold/80 rounded-full font-medium devanagari-safe">
            📂 {chapterName}
          </span>
          <span className="text-lg font-heading text-gold font-bold">
            #{gathaNum === '000_मंगलाचरण' ? '000' : gathaNum.replace('-parishisht', '-परिशिष्ट')}
          </span>
        </div>

        {/* Header title */}
        <h3 
          className="font-heading text-center font-black text-foreground drop-shadow-[0_4px_12px_rgba(212,175,55,0.8)] mb-6 devanagari-safe tracking-wide break-words" 
          style={{ fontSize: `${contentFontSize * 1.6}px`, wordBreak: 'break-word', overflowWrap: 'anywhere' }}
        >
          {formatGathaText(content.title)}
        </h3>

        {/* Prakrit verse */}
        {chapterName !== 'परिशिष्ट' && content.gatha && (
          <div className="p-6 md:p-8 rounded-2xl bg-gold/5 border border-gold/20 shadow-sm relative mb-6 overflow-hidden">
            <h4 className="text-xs uppercase tracking-wider text-gold font-medium mb-3">{t('prakrit')}</h4>
            <p 
              className={`text-center text-xl md:text-2xl font-semibold devanagari-safe leading-loose break-words ${readingClass} ${
                content.gatha.includes('ओंकारं बिन्दुसंयुक्तं')
                  ? 'text-gold drop-shadow-[0_0_15px_rgba(212,175,55,0.8)]'
                  : 'text-orange-800 dark:text-orange-400 drop-shadow-[0_4px_12px_rgba(234,88,12,0.7)] dark:drop-shadow-[0_4px_12px_rgba(251,146,60,0.8)]'
              }`}
              style={{ fontSize: `${contentFontSize * 1.25}px`, lineHeight: lineSpacing, wordBreak: 'break-word', overflowWrap: 'anywhere' }}
            >
              {formatGathaText(content.gatha)}
            </p>
          </div>
        )}

        {/* Sanskrit verse */}
        {content.gathaS && (
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/30 mb-6 overflow-hidden">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground/80 font-medium mb-2">{t('sanskrit')}</h4>
            <p 
              className={`text-center text-base md:text-lg text-teal-700 dark:text-teal-400 devanagari-safe leading-loose break-words ${readingClass}`}
              style={{ fontSize: `${contentFontSize * 0.8}px`, lineHeight: lineSpacing, wordBreak: 'break-word', overflowWrap: 'anywhere' }}
            >
              {formatGathaText(content.gathaS)}
            </p>
          </div>
        )}

        {/* Hindi Poetic Verse (Gadya) */}
        {content.gadya && chapterName !== 'परिशिष्ट' && (
          <div className="text-center italic text-foreground/90 font-serif my-8 px-6 devanagari-safe border-l-2 border-r-2 border-gold/30 break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
            <p 
              className="leading-relaxed break-words"
              style={{ fontSize: `${contentFontSize * 0.8}px`, lineHeight: lineSpacing, wordBreak: 'break-word', overflowWrap: 'anywhere' }}
            >
              {formatGathaText(content.gadya, true)}
            </p>
          </div>
        )}

        {/* Anvayarth (Word Meanings) */}
        {chapterName !== 'परिशिष्ट' && content.anvayarth && (
          <div className="my-8">
            <h4 className="text-sm font-semibold text-gold mb-3 devanagari-safe">
              🔍 {t('anvayarth')}
            </h4>
            <div 
              className="text-foreground/95 devanagari-safe leading-loose"
              style={{ fontSize: `${contentFontSize}px`, lineHeight: lineSpacing }}
            >
              {parseTextWithDiagrams(cleanAnvayarthText(content.anvayarth)).map((part, pIdx) => {
                if (part.type === 'diagram') {
                  try {
                    const data = JSON.parse(part.content);
                    return (
                      <DiagramRenderer 
                        key={pIdx} 
                        type={data.type} 
                        nodes={data.nodes} 
                      />
                    );
                  } catch (e) {
                    console.error('Failed to parse diagram JSON', e);
                    return null;
                  }
                }
                return renderHighlightedAnvayarth(part.content);
              })}
            </div>
          </div>
        )}

        {/* Bhavarth (Special Meaning / Context) */}
        {content.bhavarth && (
          <div className="my-8 p-6 rounded-2xl bg-amber-900/5 dark:bg-amber-900/10 border border-gold/10 shadow-inner">
            <div 
              className="devanagari-safe leading-loose"
              style={{ fontSize: `${contentFontSize * 1.1}px`, lineHeight: lineSpacing }}
            >
              {renderFormattedCommentary(content.bhavarth, 'text-foreground/90', true, activeGathaNum)}
            </div>
          </div>
        )}

        {/* English meaning */}
        {content.english && (
          <div className="my-8 p-5 rounded-2xl bg-card border border-border/30">
            <h4 className="text-sm font-semibold text-gold mb-2 devanagari-safe">
              📖 {t('englishMeaning')}
            </h4>
            <p 
              className="text-foreground/90 leading-relaxed font-sans"
              style={{ fontSize: `${contentFontSize * 0.95}px`, lineHeight: lineSpacing }}
            >
              {content.english}
            </p>
          </div>
        )}

        {/* Commentaries (Teekas) */}
        {content.teekas.length > 0 && (
          <div className="mt-8 rounded-2xl border border-border/40 overflow-hidden bg-card">
            {/* Tabs Bar */}
            <div className="flex bg-secondary/50 border-b border-border/40 overflow-x-auto scrollbar-none">
              {content.teekas.map(tk => (
                <button
                  key={tk.commentator}
                  onClick={() => setActiveTeekaTabs(prev => ({ ...prev, [gathaNum]: tk.commentator }))}
                  className={`px-5 py-3 text-sm font-heading font-medium transition-colors flex-shrink-0 devanagari-safe ${
                    currentComm === tk.commentator
                      ? 'bg-card text-gold border-t-2 border-gold font-semibold'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  {tk.commentator}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTeeka && (
                <div className="space-y-4">
                  {/* Sanskrit Toggle */}
                  {activeTeeka.sanskrit && (
                    <div className="flex justify-end mb-2">
                      <button
                        onClick={() => setShowSanskritTeeka(prev => ({
                          ...prev,
                          [`${gathaNum}_${currentComm}`]: !showSanskrit
                        }))}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs text-secondary-foreground hover:bg-gold/10 transition-colors"
                      >
                        {showSanskrit ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {showSanskrit ? t('hideTranslation') : t('originalSanskrit')}
                      </button>
                    </div>
                  )}

                  {/* Sanskrit commentary text */}
                  {activeTeeka.sanskrit && showSanskrit && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-xl bg-gold/5 border border-gold/10 mb-4 text-foreground/80 devanagari-safe leading-loose space-y-2"
                      style={{ fontSize: `${contentFontSize}px`, lineHeight: lineSpacing }}
                    >
                      <h5 className="text-xs uppercase text-gold font-semibold mb-2">{t('sanskrit')}</h5>
                      {renderCommentaryWithDiagrams(activeTeeka.sanskrit, "text-teal-700 dark:text-teal-400", activeGathaNum)}
                    </motion.div>
                  )}

                  {/* Hindi commentary text */}
                  <div 
                    className="text-foreground/90 devanagari-safe leading-loose space-y-2"
                    style={{ fontSize: `${contentFontSize}px`, lineHeight: lineSpacing }}
                  >
                    {renderCommentaryWithDiagrams(activeTeeka.hindi, undefined, activeGathaNum)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Fragment>
  );
});

GathaVerseItem.displayName = 'GathaVerseItem';

/* -------------------------------------------------------------------------- */
/*                           MAIN READER COMPONENT                            */
/* -------------------------------------------------------------------------- */

const ShastraReader = () => {
  const { categorySlug, shastraSlug } = useParams<{ categorySlug: string; shastraSlug: string }>();
  const { t, language, fontSize, lineSpacing, useSerif, theme } = useApp();
  const contentFontSize = fontSize + 4;
  
  const [shastraIndex, setShastraIndex] = useState<ShastraIndex | null>(null);
  const [activeGathaNum, setActiveGathaNum] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTeekaTabs, setActiveTeekaTabs] = useState<Record<string, string>>({});
  const [showSanskritTeeka, setShowSanskritTeeka] = useState<Record<string, boolean>>({});
  const [isAutoFollow, setIsAutoFollow] = useState(true);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [gathas, setGathas] = useState<Array<{ item: GathaItem; content: GathaContent; chapterName: string }>>([]);
  const [isLoadingGathas, setIsLoadingGathas] = useState(true);

  const uniqueCommentators = useMemo(() => {
    const set = new Set<string>();
    for (const g of gathas) {
      for (const tk of g.content.teekas) {
        if (tk.commentator) set.add(tk.commentator);
      }
    }
    return Array.from(set);
  }, [gathas]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const gathaRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isManualScrollingRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollTimeoutRef = useRef<any>(null);
  const visibleGathasRef = useRef<Set<string>>(new Set());
  const activeGathaNumRef = useRef(activeGathaNum);
  activeGathaNumRef.current = activeGathaNum;

  const handleScrollOccupancy = () => {
    if (isManualScrollingRef.current || visibleGathasRef.current.size === 0) return;

    let targetGathaNum = '';
    let maxOccupancy = 0;
    let gathaWith51Plus = '';

    visibleGathasRef.current.forEach((num) => {
      const el = document.getElementById(`gatha-${num}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
        const occupancy = visibleHeight / window.innerHeight;

        if (occupancy > maxOccupancy) {
          maxOccupancy = occupancy;
          targetGathaNum = num;
        }
        if (occupancy >= 0.51) {
          gathaWith51Plus = num;
        }
      }
    });

    const nextActive = gathaWith51Plus || targetGathaNum;
    if (nextActive && nextActive !== activeGathaNumRef.current) {
      setActiveGathaNum(nextActive);
    }
  };

  useEffect(() => {
    const onScroll = () => handleScrollOccupancy();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    return () => {
      if (programmaticScrollTimeoutRef.current) {
        clearTimeout(programmaticScrollTimeoutRef.current);
      }
    };
  }, []);

  // 1. Fetch shastra index
  useEffect(() => {
    if (shastraSlug) {
      const idx = getShastraIndex(shastraSlug);
      setShastraIndex(idx);
      if (idx && idx.cover) {
        setActiveGathaNum('cover');
      } else if (idx && idx.chapters.length > 0 && idx.chapters[0].items.length > 0) {
        setActiveGathaNum(idx.chapters[0].items[0].gathaNum);
      }
      gathaRefs.current = {};
    }
  }, [shastraSlug]);

  // 2. Load all gatha contents asynchronously on-demand
  useEffect(() => {
    let isActive = true;
    if (!shastraIndex || !shastraSlug) return;
    
    setIsLoadingGathas(true);
    
    loadGathasForShastra(shastraSlug, shastraIndex.chapters)
      .then(list => {
        if (!isActive) return;
        setGathas(list);
        setIsLoadingGathas(false);
      })
      .catch(err => {
        console.error("Failed to load gathas", err);
        if (!isActive) return;
        setIsLoadingGathas(false);
      });

    return () => {
      isActive = false;
    };
  }, [shastraIndex, shastraSlug]);

  // Initialize commentator tabs when gathas load
  useEffect(() => {
    if (gathas.length > 0) {
      const initialTabs: Record<string, string> = {};
      gathas.forEach(g => {
        if (g.content.teekas.length > 0) {
          initialTabs[g.item.gathaNum] = g.content.teekas[0].commentator;
        }
      });
      setActiveTeekaTabs(prev => ({ ...initialTabs, ...prev }));
    }
  }, [gathas]);

  // 3. Setup IntersectionObserver to track visible gathas
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const gathaNum = entry.target.getAttribute('data-gatha-num');
          if (gathaNum) {
            if (entry.isIntersecting) {
              visibleGathasRef.current.add(gathaNum);
            } else {
              visibleGathasRef.current.delete(gathaNum);
            }
          }
        });
        handleScrollOccupancy();
      },
      { root: null, rootMargin: '0px', threshold: 0 }
    );

    Object.values(gathaRefs.current).forEach((el) => {
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [gathas]);

  // 4. Auto-follow sidebar scroll
  useEffect(() => {
    if (isAutoFollow && activeGathaNum && isSidebarOpen) {
      isProgrammaticScrollRef.current = true;
      
      if (programmaticScrollTimeoutRef.current) {
        clearTimeout(programmaticScrollTimeoutRef.current);
      }
      programmaticScrollTimeoutRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 1000);

      const timer = setTimeout(() => {
        const activeSidebarItem = document.getElementById(`sidebar-link-${activeGathaNum}`);
        const container = document.getElementById('sidebar-scroll-container');
        
        if (activeSidebarItem && container) {
          const containerRect = container.getBoundingClientRect();
          const itemRect = activeSidebarItem.getBoundingClientRect();
          const isOutsideCenter = itemRect.top < containerRect.top + 50 || itemRect.bottom > containerRect.bottom - 50;
          
          if (isOutsideCenter) {
            const offset = itemRect.top - containerRect.top - (containerRect.height / 2) + (itemRect.height / 2);
            container.scrollBy({ top: offset, behavior: 'smooth' });
          }
        }
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [activeGathaNum, isAutoFollow, isSidebarOpen]);

  // Preserve scroll position when sidebar toggles
  const layoutPreserveRef = useRef<number | null>(null);
  
  const handleSidebarToggle = (newState: boolean) => {
    if (activeGathaNum) {
      const el = document.getElementById(`gatha-${activeGathaNum}`);
      if (el) {
        layoutPreserveRef.current = el.getBoundingClientRect().top;
      }
    }
    
    isProgrammaticScrollRef.current = true;
    if (programmaticScrollTimeoutRef.current) {
      clearTimeout(programmaticScrollTimeoutRef.current);
    }
    programmaticScrollTimeoutRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 1000);

    setIsSidebarOpen(newState);
  };

  useLayoutEffect(() => {
    if (layoutPreserveRef.current !== null && activeGathaNum) {
      const el = document.getElementById(`gatha-${activeGathaNum}`);
      if (el) {
        const currentY = el.getBoundingClientRect().top;
        const diff = currentY - layoutPreserveRef.current;
        if (Math.abs(diff) > 0) {
          window.scrollBy(0, diff);
        }
      }
      layoutPreserveRef.current = null;
    }
  }, [isSidebarOpen, activeGathaNum]);

  if (!shastraIndex) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center pt-24">
          <p className="text-muted-foreground">{t('noResults')}</p>
        </div>
        <Footer />
      </div>
    );
  }

  const scrollToGatha = (gathaNum: string) => {
    const el = document.getElementById(`gatha-${gathaNum}`);
    if (el) {
      isManualScrollingRef.current = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveGathaNum(gathaNum);
      setIsAutoFollow(true);
      
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
      
      isProgrammaticScrollRef.current = true;
      if (programmaticScrollTimeoutRef.current) {
        clearTimeout(programmaticScrollTimeoutRef.current);
      }
      programmaticScrollTimeoutRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 1000);

      setTimeout(() => {
        isManualScrollingRef.current = false;
      }, 1000);
    }
  };

  const handleSidebarScroll = () => {
    if (isProgrammaticScrollRef.current) return;
    setIsAutoFollow(false);
  };

  const handleFullPdfDownload = () => {
    if (!shastraIndex || gathas.length === 0) return;
    setIsDownloadingPdf(true);
  };

  const registerGathaRef = (num: string, el: HTMLDivElement | null) => {
    gathaRefs.current[num] = el;
  };

  const readingClass = useSerif ? 'font-reading' : '';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Unified PDF Download Button */}
      <button
        onClick={handleFullPdfDownload}
        disabled={isDownloadingPdf}
        className="fixed z-40 top-[76px] right-4 md:right-8 flex items-center justify-center gap-1.5 w-9 h-9 md:w-auto md:h-auto md:px-3 md:py-1.5 rounded-lg bg-gold hover:opacity-90 text-primary-foreground shadow-lg backdrop-blur-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold devanagari-safe"
        title={t('downloadFullPdf')}
      >
        {isDownloadingPdf ? (
          <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        <span className="hidden md:inline">
          {isDownloadingPdf 
            ? (language === 'hi' ? 'तैयार...' : 'Generating...') 
            : t('downloadFullPdf')
          }
        </span>
      </button>

      <div className={`flex-1 flex pt-16 relative ${isSidebarOpen && !isLoadingGathas ? 'md:pl-[280px]' : ''}`}>
        {/* Toggle Sidebar Button for Desktop & Mobile */}
        {!isLoadingGathas && (
          <button
            onClick={() => handleSidebarToggle(!isSidebarOpen)}
            className="fixed z-50 bottom-6 left-6 p-3 rounded-full bg-gold text-primary-foreground shadow-lg hover:opacity-90 transition-all flex items-center justify-center"
            title="Toggle Navigation Menu"
          >
            <ListCollapse className="w-5 h-5" />
          </button>
        )}

        {/* 1. Sidebar Navigation Panel & Mobile Overlay */}
        <AnimatePresence>
          {isSidebarOpen && !isLoadingGathas && (
            <>
              {/* Mobile Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => handleSidebarToggle(false)}
                className="md:hidden fixed inset-0 z-30 bg-background/60 backdrop-blur-sm top-16"
              />

              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "tween", duration: 0.3 }}
                className="fixed left-0 top-16 bottom-0 w-[80vw] max-w-[300px] md:w-[280px] bg-card border-r border-border/40 z-40 flex flex-col shadow-2xl md:shadow-none overflow-hidden"
              >
                <div className="p-4 border-b border-border/40 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-heading text-lg text-gradient-gold font-semibold devanagari-safe">
                      {t('chapters')}
                    </h2>
                    <div className="flex items-center gap-2">
                      {!isAutoFollow && (
                        <button 
                          onClick={() => setIsAutoFollow(true)}
                          className="flex items-center gap-1.5 text-xs bg-gold/10 text-gold hover:bg-gold/20 px-2.5 py-1.5 rounded-lg transition-colors font-medium animate-fade-in"
                          title={t('follow')}
                        >
                          <LocateFixed className="w-3.5 h-3.5" />
                          {t('follow')}
                        </button>
                      )}
                      <button 
                        onClick={() => handleSidebarToggle(false)}
                        className="md:hidden p-1 rounded-lg hover:bg-secondary"
                      >
                        <X className="w-5 h-5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Teeka Legend */}
                  {uniqueCommentators.length > 0 && (
                    <div className="flex flex-col gap-1.5 text-[11px] text-muted-foreground devanagari-safe font-medium mt-1">
                      {uniqueCommentators.map((comm, idx) => {
                        const colors = [
                          { dot: "bg-teal-600 dark:bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.4)]" },
                          { dot: "bg-orange-500 dark:bg-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.4)]" },
                          { dot: "bg-purple-600 dark:bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]" },
                          { dot: "bg-rose-600 dark:bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" },
                          { dot: "bg-sky-600 dark:bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.4)]" }
                        ];
                        const color = colors[idx % colors.length];
                        return (
                          <div key={comm} className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-sm ${color.dot}`} /> 
                            <span>{comm}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div 
                  id="sidebar-scroll-container"
                  className="flex-1 overflow-y-auto p-3 scrollbar-thin"
                  onScroll={handleSidebarScroll}
                >
                  {/* Shastra Cover Page Link */}
                  {shastraIndex.cover && (
                    <div className="mb-4 relative">
                      <ul className="space-y-1 ml-1">
                        <li id="sidebar-link-cover" className="relative font-bold">
                          <div className={`absolute left-[11px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full z-10 ${
                            activeGathaNum === 'cover' ? 'bg-gold shadow-[0_0_8px_rgba(234,179,8,0.8)]' : 'bg-gold/40'
                          }`} />
                          <button
                            onClick={() => scrollToGatha('cover')}
                            className={`w-full text-left pl-7 pr-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between devanagari-safe font-bold ${
                              activeGathaNum === 'cover'
                                ? 'bg-gold/15 text-gold shadow-sm font-bold'
                                : 'text-foreground/80 hover:bg-secondary hover:text-foreground font-bold'
                            }`}
                          >
                            <span className="truncate pr-2">📖 {shastraIndex.title}</span>
                            <ChevronRight className="w-3.5 h-3.5 opacity-50 flex-shrink-0" />
                          </button>
                        </li>
                      </ul>
                    </div>
                  )}

                  {shastraIndex.chapters.map((chapter, chapIdx) => (
                    <div key={chapIdx} className="mb-6 relative">
                      <div className="sticky top-0 bg-card z-10 py-1 mb-2 border-b-2 border-gold/20">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-gold/90 px-2 py-1 truncate devanagari-safe">
                          {chapter.name}
                        </h3>
                      </div>
                      <ul className="space-y-1 relative before:absolute before:inset-y-0 before:left-3 before:w-[1px] before:bg-gold/20 ml-1">
                        {chapter.items.map((item) => (
                          <li key={item.gathaNum} id={`sidebar-link-${item.gathaNum}`} className="relative">
                            <div className={`absolute left-[11px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full z-10 ${
                              activeGathaNum === item.gathaNum ? 'bg-gold shadow-[0_0_8px_rgba(234,179,8,0.8)]' : 'bg-gold/40'
                            }`} />
                            <button
                              onClick={() => scrollToGatha(item.gathaNum)}
                              className={`w-full text-left pl-7 pr-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between devanagari-safe ${
                                activeGathaNum === item.gathaNum
                                  ? 'bg-gold/15 text-gold font-semibold shadow-sm'
                                  : 'text-foreground/80 hover:bg-secondary hover:text-foreground'
                              }`}
                            >
                              <span className="truncate pr-2">
                                {item.gathaNum === '000_मंगलाचरण' ? '000' : item.gathaNum.replace('-parishisht', '')} — {item.title}
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 opacity-50 flex-shrink-0" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}

                  {/* Shrutskandh Sidebar Link */}
                  <div className="mb-6 mt-4 relative border-t border-gold/15 pt-4">
                    <div className="sticky top-0 bg-card z-10 py-1 mb-2 border-b-2 border-gold/20">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-gold/90 px-2 py-1 truncate devanagari-safe">
                        श्रुतस्कन्ध
                      </h3>
                    </div>
                    <ul className="space-y-1 relative before:absolute before:inset-y-0 before:left-3 before:w-[1px] before:bg-gold/20 ml-1">
                      <li id="sidebar-link-shrutskandh" className="relative">
                        <div className={`absolute left-[11px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full z-10 ${
                          activeGathaNum === 'shrutskandh' ? 'bg-gold shadow-[0_0_8px_rgba(234,179,8,0.8)]' : 'bg-gold/40'
                        }`} />
                        <button
                          onClick={() => scrollToGatha('shrutskandh')}
                          className={`w-full text-left pl-7 pr-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between devanagari-safe ${
                            activeGathaNum === 'shrutskandh'
                              ? 'bg-gold/15 text-gold font-semibold shadow-sm'
                              : 'text-foreground/80 hover:bg-secondary hover:text-foreground'
                          }`}
                        >
                          <span className="truncate pr-2">श्रुतस्कन्ध</span>
                          <ChevronRight className="w-3.5 h-3.5 opacity-50 flex-shrink-0" />
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* 2. Main Content Area */}
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
          {/* Shastra Cover Page */}
          {!isLoadingGathas && shastraIndex?.cover && (
            <div
              id="gatha-cover"
              data-gatha-num="cover"
              ref={(el) => { gathaRefs.current['cover'] = el; }}
              className="flex flex-col items-center justify-center min-h-[85vh] text-center py-16 mb-8 border-b border-gold/20 devanagari-safe scroll-mt-20"
            >
              {shastraIndex.cover.invocation && (
                <h3 className="text-3xl md:text-4xl font-heading font-black text-gold drop-shadow-[0_2px_4px_rgba(212,175,55,0.4)] mb-12">
                  {shastraIndex.cover.invocation}
                </h3>
              )}
              
              {shastraIndex.cover.authorPrefix && (
                <h2 className="text-4xl md:text-5xl font-heading font-black text-foreground drop-shadow-[0_2px_6px_rgba(212,175,55,0.5)] mb-12">
                  {shastraIndex.cover.authorPrefix}
                </h2>
              )}
              
              {shastraIndex.cover.title && (
                <div className="flex flex-col items-center my-6">
                  <span className="text-3xl md:text-4xl font-heading font-black text-foreground mb-4">श्री</span>
                  <h1 className="text-7xl md:text-9xl font-heading font-black text-foreground drop-shadow-[0_4px_12px_rgba(212,175,55,0.8)] tracking-wide">
                    {shastraIndex.cover.title.replace('श्री ', '')}
                  </h1>
                </div>
              )}
              
              {shastraIndex.cover.subtitle && (
                <p className="text-lg md:text-xl font-bold text-gold/90 max-w-4xl leading-relaxed mt-16 px-4 drop-shadow-sm">
                  {shastraIndex.cover.subtitle}
                </p>
              )}
              
              {shastraIndex.cover.credits && (
                <p className="text-sm md:text-base font-bold text-muted-foreground max-w-4xl leading-relaxed mt-16">
                  {shastraIndex.cover.credits}
                </p>
              )}
            </div>
          )}

          {/* Verses Scroller */}
          {isLoadingGathas ? (
            <div className="space-y-24 animate-pulse pt-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border-b border-border/20 pb-16">
                  <div className="flex justify-between mb-6">
                    <div className="h-6 w-24 bg-secondary/80 rounded-full" />
                    <div className="h-6 w-16 bg-gold/20 rounded" />
                  </div>
                  <div className="h-10 w-3/4 bg-rose-900/10 rounded-xl mb-6 mx-auto" />
                  <div className="h-32 w-full bg-gold/5 rounded-2xl mb-6 border border-gold/10" />
                  <div className="h-24 w-full bg-secondary/30 rounded-xl mb-6" />
                  <div className="h-4 w-full bg-foreground/5 rounded mt-12" />
                  <div className="h-4 w-full bg-foreground/5 rounded mt-3" />
                  <div className="h-4 w-5/6 bg-foreground/5 rounded mt-3" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-24">
              {gathas.map(({ item, content, chapterName }, index) => {
                const isFirstOfChapter = index === 0 || gathas[index - 1].chapterName !== chapterName;
                return (
                  <GathaVerseItem
                    key={item.gathaNum}
                    item={item}
                    content={content}
                    chapterName={chapterName}
                    isFirstOfChapter={isFirstOfChapter}
                    contentFontSize={contentFontSize}
                    lineSpacing={lineSpacing}
                    readingClass={readingClass}
                    activeTeekaTabs={activeTeekaTabs}
                    setActiveTeekaTabs={setActiveTeekaTabs}
                    showSanskritTeeka={showSanskritTeeka}
                    setShowSanskritTeeka={setShowSanskritTeeka}
                    activeGathaNum={activeGathaNum}
                    t={t}
                    onRegisterRef={registerGathaRef}
                  />
                );
              })}
            </div>
          )}

          {/* Shrutskandh Page */}
          {!isLoadingGathas && (
            <div
              id="gatha-shrutskandh"
              data-gatha-num="shrutskandh"
              ref={(el) => { gathaRefs.current['shrutskandh'] = el; }}
              className="flex flex-col items-center justify-center py-16 mt-8 border-t border-gold/20 devanagari-safe scroll-mt-20"
            >
              <div className="flex flex-col items-center justify-center mb-8 space-y-4">
                <div className="w-full max-w-2xl h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
                <h2 className="text-2xl md:text-4xl font-heading font-bold text-gold tracking-widest devanagari-safe text-center px-4">
                  ------ श्रुतस्कन्ध ------
                </h2>
                <div className="w-full max-w-2xl h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
              </div>

              <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-gold/20 shadow-2xl bg-card p-3 relative group transition-all duration-500 hover:border-gold/40">
                <div className="absolute inset-0 bg-gold/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl" />
                <img 
                  src={ShrutskandhImg} 
                  alt="Shrutskandh" 
                  className="w-full h-auto rounded-xl shadow-inner object-contain max-h-[80vh] mx-auto"
                />
              </div>
            </div>
          )}
        </main>
      </div>

      <ShastraPrintTemplate
        title={shastraIndex.title}
        author={shastraIndex.author}
        gathas={gathas}
        theme={theme}
        useSerif={useSerif}
        fontSize={contentFontSize}
        lineSpacing={lineSpacing}
        isGenerating={isDownloadingPdf}
        onProgress={() => {}}
        onComplete={() => setIsDownloadingPdf(false)}
        onCancel={() => setIsDownloadingPdf(false)}
      />

      <Footer />
    </div>
  );
};

export default ShastraReader;
