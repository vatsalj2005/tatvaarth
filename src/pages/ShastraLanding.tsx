import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { getShastras } from '@/data/shastra-loader';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Search, X, BookOpen, User, ListCollapse } from 'lucide-react';

const ShastraLanding = () => {
  const { t, language } = useApp();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const shastras = getShastras();

  // Search filter
  const filteredShastras = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return shastras;

    return shastras.filter(s => {
      const title = s.title.toLowerCase();
      const author = s.author.toLowerCase();
      const catHi = s.categoryHi.toLowerCase();
      const catEn = s.categoryEn.toLowerCase();
      return title.includes(query) || author.includes(query) || catHi.includes(query) || catEn.includes(query);
    });
  }, [searchQuery, shastras]);

  // Group by category
  const groupedShastras = useMemo(() => {
    const groups: Record<string, typeof shastras> = {};
    filteredShastras.forEach(s => {
      const key = s.categorySlug;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return groups;
  }, [filteredShastras]);

  // Get category titles
  const getCategoryTitle = (slug: string) => {
    const item = shastras.find(s => s.categorySlug === slug);
    if (!item) return slug;
    return language === 'hi' ? item.categoryHi : item.categoryEn;
  };

  const showNoResults = searchQuery.trim() && filteredShastras.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-heading text-gradient-gold mb-3 devanagari-safe">
              {t('shastra')}
            </h1>
            <p className="text-muted-foreground">{language === 'hi' ? 'जैन ग्रंथ एवं टीकाओं का पावन संग्रह' : 'Sacred collection of Jain scriptures and commentaries'}</p>
          </motion.div>

          {/* Search bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-10 max-w-xl mx-auto relative"
          >
            <div
              className={`relative flex items-center gap-3 px-4 py-3 border transition-all duration-300 rounded-xl ${
                isFocused ? 'border-gold/50 bg-card shadow-lg shadow-gold/5' : 'border-border/50 bg-card hover:border-border'
              }`}
            >
              <Search className={`w-5 h-5 flex-shrink-0 transition-colors duration-300 ${isFocused ? 'text-gold' : 'text-muted-foreground'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                placeholder={language === 'hi' ? 'शास्त्र, लेखक या अधिकार खोजें...' : 'Search scriptures, authors, chapters...'}
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
          </motion.div>

          {/* List grouped by category */}
          <div className="space-y-12">
            {Object.keys(groupedShastras).map((catSlug, index) => {
              const list = groupedShastras[catSlug];
              return (
                <motion.div
                  key={catSlug}
                  initial={{ opacity: 0, y: 25 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <h2 className="text-xl md:text-2xl font-heading text-gradient-gold border-b border-border/40 pb-2 mb-6 devanagari-safe">
                    📚 {getCategoryTitle(catSlug)}
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {list.map(s => (
                      <Link
                        key={s.id}
                        to={`/shastra/${s.categorySlug}/${s.shastraSlug}`}
                        className="p-6 rounded-2xl border border-border/50 bg-card hover:border-gold/30 hover:bg-secondary/50 transition-all group relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gold/5 rounded-bl-full flex items-center justify-center translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                          <BookOpen className="w-6 h-6 text-gold/30 -translate-x-2 translate-y-2" />
                        </div>
                        
                        <h3 className="text-xl font-heading text-foreground group-hover:text-gold transition-colors devanagari-safe pr-8">
                          {s.title}
                        </h3>
                        
                        <div className="flex flex-col gap-1.5 mt-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5 devanagari-safe">
                            <User className="w-4 h-4 text-gold/50 flex-shrink-0" />
                            {t('author')}: {s.author}
                          </span>
                          <span className="flex items-center gap-1.5 devanagari-safe">
                            <ListCollapse className="w-4 h-4 text-gold/50 flex-shrink-0" />
                            {t('gathas')}: {s.gathaCount}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </motion.div>
              );
            })}

            {showNoResults && (
              <div className="text-center py-12 bg-card border border-dashed border-border rounded-2xl">
                <p className="text-muted-foreground">{t('noResults')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ShastraLanding;
