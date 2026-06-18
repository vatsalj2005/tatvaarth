import { useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { getShastras } from '@/data/shastra-loader';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Search, X, BookOpen, User, ListCollapse, ChevronLeft } from 'lucide-react';
import { transliterateText } from '@/lib/transliterate';

const getShastraNumber = (path: string): number | null => {
  if (!path) return null;
  const parts = path.split('/');
  const folderName = parts[parts.length - 1];
  const match = folderName.match(/^(\d+)_/);
  return match ? parseInt(match[1], 10) : null;
};

const categoriesList = [
  { slug: 'dravyanuyog', nameHi: 'द्रव्यानुयोग', nameEn: 'Dravyanuyog', icon: '💎', descHi: 'जीव, अजीव और आत्म-कल्याण के सिद्धांतों का विवेचन।', descEn: 'Principles of soul, matter, and self-realization.' },
  { slug: 'charananuyog', nameHi: 'चरणानुयोग', nameEn: 'Charananuyog', icon: '🚶', descHi: 'गृहस्थ और मुनियों के सदाचार, व्रत और नियम।', descEn: 'Code of conduct, vows, and rules for householders and monks.' },
  { slug: 'karananuyog', nameHi: 'करणानुयोग', nameEn: 'Karananuyog', icon: '🌌', descHi: 'लोक की रचना, भूगोल और कर्मों के गणितीय सिद्धांत।', descEn: 'Cosmology, geography, and mathematical principles of Karma.' },
  { slug: 'prathmanuyog', nameHi: 'प्रथमानुयोग', nameEn: 'Prathmanuyog', icon: '👑', descHi: 'महापुरुषों के पावन चरित्र, कथाएं और इतिहास।', descEn: 'Sacred biographies, stories, and histories of great souls.' },
  { slug: 'nyay', nameHi: 'न्याय', nameEn: 'Nyay', icon: '⚖️', descHi: 'जैन दर्शन का तर्कशास्त्र, प्रमाण और ज्ञान-मीमांसा।', descEn: 'Jain logic, epistemology, and reasoning.' },
  { slug: 'itihas', nameHi: 'इतिहास', nameEn: 'Itihas', icon: '🏛️', descHi: 'जैन धर्म का ऐतिहासिक विकास, तीर्थ और पुरातत्त्व।', descEn: 'Historical development, pilgrimages, and archaeology.' },
  { slug: 'notes', nameHi: 'notes', nameEn: 'Notes', icon: '📝', descHi: 'स्वाध्याय के महत्वपूर्ण बिन्दु, नोट्स और संग्रह।', descEn: 'Key study notes, compilation, and reference materials.' }
];

