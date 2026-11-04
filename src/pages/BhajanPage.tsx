import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { getBhajanById, getRelatedBhajans, subdivisions } from '@/data/content-loader';
import { transliterateText } from '@/lib/transliterate';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Play, Pause, Copy, Check, Volume2, Volume1, VolumeX, Download, Music, Type, Mic, RotateCcw, RotateCw, Repeat } from 'lucide-react';

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
      ruler.style.fontWeight = '600';
      ruler.style.fontSize = '16px';
      document.body.appendChild(ruler);

      try {
        // Safe target width so text doesn't touch card borders or get clipped
        const targetWidth = Math.max(rawWidth - 28, 100);

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
          // If keeping refrain combined would force font size below 18.5px (or if combined width overflows targetWidth at 18.5px),
          // split the refrain onto the next line so font size remains comfortably large and doesn't wrap awkwardly.
          if (hasAnyRefrain && combinedSize < 18.5 && maxSplitWidth > 0) {
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

        const finalSize = Math.max(10, Math.min(calculatedSize, 25));
        const roundedSize = Math.round(finalSize * 10) / 10;
        setResult(prev => {
          if (prev.fontSize === roundedSize && prev.shouldSplitRefrain === shouldSplit) {
            return prev;
          }
          return {
            fontSize: roundedSize,
            shouldSplitRefrain: shouldSplit,
          };
        });
      } finally {
        if (ruler.parentNode) {
          ruler.parentNode.removeChild(ruler);
        }
      }
    };

    measureAndFit();
    const rafId = requestAnimationFrame(measureAndFit);
    const timeoutId = setTimeout(measureAndFit, 60);

    if (document.fonts) {
      document.fonts.ready.then(measureAndFit);
    }

    let lastObservedWidth = containerEl.clientWidth;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        if (Math.abs(newWidth - lastObservedWidth) > 3) {
          lastObservedWidth = newWidth;
          measureAndFit();
        }
      }
    });
    resizeObserver.observe(containerEl);

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
  const lyricsText = bhajan?.lyrics || '';

  const subdivision = bhajan ? subdivisions.find(s => s.id === bhajan.subdivision) : undefined;
  const related = bhajan ? getRelatedBhajans(bhajan, 4) : [];

  const {
    activeTrack,
    activeAudioMode: globalAudioMode,
    isPlaying: isGlobalPlaying,
    currentTime: globalCurrentTime,
    duration: globalDuration,
    volume,
    isMuted,
    isLooping,
    downloadState: globalDownloadState,
    downloadProgress: globalDownloadProgress,
    playTrack,
    togglePlayPause,
    seek,
    skip,
    setVolume,
    toggleMute,
    toggleLoop,
    selectAudioMode,
    downloadAudio,
  } = useAudioPlayer();

  const isThisBhajanActive =
    activeTrack !== null &&
    (activeTrack.bhajanId === bhajan?.slug ||
      activeTrack.bhajanId === bhajan?.id ||
      activeTrack.title === bhajan?.title);

  const [localAudioMode, setLocalAudioMode] = useState<'bhajan' | 'karaoke'>(() => {
    return bhajan?.audioUrl ? 'bhajan' : bhajan?.karaokeUrl ? 'karaoke' : 'bhajan';
  });

  const activeAudioMode = isThisBhajanActive ? globalAudioMode : localAudioMode;
  const isPlaying = isThisBhajanActive && isGlobalPlaying;
  const currentTime = isThisBhajanActive ? globalCurrentTime : 0;
  const duration = isThisBhajanActive ? globalDuration : 0;
  const downloadState = isThisBhajanActive ? globalDownloadState : 'idle';
  const downloadProgress = isThisBhajanActive ? globalDownloadProgress : 0;

  const currentAudioSource =
    activeAudioMode === 'karaoke' ? bhajan?.karaokeUrl : bhajan?.audioUrl;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handlePlayPause = () => {
    if (!bhajan || !currentAudioSource) return;
    if (isThisBhajanActive) {
      togglePlayPause();
    } else {
      playTrack(bhajan, activeAudioMode, true);
    }
  };

  const handleSelectAudioMode = (mode: 'bhajan' | 'karaoke') => {
    setLocalAudioMode(mode);
    if (!bhajan) return;
    if (isThisBhajanActive) {
      selectAudioMode(mode);
    } else {
      playTrack(bhajan, mode, true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (isThisBhajanActive) {
      seek(newTime);
    }
  };

  const handleSkip = (seconds: number) => {
    if (isThisBhajanActive) {
      skip(seconds);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  const handleToggleMute = () => {
    toggleMute();
  };

  const handleDownloadAudio = () => {
    if (!bhajan || !currentAudioSource) return;
    if (isThisBhajanActive) {
      downloadAudio();
    } else {
      playTrack(bhajan, activeAudioMode, false);
      setTimeout(() => downloadAudio(), 100);
    }
  };

  // Generate romanized text only when roman script is toggled on
  const romanizedLyrics = useMemo(() => {
    return showRoman && lyricsText ? transliterateText(lyricsText) : '';
  }, [showRoman, lyricsText]);

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

  const parsedHindi = useMemo(() => parseBhajanLyrics(lyricsText), [lyricsText]);
  const hindiSizing = useDynamicBhajanFontSize(parsedHindi, hindiContainerEl, false);

  const parsedRoman = useMemo(() => (showRoman ? parseBhajanLyrics(romanizedLyrics) : []), [showRoman, romanizedLyrics]);
  const romanSizing = useDynamicBhajanFontSize(parsedRoman, romanContainerEl, true);

  const handleCopy = () => {
    if (!bhajan) return;
    navigator.clipboard.writeText(bhajan.lyrics);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePdfDownload = async () => {
    if (!bhajan) return;
    const { generateBhajanPdf } = await import('@/lib/pdf-generator');
    await generateBhajanPdf({
      title: bhajan.title,
      slug: bhajan.slug,
      singer: bhajan.singer,
      lyrics: bhajan.lyrics,
      theme,
    });
  };

  if (!bhajan) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-32 pb-16 px-4 text-center max-w-md mx-auto">
          <h1 className="text-2xl md:text-3xl font-heading text-gradient-gold mb-3">
            {language === 'hi' ? 'भजन नहीं मिला' : 'Bhajan Not Found'}
          </h1>
          <p className="text-muted-foreground mb-6">
            {language === 'hi'
              ? 'यह भजन उपलब्ध नहीं है या इसका लिंक बदल गया है।'
              : 'This bhajan is not available or the link has changed.'}
          </p>
          <Link
            to="/bhajan"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold text-primary-foreground font-medium hover:opacity-90 transition-opacity"
          >
            {language === 'hi' ? 'भजन संग्रह पर लौटें' : 'Back to Bhajans'}
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

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
                className="mb-6 last:mb-0 text-center space-y-1"
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
              className="mb-6 last:mb-0 text-center space-y-1"
            >
              {stanza.lines.map((line, lIdx) => {
                if (line.type === 'verse_with_refrain') {
                  if (shouldSplitRefrain && line.after) {
                    return (
                      <div key={lIdx} className="space-y-0.5">
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
            className="w-full flex flex-col items-center mb-8"
          >
            {/* Custom Devotional Audio Player Card (renders when audio exists) */}
            {currentAudioSource ? (
              <div className="w-full max-w-lg mb-4 p-4 sm:p-5 rounded-2xl bg-card/90 backdrop-blur-md border border-gold/30 shadow-lg shadow-gold/5 flex flex-col gap-3.5">
                {/* Top header row: Mode selector / Track info */}
                <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-gold animate-pulse flex-shrink-0" />
                    <span className="text-xs font-semibold text-gold tracking-wide uppercase truncate">
                      {activeAudioMode === 'karaoke' ? `${t('karaoke')} Track` : `${t('playBhajan')}`}
                    </span>
                  </div>

                  {/* Vocal / Karaoke Segmented Selector if both tracks exist */}
                  {bhajan.audioUrl && bhajan.karaokeUrl && (
                    <div className="flex items-center bg-secondary/80 p-0.5 rounded-lg border border-border/50 text-xs">
                      <button
                        onClick={() => handleSelectAudioMode('bhajan')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
                          activeAudioMode === 'bhajan'
                            ? 'bg-gold text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Music className="w-3 h-3" />
                        <span>भजन</span>
                      </button>
                      <button
                        onClick={() => handleSelectAudioMode('karaoke')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
                          activeAudioMode === 'karaoke'
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Mic className="w-3 h-3" />
                        <span>कराओके</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Progress bar + time timestamps */}
                <div className="flex flex-col gap-1.5">
                  <div className="relative w-full flex items-center">
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      step={0.1}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-gold hover:accent-gold-light focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-muted-foreground font-mono px-0.5">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Main Audio Controls: Volume (Left) | Rewind 10s + Gold Play/Pause + Forward 10s (Center) | Repeat & Download (Right) */}
                <div className="flex items-center justify-between pt-1 px-1 sm:px-2 gap-2">
                  {/* Left: Volume Mute Toggle + Slider */}
                  <div className="flex items-center gap-1 sm:gap-1.5 min-w-[76px] sm:min-w-[120px]">
                    <button
                      onClick={handleToggleMute}
                      className="p-1.5 sm:p-2 rounded-xl text-muted-foreground hover:text-gold hover:bg-gold/10 transition-colors flex-shrink-0"
                      title={isMuted ? (language === 'hi' ? 'आवाज़ खोलें' : 'Unmute') : (language === 'hi' ? 'म्यूट करें' : 'Mute')}
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-4 h-4 text-amber-500" />
                      ) : volume < 0.5 ? (
                        <Volume1 className="w-4 h-4" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-12 sm:w-20 h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-gold hover:accent-gold-light focus:outline-none transition-all"
                      title={`${language === 'hi' ? 'वॉल्यूम' : 'Volume'}: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                    />
                  </div>

                  {/* Center: Rewind 10s | Single Glowing Gold Play-Pause | Forward 10s */}
                  <div className="flex items-center gap-2.5 sm:gap-4 flex-shrink-0">
                    {/* Rewind 10s */}
                    <button
                      onClick={() => handleSkip(-10)}
                      className="p-2 rounded-xl text-muted-foreground hover:text-gold hover:bg-gold/10 transition-colors"
                      title="Rewind 10s"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    {/* Single Main Glowing Gold Play/Pause Button */}
                    <button
                      onClick={handlePlayPause}
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-amber-600 via-gold to-yellow-300 text-primary-foreground flex items-center justify-center shadow-lg shadow-gold/25 hover:scale-105 active:scale-95 transition-all"
                      title={isPlaying ? t('pauseAudio') : t('playBhajan')}
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
                      ) : (
                        <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current translate-x-0.5" />
                      )}
                    </button>

                    {/* Forward 10s */}
                    <button
                      onClick={() => handleSkip(10)}
                      className="p-2 rounded-xl text-muted-foreground hover:text-gold hover:bg-gold/10 transition-colors"
                      title="Forward 10s"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Right: Repeat Toggle & Audio Download Button */}
                  <div className="flex items-center justify-end gap-1 sm:gap-1.5 min-w-[76px] sm:min-w-[120px]">
                    {/* Repeat Button */}
                    <button
                      onClick={toggleLoop}
                      className={`p-2 rounded-xl border transition-all ${
                        isLooping
                          ? 'bg-gold/20 text-gold border-gold/50 shadow-sm shadow-gold/20'
                          : 'text-muted-foreground border-transparent hover:text-gold hover:bg-gold/10'
                      }`}
                      title={isLooping ? (language === 'hi' ? 'दोहराना चालू (Repeat On)' : 'Repeat On') : (language === 'hi' ? 'दोहराना बंद (Repeat Off)' : 'Repeat Off')}
                    >
                      <Repeat className="w-4 h-4" />
                    </button>

                    {/* Download Button */}
                    {downloadState === 'downloading' ? (
                      <div
                        className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-gold/10 border border-gold/20"
                        title={downloadProgress > 0 ? `${downloadProgress}%` : (language === 'hi' ? 'डाउनलोड हो रहा है...' : 'Downloading...')}
                      >
                        <svg className="w-7 h-7 -rotate-90 text-gold" viewBox="0 0 36 36">
                          <circle
                            className="text-border/40"
                            strokeWidth="3"
                            stroke="currentColor"
                            fill="transparent"
                            r="14"
                            cx="18"
                            cy="18"
                          />
                          <circle
                            className="text-gold transition-all duration-150"
                            strokeWidth="3"
                            strokeDasharray={88}
                            strokeDashoffset={88 - (88 * (downloadProgress || 20)) / 100}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                            r="14"
                            cx="18"
                            cy="18"
                          />
                        </svg>
                        <motion.div
                          className="absolute"
                          animate={{ y: [-1.5, 1.5, -1.5] }}
                          transition={{ repeat: Infinity, duration: 0.9, ease: 'easeInOut' }}
                        >
                          <Download className="w-3.5 h-3.5 text-gold" />
                        </motion.div>
                      </div>
                    ) : downloadState === 'completed' ? (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="p-2 rounded-xl text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"
                        title={language === 'hi' ? 'डाउनलोड पूरा हुआ' : 'Downloaded'}
                      >
                        <Check className="w-4 h-4" />
                      </motion.div>
                    ) : (
                      <button
                        onClick={handleDownloadAudio}
                        className="p-2 rounded-xl text-muted-foreground hover:text-gold hover:bg-gold/10 border border-transparent hover:border-gold/20 transition-all"
                        title={t('downloadAudio')}
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* When no audio file is uploaded/linked for this bhajan */
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary/70 text-muted-foreground text-xs mb-4 border border-border/30">
                <VolumeX className="w-4 h-4" />
                <span>{t('audioUnavailable')}</span>
              </div>
            )}

            {/* Utility actions: Roman Script | Copy Verse | Download PDF */}
            <div className="flex flex-wrap gap-2 sm:gap-2.5 justify-center items-center">
              <button
                onClick={() => setShowRoman(!showRoman)}
                className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl font-medium transition-all text-xs sm:text-sm ${
                  showRoman
                    ? 'bg-gold text-primary-foreground shadow-sm'
                    : 'bg-secondary text-secondary-foreground hover:bg-gold/20 border border-border/40'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span>{showRoman ? t('hideRomanScript') : t('romanScript')}</span>
              </button>

              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-secondary text-secondary-foreground hover:bg-gold/20 border border-border/40 transition-colors text-xs sm:text-sm"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-gold" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? t('copied') : t('copyVerse')}</span>
              </button>

              <button
                onClick={handlePdfDownload}
                className="flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-secondary text-secondary-foreground hover:bg-gold/20 border border-border/40 transition-colors text-xs sm:text-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t('downloadPdf')}</span>
              </button>
            </div>
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
