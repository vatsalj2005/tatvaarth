import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import { siteWideSearch, UnifiedSearchResult } from '@/lib/smart-search';

// Dynamically import all hero images from the assets folder
const heroImages = Object.values(
  (import.meta as any).glob('../assets/hero-*.{jpg,jpeg,png,webp,svg}', { eager: true, import: 'default' })
) as string[];

const HeroSection = () => {
  const { t } = useApp();
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<UnifiedSearchResult[]>([]);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % heroImages.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const results = siteWideSearch(searchQuery.trim(), { limit: 10 });
      setSuggestions(results);
    } else {
      setSuggestions([]);
    }
  }, [searchQuery]);

  const showDropdown = isFocused && suggestions.length > 0;

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-16 pb-24">
      {/* Fixed wallpaper background — completely isolated from content */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0"
          >
            <img
              src={heroImages[currentSlide]}
              alt="Jain Heritage"
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-background/70" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Content — always visible, never affected by wallpaper transitions */}
      <div className="relative text-center px-4 max-w-5xl mx-auto" style={{ zIndex: 1 }}>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-4xl md:text-6xl font-heading text-gradient-gold mb-4 devanagari-safe"
          style={{ lineHeight: 1.4 }}
        >
          {t('siteName')}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-lg md:text-xl text-foreground/70 mb-10 devanagari-safe"
        >
          {t('heroSubtitle')}
        </motion.p>

        {/* Search Bar — 150% horizontal length (864px vs 576px max-w-xl) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="relative w-full max-w-[864px] mx-auto"
        >
          <div
            className={`relative flex items-center gap-3 px-4 py-3 border transition-all duration-300 ${
              showDropdown
                ? 'rounded-t-xl border-gold/50 bg-card shadow-lg shadow-gold/5 border-b-0'
                : `rounded-xl ${isFocused ? 'border-gold/50 bg-card shadow-lg shadow-gold/5' : 'border-border/50 bg-card/90 backdrop-blur-md hover:border-border'}`
            }`}
          >
            <Search className={`w-5 h-5 flex-shrink-0 transition-colors duration-300 ${isFocused ? 'text-gold' : 'text-muted-foreground'}`} />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/60 outline-none text-sm devanagari-safe"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSuggestions([]);
                }}
                className="p-1 rounded-lg hover:bg-secondary transition-colors"
                title="Clear search"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>

          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute left-0 right-0 z-30 bg-card border border-gold/50 border-t-0 rounded-b-xl shadow-lg shadow-gold/5 overflow-hidden max-h-[320px] overflow-y-auto scrollbar-thin"
              >
                <div className="border-t border-border/30" />
                {suggestions.map(s => (
                  <button
                    key={s.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      navigate(s.url);
                      setSearchQuery('');
                      setSuggestions([]);
                    }}
                    className={`w-full text-left px-4 py-2.5 hover:bg-secondary/80 transition-colors text-sm flex items-center justify-between gap-3 border-b border-border/20 last:border-b-0 group ${
                      s.type === 'directory' ? 'bg-gold/5' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-base flex-shrink-0 w-5 text-center">
                        {s.icon || (s.type === 'directory' ? '📂' : s.type === 'shastra' ? '📚' : '🎵')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground/90 font-medium truncate devanagari-safe">
                            {s.title}
                          </span>
                          {s.badge && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                                s.type === 'directory'
                                  ? 'bg-gold/20 text-gold border border-gold/40'
                                  : s.type === 'shastra'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                              }`}
                            >
                              {s.badge}
                            </span>
                          )}
                        </div>
                        {s.subtitle && (
                          <p className="text-xs text-muted-foreground/60 truncate devanagari-safe mt-0.5">
                            {s.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Slide indicators */}
        <div className="flex justify-center gap-2 mt-8">
          {heroImages.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentSlide ? 'w-8 bg-gold' : 'bg-foreground/30'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
