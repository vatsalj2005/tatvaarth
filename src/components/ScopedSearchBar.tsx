import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { scopedSiteSearch, ScopedSearchOptions } from '@/lib/smart-search';
import { Search, X } from 'lucide-react';

interface ScopedSearchBarProps {
  scope: ScopedSearchOptions['scope'];
  placeholder?: string;
  className?: string;
  limit?: number;
}

export const ScopedSearchBar = ({
  scope,
  placeholder,
  className = 'mb-10 max-w-xl mx-auto relative',
  limit = 10,
}: ScopedSearchBarProps) => {
  const { language } = useApp();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const searchResponse = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return scopedSiteSearch(searchQuery, { limit, scope });
  }, [searchQuery, scope, limit]);

  const searchResults = searchResponse?.results ?? [];
  const hasQuery = searchQuery.trim().length > 0;
  const showDropdown = isFocused && hasQuery && searchResults.length > 0;
  const showNoResults = isFocused && hasQuery && searchResults.length === 0;

  const defaultPlaceholder = language === 'hi' ? 'खोजें...' : 'Search...';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className={className}
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
          placeholder={placeholder || defaultPlaceholder}
          className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/60 outline-none text-sm devanagari-safe"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="p-1 rounded-lg hover:bg-secondary transition-colors"
            title="Clear search"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {(showDropdown || showNoResults) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute left-0 right-0 z-30 bg-card border border-gold/50 border-t-0 rounded-b-xl shadow-lg shadow-gold/5 overflow-hidden max-h-[380px] overflow-y-auto scrollbar-thin"
          >
            {/* Fallback Banner if zero matches in scope */}
            {searchResponse?.isFallback && (
              <div className="px-4 py-2 bg-gold/10 border-b border-border/30 text-xs text-gold flex items-center justify-between devanagari-safe">
                <span className="flex items-center gap-1.5 font-medium">
                  <span>🌐</span>
                  <span>
                    {language === 'hi'
                      ? `"${searchResponse.scopeLabel}" में कोई परिणाम नहीं • संपूर्ण वेबसाइट से परिणाम:`
                      : `No matches in "${searchResponse.scopeLabel}" • Showing results from entire website:`}
                  </span>
                </span>
              </div>
            )}

            <div className="border-t border-border/30" />
            {searchResults.length > 0 ? (
              searchResults.map(s => (
                <button
                  key={s.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    navigate(s.url);
                    setSearchQuery('');
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
                        <span className="text-foreground/90 font-medium truncate devanagari-safe">{s.title}</span>
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
  );
};

export default ScopedSearchBar;
