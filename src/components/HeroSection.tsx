import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import { smartSearch } from '@/lib/smart-search';
import { getShastras } from '@/data/shastra-loader';
import { transliterateText } from '@/lib/transliterate';

interface UnifiedSearchResult {
  id: string;
  title: string;
  type: 'bhajan' | 'shastra';
  bhajanSubdivision?: string;
  bhajanSlug?: string;
  shastraCategorySlug?: string;
  shastraSlug?: string;
  score: number;
  subtitle?: string;
}

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
    if (searchQuery.length > 1) {
      const query = searchQuery.trim().toLowerCase();
      
      // 1. Search Bhajans
      const bhajanResults = smartSearch(query, { limit: 10 });
      const unifiedBhajans: UnifiedSearchResult[] = bhajanResults.map(r => ({
        id: `bhajan-${r.id}`,
        title: r.title,
        type: 'bhajan',
        bhajanSubdivision: r.bhajan.subdivision,
        bhajanSlug: r.bhajan.slug,
        score: r.relevance_score,
        subtitle: r.bhajan.singer ? `🎤 ${r.bhajan.singer}` : '🎵 Bhajan'
      }));

      // 2. Search Shastras
      const shastras = getShastras();
      
      // Vowel normalization (aa -> a, ee -> i, etc.)
      const normalizeVowel = (str: string) => str
        .replace(/aa/g, 'a')
        .replace(/ee/g, 'i')
        .replace(/oo/g, 'u')
        .replace(/ii/g, 'i')
        .replace(/uu/g, 'u')
        .replace(/ai/g, 'e')
        .replace(/au/g, 'o');

      // Phonetic / consonant-only normalization
      const normalizePhonetic = (str: string) => str
        .replace(/ph/g, 'f')
        .replace(/sh/g, 's')
        .replace(/th/g, 't')
        .replace(/ch/g, 'c')
        .replace(/kh/g, 'k')
        .replace(/gh/g, 'g')
        .replace(/dh/g, 'd')
        .replace(/bh/g, 'b')
        .replace(/(.)\1+/g, '$1') // collapse duplicate letters
        .replace(/[aeiou]/g, '') // remove vowels
        .trim();

      const normQueryVowel = normalizeVowel(query);
      const normQueryPhonetic = normalizePhonetic(query);

      const matchText = (text: string) => {
        const textLower = text.toLowerCase();
        if (textLower.includes(query)) return 1.0;
        if (normalizeVowel(textLower).includes(normQueryVowel)) return 0.9;
        if (normQueryPhonetic.length >= 2 && normalizePhonetic(textLower).includes(normQueryPhonetic)) return 0.8;
        return 0;
      };

      const matchedShastras: UnifiedSearchResult[] = [];

      shastras.forEach(s => {
        const titleLower = s.title.toLowerCase();
        const authorLower = s.author.toLowerCase();
        const catHiLower = s.categoryHi.toLowerCase();
        const catEnLower = s.categoryEn.toLowerCase();
        const idLower = s.id.toLowerCase();
        const shastraSlugLower = s.shastraSlug.toLowerCase();
        const categorySlugLower = s.categorySlug.toLowerCase();
        const romanTitle = transliterateText(s.title).toLowerCase();
        const romanAuthor = transliterateText(s.author).toLowerCase();

        // Calculate maximum score
        const scores = [
          titleLower === query ? 1.0 : (titleLower.includes(query) ? 0.95 : 0),
          authorLower === query ? 0.9 : (authorLower.includes(query) ? 0.85 : 0),
          catHiLower.includes(query) ? 0.7 : 0,
          catEnLower.includes(query) ? 0.7 : 0,
          matchText(idLower) * 0.95,
          matchText(shastraSlugLower) * 0.95,
          matchText(categorySlugLower) * 0.7,
          matchText(romanTitle) * 0.9,
          matchText(romanAuthor) * 0.85
        ];

        const maxScore = Math.max(...scores);
        if (maxScore > 0) {
          matchedShastras.push({
            id: `shastra-${s.id}`,
            title: s.title,
            type: 'shastra',
            shastraCategorySlug: s.categorySlug,
            shastraSlug: s.shastraSlug,
            score: maxScore,
            subtitle: `📚 ${s.author} (${s.categoryHi})`
          });
        }
      });

      // Combine and sort
      const combined = [...unifiedBhajans, ...matchedShastras]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      setSuggestions(combined);
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

        {/* Search Bar — Google-style */}
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
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
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
                className="absolute left-0 right-0 z-20 bg-card/95 backdrop-blur-md border border-border/50 border-t-0 rounded-b-2xl shadow-2xl overflow-hidden"
              >
                <div className="border-t border-border/30" />
                {suggestions.map(s => (
                  <button
                    key={s.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (s.type === 'bhajan') {
                        navigate(`/bhajan/${s.bhajanSubdivision}/${s.bhajanSlug}`);
                      } else {
                        navigate(`/shastra/${s.shastraCategorySlug}/${s.shastraSlug}`);
                      }
                      setSearchQuery('');
                      setSuggestions([]);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-secondary/80 transition-colors text-sm flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Search className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                      <span className="text-foreground/90 truncate devanagari-safe">{s.title}</span>
                    </div>
                    {s.subtitle && (
                      <span className="text-xs text-muted-foreground/60 flex-shrink-0 devanagari-safe">{s.subtitle}</span>
                    )}
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
