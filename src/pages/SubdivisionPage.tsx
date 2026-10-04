import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { subdivisions, getBhajansBySubdivision } from '@/data/content-loader';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ScopedSearchBar from '@/components/ScopedSearchBar';
import { ArrowLeft } from 'lucide-react';

const SubdivisionPage = () => {
  const { subdivisionId } = useParams<{ subdivisionId: string }>();
  const { language } = useApp();

  const subdivision = subdivisions.find(s => s.id === subdivisionId);
  const bhajanList = useMemo(() => getBhajansBySubdivision(subdivisionId || ''), [subdivisionId]);

  const searchScope = useMemo(() => ({
    subdivisionId,
    pathPrefix: `/bhajan/${subdivisionId}`,
    label: subdivision ? (language === 'hi' ? subdivision.nameHi : subdivision.nameEn) : subdivisionId
  }), [subdivisionId, subdivision, language]);

  if (!subdivision) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="pt-24 pb-16 px-2.5 sm:px-4">
        <div className="container mx-auto">
          <Link
            to="/bhajan"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-gold transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            {language === 'hi' ? 'भजन' : 'Bhajans'}
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl md:text-4xl font-heading mb-2 devanagari-safe flex items-center gap-3">
              <span className="flex-shrink-0">{subdivision.icon}</span>
              <span className="text-gradient-gold">
                {language === 'hi' ? subdivision.nameHi : subdivision.nameEn}
              </span>
            </h1>
            <p className="text-muted-foreground">
              {language === 'hi' ? subdivision.descHi : subdivision.descEn}
            </p>
          </motion.div>

          {/* Scoped Search Bar */}
          <ScopedSearchBar
            scope={searchScope}
            placeholder={language === 'hi' ? 'भजन खोजें...' : 'Search bhajans...'}
            className="mb-8 max-w-xl relative"
          />

          {/* Responsive 2-column on mobile, 3 on md, 4 on lg */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {bhajanList.map((bhajan, idx) => (
              <motion.div
                key={bhajan.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.015, 0.4) }}
              >
                <Link
                  to={`/bhajan/${bhajan.subdivision}/${bhajan.slug}`}
                  className="relative flex flex-col justify-between p-2.5 sm:p-4 rounded-xl border border-border/50 bg-card hover:border-gold/30 hover:bg-secondary transition-all group overflow-hidden min-h-[64px] sm:min-h-[76px] h-full"
                >
                  <div className="flex-1 min-w-0 pr-4 sm:pr-6">
                    <h3 className="font-medium text-sm sm:text-base text-foreground group-hover:text-gold transition-colors line-clamp-2 devanagari-safe leading-snug">
                      {bhajan.title}
                    </h3>
                    {bhajan.singer && (
                      <p className="text-[11px] sm:text-xs text-gold/70 mt-1 truncate">🎤 {bhajan.singer}</p>
                    )}
                  </div>
                  <div className="absolute bottom-1 right-2 sm:bottom-2 sm:right-3 text-sm sm:text-xl font-heading font-black text-gold/20 group-hover:text-gold/45 transition-colors pointer-events-none select-none">
                    #{idx + 1}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {bhajanList.length === 0 && (
            <p className="text-center text-muted-foreground py-12">
              {language === 'hi' ? 'इस श्रेणी में अभी कोई भजन नहीं है' : 'No bhajans in this category yet'}
            </p>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default SubdivisionPage;
