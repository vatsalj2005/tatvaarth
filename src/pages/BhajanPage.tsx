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
interface ParsedLine {
  type: 'chorus' | 'verse' | 'verse_with_refrain';
  text?: string;
  before?: string;
  marker?: string;
  after?: string;
}

interface ParsedStanza {
  isChorus: boolean;
  lines: ParsedLine[];
}

interface DynamicBhajanResult {
  fontSize: number;
  shouldSplitRefrain: boolean;
}

/**
 * Custom hook: Computes the maximum uniform font size (capped at 25px)
 * such that the longest line in the bhajan fits on a single line within the card's available width.
 * If keeping refrains combined would make the font size too small (< 17.5px) or overflow,
 * it splits the refrain ("रंग दो ...") onto the next line.
 */
function useDynamicBhajanFontSize(
  stanzas: ParsedStanza[],
  containerEl: HTMLElement | null,
  isRoman: boolean
): DynamicBhajanResult {
  const [result, setResult] = useState<DynamicBhajanResult>({
    fontSize: 16,
    shouldSplitRefrain: false,
  });

  useEffect(() => {
    if (!containerEl || stanzas.length === 0) return;

    const measureAndFit = () => {
      if (!containerEl) return;

      const parent = containerEl.parentElement;
      const parentWidth = parent ? parent.clientWidth : containerEl.clientWidth;
      const rawWidth = Math.min(
        containerEl.clientWidth || window.innerWidth,
        parentWidth || window.innerWidth,
        window.innerWidth - (window.innerWidth < 768 ? 24 : 48)
      );
      if (rawWidth <= 0) return;

      // Create an off-screen ruler element to measure text widths accurately
      const ruler = document.createElement('div');
      ruler.style.position = 'fixed';
      ruler.style.visibility = 'hidden';
      ruler.style.pointerEvents = 'none';
      ruler.style.left = '-9999px';
      ruler.style.top = '-9999px';
      ruler.style.whiteSpace = 'nowrap';
      ruler.style.fontFamily = isRoman
        ? "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
        : "'Noto Sans Devanagari', sans-serif";
      ruler.style.fontWeight = '500';
      ruler.style.fontSize = '16px';
      document.body.appendChild(ruler);

      // Safe target width so text doesn't touch card borders
      const targetWidth = Math.max(rawWidth - 12, 100);

      // 1. Measure all lines with refrains combined on same line
      let maxCombinedWidth = 0;
      let longestCombinedLine = '';
      let hasAnyRefrain = false;

      // 2. Measure with refrains split onto the next line
      let maxSplitWidth = 0;
      let longestSplitLine = '';

      for (const stanza of stanzas) {
        for (const line of stanza.lines) {
          if (line.type === 'verse_with_refrain' && line.after) {
            hasAnyRefrain = true;
            // Combined line: before + marker + after
            const combinedText = [line.before, line.marker, line.after].filter(Boolean).join(' ').trim();
            ruler.textContent = combinedText;
            const combinedW = ruler.getBoundingClientRect().width;
            if (combinedW > maxCombinedWidth) {
              maxCombinedWidth = combinedW;
              longestCombinedLine = combinedText;
            }

            // Split line 1: before + marker
            const splitPart1 = [line.before, line.marker].filter(Boolean).join(' ').trim();
            ruler.textContent = splitPart1;
            const splitW1 = ruler.getBoundingClientRect().width;
            if (splitW1 > maxSplitWidth) {
              maxSplitWidth = splitW1;
              longestSplitLine = splitPart1;
            }

            // Split line 2: after
            const splitPart2 = (line.after || '').trim();
            ruler.textContent = splitPart2;
            const splitW2 = ruler.getBoundingClientRect().width;
            if (splitW2 > maxSplitWidth) {
              maxSplitWidth = splitW2;
              longestSplitLine = splitPart2;
            }
          } else {
            const text = (line.text || [line.before, line.marker].filter(Boolean).join(' ')).trim();
            if (!text) continue;
            ruler.textContent = text;
            const w = ruler.getBoundingClientRect().width;
            if (w > maxCombinedWidth) {
              maxCombinedWidth = w;
              longestCombinedLine = text;
            }
            if (w > maxSplitWidth) {
              maxSplitWidth = w;
              longestSplitLine = text;
            }
          }
        }
      }

      let shouldSplit = false;
      let calculatedSize = 16;
      let chosenLongestLine = '';

      if (maxCombinedWidth > 0) {
        const combinedSize = 16 * (targetWidth / maxCombinedWidth);
        // If keeping refrain combined would force font size below 17.5px (or if combined width overflows targetWidth at 17.5px),
        // split the refrain onto the next line so font size remains comfortably large and doesn't wrap awkwardly.
        if (hasAnyRefrain && combinedSize < 17.5 && maxSplitWidth > 0) {
          shouldSplit = true;
          calculatedSize = 16 * (targetWidth / maxSplitWidth);
          chosenLongestLine = longestSplitLine;
        } else {
          shouldSplit = false;
          calculatedSize = combinedSize;
          chosenLongestLine = longestCombinedLine;
        }
      }

      // Verification pass at calculatedSize
      if (chosenLongestLine && calculatedSize > 0) {
        ruler.style.fontSize = `${calculatedSize}px`;
        ruler.textContent = chosenLongestLine;
        const actualWidth = ruler.getBoundingClientRect().width;
        if (actualWidth > targetWidth) {
          calculatedSize = calculatedSize * (targetWidth / actualWidth);
        }
      }

      document.body.removeChild(ruler);

      const finalSize = Math.max(10, Math.min(calculatedSize, 25));
      setResult({
        fontSize: Math.round(finalSize * 10) / 10,
        shouldSplitRefrain: shouldSplit,
      });
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
    resizeObserver.observe(containerEl);
    if (containerEl.parentElement) {
      resizeObserver.observe(containerEl.parentElement);
    }

    window.addEventListener('resize', measureAndFit);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', measureAndFit);
    };
  }, [stanzas, containerEl, isRoman]);

  return result;
}

