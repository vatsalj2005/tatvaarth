import jsPDF from 'jspdf';
import { GathaContent, GathaItem } from '@/data/shastra-loader';

interface FullShastraPdfOptions {
  title: string;
  author: string;
  gathas: { item: GathaItem; content: GathaContent; chapterName: string }[];
  theme: 'dark' | 'soft-dark' | 'light' | 'sepia';
}

const themeColors: Record<string, { bg: [number, number, number]; text: [number, number, number]; accent: [number, number, number]; divider: [number, number, number] }> = {
  dark: {
    bg: [24, 26, 33],
    text: [220, 210, 190],
    accent: [212, 168, 83],
    divider: [80, 75, 65],
  },
  'soft-dark': {
    bg: [38, 40, 48],
    text: [215, 208, 195],
    accent: [212, 168, 83],
    divider: [90, 85, 75],
  },
  light: {
    bg: [248, 244, 235],
    text: [30, 32, 45],
    accent: [160, 120, 50],
    divider: [200, 190, 170],
  },
  sepia: {
    bg: [240, 228, 205],
    text: [50, 40, 25],
    accent: [140, 95, 40],
    divider: [200, 185, 155],
  },
};

const devanagariFontFile = 'NotoSansDevanagari-Regular.ttf';
const devanagariFontFamily = 'NotoSansDevanagari';
let devanagariFontBase64: string | null = null;

function sanitizeText(text: string): string {
  if (!text) return '';
  let cleaned = text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');
  cleaned = cleaned.normalize('NFC');
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '');
  cleaned = cleaned.split('\n').map(line => line.trim()).join('\n');
  return cleaned;
}

async function loadDevanagariFont(doc: jsPDF) {
  try {
    if (!devanagariFontBase64) {
      const basePath = import.meta.env.BASE_URL || '/';
      const fontPath = `${basePath}fonts/${devanagariFontFile}`;
      const response = await fetch(fontPath);
      if (!response.ok) throw new Error('Font not found');
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      devanagariFontBase64 = btoa(binary);
    }
    doc.addFileToVFS(devanagariFontFile, devanagariFontBase64);
    doc.addFont(devanagariFontFile, devanagariFontFamily, 'normal');
    return true;
  } catch (err) {
    console.error('Failed to load Devanagari font for PDF:', err);
    return false;
  }
}

