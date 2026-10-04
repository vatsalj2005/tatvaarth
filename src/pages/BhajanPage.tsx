import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { getBhajanById, getRelatedBhajans, subdivisions } from '@/data/content-loader';
import { transliterateText } from '@/lib/transliterate';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Play, Copy, Check, VolumeX, Download, Music, Type } from 'lucide-react';

/**
 * Extracts all flattened line strings as rendered in the bhajan.
 */
const getAllRenderedLines = (parsedStanzas: { isChorus: boolean; lines: any[] }[]): string[] => {
  const lineStrings: string[] = [];
  for (const stanza of parsedStanzas) {
    for (const line of stanza.lines) {
      if (line.type === 'verse_with_refrain') {
        const full = [line.before, line.marker, line.after].filter(Boolean).join(' ');
        lineStrings.push(full);
      } else if (line.text) {
        lineStrings.push(line.text);
      }
    }
  }
  return lineStrings;
};

/**
 * Custom hook: Computes the maximum uniform font size (capped at 25px)
 * such that the longest line in the bhajan fits on a single line within the card's available width.
 */
function useDynamicBhajanFontSize(
  lines: string[],
  containerRef: React.RefObject<HTMLDivElement>
): number {
  const [fontSize, setFontSize] = useState<number>(16);

  useEffect(() => {
    if (!containerRef.current || lines.length === 0) return;

    const measureAndFit = () => {
      const container = containerRef.current;
      if (!container) return;

      const parent = container.parentElement;
      const parentWidth = parent ? parent.clientWidth : container.clientWidth;
      const rawWidth = Math.min(
        container.clientWidth || window.innerWidth,
        parentWidth || window.innerWidth,
        window.innerWidth - 24
      );
      if (rawWidth <= 0) return;

      const containerStyle = window.getComputedStyle(container);
      const sampleText = lines.slice(0, 5).join(' ');
      const hasDevanagari = /[\u0900-\u097F]/.test(sampleText);

      // Create an off-screen ruler element to measure text widths accurately
      const ruler = document.createElement('div');
      ruler.style.position = 'fixed';
      ruler.style.visibility = 'hidden';
      ruler.style.pointerEvents = 'none';
      ruler.style.left = '-9999px';
      ruler.style.top = '-9999px';
      ruler.style.whiteSpace = 'nowrap';
      ruler.style.fontFamily = hasDevanagari
        ? (containerStyle.fontFamily || "'Noto Sans Devanagari', sans-serif")
        : "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
      ruler.style.fontWeight = '600';
      ruler.style.fontSize = '16px';
      document.body.appendChild(ruler);

      // Find maximum line width at 16px
      let maxLineWidth = 0;
      let longestLine = '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        ruler.textContent = trimmed;
        const width = ruler.getBoundingClientRect().width;
        if (width > maxLineWidth) {
          maxLineWidth = width;
          longestLine = trimmed;
        }
      }

      if (maxLineWidth > 0) {
        // Target width with safe buffer so text doesn't touch borders
        const targetWidth = Math.max(rawWidth - 8, 100);
        let calculatedSize = 16 * (targetWidth / maxLineWidth);

        // Verification pass at calculatedSize
        ruler.style.fontSize = `${calculatedSize}px`;
        ruler.textContent = longestLine;
        const actualWidth = ruler.getBoundingClientRect().width;
        if (actualWidth > targetWidth) {
          calculatedSize = calculatedSize * (targetWidth / actualWidth);
        }

        document.body.removeChild(ruler);

        // Cap upper font size at 25px (desktop readability), floor at 10px
        const finalSize = Math.max(10, Math.min(calculatedSize, 25));
        setFontSize(Math.round(finalSize * 10) / 10);
      } else {
        document.body.removeChild(ruler);
      }
    };

    measureAndFit();
    const rafId = requestAnimationFrame(measureAndFit);
    const timeoutId = setTimeout(measureAndFit, 60);

    if (document.fonts) {
      document.fonts.ready.then(measureAndFit);
    }

    const resizeObserver = new ResizeObserver(() => {
      measureAndFit();
    });
    resizeObserver.observe(containerRef.current);
    if (containerRef.current.parentElement) {
      resizeObserver.observe(containerRef.current.parentElement);
    }

    window.addEventListener('resize', measureAndFit);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', measureAndFit);
    };
  }, [lines, containerRef]);

  return fontSize;
}

