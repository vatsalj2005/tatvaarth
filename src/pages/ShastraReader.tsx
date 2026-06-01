import { useState, useEffect, useLayoutEffect, useMemo, useRef, Fragment } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { getShastraIndex, getGathaContent, ShastraIndex, GathaContent, GathaItem } from '@/data/shastra-loader';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ChevronRight, ListCollapse, Download, Type, ChevronLeft, Eye, EyeOff, LocateFixed, X } from 'lucide-react';
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
  const [gathas, setGathas] = useState<Array<{ item: GathaItem; content: GathaContent; chapterName: string }>>([]);
  const [isLoadingGathas, setIsLoadingGathas] = useState(true);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const gathaRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isManualScrollingRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollTimeoutRef = useRef<any>(null);

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
      // Clear gatha refs when shastra changes
      gathaRefs.current = {};
    }
  }, [shastraSlug]);

  // 2. Load all gatha contents asynchronously
  useEffect(() => {
    let isActive = true;
    if (!shastraIndex || !shastraSlug) return;
    
    setIsLoadingGathas(true);
    
    // Defer the heavy parsing to let React render the skeleton
    const timer = setTimeout(() => {
      if (!isActive) return;
      const list: { item: GathaItem; content: GathaContent; chapterName: string }[] = [];
      shastraIndex.chapters.forEach(chapter => {
        chapter.items.forEach(item => {
          const content = getGathaContent(shastraSlug, item.file);
          if (content) {
            list.push({ item, content, chapterName: chapter.name });
          }
        });
      });
      setGathas(list);
      setIsLoadingGathas(false);
    }, 50);

    return () => {
      isActive = false;
      clearTimeout(timer);
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
        if (intersectingGathas.size > 0 && !isManualScrollingRef.current) {
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
    if (isAutoFollow && activeGathaNum && isSidebarOpen) {
      isProgrammaticScrollRef.current = true; // Block scroll events immediately during mount/animation
      
      // Always block manual scroll detection for 1 full second when auto-following or mounting
      // to prevent the browser's native scroll-restoration from triggering it
      if (programmaticScrollTimeoutRef.current) {
        clearTimeout(programmaticScrollTimeoutRef.current);
      }
      programmaticScrollTimeoutRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 1000);

      // Need a small timeout to ensure the sidebar DOM is fully mounted and animated before scrolling
      const timer = setTimeout(() => {
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
      }, 50); // Short delay ensures Framer Motion has mounted the container
      
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
    
    // Pre-emptively block scroll events BEFORE the sidebar mounts to catch any
    // immediate scroll restorations fired by the browser during the paint phase.
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

  // Handle sidebar navigation clicking
  const scrollToGatha = (gathaNum: string) => {
    const el = document.getElementById(`gatha-${gathaNum}`);
    if (el) {
      isManualScrollingRef.current = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveGathaNum(gathaNum);
      setIsAutoFollow(true);
      
      // On mobile, close sidebar automatically on selection
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
      
      // Temporarily block scroll detection in sidebar on navigation click
      isProgrammaticScrollRef.current = true;
      if (programmaticScrollTimeoutRef.current) {
        clearTimeout(programmaticScrollTimeoutRef.current);
      }
      programmaticScrollTimeoutRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 1000);

      // Re-enable auto-follow and tracking after scroll finishes
      setTimeout(() => {
        isManualScrollingRef.current = false;
      }, 1000); // 1s is enough for smooth scroll to finish
    }
  };

  const handleSidebarScroll = () => {
    if (isProgrammaticScrollRef.current) return;
    setIsAutoFollow(false);
  };

  // PDF generation for the entire shastra
  const handleFullPdfDownload = () => {
    if (!shastraIndex || gathas.length === 0) return;
    setIsDownloadingPdf(true);
  };

  // Helper to highlight bracketed words in Anvayarth
  const renderHighlightedAnvayarth = (text: string) => {
    return text.split('\n').map((line, lineIndex, arr) => {
      const parts = line.split(/(\*\*\[[^\]]+\]\*\*|\([^\)]+\))/);
      return (
        <span key={lineIndex} className="block mb-2 last:mb-0">
          {parts.map((part, index) => {
            const boldMatch = part.match(/\*\*\[([^\]]+)\]\*\*/);
            if (boldMatch) {
              return (
                <span 
                  key={index} 
                  className="inline-block px-1 py-0.5 mx-0.5 rounded text-gold font-semibold bg-gold/10 border border-gold/10"
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
                  className="text-gold-light font-medium"
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

  // Helper to color specific lines in Bhavarth
  const renderBhavarthText = (text: string) => {
    return text.split('\n').map((line, i, arr) => {
      const trimmed = line.trim();
      const isSanskritColor = [
        "॥ श्रीपरमगुरुवे नमः, परम्पराचार्यगुरुवे नमः ॥",
        "॥ श्रीपरमगुरुवे नम:, परम्पराचार्यगुरुवे नम: ॥",
        "॥ श्रोतारः सावधानतया शृणवन्तु ॥",
        "॥ श्रोतार: सावधानतया शृणवन्तु ॥",
        "(देव वंदना)",
        "(शास्त्र वंदना)",
        "(गुरु वंदना)",
        "आर्हत भक्ति",
        "पण्डित-जुगल-किशोर कृत"
      ].includes(trimmed);

      const isArthColor = trimmed.startsWith("(समस्त पापों का नाश करनेवाला");

      const colorClass = isSanskritColor 
        ? "text-pink-700 dark:text-pink-400 font-semibold" 
        : isArthColor 
          ? "text-foreground/95" 
          : "text-green-800 dark:text-green-600";

      const style = trimmed === "आर्हत भक्ति"
        ? { fontSize: "2.1em", lineHeight: "1.1", display: "block", margin: "0.25rem 0" }
        : trimmed === "पण्डित-जुगल-किशोर कृत"
          ? { fontSize: "0.55em", lineHeight: "1.1", display: "block", margin: "0.15rem 0" }
          : undefined;

      return (
        <span key={i} className={colorClass} style={style}>
          {line}
          {i < arr.length - 1 && <br />}
        </span>
      );
    });
  };

  // Helper to highlight bracketed terms in commentaries (like [स्वानुभूत्या चकासते] in dark red or gold)
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

  // Helper to render commentary lines dynamically (centering कलश-दोहा and verses, highlighting brackets)
  const renderFormattedCommentary = (text: string, colorClass: string = "text-foreground/90") => {
    if (!text) return null;

    const paragraphs = text.split('\n');
    let inVerse = false;
    let wasLastLineWrapped = false;

    return paragraphs.map((paragraph, index) => {
      let clean = paragraph.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      if (!clean) {
        inVerse = false;
        return <div key={index} className="h-2" />;
      }

      const isWrapped = clean.startsWith('{') && clean.endsWith('}');
      const unwrapped = isWrapped ? clean.slice(1, -1).trim() : clean;
      const isMeterHeader = /^[(（].*?[)）]$/.test(unwrapped) && unwrapped.length <= 50;

      if (isMeterHeader) {
        inVerse = true;
        wasLastLineWrapped = isWrapped;
        return (
          <div 
            key={index} 
            className="text-center font-bold text-pink-700 dark:text-pink-400 my-3 devanagari-safe"
            style={{ fontSize: "1.05em" }}
          >
            {unwrapped}
          </div>
        );
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

      if (inVerse) {
        return (
          <div 
            key={index} 
            className="text-center text-green-800 dark:text-green-600 font-semibold !m-0 !leading-tight devanagari-safe"
            style={{ fontSize: "1.2em" }}
          >
            {unwrapped}
          </div>
        );
      }

      const isQuestion = unwrapped.startsWith('प्रश्न –') || unwrapped.startsWith('प्रश्न -') || unwrapped.startsWith('शंका –') || unwrapped.startsWith('शंका -');
      const isCenteredOrange = isWrapped && !isMeterHeader;
      const isBullet = clean.startsWith('•');
      
      let displayClasses = '';
      if (isQuestion) {
        displayClasses = 'text-red-600 dark:text-red-400 font-semibold text-left';
      } else if (isCenteredOrange) {
        displayClasses = 'text-orange-800 dark:text-orange-400 font-semibold text-center';
      } else {
        displayClasses = `${colorClass} text-left`;
      }

      return (
        <div 
          key={index} 
          className={`${displayClasses} ${isBullet ? 'my-0.5' : 'my-2'} leading-loose devanagari-safe`}
          style={isBullet ? { 
            marginLeft: '1.5rem',
            paddingLeft: '1.2rem', 
            textIndent: '-1.2rem',
            marginTop: '2px',
            marginBottom: '2px',
            lineHeight: '1.4'
          } : undefined}
        >
          {highlightBracketedTerms(unwrapped)}
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

      <div className={`flex-1 flex pt-16 relative ${isSidebarOpen && !isLoadingGathas ? 'md:pl-[280px]' : ''}`}>
        {/* Toggle Sidebar Button for Desktop & Mobile */}
        {!isLoadingGathas && (
          <button
            onClick={() => handleSidebarToggle(!isSidebarOpen)}
            className={`fixed z-50 bottom-6 left-6 p-3 rounded-full bg-gold text-primary-foreground shadow-lg hover:opacity-90 transition-all flex items-center justify-center`}
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
                <div className="flex flex-col gap-1.5 text-[11px] text-muted-foreground devanagari-safe font-medium mt-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm bg-teal-600 dark:bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.4)]"></span> 
                    <span>अमृतचंद्राचार्य</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm bg-orange-500 dark:bg-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.4)]"></span> 
                    <span>जयसेनाचार्य</span>
                  </div>
                </div>
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
                        }`}></div>
                        <button
                          onClick={() => scrollToGatha('cover')}
                          className={`w-full text-left pl-7 pr-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between devanagari-safe font-bold ${
                            activeGathaNum === 'cover'
                              ? 'bg-gold/15 text-gold shadow-sm font-bold'
                              : 'text-foreground/80 hover:bg-secondary hover:text-foreground font-bold'
                          }`}
                        >
                          <span className="truncate pr-2">
                            📖 {shastraIndex.title}
                          </span>
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
                              {item.gathaNum.replace('-parishisht', '')} — {item.title}
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
                    <div className="h-6 w-24 bg-secondary/80 rounded-full"></div>
                    <div className="h-6 w-16 bg-gold/20 rounded"></div>
                  </div>
                  <div className="h-10 w-3/4 bg-rose-900/10 rounded-xl mb-6 mx-auto"></div>
                  <div className="h-32 w-full bg-gold/5 rounded-2xl mb-6 border border-gold/10"></div>
                  <div className="h-24 w-full bg-secondary/30 rounded-xl mb-6"></div>
                  <div className="h-4 w-full bg-foreground/5 rounded mt-12"></div>
                  <div className="h-4 w-full bg-foreground/5 rounded mt-3"></div>
                  <div className="h-4 w-5/6 bg-foreground/5 rounded mt-3"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-24">
            {gathas.map(({ item, content, chapterName }, index) => {
              const gathaNum = item.gathaNum;
              const currentComm = activeTeekaTabs[gathaNum] || (content.teekas[0]?.commentator);
              const activeTeeka = content.teekas.find(t => t.commentator === currentComm);
              const showSanskrit = showSanskritTeeka[`${gathaNum}_${currentComm}`] || false;
              
              const isFirstOfChapter = index === 0 || gathas[index - 1].chapterName !== chapterName;

              return (
                <Fragment key={gathaNum}>
                  {isFirstOfChapter && (
                    <div className="flex flex-col items-center justify-center pt-8 pb-16 space-y-6">
                      <div className="w-full max-w-2xl h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent"></div>
                      <h2 className="text-2xl md:text-4xl font-heading font-bold text-gold tracking-widest devanagari-safe text-center px-4">
                        ------ {chapterName} ------
                      </h2>
                      <div className="w-full max-w-2xl h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent"></div>
                    </div>
                  )}
                  
                  <div
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
                        #{gathaNum.replace('-parishisht', '-परिशिष्ट')}
                      </span>
                    </div>

                  {/* Header title */}
                  <h3 className="font-heading text-center font-black text-foreground drop-shadow-[0_4px_12px_rgba(212,175,55,0.8)] mb-6 devanagari-safe tracking-wide" style={{ fontSize: `${contentFontSize * 1.6}px` }}>
                    {formatGathaText(content.title)}
                  </h3>

                  {/* Prakrit verse */}
                  {chapterName !== 'परिशिष्ट' && (
                    <div className="p-6 md:p-8 rounded-2xl bg-gold/5 border border-gold/20 shadow-sm relative mb-6">
                      <h4 className="text-xs uppercase tracking-wider text-gold font-medium mb-3">{t('prakrit')}</h4>
                      <p 
                        className={`text-center text-xl md:text-2xl font-semibold devanagari-safe leading-loose ${readingClass} ${
                          content.gatha.includes('ओंकारं बिन्दुसंयुक्तं')
                            ? 'text-gold drop-shadow-[0_0_15px_rgba(212,175,55,0.8)]'
                            : 'text-orange-800 dark:text-orange-400 drop-shadow-[0_4px_12px_rgba(234,88,12,0.7)] dark:drop-shadow-[0_4px_12px_rgba(251,146,60,0.8)]'
                        }`}
                        style={{ fontSize: `${contentFontSize * 1.25}px`, lineHeight: lineSpacing }}
                      >
                        {formatGathaText(content.gatha)}
                      </p>
                    </div>
                  )}

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
                  {content.gadya && chapterName !== 'परिशिष्ट' && (
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
                  {chapterName !== 'परिशिष्ट' && (
                    <div className="my-8">
                      <h4 className="text-sm font-semibold text-gold mb-3 devanagari-safe">
                        🔍 {t('anvayarth')}
                      </h4>
                      <div 
                        className="text-foreground/95 devanagari-safe leading-loose"
                        style={{ fontSize: `${contentFontSize}px`, lineHeight: lineSpacing }}
                      >
                        {renderHighlightedAnvayarth(content.anvayarth)}
                      </div>
                    </div>
                  )}

                  {/* Bhavarth (Special Meaning / Context) */}
                  {content.bhavarth && (
                    <div className="my-8 p-6 rounded-2xl bg-amber-900/5 dark:bg-amber-900/10 border border-gold/10 shadow-inner">
                      <p 
                        className="devanagari-safe leading-loose text-center"
                        style={{ fontSize: `${contentFontSize * 1.1}px`, lineHeight: lineSpacing }}
                      >
                        {renderBhavarthText(content.bhavarth)}
                      </p>
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
                </Fragment>
              );
            })}
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