export async function generateFullShastraPdf({ title, author, gathas, theme }: FullShastraPdfOptions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 20;
  const marginRight = 20;
  const marginTop = 20;
  const marginBottom = 25;
  const contentWidth = pageWidth - marginLeft - marginRight;
  const colors = themeColors[theme] || themeColors.dark;

  const useDevanagari = await loadDevanagariFont(doc);

  function setPageBg() {
    doc.setFillColor(...colors.bg);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
  }

  function setTextColor() {
    doc.setTextColor(...colors.text);
  }

  function setAccentColor() {
    doc.setTextColor(...colors.accent);
  }

  function useHindiFont() {
    if (useDevanagari) {
      doc.setFont(devanagariFontFamily, 'normal');
      return;
    }
    doc.setFont('Helvetica', 'normal');
  }

  function useRomanFont() {
    doc.setFont('Helvetica', 'normal');
  }

  function drawCenteredLine(line: string, y: number) {
    const width = doc.getTextWidth(line);
    const x = Math.max((pageWidth - width) / 2, marginLeft);
    doc.text(line, x, y);
  }

  function toWrappedLines(rawText: string, fontSetter: () => void, fontSize: number): string[] {
    const wrappedLines: string[] = [];
    fontSetter();
    doc.setFontSize(fontSize);

    for (const rawLine of rawText.split('\n')) {
      const line = rawLine.trim();
      if (!line) {
        wrappedLines.push('');
        continue;
      }
      const split = doc.splitTextToSize(line, contentWidth);
      const splitArray = Array.isArray(split) ? split : [split];
      for (const part of splitArray) {
        wrappedLines.push(`${part}`.trim());
      }
    }
    return wrappedLines;
  }

  // ----------------------------------------------------
  // PASS 1: Initialize index page layout and placeholder recording
  // ----------------------------------------------------
  setPageBg();
  setTextColor();
  useHindiFont();

  let y = marginTop + 10;

  // Main Heading of Scripture
  setAccentColor();
  doc.setFontSize(26);
  drawCenteredLine(sanitizeText(title), y);
  y += 10;

  // Author details
  setTextColor();
  doc.setFontSize(11);
  drawCenteredLine(sanitizeText(`लेखक: ${author}`), y);
  y += 12;

  // Set up index columns coordinates
  const colGathaX = marginLeft;
  const colChapX = marginLeft + 18;
  const colTitleX = marginLeft + 65;
  const colPageX = pageWidth - marginRight; // Right-aligned

  const drawHeaders = (currentY: number) => {
    doc.setFontSize(10);
    setAccentColor();
    useHindiFont();
    doc.text(sanitizeText('गाथा'), colGathaX, currentY);
    doc.text(sanitizeText('अधिकार'), colChapX, currentY);
    doc.text(sanitizeText('शीर्षक'), colTitleX, currentY);
    doc.text(sanitizeText('पृष्ठ'), colPageX, currentY, { align: 'right' });
    
    doc.setDrawColor(...colors.divider);
    doc.setLineWidth(0.4);
    doc.line(marginLeft, currentY + 2, pageWidth - marginRight, currentY + 2);
    return currentY + 8;
  };

  y = drawHeaders(y);

  // Arrays to hold placeholders to resolve pages later
  const pageNumPlaceholders: { gathaNum: string; pageIndex: number; x: number; y: number }[] = [];
  const indexLinks: { gathaNum: string; pageIndex: number; clickX: number; clickY: number; clickW: number; clickH: number }[] = [];

  for (const gatha of gathas) {
    const gathaNum = gatha.item.gathaNum;
    const chapName = gatha.chapterName;
    const gathaTitle = gatha.item.title;

    doc.setFontSize(9.5);
    const wrappedTitle = doc.splitTextToSize(sanitizeText(gathaTitle), 92);
    const titleLinesCount = Math.max(1, wrappedTitle.length);
    const thisRowHeight = titleLinesCount * 5.5 + 2.5;

    // Check bottom boundary overflow for index page
    if (y + thisRowHeight > pageHeight - marginBottom) {
      doc.addPage();
      setPageBg();
      setTextColor();
      useHindiFont();
      y = marginTop + 5;
      y = drawHeaders(y);
    }

    // Draw horizontal row separator
    doc.setDrawColor(...colors.divider);
    doc.setLineWidth(0.1);
    doc.line(marginLeft, y + thisRowHeight - 1, pageWidth - marginRight, y + thisRowHeight - 1);

    // Render columns
    setTextColor();
    doc.setFontSize(9.5);
    doc.text(sanitizeText(gathaNum), colGathaX, y + 4.5);

    // Truncate chapter name if it exceeds the space
    let shortChap = sanitizeText(chapName);
    if (doc.getTextWidth(shortChap) > 42) {
      shortChap = doc.splitTextToSize(shortChap, 42)[0] + '...';
    }
    doc.text(shortChap, colChapX, y + 4.5);

    // Render Title wrapping
    wrappedTitle.forEach((line: string, index: number) => {
      doc.text(line, colTitleX, y + 4.5 + index * 5.5);
    });

    // Record links coordinates to resolve in Pass 3
    pageNumPlaceholders.push({
      gathaNum,
      pageIndex: doc.getNumberOfPages(),
      x: colPageX,
      y: y + 4.5
    });

    indexLinks.push({
      gathaNum,
      pageIndex: doc.getNumberOfPages(),
      clickX: marginLeft,
      clickY: y + 0.5,
      clickW: contentWidth,
      clickH: thisRowHeight - 1
    });

    y += thisRowHeight;
  }

  // ----------------------------------------------------
  // PASS 2: Generate content pages sequentially
  // ----------------------------------------------------
  doc.addPage();
  const gathaStartPages: Record<string, number> = {};

  const homeText = 'Index ↩';
  const homeTextHi = 'सूची ↩';

  for (let i = 0; i < gathas.length; i++) {
    const gatha = gathas[i];
    const gathaNum = gatha.item.gathaNum;
    const content = gatha.content;
    const chapName = gatha.chapterName;

    // Start each gatha on a new page (except the first one, which uses the newly added page)
    if (i > 0) {
      doc.addPage();
    }

    setPageBg();
    setTextColor();
    useHindiFont();

    // Record the actual page index where this gatha starts
    gathaStartPages[gathaNum] = doc.getNumberOfPages();

    let contentY = marginTop + 5;

    // Local Helper to draw Header / Home Link on top of each page
    const drawPageHeader = (pageY: number) => {
      setAccentColor();
      doc.setFontSize(9.5);
      useHindiFont();
      doc.text(sanitizeText(`📂 ${chapName}`), marginLeft, pageY);

      // Home link text rendering
      const activeHomeText = useDevanagari ? homeTextHi : homeText;
      const textW = doc.getTextWidth(activeHomeText);
      const homeX = pageWidth - marginRight - textW;

      doc.text(activeHomeText, homeX, pageY);
      doc.link(homeX - 1, pageY - 3.5, textW + 2, 5, { pageNumber: 1 });
      setTextColor();
    };

    drawPageHeader(contentY);
    contentY += 8;

    // Gatha Title
    setAccentColor();
    doc.setFontSize(14);
    drawCenteredLine(sanitizeText(`गाथा #${gathaNum} — ${content.title}`), contentY);
    contentY += 6;

    // Heading divider line
    doc.setDrawColor(...colors.divider);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, contentY, pageWidth - marginRight, contentY);
    contentY += 9;

    // Render Prakrit Verse
    setAccentColor();
    doc.setFontSize(10.5);
    doc.text(sanitizeText('गाथा (प्राकृत) :'), marginLeft, contentY);
    contentY += 7;

    const gathaLines = toWrappedLines(content.gatha, useHindiFont, 13);
    for (const line of gathaLines) {
      if (contentY > pageHeight - marginBottom) {
        doc.addPage();
        setPageBg();
        setTextColor();
        useHindiFont();
        contentY = marginTop + 5;
        drawPageHeader(contentY);
        contentY += 14;
      }
      setTextColor();
      drawCenteredLine(line, contentY);
      contentY += 7.5;
    }
    contentY += 3;

    // Render Sanskrit Shadow
    if (content.gathaS) {
      if (contentY > pageHeight - marginBottom - 12) {
        doc.addPage();
        setPageBg();
        setTextColor();
        useHindiFont();
        contentY = marginTop + 5;
        drawPageHeader(contentY);
        contentY += 14;
      }
      setAccentColor();
      doc.setFontSize(10.5);
      doc.text(sanitizeText('संस्कृत छाया :'), marginLeft, contentY);
      contentY += 7;

      const sanskritLines = toWrappedLines(content.gathaS, useHindiFont, 11);
      for (const line of sanskritLines) {
        if (contentY > pageHeight - marginBottom) {
          doc.addPage();
          setPageBg();
          setTextColor();
          useHindiFont();
          contentY = marginTop + 5;
          drawPageHeader(contentY);
          contentY += 14;
        }
        setTextColor();
        drawCenteredLine(line, contentY);
        contentY += 7;
      }
      contentY += 3;
    }

    // Render Hindi Poetic translation
    if (content.gadya) {
      if (contentY > pageHeight - marginBottom - 12) {
        doc.addPage();
        setPageBg();
        setTextColor();
        useHindiFont();
        contentY = marginTop + 5;
        drawPageHeader(contentY);
        contentY += 14;
      }
      setAccentColor();
      doc.setFontSize(10.5);
      doc.text(sanitizeText('पद्य अनुवाद (हिंदी) :'), marginLeft, contentY);
      contentY += 7;

      const gadyaLines = toWrappedLines(content.gadya, useHindiFont, 11);
      for (const line of gadyaLines) {
        if (contentY > pageHeight - marginBottom) {
          doc.addPage();
          setPageBg();
          setTextColor();
          useHindiFont();
          contentY = marginTop + 5;
          drawPageHeader(contentY);
          contentY += 14;
        }
        setTextColor();
        drawCenteredLine(line, contentY);
        contentY += 7;
      }
      contentY += 3;
    }

    // Render Anvayarth (Meanings)
    if (contentY > pageHeight - marginBottom - 12) {
      doc.addPage();
      setPageBg();
      setTextColor();
      useHindiFont();
      contentY = marginTop + 5;
      drawPageHeader(contentY);
      contentY += 14;
    }
    setAccentColor();
    doc.setFontSize(10.5);
    doc.text(sanitizeText('अन्वयार्थ :'), marginLeft, contentY);
    contentY += 7;

    const cleanAnvayarth = content.anvayarth.replace(/\*\*/g, '');
    const anvayarthLines = toWrappedLines(cleanAnvayarth, useHindiFont, 10);
    for (const line of anvayarthLines) {
      if (contentY > pageHeight - marginBottom) {
        doc.addPage();
        setPageBg();
        setTextColor();
        useHindiFont();
        contentY = marginTop + 5;
        drawPageHeader(contentY);
        contentY += 14;
      }
      setTextColor();
      doc.text(line, marginLeft, contentY);
      contentY += 5.5;
    }
    contentY += 3;

    // Render English translation
    if (content.english) {
      if (contentY > pageHeight - marginBottom - 12) {
        doc.addPage();
        setPageBg();
        setTextColor();
        useHindiFont();
        contentY = marginTop + 5;
        drawPageHeader(contentY);
        contentY += 14;
      }
      setAccentColor();
      doc.setFontSize(10.5);
      useRomanFont();
      doc.text('English Meaning :', marginLeft, contentY);
      contentY += 7;

      const englishLines = toWrappedLines(content.english, useRomanFont, 9.5);
      for (const line of englishLines) {
        if (contentY > pageHeight - marginBottom) {
          doc.addPage();
          setPageBg();
          setTextColor();
          useHindiFont();
          contentY = marginTop + 5;
          drawPageHeader(contentY);
          contentY += 14;
        }
        setTextColor();
        doc.text(line, marginLeft, contentY);
        contentY += 5.5;
      }
      contentY += 3;
    }

    // Render Commentaries (Teekas) sequentially
    if (content.teekas && content.teekas.length > 0) {
      for (const teeka of content.teekas) {
        if (contentY > pageHeight - marginBottom - 15) {
          doc.addPage();
          setPageBg();
          setTextColor();
          useHindiFont();
          contentY = marginTop + 5;
          drawPageHeader(contentY);
          contentY += 14;
        }

        setAccentColor();
        doc.setFontSize(10.5);
        useHindiFont();
        doc.text(sanitizeText(`टीका: ${teeka.commentator} :`), marginLeft, contentY);
        contentY += 7;

        // Sanskrit sub-commentary
        if (teeka.sanskrit) {
          setTextColor();
          doc.setFontSize(9.5);
          doc.text(sanitizeText('संस्कृत :'), marginLeft, contentY);
          contentY += 6.5;

          const sanskritTeekaLines = toWrappedLines(teeka.sanskrit, useHindiFont, 9.5);
          for (const line of sanskritTeekaLines) {
            if (contentY > pageHeight - marginBottom) {
              doc.addPage();
              setPageBg();
              setTextColor();
              useHindiFont();
              contentY = marginTop + 5;
              drawPageHeader(contentY);
              contentY += 14;
            }
            setTextColor();
            doc.text(line, marginLeft, contentY);
            contentY += 5.5;
          }
          contentY += 3;
        }

        // Hindi commentary
        setTextColor();
        const hindiTeekaLines = toWrappedLines(teeka.hindi, useHindiFont, 10);
        for (const line of hindiTeekaLines) {
          if (contentY > pageHeight - marginBottom) {
            doc.addPage();
            setPageBg();
            setTextColor();
            useHindiFont();
            contentY = marginTop + 5;
            drawPageHeader(contentY);
            contentY += 14;
          }
          setTextColor();
          doc.text(line, marginLeft, contentY);
          contentY += 6;
        }
        contentY += 5;
      }
    }
  }

  // ----------------------------------------------------
  // PASS 3: Resolve links and insert pages numbers in Table of Contents
  // ----------------------------------------------------
  indexLinks.forEach((link, idx) => {
    const targetPage = gathaStartPages[link.gathaNum];
    if (targetPage) {
      // Go back to table of contents page index
      doc.setPage(link.pageIndex);
      
      // Print the resolved target page number
      const placeholder = pageNumPlaceholders[idx];
      doc.setFontSize(9.5);
      doc.setTextColor(...colors.accent);
      useRomanFont();
      doc.text(String(targetPage), placeholder.x, placeholder.y, { align: 'right' });
      
      // Make entire row bounding box link to targetPage
      doc.link(link.clickX, link.clickY, link.clickW, link.clickH, { pageNumber: targetPage });
    }
  });

  // Add Page Numbers to the footers of all pages
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    useRomanFont();
    doc.setFontSize(9);
    doc.setTextColor(...colors.text);
    doc.text(`${page}/${totalPages}`, pageWidth - marginRight, pageHeight - 10, { align: 'right' });
  }

  // Save full compilation
  const cleanTitle = title.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');
  doc.save(`${cleanTitle}_Complete_Scripture.pdf`);
}
