import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { subdivisions, getBhajansBySubdivision } from '@/data/content-loader';
import { smartSearch } from '@/lib/smart-search';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Search, X } from 'lucide-react';

const BhajanLanding = () => {
  const { t, language } = useApp();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Search across all bhajans (no subdivisionId = all bhajans)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return smartSearch(searchQuery, { limit: 10 });
  }, [searchQuery]);

  const showDropdown = isFocused && searchResults && searchResults.length > 0;
  const showNoResults = isFocused && searchResults && searchResults.length === 0 && searchQuery.trim();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-heading text-gradient-gold mb-3 devanagari-safe">
              {t('bhajan')}
            </h1>
            <p className="text-muted-foreground">{t('bhajanDesc')}</p>
          </motion.div>

          {/* Search Bar with Google-style dropdown */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-10 max-w-xl mx-auto relative"
          >
            <div
              className={`relative flex items-center gap-3 px-4 py-3 border transition-all duration-300 ${
                showDropdown || showNoResults
                  ? 'rounded-t-xl border-gold/50 bg-card shadow-lg shadow-gold/5 border-b-0'
                  : `rounded-xl ${isFocused ? 'border-gold/50 bg-card shadow-lg shadow-gold/5' : 'border-border/50 bg-card hover:border-border'}`
              }`}
            >
              <Search className={`w-5 h-5 flex-shrink-0 transition-colors duration-300 ${isFocused ? 'text-gold' : 'text-muted-foreground'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                placeholder={language === 'hi' ? 'भजन खोजें...' : 'Search bhajans...'}
                className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/60 outline-none text-sm devanagari-safe"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 rounded-lg hover:bg-secondary transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Dropdown suggestions */}
            <AnimatePresence>
              {(showDropdown || showNoResults) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute left-0 right-0 z-30 bg-card border border-gold/50 border-t-0 rounded-b-xl shadow-lg shadow-gold/5 overflow-hidden"
                >
                  <div className="border-t border-border/30" />
                  {searchResults && searchResults.length > 0 ? (
                    searchResults.map(s => (
                      <button
                        key={s.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          navigate(`/bhajan/${s.bhajan.subdivision}/${s.bhajan.slug}`);
                          setSearchQuery('');
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-secondary/80 transition-colors text-sm flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Search className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                          <span className="text-foreground/90 truncate devanagari-safe">{s.title}</span>
                        </div>
                        <span className="text-xs text-muted-foreground/60 flex-shrink-0 devanagari-safe">
                          {s.bhajan.singer ? `🎤 ${s.bhajan.singer}` : '🎵 Bhajan'}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-muted-foreground">
                      {language === 'hi' ? 'कोई परिणाम नहीं — अन्य शब्द आज़माएं' : 'No results — try different words'}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Subdivision Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {subdivisions.map((sub, i) => {
              const count = getBhajansBySubdivision(sub.id).length;
              return (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Link
                    to={`/bhajan/${sub.id}`}
                    className="block p-6 rounded-2xl border border-border/50 bg-card hover:border-gold/30 hover:bg-secondary transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">{sub.icon}</span>
                      <div>
                        <h3 className="text-xl font-heading text-foreground group-hover:text-gold transition-colors devanagari-safe">
                          {language === 'hi' ? sub.nameHi : sub.nameEn}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {language === 'hi' ? sub.descHi : sub.descEn}
                        </p>
                        <p className="text-xs text-gold/60 mt-1">
                          {count} {language === 'hi' ? 'भजन' : 'bhajans'}
                        </p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default BhajanLanding;
