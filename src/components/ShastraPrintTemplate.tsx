import React, { useState, useEffect, useRef } from 'react';
import { GathaContent, GathaItem } from '@/data/shastra-loader';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface ShastraPrintTemplateProps {
  title: string;
  author: string;
  gathas: { item: GathaItem; content: GathaContent; chapterName: string }[];
  theme: string;
  useSerif: boolean;
  fontSize: number;
  lineSpacing: number;
  isGenerating: boolean;
  onProgress: (current: number, total: number) => void;
  onComplete: () => void;
  onCancel: () => void;
}

interface Block {
  id: string;
  type: 'toc_header' | 'toc_row' | 'gatha_title' | 'prakrit' | 'sanskrit' | 'gadya' | 'anvayarth' | 'english' | 'teeka_header' | 'teeka_content_para' | 'table';
  gathaNum?: string;
  chapterName?: string;
  data: any;
}

interface PageData {
  pageIndex: number;
  type: 'toc' | 'gatha';
  chapterName?: string;
  gathaNum?: string;
  blocks: Block[];
}

const highlightBracketedTerms = (text: string) => {
  let prefix: string | null = null;
  let restText = text;
  
  // Check for list items like "१. जीवत्वशक्ति -" or "३३-३८. भाव-अभावादि छह शक्तियाँ -"
  const prefixMatch = text.match(/^([०-९0-9]+(?:-[०-९0-9]+)?\.\s+.*?[\s]*[-–]+(?:[\s]+|$))(.*)$/);
  if (prefixMatch) {
    prefix = prefixMatch[1];
    restText = prefixMatch[2];
  }

  const processText = (t: string) => {
    const parts = t.split(/(\*\*\[[^\]]+\]\*\*|\[[^\]]+\]|\([^\)]+\)|\{[^\}]+\}|(?:समाधान|उत्तर)\s*[–-])/);
    return parts.map((part, index) => {
      const solutionMatch = part.match(/^(समाधान|उत्तर)\s*([–-])$/);
      if (solutionMatch) {
        return (
          <span 
            key={index} 
            className="text-emerald-700 dark:text-emerald-400 font-bold pr-1"
          >
            {solutionMatch[1]} {solutionMatch[2]}
          </span>
        );
      }
      const boldMatch = part.match(/\*\*\[([^\]]+)\]\*\*/);
      if (boldMatch) {
        return (
          <span 
            key={index} 
            className="font-bold text-red-800 dark:text-gold px-0.5"
          >
            [{boldMatch[1]}]
          </span>
        );
      }
      const normalMatch = part.match(/^\[([^\]]+)\]$/);
      if (normalMatch) {
        return (
          <span 
            key={index} 
            className="font-bold text-red-800 dark:text-gold px-0.5"
          >
            [{normalMatch[1]}]
          </span>
        );
      }
      const parenMatch = part.match(/^\(([^\)]+)\)$/);
      // We exclude short numbers like (1) or (देव वंदना) if needed, but for now we format all matched parens 
      if (parenMatch && !part.match(/^\(\s*\d+\s*\)$/) && !part.match(/^\(कलश-/)) {
        return (
          <span 
            key={index} 
            className="text-sky-700 dark:text-sky-400 font-medium px-0.5"
          >
            ({parenMatch[1]})
          </span>
        );
      }
      const curlyMatch = part.match(/^\{([^\}]+)\}$/);
      if (curlyMatch) {
        return (
          <span 
            key={index} 
            className="text-orange-800 dark:text-orange-400 font-semibold px-0.5"
          >
            {curlyMatch[1]}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  if (prefix) {
    return (
      <span className="inline-block">
        <span className="inline-block px-1 py-0.5 mr-1 rounded text-gold font-semibold bg-gold/10 border border-gold/10">
          {prefix.trim()}
        </span>
        {processText(restText)}
      </span>
    );
  }

  return processText(text);
};

const renderTableBlockHelper = (id: string, rows: string[]) => {
  const tableData: string[][] = [];
  rows.forEach(row => {
    const cells = row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    if (cells.every(c => c.match(/^---+$/) || c === '')) {
      // Skip separator
    } else {
      tableData.push(cells);
    }
  });

  if (tableData.length === 0) return null;

  const headerRow = tableData[0];
  const bodyRows = tableData.slice(1);

  return (
    <div key={id} data-block-id={id} className="inline-block max-w-full overflow-x-auto my-4 rounded-xl border-4 border-double border-gold/30 shadow-md bg-card/50 p-1">
      <table className="border-collapse text-xs devanagari-safe font-heading">
        <thead className="bg-gold/15 dark:bg-gold/10 font-bold text-foreground">
          <tr>
            {headerRow.map((cell, cellIdx) => (
              <th key={cellIdx} className="px-3 py-2 text-center font-bold text-gold border border-gold/20">
                {highlightBracketedTerms(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-card">
          {bodyRows.map((row, rowIdx) => (
            <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-emerald-500/10 dark:bg-emerald-500/15' : 'bg-sky-500/10 dark:bg-sky-500/15'}>
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-3 py-1.5 text-center text-foreground/90 border border-border/50">
                  {highlightBracketedTerms(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ShastraPrintTemplate: React.FC<ShastraPrintTemplateProps> = ({
  title,
  author,
  gathas,
  theme,
  useSerif,
  fontSize,
  lineSpacing,
  isGenerating,
  onProgress,
  onComplete,
  onCancel
}) => {
  const [pages, setPages] = useState<PageData[]>([]);
  const [measuring, setMeasuring] = useState(false);
  const [gathaStartPages, setGathaStartPages] = useState<Record<string, number>>({});
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });
  
  const measuringContainerRef = useRef<HTMLDivElement>(null);
  const paginatedContainerRef = useRef<HTMLDivElement>(null);

  const themeClass = `theme-${theme}`;
  const fontClass = useSerif ? 'font-reading' : 'font-body';

  // 1. Prepare flat blocks list
  const allBlocks = React.useMemo(() => {
    const list: Block[] = [];
    
    // TOC Header
    list.push({
      id: 'toc-header',
      type: 'toc_header',
      data: { title, author }
    });

    // TOC Rows
    gathas.forEach(({ item, chapterName }) => {
      list.push({
        id: `toc-row-${item.gathaNum}`,
        type: 'toc_row',
        gathaNum: item.gathaNum,
        data: { gathaNum: item.gathaNum, chapterName, title: item.title }
      });
    });

    // Gathas
    gathas.forEach(({ item, content, chapterName }) => {
      const gathaNum = item.gathaNum;

      // Title block
      list.push({
        id: `gatha-${gathaNum}-title`,
        type: 'gatha_title',
        gathaNum,
        chapterName,
        data: { gathaNum, title: content.title, chapterName }
      });

      // Prakrit
      list.push({
        id: `gatha-${gathaNum}-prakrit`,
        type: 'prakrit',
        gathaNum,
        chapterName,
        data: content.gatha
      });

      // Sanskrit
      if (content.gathaS) {
        list.push({
          id: `gatha-${gathaNum}-sanskrit`,
          type: 'sanskrit',
          gathaNum,
          chapterName,
          data: content.gathaS
        });
      }

      // Gadya (Poetic Hindi)
      if (content.gadya) {
        list.push({
          id: `gatha-${gathaNum}-gadya`,
          type: 'gadya',
          gathaNum,
          chapterName,
          data: content.gadya
        });
      }

      // Anvayarth
      list.push({
        id: `gatha-${gathaNum}-anvayarth`,
        type: 'anvayarth',
        gathaNum,
        chapterName,
        data: content.anvayarth
      });

      // English
      if (content.english) {
        list.push({
          id: `gatha-${gathaNum}-english`,
          type: 'english',
          gathaNum,
          chapterName,
          data: content.english
        });
      }

      // Teekas
      content.teekas.forEach(teeka => {
        const comm = teeka.commentator;
        
        list.push({
          id: `gatha-${gathaNum}-teeka-${comm}-header`,
          type: 'teeka_header',
          gathaNum,
          chapterName,
          data: comm
        });

        if (teeka.sanskrit) {
          const lines = teeka.sanskrit.split('\n');
          let inVerse = false;
          let pIdx = 0;
          let currentTableRows: string[] = [];

          const flushTableBlock = () => {
            if (currentTableRows.length > 0) {
              list.push({
                id: `gatha-${gathaNum}-teeka-${comm}-sanskrit-table-${pIdx++}`,
                type: 'table',
                gathaNum,
                chapterName,
                data: [...currentTableRows]
              });
              currentTableRows = [];
            }
          };

          lines.forEach((lineText) => {
            const clean = lineText.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

            if (clean.startsWith('|')) {
              currentTableRows.push(clean);
              return;
            } else {
              flushTableBlock();
            }

            if (!clean) return;

            const isMeterHeader = clean.startsWith('(') && clean.endsWith(')') && clean.length <= 50;
            const isStarLine = clean.startsWith('*') && !clean.startsWith('**');

            if (isMeterHeader) {
              inVerse = true;
              list.push({
                id: `gatha-${gathaNum}-teeka-${comm}-sanskrit-p-${pIdx++}`,
                type: 'teeka_content_para',
                gathaNum,
                chapterName,
                data: { isSanskrit: true, text: clean, isMeterHeader: true, inVerse: false, isStarLine: false }
              });
            } else if (inVerse && (clean.startsWith('[') || clean.startsWith('**['))) {
              inVerse = false;
              list.push({
                id: `gatha-${gathaNum}-teeka-${comm}-sanskrit-p-${pIdx++}`,
                type: 'teeka_content_para',
                gathaNum,
                chapterName,
                data: { isSanskrit: true, text: clean, isMeterHeader: false, inVerse: false, isStarLine: false }
              });
            } else if (inVerse) {
              list.push({
                id: `gatha-${gathaNum}-teeka-${comm}-sanskrit-p-${pIdx++}`,
                type: 'teeka_content_para',
                gathaNum,
                chapterName,
                data: { isSanskrit: true, text: clean, isMeterHeader: false, inVerse: true, isStarLine: false }
              });
            } else {
              list.push({
                id: `gatha-${gathaNum}-teeka-${comm}-sanskrit-p-${pIdx++}`,
                type: 'teeka_content_para',
                gathaNum,
                chapterName,
                data: { isSanskrit: true, text: clean, isMeterHeader: false, inVerse: false, isStarLine }
              });
            }
          });
          flushTableBlock();
        }

        if (teeka.hindi) {
          const lines = teeka.hindi.split('\n');
          let inVerse = false;
          let pIdx = 0;
          let currentTableRows: string[] = [];

          const flushTableBlock = () => {
            if (currentTableRows.length > 0) {
              list.push({
                id: `gatha-${gathaNum}-teeka-${comm}-hindi-table-${pIdx++}`,
                type: 'table',
                gathaNum,
                chapterName,
                data: [...currentTableRows]
              });
              currentTableRows = [];
            }
          };

          lines.forEach((lineText) => {
            const clean = lineText.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

            if (clean.startsWith('|')) {
              currentTableRows.push(clean);
              return;
            } else {
              flushTableBlock();
            }

            if (!clean) return;

            const isMeterHeader = clean.startsWith('(') && clean.endsWith(')') && clean.length <= 50;
            const isStarLine = clean.startsWith('*') && !clean.startsWith('**');

            if (isMeterHeader) {
              inVerse = true;
              list.push({
                id: `gatha-${gathaNum}-teeka-${comm}-hindi-p-${pIdx++}`,
                type: 'teeka_content_para',
                gathaNum,
                chapterName,
                data: { isSanskrit: false, text: clean, isMeterHeader: true, inVerse: false, isStarLine: false }
              });
            } else if (inVerse && (clean.startsWith('[') || clean.startsWith('**['))) {
              inVerse = false;
              list.push({
                id: `gatha-${gathaNum}-teeka-${comm}-hindi-p-${pIdx++}`,
                type: 'teeka_content_para',
                gathaNum,
                chapterName,
                data: { isSanskrit: false, text: clean, isMeterHeader: false, inVerse: false, isStarLine: false }
              });
            } else if (inVerse) {
              list.push({
                id: `gatha-${gathaNum}-teeka-${comm}-hindi-p-${pIdx++}`,
                type: 'teeka_content_para',
                gathaNum,
                chapterName,
                data: { isSanskrit: false, text: clean, isMeterHeader: false, inVerse: true, isStarLine: false }
              });
            } else {
              list.push({
                id: `gatha-${gathaNum}-teeka-${comm}-hindi-p-${pIdx++}`,
                type: 'teeka_content_para',
                gathaNum,
                chapterName,
                data: { isSanskrit: false, text: clean, isMeterHeader: false, inVerse: false, isStarLine }
              });
            }
          });
          flushTableBlock();
        }
      });
    });

    return list;
  }, [title, author, gathas]);

  // 2. Start measuring when isGenerating becomes true
  useEffect(() => {
    if (isGenerating) {
      setPages([]);
      setMeasuring(true);
    } else {
      setMeasuring(false);
      setPages([]);
    }
  }, [isGenerating]);

  // 3. Perform measurement & pagination
  useEffect(() => {
    if (!measuring || !measuringContainerRef.current) return;

    // Wait a frame for browser to render
    const timer = setTimeout(() => {
      const container = measuringContainerRef.current;
      if (!container) return;

      const blockHeights: Record<string, number> = {};
      const blockElements = container.querySelectorAll('[data-block-id]');
      
      blockElements.forEach(el => {
        const blockId = el.getAttribute('data-block-id');
        if (blockId) {
          blockHeights[blockId] = el.clientHeight;
        }
      });

      // Pagination Algorithm
      // Page size is 1123px high, padding is 40px top/bottom, leaving 1043px.
      // We use a safe content limit of 1000px.
      const contentHeightLimit = 1000;
      const paginatedPages: PageData[] = [];
      const computedGathaStartPages: Record<string, number> = {};

      let currentPageIndex = 1;
      let currentPageType: 'toc' | 'gatha' = 'toc';
      let currentPageBlocks: Block[] = [];
      let currentPageHeight = 0;

      // Locate block categories
      const tocHeaderBlock = allBlocks.find(b => b.type === 'toc_header');
      const tocRowBlocks = allBlocks.filter(b => b.type === 'toc_row');
      const gathaBlocks = allBlocks.filter(b => b.type !== 'toc_header' && b.type !== 'toc_row');

      // Paginate TOC
      if (tocHeaderBlock) {
        currentPageBlocks.push(tocHeaderBlock);
        currentPageHeight += blockHeights[tocHeaderBlock.id] || 150;
      }

      tocRowBlocks.forEach(rowBlock => {
        const rowHeight = blockHeights[rowBlock.id] || 40;
        
        // If row overflows, create new TOC page
        if (currentPageHeight + rowHeight > contentHeightLimit) {
          paginatedPages.push({
            pageIndex: currentPageIndex,
            type: 'toc',
            blocks: currentPageBlocks
          });
          currentPageIndex++;
          currentPageBlocks = [];
          currentPageHeight = 0;
        }
        currentPageBlocks.push(rowBlock);
        currentPageHeight += rowHeight;
      });

      // Save last TOC page
      if (currentPageBlocks.length > 0) {
        paginatedPages.push({
          pageIndex: currentPageIndex,
          type: 'toc',
          blocks: currentPageBlocks
        });
        currentPageIndex++;
      }

      // Paginate Gatha contents
      currentPageType = 'gatha';
      currentPageBlocks = [];
      currentPageHeight = 0;

      let currentGathaNum = '';
      let currentChapterName = '';

      gathaBlocks.forEach(block => {
        const blockHeight = blockHeights[block.id] || 50;

        if (block.type === 'gatha_title') {
          currentGathaNum = block.gathaNum || '';
          currentChapterName = block.chapterName || '';

          // Each Gatha MUST start on a new page
          if (currentPageBlocks.length > 0) {
            paginatedPages.push({
              pageIndex: currentPageIndex,
              type: 'gatha',
              chapterName: currentChapterName,
              gathaNum: currentGathaNum,
              blocks: currentPageBlocks
            });
            currentPageIndex++;
          }
          
          currentPageBlocks = [block];
          currentPageHeight = blockHeight;
          computedGathaStartPages[currentGathaNum] = currentPageIndex;
        } else {
          // If block overflows current page, split to next page
          if (currentPageHeight + blockHeight > contentHeightLimit) {
            paginatedPages.push({
              pageIndex: currentPageIndex,
              type: 'gatha',
              chapterName: currentChapterName,
              gathaNum: currentGathaNum,
              blocks: currentPageBlocks
            });
            currentPageIndex++;
            currentPageBlocks = [block];
            currentPageHeight = blockHeight;
          } else {
            currentPageBlocks.push(block);
            currentPageHeight += blockHeight;
          }
        }
      });

      // Save final Gatha page
      if (currentPageBlocks.length > 0) {
        paginatedPages.push({
          pageIndex: currentPageIndex,
          type: 'gatha',
          chapterName: currentChapterName,
          gathaNum: currentGathaNum,
          blocks: currentPageBlocks
        });
      }

      setGathaStartPages(computedGathaStartPages);
      setPages(paginatedPages);
      setMeasuring(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [measuring, allBlocks]);

  // 4. PDF compilation phase
  useEffect(() => {
    if (pages.length === 0) return;

    const compilePdf = async () => {
      // Wait for rendering
      await new Promise(resolve => setTimeout(resolve, 800));

      const container = paginatedContainerRef.current;
      if (!container) return;

      const pageDivs = container.querySelectorAll('.pdf-page');
      if (pageDivs.length === 0) return;

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const scaleFactorX = 210 / 794;
      const scaleFactorY = 297 / 1123;

      for (let i = 0; i < pageDivs.length; i++) {
        const pageEl = pageDivs[i] as HTMLDivElement;
        
        setPdfProgress({ current: i + 1, total: pageDivs.length });
        onProgress(i + 1, pageDivs.length);

        if (i > 0) {
          doc.addPage();
        }

        // Snapshot page
        const canvas = await html2canvas(pageEl, {
          scale: 2, // 2x scale for print quality
          useCORS: true,
          logging: false
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        doc.addImage(imgData, 'JPEG', 0, 0, 210, 297);

        // Add interactive links on this page
        // 1. TOC page row links
        const rowLinks = pageEl.querySelectorAll('[data-toc-row-target]');
        rowLinks.forEach(el => {
          const targetGatha = el.getAttribute('data-toc-row-target');
          if (targetGatha) {
            const targetPageNum = gathaStartPages[targetGatha];
            if (targetPageNum) {
              const rect = el.getBoundingClientRect();
              const pageRect = pageEl.getBoundingClientRect();
              
              const x = (rect.left - pageRect.left) * scaleFactorX;
              const y = (rect.top - pageRect.top) * scaleFactorY;
              const w = rect.width * scaleFactorX;
              const h = rect.height * scaleFactorY;

              doc.link(x, y, w, h, { pageNumber: targetPageNum });
            }
          }
        });

        // 2. Home buttons on Gatha pages
        const homeBtn = pageEl.querySelector('[data-home-button]');
        if (homeBtn) {
          const rect = homeBtn.getBoundingClientRect();
          const pageRect = pageEl.getBoundingClientRect();
          
          const x = (rect.left - pageRect.left) * scaleFactorX;
          const y = (rect.top - pageRect.top) * scaleFactorY;
          const w = rect.width * scaleFactorX;
          const h = rect.height * scaleFactorY;

          doc.link(x, y, w, h, { pageNumber: 1 });
        }
      }

      const cleanTitle = title.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');
      doc.save(`${cleanTitle}_समयसार_ग्रन्थ.pdf`);
      onComplete();
    };

    compilePdf();
  }, [pages, gathaStartPages]);

  // Helper to render bracketed words in Anvayarth
  const renderHighlightedAnvayarth = (text: string) => {
    return text.split('\n').map((line, lineIndex, arr) => {
      const trimmed = line.trim();
      const isStarLine = trimmed.startsWith('*') && !trimmed.startsWith('**');

      const parts = line.split(/(\*\*\[[^\]]+\]\*\*|\([^\)]+\))/);

      const displayClasses = isStarLine
        ? "block mb-0.5 last:mb-0 text-gold-light font-medium leading-normal"
        : "block mb-1.5 last:mb-0";

      const displayStyle = isStarLine
        ? { fontSize: '0.55em', marginLeft: '2rem' }
        : undefined;

      return (
        <span key={lineIndex} className={displayClasses} style={displayStyle}>
          {parts.map((part, index) => {
            const boldMatch = part.match(/\*\*\[([^\]]+)\]\*\*/);
            if (boldMatch) {
              return (
                <span 
                  key={index} 
                  className={isStarLine 
                    ? "text-gold font-bold px-0.5 text-sm"
                    : "inline px-1 py-0.5 mx-0.5 rounded text-gold font-bold bg-gold/10 border border-gold/25 text-sm"
                  }
                >
                  {boldMatch[1]}
                </span>
              );
            }
            const parenMatch = part.match(/^\(([^\)]+)\)$/);
            if (parenMatch) {
              return (
                <span 
                  key={index} 
                  className="text-sky-700 dark:text-sky-400 font-medium text-sm px-0.5"
                >
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

  if (!isGenerating) return null;

  return (
    <div className={`fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 ${themeClass}`}>
      {/* 1. Progress Indicator View */}
      <div className="max-w-md w-full text-center space-y-6 bg-card border border-border/50 p-8 rounded-2xl shadow-xl">
        <h2 className="text-2xl font-heading font-bold text-gradient-gold devanagari-safe">
          {title} — PDF संकलन
        </h2>
        <p className="text-sm text-muted-foreground devanagari-safe">
          ग्रन्थ के सभी अध्यायों, गाथाओं और टीकाओं को मूल स्वरूप में संयोजित किया जा रहा है...
        </p>

        {/* Loading Spinner */}
        <div className="flex justify-center">
          <div className="relative w-20 h-20 flex items-center justify-center">
            <div className="absolute inset-0 border-4 border-gold/20 rounded-full" />
            <div className="absolute inset-0 border-4 border-gold border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold text-gold">PDF</span>
          </div>
        </div>

        {/* Progress Text */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground devanagari-safe">
            {pages.length === 0 
              ? 'पृष्ठ लेआउट और लम्बाई की गणना की जा रही है (Calculating page lengths)...' 
              : `पृष्ठ संकलन प्रगति (Compiling pages): ${pdfProgress.current} / ${pdfProgress.total}`
            }
          </p>
          {pages.length > 0 && (
            <div className="w-full bg-secondary/50 rounded-full h-2 overflow-hidden border border-border/30">
              <div 
                className="bg-gold h-full transition-all duration-300"
                style={{ width: `${(pdfProgress.total > 0 ? (pdfProgress.current / pdfProgress.total) * 100 : 0)}%` }}
              />
            </div>
          )}
        </div>

        <button 
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-destructive underline transition-colors"
        >
          रद्द करें / Cancel
        </button>
      </div>

      {/* 2. Hidden measuring container (flat list of blocks) */}
      {measuring && (
        <div 
          ref={measuringContainerRef}
          className={`absolute left-[-9999px] top-0 w-[794px] opacity-0 pointer-events-none p-[40px] flex flex-col bg-background text-foreground ${fontClass}`}
          style={{ fontSize: `${fontSize}px`, lineHeight: lineSpacing }}
        >
          {allBlocks.map(block => {
            switch (block.type) {
              case 'toc_header':
                return (
                  <div key={block.id} data-block-id={block.id} className="text-center mb-12 border-b-2 border-gold/30 pb-6">
                    <h1 className="text-3xl font-bold text-gold mb-2">{block.data.title}</h1>
                    <p className="text-base text-foreground/80">✍️ लेखक: {block.data.author}</p>
                  </div>
                );

              case 'toc_row':
                return (
                  <div 
                    key={block.id} 
                    data-block-id={block.id} 
                    className="flex justify-between items-center py-2 border-b border-border/40 text-sm"
                  >
                    <span className="font-bold">{block.data.gathaNum}</span>
                    <span className="text-muted-foreground">{block.data.chapterName}</span>
                    <span className="flex-1 px-4 truncate">{block.data.title}</span>
                    <span>1</span>
                  </div>
                );

              case 'gatha_title':
                return (
                  <div key={block.id} data-block-id={block.id} className="w-full mb-6">
                    <div className="flex justify-between items-center border-b border-border/40 pb-2 mb-4">
                      <span className="text-xs font-semibold text-gold/80 bg-gold/5 px-2.5 py-1 rounded">📂 {block.data.chapterName}</span>
                      <span className="text-lg font-bold text-gold">#{block.data.gathaNum}</span>
                    </div>
                    <h3 className="text-3xl font-bold text-center text-rose-900 dark:text-rose-900 devanagari-safe">{block.data.title}</h3>
                  </div>
                );

              case 'prakrit':
                return (
                  <div key={block.id} data-block-id={block.id} className="p-6 rounded-xl bg-gold/5 border border-gold/20 mb-4 text-center">
                    <h4 className="text-[10px] uppercase text-gold font-bold mb-2">गाथा (प्राकृत)</h4>
                    <p className="whitespace-pre-line text-2xl font-bold leading-loose text-orange-800 dark:text-orange-400">{block.data}</p>
                  </div>
                );

              case 'sanskrit':
                return (
                  <div key={block.id} data-block-id={block.id} className="p-4 rounded-lg bg-secondary/30 border border-border/30 mb-4 text-center">
                    <h4 className="text-[10px] uppercase text-muted-foreground/80 font-bold mb-2">संस्कृत छाया</h4>
                    <p className="whitespace-pre-line text-base text-sky-900 dark:text-sky-900 leading-loose">{block.data}</p>
                  </div>
                );

              case 'gadya':
                return (
                  <div key={block.id} data-block-id={block.id} className="text-center italic text-foreground/90 my-6 px-6 border-l-2 border-r-2 border-gold/30">
                    <p className="leading-relaxed whitespace-pre-line">{block.data}</p>
                  </div>
                );

              case 'anvayarth':
                return (
                  <div key={block.id} data-block-id={block.id} className="my-4 text-sm leading-loose text-foreground">
                    <span className="font-bold text-gold block mb-1">अन्वयार्थ:</span>
                    {renderHighlightedAnvayarth(block.data)}
                  </div>
                );

              case 'english':
                return (
                  <div key={block.id} data-block-id={block.id} className="my-4 p-4 rounded-xl bg-card border border-border/30 text-xs text-foreground/80 font-sans leading-relaxed">
                    <span className="font-bold text-gold block mb-1 font-heading">English Meaning:</span>
                    {block.data}
                  </div>
                );

              case 'teeka_header':
                return (
                  <div key={block.id} data-block-id={block.id} className="mt-6 mb-2 border-b border-gold/20 pb-1">
                    <h5 className="text-sm font-bold text-gold">टीका: {block.data}</h5>
                  </div>
                );

              case 'teeka_content_para': {
                const isMeterHeader = block.data.isMeterHeader;
                const inVerse = block.data.inVerse;
                const isStarLine = block.data.isStarLine;
                
                let paraClass = "my-2 text-xs leading-loose ";
                let paraStyle: React.CSSProperties | undefined = undefined;
                
                if (isMeterHeader) {
                  paraClass += "text-center font-bold text-teal-700 dark:text-teal-400 my-3 text-sm devanagari-safe";
                } else if (inVerse) {
                  paraClass += "text-center text-orange-800 dark:text-orange-400 font-semibold my-1 text-base leading-relaxed devanagari-safe";
                } else if (isStarLine) {
                  paraClass += "text-gold-light text-left font-medium devanagari-safe";
                  paraStyle = {
                    fontSize: '0.55em',
                    marginLeft: '2rem',
                    marginTop: '1px',
                    marginBottom: '1px',
                    lineHeight: '1.4'
                  };
                } else {
                  paraClass += `text-foreground/90 text-left devanagari-safe ${block.data.isSanskrit ? 'bg-gold/5 p-2.5 rounded-lg border border-gold/10 italic text-foreground/80' : ''}`;
                }
                
                return (
                  <p 
                    key={block.id} 
                    data-block-id={block.id} 
                    className={paraClass}
                    style={paraStyle}
                  >
                    {block.data.isSanskrit && !isMeterHeader && !inVerse && !isStarLine && (
                      <span className="font-bold text-[9px] uppercase text-gold block mb-1">संस्कृत</span>
                    )}
                    {isMeterHeader || inVerse 
                      ? block.data.text 
                      : highlightBracketedTerms(block.data.text)
                    }
                  </p>
                );
              }

              case 'table':
                return renderTableBlockHelper(block.id, block.data);

              default:
                return null;
            }
          })}
        </div>
      )}

      {/* 3. Hidden container for paginated pages rendering */}
      {pages.length > 0 && (
        <div 
          ref={paginatedContainerRef}
          className="absolute left-[-9999px] top-0 flex flex-col gap-6"
        >
          {pages.map((page, pIdx) => {
            const pageNum = page.pageIndex;
            
            return (
              <div 
                key={pIdx}
                className={`pdf-page w-[794px] h-[1123px] relative flex flex-col justify-between p-[40px] bg-background text-foreground box-border overflow-hidden select-none ${themeClass} ${fontClass}`}
                style={{ fontSize: `${fontSize}px`, lineHeight: lineSpacing }}
              >
                {/* 1. Double Gold scripture-style page border */}
                <div className="absolute inset-[15px] border-2 border-gold/40 rounded-lg pointer-events-none" />
                <div className="absolute inset-[19px] border border-gold/20 rounded pointer-events-none" />

                {/* 2. Top Header (only on non-first Gatha pages) */}
                <div className="flex justify-between items-center border-b border-border/40 pb-2 mb-4 z-10">
                  {page.type === 'toc' ? (
                    <>
                      <span className="text-xs font-semibold text-gold/80">समयसार परमागम</span>
                      <span className="text-xs font-semibold text-gold/80">अनुक्रमणिका (TOC)</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-semibold text-gold/80">📂 {page.chapterName}</span>
                      
                      {/* Home Button and Gatha Badge */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gold/90 bg-gold/10 px-2 py-0.5 rounded border border-gold/20">
                          #{page.gathaNum}
                        </span>
                        <div 
                          data-home-button 
                          className="w-7 h-7 rounded border border-gold/40 flex items-center justify-center text-gold bg-gold/10 shadow-sm cursor-pointer hover:bg-gold/20"
                          title="सूची पर वापस जाएँ"
                        >
                          <svg className="w-3.5 h-3.5 fill-current text-gold" viewBox="0 0 24 24">
                            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                          </svg>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* 3. Page Content Area */}
                <div className="flex-1 flex flex-col justify-start overflow-hidden z-10">
                  {page.type === 'toc' ? (
                    <div className="flex-1 flex flex-col justify-start">
                      {page.blocks.map(block => {
                        if (block.type === 'toc_header') {
                          return (
                            <div key={block.id} className="text-center mb-6 mt-2 border-b-2 border-gold/30 pb-4">
                              <h1 className="text-3xl font-bold text-gradient-gold mb-1">{block.data.title}</h1>
                              <p className="text-sm text-gold/80 font-semibold">✍️ लेखक: {block.data.author}</p>
                            </div>
                          );
                        }
                        return null;
                      })}

                      {/* TOC Table */}
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gold/10 border border-gold/40 text-xs text-gold font-bold">
                            <th className="border border-gold/40 px-3 py-2 text-left w-[120px]">गाथा #</th>
                            <th className="border border-gold/40 px-3 py-2 text-left w-[140px]">अधिकार</th>
                            <th className="border border-gold/40 px-3 py-2 text-left w-[364px]">शीर्षक</th>
                            <th className="border border-gold/40 px-3 py-2 text-center w-[60px]">पृष्ठ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {page.blocks.map(block => {
                            if (block.type === 'toc_row') {
                              const targetPage = gathaStartPages[block.gathaNum || ''] || '';
                              return (
                                <tr 
                                  key={block.id} 
                                  data-toc-row-target={block.gathaNum}
                                  className="border border-gold/40 text-[12px] hover:bg-gold/5 cursor-pointer transition-colors"
                                >
                                  <td className="border border-gold/40 px-3 py-1.5 font-bold text-gold">गाथा #{block.data.gathaNum}</td>
                                  <td className="border border-gold/40 px-3 py-1.5 text-foreground/80 truncate max-w-[140px]">{block.data.chapterName}</td>
                                  <td className="border border-gold/40 px-3 py-1.5 text-foreground/95 font-medium truncate max-w-[364px]">{block.data.title}</td>
                                  <td className="border border-gold/40 px-3 py-1.5 text-center font-bold text-gold">{targetPage}</td>
                                </tr>
                              );
                            }
                            return null;
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="space-y-4 flex flex-col justify-start">
                      {page.blocks.map(block => {
                        switch (block.type) {
                          case 'gatha_title':
                            return (
                              <h3 key={block.id} className="text-3xl font-bold text-center text-rose-900 dark:text-rose-900 border-b border-border/20 pb-2 devanagari-safe">
                                {block.data.title}
                              </h3>
                            );

                          case 'prakrit':
                            return (
                              <div key={block.id} className="p-6 rounded-xl bg-gold/5 border border-gold/25 mb-2 text-center shadow-sm">
                                <h4 className="text-[10px] uppercase tracking-wider text-gold font-bold mb-2">गाथा (प्राकृत)</h4>
                                <p className="whitespace-pre-line text-2xl font-bold leading-loose text-orange-800 dark:text-orange-400 devanagari-safe">{block.data}</p>
                              </div>
                            );

                          case 'sanskrit':
                            return (
                              <div key={block.id} className="p-4 rounded-lg bg-secondary/20 border border-border/30 mb-2 text-center">
                                <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-bold mb-1">संस्कृत छाया</h4>
                                <p className="whitespace-pre-line text-base text-sky-900 dark:text-sky-900 leading-loose devanagari-safe">{block.data}</p>
                              </div>
                            );

                          case 'gadya':
                            return (
                              <div key={block.id} className="text-center italic text-foreground/95 font-serif my-4 px-6 border-l-2 border-r-2 border-gold/30">
                                <p className="leading-relaxed whitespace-pre-line devanagari-safe">{block.data}</p>
                              </div>
                            );

                          case 'anvayarth':
                            return (
                              <div key={block.id} className="my-2 text-sm leading-loose text-foreground devanagari-safe">
                                <span className="font-bold text-gold block mb-1">अन्वयार्थ:</span>
                                {renderHighlightedAnvayarth(block.data)}
                              </div>
                            );

                          case 'english':
                            return (
                              <div key={block.id} className="my-2 p-4 rounded-xl bg-card border border-border/30 text-xs text-foreground/80 font-sans leading-relaxed">
                                <span className="font-bold text-gold block mb-1 font-heading">English Meaning:</span>
                                {block.data}
                              </div>
                            );

                          case 'teeka_header':
                            return (
                              <div key={block.id} className="mt-4 mb-1 border-b border-gold/20 pb-0.5">
                                <h5 className="text-sm font-bold text-gold">टीका: {block.data}</h5>
                              </div>
                            );

                          case 'teeka_content_para': {
                            const isMeterHeader = block.data.isMeterHeader;
                            const inVerse = block.data.inVerse;
                            const isStarLine = block.data.isStarLine;
                            
                            let paraClass = "my-1 text-xs leading-loose ";
                            let paraStyle: React.CSSProperties | undefined = undefined;
                            
                            if (isMeterHeader) {
                              paraClass += "text-center font-bold text-teal-700 dark:text-teal-400 my-2 text-sm devanagari-safe";
                            } else if (inVerse) {
                              paraClass += "text-center text-orange-800 dark:text-orange-400 font-semibold my-0.5 text-base leading-relaxed devanagari-safe";
                            } else if (isStarLine) {
                              paraClass += "text-gold-light text-left font-medium devanagari-safe";
                              paraStyle = {
                                fontSize: '0.55em',
                                marginLeft: '2rem',
                                marginTop: '1px',
                                marginBottom: '1px',
                                lineHeight: '1.4'
                              };
                            } else {
                              paraClass += `text-foreground/90 text-left devanagari-safe ${block.data.isSanskrit ? 'bg-gold/5 p-2.5 rounded-lg border border-gold/10 italic text-foreground/80' : ''}`;
                            }
                            
                            return (
                              <p 
                                key={block.id} 
                                className={paraClass}
                                style={paraStyle}
                              >
                                {block.data.isSanskrit && !isMeterHeader && !inVerse && !isStarLine && (
                                  <span className="font-bold text-[9px] uppercase text-gold block mb-1">संस्कृत</span>
                                )}
                                {isMeterHeader || inVerse 
                                  ? block.data.text 
                                  : highlightBracketedTerms(block.data.text)
                                }
                              </p>
                            );
                          }

                           case 'table':
                             return renderTableBlockHelper(block.id, block.data);

                           default:
                             return null;
                        }
                      })}
                    </div>
                  )}
                </div>

                {/* 4. Page Footer */}
                <div className="flex justify-between items-center border-t border-border/40 pt-2 mt-4 text-xs text-muted-foreground z-10">
                  <span>समयसार परमागम</span>
                  <span className="font-bold text-foreground">{pageNum} / {pages.length}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ShastraPrintTemplate;