const BhajanPage = () => {
  const { subdivisionId, bhajanId } = useParams<{ subdivisionId: string; bhajanId: string }>();
  const { t, language, theme } = useApp();
  const [showRoman, setShowRoman] = useState(false);
  const [copied, setCopied] = useState(false);

  const hindiContentRef = useRef<HTMLDivElement>(null);
  const romanContentRef = useRef<HTMLDivElement>(null);

  const bhajan = getBhajanById(subdivisionId || '', bhajanId || '');
  if (!bhajan) return null;

  const subdivision = subdivisions.find(s => s.id === bhajan.subdivision);
  const related = getRelatedBhajans(bhajan, 4);

  // Generate romanized text only when roman script is toggled on
  const romanizedLyrics = useMemo(() => {
    return showRoman ? transliterateText(bhajan.lyrics) : '';
  }, [showRoman, bhajan.lyrics]);

  const parseBhajanLyrics = (rawText: string) => {
    if (!rawText) return [];
    const stanzas = rawText.trim().split(/\n\s*\n+/);

    return stanzas.map((stanza, sIdx) => {
      const rawLines = stanza.split('\n').map(l => l.trim()).filter(Boolean);
      const isChorus = sIdx === 0;

      const lines = rawLines.map(line => {
        if (isChorus) {
          return { type: 'chorus' as const, text: line };
        }

        // Check for verse marker: ॥[०-९0-9]+॥ or ||[०-९0-9]+|| or ॥\s*टेक\s*॥
        const markerMatch = line.match(/(॥\s*[०-९0-9]+\s*॥|\|\|\s*[०-९0-9]+\s*\|\||॥\s*टेक\s*॥|\|\|\s*टेक\s*\|\|)/);
        if (markerMatch && markerMatch.index !== undefined) {
          const markerIdx = markerMatch.index;
          const before = line.slice(0, markerIdx).trim();
          const marker = markerMatch[0].trim();
          const after = line.slice(markerIdx + markerMatch[0].length).trim();
          return { type: 'verse_with_refrain' as const, before, marker, after };
        }

        // Check for danda refrain without number: e.g. "॥ मंगल थाल ..."
        const dandaRefrainMatch = line.match(/(॥\s*[^॥\n]+\.\.\.|\|\|\s*[^\|\n]+\.\.\.)/);
        if (dandaRefrainMatch && dandaRefrainMatch.index !== undefined) {
          const markerIdx = dandaRefrainMatch.index;
          const before = line.slice(0, markerIdx).trim();
          const matchStr = dandaRefrainMatch[0];
          const marker = matchStr.startsWith('||') ? '||' : '॥';
          const after = matchStr.replace(/^(\|\||॥)\s*/, '').trim();
          return { type: 'verse_with_refrain' as const, before, marker, after };
        }

        return { type: 'verse' as const, text: line };
      });

      return { isChorus, lines };
    });
  };

  const parsedHindi = useMemo(() => parseBhajanLyrics(bhajan.lyrics), [bhajan.lyrics]);
  const hindiLines = useMemo(() => getAllRenderedLines(parsedHindi), [parsedHindi]);
  const hindiFontSize = useDynamicBhajanFontSize(hindiLines, hindiContentRef);

  const parsedRoman = useMemo(() => (showRoman ? parseBhajanLyrics(romanizedLyrics) : []), [showRoman, romanizedLyrics]);
  const romanLines = useMemo(() => getAllRenderedLines(parsedRoman), [parsedRoman]);
  const romanFontSize = useDynamicBhajanFontSize(romanLines, romanContentRef);

  const handleCopy = () => {
    navigator.clipboard.writeText(bhajan.lyrics);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePdfDownload = async () => {
    const { generateBhajanPdf } = await import('@/lib/pdf-generator');
    await generateBhajanPdf({
      title: bhajan.title,
      slug: bhajan.slug,
      singer: bhajan.singer,
      lyrics: bhajan.lyrics,
      theme,
    });
  };

  const renderLyricsBlock = (rawText: string, fontSize: number, isRoman = false) => {
    const parsed = isRoman ? parsedRoman : parsedHindi;
    if (!parsed.length) return null;

    return (
      <div className="w-full min-w-0 max-w-full">
        {parsed.map((stanza, sIdx) => {
          if (stanza.isChorus) {
            return (
              <div 
                key={`stanza-${sIdx}`}
                className="mb-6 text-center space-y-1.5"
              >
                {stanza.lines.map((line, lIdx) => {
                  const lineText = line.type === 'verse_with_refrain'
                    ? `${line.before ? line.before + ' ' : ''}${line.marker ? line.marker + ' ' : ''}${line.after || ''}`
                    : line.text;

                  return (
                    <p 
                      key={lIdx}
                      className="font-semibold text-amber-700 dark:text-amber-400 leading-normal devanagari-safe drop-shadow-[0_1px_3px_rgba(212,175,55,0.25)] break-words"
                      style={{ fontSize: `${fontSize}px` }}
                    >
                      {lineText}
                    </p>
                  );
                })}
              </div>
            );
          }

          return (
            <div 
              key={`stanza-${sIdx}`}
              className="mb-6 text-center space-y-1.5"
            >
              {stanza.lines.map((line, lIdx) => {
                if (line.type === 'verse_with_refrain') {
                  return (
                    <p 
                      key={lIdx}
                      className="leading-normal devanagari-safe break-words"
                      style={{ fontSize: `${fontSize}px` }}
                    >
                      {line.before && (
                        <span className="text-teal-800 dark:text-teal-300">
                          {line.before}{' '}
                        </span>
                      )}
                      {line.marker && (
                        <span className="inline-block mx-1 font-bold text-gold drop-shadow-sm select-none">
                          {line.marker}
                        </span>
                      )}
                      {line.after && (
                        <span className="font-semibold text-amber-700 dark:text-amber-400 drop-shadow-[0_1px_3px_rgba(212,175,55,0.25)]">
                          {' '}{line.after}
                        </span>
                      )}
                    </p>
                  );
                }

                return (
                  <p 
                    key={lIdx}
                    className="text-teal-800 dark:text-teal-300 leading-normal devanagari-safe break-words"
                    style={{ fontSize: `${fontSize}px` }}
                  >
                    {line.text}
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Header />
      <div className="pt-24 pb-16 w-full overflow-x-hidden">
        {/* 95% of phone screen width on mobile, 80% on wide screens / laptops */}
        <div className="w-[95%] md:w-[80%] mx-auto flex flex-col items-center min-w-0">
          {/* Breadcrumb */}
          <div className="w-full flex items-center gap-2 text-sm text-muted-foreground mb-6 flex-wrap devanagari-safe">
            <Link to="/bhajan" className="hover:text-gold transition-colors">{t('bhajan')}</Link>
            <span>/</span>
            {subdivision && (
              <>
                <Link to={`/bhajan/${subdivision.id}`} className="hover:text-gold transition-colors">
                  {language === 'hi' ? subdivision.nameHi : subdivision.nameEn}
                </Link>
                <span>/</span>
              </>
            )}
            <span className="text-foreground/80 truncate">{bhajan.title}</span>
          </div>

          {/* Title Section - Centered */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full mb-8 text-center"
          >
            <h1 className="text-3xl md:text-4xl font-heading text-gradient-gold mb-3 devanagari-safe break-words">
              {bhajan.title}
            </h1>
            {bhajan.singer && (
              <p className="text-sm text-gold/80">🎤 {t('singer')}: {bhajan.singer}</p>
            )}
          </motion.div>

          {/* Audio + Controls */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="w-full flex flex-wrap gap-2.5 sm:gap-3 mb-8 justify-center"
          >
            {bhajan.audioUrl ? (
              <button className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gold text-primary-foreground font-medium hover:opacity-90 transition-opacity text-sm">
                <Play className="w-4 h-4" /> {language === 'hi' ? 'सुनें' : 'Listen'}
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-secondary text-muted-foreground">
                <VolumeX className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs sm:text-sm">{t('audioUnavailable')}</span>
              </div>
            )}

            {/* Roman Script toggle */}
            <button
              onClick={() => setShowRoman(!showRoman)}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-medium transition-all text-xs sm:text-sm ${
                showRoman
                  ? 'bg-gold text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-gold/20'
              }`}
            >
              <Type className="w-4 h-4" />
              {showRoman ? t('hideRomanScript') : t('romanScript')}
            </button>

            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-gold/20 transition-colors text-xs sm:text-sm"
            >
              {copied ? <Check className="w-4 h-4 text-gold" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? t('copied') : t('copyVerse')}</span>
            </button>

            <button
              onClick={handlePdfDownload}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-gold/20 transition-colors text-xs sm:text-sm"
            >
              <Download className="w-4 h-4" />
              <span>{t('downloadPdf')}</span>
            </button>
          </motion.div>

          {/* Lyrics: 95% on mobile, 80% on wide screens */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className={`w-full min-w-0 max-w-full grid gap-6 ${showRoman ? 'md:grid-cols-2' : 'grid-cols-1'}`}
          >
            {/* Hindi lyrics */}
            <div className="w-full min-w-0 max-w-full px-3 py-6 sm:p-6 md:p-8 rounded-2xl bg-card border border-border/50 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-6">
                <h3 className="text-sm font-semibold text-gold uppercase tracking-wider flex items-center gap-2">
                  <Music className="w-4 h-4" /> {t('lyrics')}
                </h3>
              </div>
              <div ref={hindiContentRef} className="w-full min-w-0 max-w-full overflow-hidden">
                {renderLyricsBlock(bhajan.lyrics, hindiFontSize, false)}
              </div>
            </div>

            {/* Roman transliteration - Auto-generated */}
            {showRoman && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full min-w-0 max-w-full px-3 py-6 sm:p-6 md:p-8 rounded-2xl bg-card border border-gold/20 shadow-sm overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-6">
                  <h3 className="text-sm font-semibold text-gold uppercase tracking-wider flex items-center gap-2">
                    <Type className="w-4 h-4" /> {t('transliteration')}
                  </h3>
                </div>
                <div ref={romanContentRef} className="w-full min-w-0 max-w-full overflow-hidden">
                  {renderLyricsBlock(romanizedLyrics, romanFontSize, true)}
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Related Bhajans: 95% on mobile, 80% on wide screens */}
          {related.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-16 w-full"
            >
              <h2 className="text-xl font-heading text-gradient-gold mb-6 devanagari-safe text-center sm:text-left">
                {t('relatedBhajans')}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 w-full">
                {related.map((r, rIdx) => (
                  <Link
                    key={r.id}
                    to={`/bhajan/${r.subdivision}/${r.slug}`}
                    className="relative flex flex-col justify-between p-2.5 sm:p-4 rounded-xl border border-border/50 bg-card hover:border-gold/30 hover:bg-secondary transition-all group overflow-hidden min-h-[64px] sm:min-h-[76px]"
                  >
                    <div className="flex-1 min-w-0 pr-4 sm:pr-6">
                      <h3 className="font-medium text-sm sm:text-base text-foreground group-hover:text-gold transition-colors line-clamp-2 devanagari-safe leading-snug">
                        {r.title}
                      </h3>
                    </div>
                    <div className="absolute bottom-1 right-2 sm:bottom-2 sm:right-3 text-sm sm:text-xl font-heading font-black text-gold/20 group-hover:text-gold/45 transition-colors pointer-events-none select-none">
                      #{rIdx + 1}
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default BhajanPage;
