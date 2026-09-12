import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowRight } from 'lucide-react';
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
    <section className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Fixed wallpaper background — completely isolated from content */}
      <div className="fixed inset-0" style={{ zIndex: 0 }}>
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
      <div className="relative text-center px-4 max-w-3xl mx-auto" style={{ zIndex: 1 }}>
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

        {/* Search Bar — Google-style with site-wide intelligent suggestions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="relative max-w-xl mx-auto"
        >
          <div className={`relative ${showDropdown ? 'rounded-t-2xl' : 'rounded-2xl'}`}>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 250)}
              className={`w-full pl-12 pr-4 py-4 bg-card/90 backdrop-blur-md border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 text-base ${
                showDropdown ? 'rounded-t-2xl border-b-0' : 'rounded-2xl'
              }`}
            />
          </div>

          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute left-0 right-0 z-20 bg-card/95 backdrop-blur-md border border-border/50 border-t-0 rounded-b-2xl shadow-2xl overflow-hidden max-h-[440px] overflow-y-auto scrollbar-thin"
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
                    className={`w-full text-left px-4 py-3 hover:bg-secondary/80 transition-colors text-sm flex items-center justify-between gap-3 border-b border-border/20 last:border-b-0 group ${
                      s.type === 'directory' ? 'bg-gold/5 hover:bg-gold/15' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-xl flex-shrink-0 w-7 text-center">
                        {s.icon || (s.type === 'directory' ? '📂' : s.type === 'shastra' ? '📚' : '🎵')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-foreground/95 font-medium truncate devanagari-safe">
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
                          <p className="text-xs text-muted-foreground/75 truncate devanagari-safe mt-0.5">
                            {s.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gold/60 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
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