const ShastraLanding = () => {
  const { t, language } = useApp();
  const navigate = useNavigate();
  const { categorySlug } = useParams<{ categorySlug?: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const shastras = getShastras();

  // Search filter
  const categoryShastras = useMemo(() => {
    if (!categorySlug) return [];
    return shastras.filter(s => s.categorySlug === categorySlug);
  }, [shastras, categorySlug]);

  // Search filter
  const filteredShastras = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    
    // Filter by category if categorySlug is present
    let list = shastras;
    if (categorySlug) {
      list = shastras.filter(s => s.categorySlug === categorySlug);
    }

    return list.filter(s => {
      const title = s.title.toLowerCase();
      const author = s.author.toLowerCase();
      const catHi = s.categoryHi.toLowerCase();
      const catEn = s.categoryEn.toLowerCase();
      
      const id = s.id.toLowerCase();
      const shastraSlug = s.shastraSlug.toLowerCase();
      const categorySlug = s.categorySlug.toLowerCase();
      
      const romanTitle = transliterateText(s.title).toLowerCase();
      const romanAuthor = transliterateText(s.author).toLowerCase();
      
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
        if (textLower.includes(query)) return true;
        if (normalizeVowel(textLower).includes(normQueryVowel)) return true;
        if (normQueryPhonetic.length >= 2 && normalizePhonetic(textLower).includes(normQueryPhonetic)) return true;
        return false;
      };

      return (
        title.includes(query) ||
        author.includes(query) ||
        catHi.includes(query) ||
        catEn.includes(query) ||
        matchText(id) ||
        matchText(shastraSlug) ||
        matchText(categorySlug) ||
        matchText(romanTitle) ||
        matchText(romanAuthor)
      );
    });
  }, [searchQuery, shastras, categorySlug]);

  // Group by category (only needed if categorySlug is not set, or we can use it to structure the page)
  const groupedShastras = useMemo(() => {
    const groups: Record<string, typeof shastras> = {};
    filteredShastras.forEach(s => {
      const key = s.categorySlug;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return groups;
  }, [filteredShastras]);

  // Get category details
  const currentCategory = useMemo(() => {
    if (!categorySlug) return null;
    return categoriesList.find(c => c.slug === categorySlug) || {
      slug: categorySlug,
      nameHi: categorySlug,
      nameEn: categorySlug,
      icon: '📚',
      descHi: '',
      descEn: ''
    };
  }, [categorySlug]);

  const showDropdown = isFocused && searchQuery.trim() && filteredShastras.length > 0;
  const showNoResults = isFocused && searchQuery.trim() && filteredShastras.length === 0;

  // Let's render the list of all categories if categorySlug is undefined
  if (!categorySlug) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="pt-28 pb-16 px-4 flex-1">
          <div className="container mx-auto max-w-4xl">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-12"
            >
              <h1 className="text-4xl md:text-5xl font-heading text-gradient-gold mb-3 devanagari-safe">
                {t('granth')}
              </h1>
              <p className="text-muted-foreground mb-8">
                {language === 'hi' 
                  ? 'जैन अनुयोगों एवं ग्रन्थों का पावन संग्रह' 
                  : 'Sacred collection of Jain Anuyogas and scriptures'}
              </p>
            </motion.div>

            {/* Search bar */}
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
                  placeholder={language === 'hi' ? 'ग्रन्थ या लेखक खोजें...' : 'Search scriptures or authors...'}
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
                    {filteredShastras.length > 0 ? (
                      filteredShastras.map(s => (
                        <button
                          key={s.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            navigate(`/shastra/${s.categorySlug}/${s.shastraSlug}`);
                            setSearchQuery('');
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-secondary/80 transition-colors text-sm flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Search className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                            <span className="text-foreground/90 truncate devanagari-safe">{s.title}</span>
                          </div>
                          <span className="text-xs text-muted-foreground/60 flex-shrink-0 devanagari-safe">
                            📚 {s.author} ({s.categoryHi})
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

            {/* Categories Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {categoriesList.map((cat, index) => {
                // Find if there are any migrated shastras in this category
                const migratedCount = shastras.filter(s => s.categorySlug === cat.slug).length;

                return (
                  <motion.div
                    key={cat.slug}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      to={`/shastra/${cat.slug}`}
                      className="p-6 rounded-2xl border border-border/50 bg-card hover:border-gold/30 hover:bg-secondary/50 transition-all group block relative overflow-hidden h-full"
                    >
                      <div className="absolute top-0 right-0 w-20 h-20 bg-gold/5 rounded-bl-full flex items-center justify-center translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                        <span className="text-2xl -translate-x-1.5 translate-y-1.5 opacity-60 group-hover:opacity-90 transition-opacity">
                          {cat.icon}
                        </span>
                      </div>
                      
                      <h3 className="text-2xl font-heading text-foreground group-hover:text-gold transition-colors devanagari-safe mb-2">
                        {language === 'hi' ? cat.nameHi : cat.nameEn}
                      </h3>
                      
                      <p className="text-sm text-muted-foreground devanagari-safe leading-relaxed mb-4 pr-6">
                        {language === 'hi' ? cat.descHi : cat.descEn}
                      </p>

                      <div className="flex items-center gap-1 text-xs text-gold/80 font-medium">
                        {migratedCount > 0 ? (
                          <span>📚 {migratedCount} {t('granth')}</span>
                        ) : (
                          <span className="text-muted-foreground/60">{t('comingSoon')}</span>
                        )}
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
  }

  // If categorySlug is defined, render the list of Shastras in that category
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="pt-28 pb-16 px-4 flex-1">
        <div className="container mx-auto max-w-4xl">
          {/* Back to categories button */}
          <Link
            to="/shastra"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-gold transition-colors mb-6"
          >
            <ChevronLeft className="w-4 h-4" />
            {language === 'hi' ? 'सभी अनुयोग' : 'All Anuyogas'}
          </Link>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-left mb-10 border-b border-border/40 pb-6 flex items-start gap-4"
          >
            <span className="text-4xl">{currentCategory.icon}</span>
            <div>
              <h1 className="text-3xl md:text-4xl font-heading text-gradient-gold mb-2 devanagari-safe">
                {language === 'hi' ? currentCategory.nameHi : currentCategory.nameEn}
              </h1>
              <p className="text-sm text-muted-foreground devanagari-safe leading-relaxed">
                {language === 'hi' ? currentCategory.descHi : currentCategory.descEn}
              </p>
            </div>
          </motion.div>

          {/* Search bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-10 max-w-xl relative"
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
                placeholder={language === 'hi' ? 'ग्रन्थ या लेखक खोजें...' : 'Search scriptures or authors...'}
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
                  {filteredShastras.length > 0 ? (
                    filteredShastras.map(s => (
                      <button
                        key={s.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          navigate(`/shastra/${s.categorySlug}/${s.shastraSlug}`);
                          setSearchQuery('');
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-secondary/80 transition-colors text-sm flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Search className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                          <span className="text-foreground/90 truncate devanagari-safe">{s.title}</span>
                        </div>
                        <span className="text-xs text-muted-foreground/60 flex-shrink-0 devanagari-safe">
                          📚 {s.author} ({s.categoryHi})
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

          {/* Shastras Grid */}
          <div className="space-y-6">
            {categoryShastras.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoryShastras.map(s => (
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

                    {/* Shastra Index Number */}
                    {(() => {
                      const num = getShastraNumber(s.path);
                      if (num === null) return null;
                      return (
                        <div className="absolute bottom-4 right-4 text-3xl font-heading font-black text-gold/20 group-hover:text-gold/45 transition-colors pointer-events-none">
                          #{num}
                        </div>
                      );
                    })()}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-card border border-dashed border-border rounded-2xl">
                <p className="text-muted-foreground">
                  {language === 'hi' 
                    ? 'इस अनुयोग में वर्तमान में कोई ग्रन्थ उपलब्ध नहीं है।' 
                    : 'No scriptures are currently available in this Anuyoga.'}
                </p>
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
