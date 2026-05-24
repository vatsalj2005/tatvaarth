import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { getShastraIndex, getGathaContent, ShastraIndex, GathaContent, GathaItem } from '@/data/shastra-loader';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ChevronRight, ListCollapse, Download, Type, ChevronLeft, Eye, EyeOff, LocateFixed } from 'lucide-react';
import ShastraPrintTemplate from '@/components/ShastraPrintTemplate';

const ShastraReader = () => {
  const { categorySlug, shastraSlug } = useParams<{ categorySlug: string; shastraSlug: string }>();
  const { t, language, fontSize, lineSpacing, useSerif, theme } = useApp();
  const contentFontSize = fontSize + 4;
  
  const [shastraIndex, setShastraIndex] = useState<ShastraIndex | null>(null);
  const [activeGathaNum, setActiveGathaNum] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTeekaTabs, setActiveTeekaTabs] = useState<Record<string, string>>({}); // Mapping: gathaNum -> activeCommentatorName
  const [showSanskritTeeka, setShowSanskritTeeka] = useState<Record<string, boolean>>({}); // Mapping: gathaNum_commentator -> boolean
  const [isAutoFollow, setIsAutoFollow] = useState(true);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const gathaRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const formatGathaText = (text: string, isGadya: boolean = false) => {
    return text.split('\n').map((line, i, arr) => {
      // Split by bracketed numbers like (383) or devanagari/english numbers in double pipes like ||397|| or ॥३८३॥
      const parts = line.split(/(\(\s*\d+\s*\)|[॥|]+\s*[\d\u0966-\u096F]+\s*[॥|]+)/);
      
      return (
        <span key={i}>
          {parts.map((part, j) => {
            if (part.match(/^\(\s*\d+\s*\)$/)) {
              return (
                <span key={j} className="text-[0.55em] text-teal-700 dark:text-teal-400 align-middle inline-block ml-1">
                  {part}
                </span>
              );
            }
            if (part.match(/^[॥|]+\s*[\d\u0966-\u096F]+\s*[॥|]+$/)) {
              if (isGadya) {
                return (
                  <span key={j} className="text-emerald-600 dark:text-emerald-500 font-semibold ml-1">
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

  // 1. Fetch shastra index
  useEffect(() => {
    if (shastraSlug) {
      const idx = getShastraIndex(shastraSlug);
      setShastraIndex(idx);
      if (idx && idx.chapters.length > 0 && idx.chapters[0].items.length > 0) {
        setActiveGathaNum(idx.chapters[0].items[0].gathaNum);
      }
      // Clear gatha refs when shastra changes
      gathaRefs.current = {};
    }
  }, [shastraSlug]);

  // 2. Load all gatha contents
  const gathas = useMemo(() => {
    const list: { item: GathaItem; content: GathaContent; chapterName: string }[] = [];
    if (!shastraIndex || !shastraSlug) return list;

    shastraIndex.chapters.forEach(chapter => {
      chapter.items.forEach(item => {
        const content = getGathaContent(shastraSlug, item.file);
        if (content) {
          list.push({ item, content, chapterName: chapter.name });
        }
      });
    });
    return list;
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

  // 3. Setup IntersectionObserver to highlight current active gatha in the sidebar
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    const intersectingGathas = new Set<string>();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const gathaNum = entry.target.getAttribute('data-gatha-num');
          if (gathaNum) {
            if (entry.isIntersecting) {
              intersectingGathas.add(gathaNum);
            } else {
              intersectingGathas.delete(gathaNum);
            }
          }
        });

        // Find the top-most intersecting gatha
        if (intersectingGathas.size > 0) {
          let topGathaNum = '';
          let minTop = Infinity;

          intersectingGathas.forEach((num) => {
            const el = document.getElementById(`gatha-${num}`);
            if (el) {
              const rect = el.getBoundingClientRect();
              if (rect.top < minTop) {
                minTop = rect.top;
                topGathaNum = num;
              }
            }
          });

          if (topGathaNum) {
            setActiveGathaNum(topGathaNum);
          }
        }
      },
      {
        rootMargin: '-10% 0px -45% 0px', // Trigger when item enters the upper half of reading viewport
      }
    );

    // Query DOM elements via refs directly to ensure we observe all currently rendered verses
    Object.values(gathaRefs.current).forEach((el) => {
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [gathas, theme, fontSize, lineSpacing, useSerif]);

  // 4. Auto-follow sidebar scroll
  useEffect(() => {
    if (isAutoFollow && activeGathaNum) {
      const activeSidebarItem = document.getElementById(`sidebar-link-${activeGathaNum}`);
      const container = document.getElementById('sidebar-scroll-container');
      
      if (activeSidebarItem && container) {
        const containerRect = container.getBoundingClientRect();
        const itemRect = activeSidebarItem.getBoundingClientRect();
        
        // Only scroll if item is outside the visible center bounds (buffer of 50px)
        const isOutsideCenter = itemRect.top < containerRect.top + 50 || itemRect.bottom > containerRect.bottom - 50;
        
        if (isOutsideCenter) {
          const offset = itemRect.top - containerRect.top - (containerRect.height / 2) + (itemRect.height / 2);
          container.scrollBy({ top: offset, behavior: 'smooth' });
        }
      }
    }
  }, [activeGathaNum, isAutoFollow]);

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

  // Handle sidebar navigation clicking
  const scrollToGatha = (gathaNum: string) => {
    const el = document.getElementById(`gatha-${gathaNum}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveGathaNum(gathaNum);
      
      // On mobile, close sidebar automatically on selection
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
      // Re-enable auto-follow since user explicitly selected a gatha
      setIsAutoFollow(true);
    }
  };

  // PDF generation for the entire shastra
  const handleFullPdfDownload = () => {
    if (!shastraIndex || gathas.length === 0) return;
    setIsDownloadingPdf(true);
  };

  // Helper to highlight bracketed words in Anvayarth
  const renderHighlightedAnvayarth = (text: string) => {
    const parts = text.split(/(\*\*\[[^\]]+\]\*\*)/);
    return parts.map((part, index) => {
      const match = part.match(/\*\*\[([^\]]+)\]\*\*/);
      if (match) {
        return (
          <span 
            key={index} 
            className="inline-block px-1 py-0.5 mx-0.5 rounded text-gold font-semibold bg-gold/10 border border-gold/10 devanagari-safe"
          >
            {match[1]}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Helper to highlight bracketed terms in commentaries (like [स्वानुभूत्या चकासते] in dark red or gold)
  const highlightBracketedTerms = (text: string) => {
    const parts = text.split(/(\*\*\[[^\]]+\]\*\*|\[[^\]]+\])/);
    return parts.map((part, index) => {
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
      return <span key={index}>{part}</span>;
    });
  };

  // Helper to render commentary lines dynamically (centering कलश-दोहा and verses, highlighting brackets)
  const renderFormattedCommentary = (text: string, colorClass: string = "text-foreground/90") => {
    const lines = text.split('\n');
    let inVerse = false;

    return lines.map((lineText, index) => {
      // Strip BOM (\ufeff) and zero-width characters
      const clean = lineText.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      if (!clean) {
        if (inVerse) return null; // Remove line space between doha lines
        return <div key={index} className="h-2" />;
      }

      // Check if it is a meter header (like (कलश-दोहा))
      const isMeterHeader = clean.startsWith('(') && clean.endsWith(')') && clean.length <= 50;

      if (isMeterHeader) {
        inVerse = true;
        return (
          <div 
            key={index} 
            className="text-center font-bold text-teal-700 dark:text-teal-400 my-3 text-sm devanagari-safe"
          >
            {clean}
          </div>
        );
      }

      // Check if verse mode should end
      if (inVerse && (clean.startsWith('[') || clean.startsWith('**['))) {
        inVerse = false;
      }

      if (inVerse) {
        return (
          <div 
            key={index} 
            className="text-center text-orange-800 dark:text-orange-400 font-semibold my-1 text-base leading-relaxed devanagari-safe"
          >
            {clean}
          </div>
        );
      }

      return (
        <div 
          key={index} 
          className={`${colorClass} my-2 leading-loose text-left devanagari-safe`}
        >
          {highlightBracketedTerms(clean)}
        </div>
      );
    });
  };

  const readingClass = useSerif ? 'font-reading' : '';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Unified PDF Download Button - Fixed to top-right viewport, collapsing to a small square on mobile */}
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

      <div className={`flex-1 flex pt-16 relative transition-all duration-300 ${isSidebarOpen ? 'md:pl-[280px]' : ''}`}>
        {/* Toggle Sidebar Button for Desktop & Mobile */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`fixed z-50 bottom-6 left-6 p-3 rounded-full bg-gold text-primary-foreground shadow-lg hover:opacity-90 transition-all flex items-center justify-center`}
          title="Toggle Navigation Menu"
        >
          <ListCollapse className="w-5 h-5" />
        </button>

        {/* 1. Sidebar Navigation Panel & Mobile Overlay */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              {/* Mobile Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setIsSidebarOpen(false)}
                className="md:hidden fixed inset-0 z-30 bg-background/60 backdrop-blur-sm top-16"
              />

              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "tween", duration: 0.3 }}
                className="fixed left-0 top-16 bottom-0 w-[80vw] max-w-[300px] md:w-[280px] bg-card border-r border-border/40 z-40 flex flex-col shadow-2xl md:shadow-none overflow-hidden"
              >
              <div className="p-4 border-b border-border/40 flex items-center justify-between">
                <h2 className="font-heading text-lg text-gradient-gold font-semibold devanagari-safe">
                  {t('chapters')}
                </h2>
                <div className="flex items-center gap-2">
                  {!isAutoFollow && (
                    <button 
                      onClick={() => setIsAutoFollow(true)}
                      className="flex items-center gap-1.5 text-xs bg-gold/10 text-gold hover:bg-gold/20 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
                      title={t('follow')}
                    >
                      <LocateFixed className="w-3.5 h-3.5" />
                      {t('follow')}
                    </button>
                  )}
                  <button 
                    onClick={() => setIsSidebarOpen(false)}
                    className="md:hidden p-1 rounded-lg hover:bg-secondary"
                  >
                    <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              <div 
                id="sidebar-scroll-container"
                className="flex-1 overflow-y-auto p-3 scrollbar-thin"
              >
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
                          }`}></div>
                          <button
                            onClick={() => scrollToGatha(item.gathaNum)}
                            className={`w-full text-left pl-7 pr-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between devanagari-safe ${
                              activeGathaNum === item.gathaNum
                                ? 'bg-gold/15 text-gold font-semibold shadow-sm'
                                : 'text-foreground/80 hover:bg-secondary hover:text-foreground'
                            }`}
                          >
                            <span className="truncate pr-2">
                              {item.gathaNum} — {item.title}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 opacity-50 flex-shrink-0" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* 2. Main Scripture Reading Container */}
        <main className="flex-1 px-4 md:px-8 py-10 max-w-4xl mx-auto w-full transition-all duration-300">
          {/* Granth Header Banner */}
          <div className="text-center mb-16 border-b border-border/30 pb-10">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4 flex-wrap devanagari-safe">
              <Link to="/shastra" className="hover:text-gold transition-colors">{t('shastra')}</Link>
              <span>/</span>
              <span className="text-foreground/80">{shastraIndex.title}</span>
            </div>
            
            <h1 className="text-7xl md:text-9xl font-heading font-bold text-gradient-gold mb-6 devanagari-safe">
              {shastraIndex.title}
            </h1>
            <p className="text-sm text-gold/80 devanagari-safe">
              ✍️ {t('author')}: {shastraIndex.author}
            </p>
          </div>

          {/* Verses Scroller */}
          <div className="space-y-24">
            {gathas.map(({ item, content, chapterName }) => {
              const gathaNum = item.gathaNum;
              const currentComm = activeTeekaTabs[gathaNum] || (content.teekas[0]?.commentator);
              const activeTeeka = content.teekas.find(t => t.commentator === currentComm);
              const showSanskrit = showSanskritTeeka[`${gathaNum}_${currentComm}`] || false;

              return (
                <div
                  key={gathaNum}
                  id={`gatha-${gathaNum}`}
                  data-gatha-num={gathaNum}
                  ref={(el) => { gathaRefs.current[gathaNum] = el; }}
                  className="scroll-mt-20 border-b border-border/20 pb-16"
                >
                  {/* Chapter Subtitle & Badge */}
                  <div className="flex items-center justify-between gap-4 mb-6">
                    <span className="text-xs px-2.5 py-1 bg-secondary text-gold/80 rounded-full font-medium devanagari-safe">
                      📂 {chapterName}
                    </span>
                    <span className="text-lg font-heading text-gold font-bold">
                      #{gathaNum}
                    </span>
                  </div>

                  {/* Header title */}
                  <h3 className="text-3xl font-heading text-center text-rose-900 dark:text-rose-900 font-bold mb-6 devanagari-safe" style={{ fontSize: `${contentFontSize * 1.4}px` }}>
                    {formatGathaText(content.title)}
                  </h3>

                  {/* Prakrit verse */}
                  <div className="p-6 md:p-8 rounded-2xl bg-gold/5 border border-gold/20 shadow-sm relative mb-6">
                    <h4 className="text-xs uppercase tracking-wider text-gold font-medium mb-3">{t('prakrit')}</h4>
                    <p 
                      className={`text-center text-xl md:text-2xl text-orange-800 dark:text-orange-400 font-semibold devanagari-safe leading-loose ${readingClass}`}
                      style={{ fontSize: `${contentFontSize * 1.25}px`, lineHeight: lineSpacing }}
                    >
                      {formatGathaText(content.gatha)}
                    </p>
                  </div>

                  {/* Sanskrit verse */}
                  {content.gathaS && (
                    <div className="p-4 rounded-xl bg-secondary/30 border border-border/30 mb-6">
                      <h4 className="text-xs uppercase tracking-wider text-muted-foreground/80 font-medium mb-2">{t('sanskrit')}</h4>
                      <p 
                        className={`text-center text-base md:text-lg text-teal-700 dark:text-teal-400 devanagari-safe leading-loose ${readingClass}`}
                        style={{ fontSize: `${contentFontSize * 0.8}px`, lineHeight: lineSpacing }}
                      >
                        {formatGathaText(content.gathaS)}
                      </p>
                    </div>
                  )}

                  {/* Hindi Poetic Verse (Gadya) */}
                  {content.gadya && (
                    <div className="text-center italic text-foreground/90 font-serif my-8 px-6 devanagari-safe border-l-2 border-r-2 border-gold/30">
                      <p 
                        className="leading-relaxed"
                        style={{ fontSize: `${contentFontSize * 0.8}px`, lineHeight: lineSpacing }}
                      >
                        {formatGathaText(content.gadya, true)}
                      </p>
                    </div>
                  )}

                  {/* Anvayarth (Word Meanings) */}
                  <div className="my-8">
                    <h4 className="text-sm font-semibold text-gold mb-3 devanagari-safe">
                      🔍 {t('anvayarth')}
                    </h4>
                    <p 
                      className="text-foreground/95 devanagari-safe leading-loose"
                      style={{ fontSize: `${contentFontSize}px`, lineHeight: lineSpacing }}
                    >
                      {renderHighlightedAnvayarth(content.anvayarth)}
                    </p>
                  </div>

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
                        {content.teekas.map(t => (
                          <button
                            key={t.commentator}
                            onClick={() => setActiveTeekaTabs(prev => ({ ...prev, [gathaNum]: t.commentator }))}
                            className={`px-5 py-3 text-sm font-heading font-medium transition-colors flex-shrink-0 devanagari-safe ${
                              currentComm === t.commentator
                                ? 'bg-card text-gold border-t-2 border-gold font-semibold'
                                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                            }`}
                          >
                            {t.commentator}
                          </button>
                        ))}
                      </div>

                      {/* Tab Content */}
                      <div className="p-6">
                        {activeTeeka && (
                          <div className="space-y-4">
                            {/* Sanskrit Toggle (if commentary has Sanskrit) */}
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
                                {renderFormattedCommentary(activeTeeka.sanskrit, "text-teal-700 dark:text-teal-400")}
                              </motion.div>
                            )}

                            {/* Hindi commentary text */}
                            <div 
                              className="text-foreground/90 devanagari-safe leading-loose space-y-2"
                              style={{ fontSize: `${contentFontSize}px`, lineHeight: lineSpacing }}
                            >
                              {renderFormattedCommentary(activeTeeka.hindi)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}


                </div>
              );
            })}
          </div>
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