const BhajanPage = () => {
  const { subdivisionId, bhajanId } = useParams<{ subdivisionId: string; bhajanId: string }>();
  const { t, language, theme } = useApp();
  const [showRoman, setShowRoman] = useState(false);
  const [copied, setCopied] = useState(false);

  const [hindiContainerEl, setHindiContainerEl] = useState<HTMLDivElement | null>(null);
  const [romanContainerEl, setRomanContainerEl] = useState<HTMLDivElement | null>(null);

  const bhajan = getBhajanById(subdivisionId || '', bhajanId || '');
  if (!bhajan) return null;

  const subdivision = subdivisions.find(s => s.id === bhajan.subdivision);
  const related = getRelatedBhajans(bhajan, 4);

  // Generate romanized text only when roman script is toggled on
  const romanizedLyrics = useMemo(() => {
    return showRoman ? transliterateText(bhajan.lyrics) : '';
  }, [showRoman, bhajan.lyrics]);

  const parseBhajanLyrics = (rawText: string): ParsedStanza[] => {
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
  const hindiSizing = useDynamicBhajanFontSize(parsedHindi, hindiContainerEl, false);

  const parsedRoman = useMemo(() => (showRoman ? parseBhajanLyrics(romanizedLyrics) : []), [showRoman, romanizedLyrics]);
  const romanSizing = useDynamicBhajanFontSize(parsedRoman, romanContainerEl, true);

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

  const renderLyricsBlock = (
    parsed: ParsedStanza[],
    fontSize: number,
    shouldSplitRefrain: boolean,
    isRoman = false
  ) => {
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
                  if (shouldSplitRefrain && line.after) {
                    return (
                      <div key={lIdx} className="space-y-1">
                        <p 
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
                        </p>
                        <p 
                          className="font-semibold text-amber-700 dark:text-amber-400 drop-shadow-[0_1px_3px_rgba(212,175,55,0.25)] leading-normal devanagari-safe break-words"
                          style={{ fontSize: `${fontSize}px` }}
                        >
                          {line.after}
                        </p>
                      </div>
                    );
                  }

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
              <div ref={setHindiContainerEl} className="w-full min-w-0 max-w-full overflow-hidden">
                {renderLyricsBlock(parsedHindi, hindiSizing.fontSize, hindiSizing.shouldSplitRefrain, false)}
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
                <div ref={setRomanContainerEl} className="w-full min-w-0 max-w-full overflow-hidden">
                  {renderLyricsBlock(parsedRoman, romanSizing.fontSize, romanSizing.shouldSplitRefrain, true)}
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
