import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { subdivisions, getBhajansBySubdivision } from '@/data/content-loader';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ScopedSearchBar from '@/components/ScopedSearchBar';
import { ArrowLeft, Music } from 'lucide-react';

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
      <div className="pt-24 pb-16 px-4">
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

          {/* Responsive Multi-column Bhajan List (pure CSS newspaper columns) */}
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 [column-fill:_balance]">
            {bhajanList.map((bhajan, idx) => (
              <motion.div
                key={bhajan.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.015, 0.4) }}
                className="break-inside-avoid mb-3"
              >
                <Link
                  to={`/bhajan/${bhajan.subdivision}/${bhajan.slug}`}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card hover:border-gold/30 hover:bg-secondary transition-all group"
                >
                  <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
                    <Music className="w-5 h-5 text-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground group-hover:text-gold transition-colors truncate devanagari-safe">
                      {bhajan.title}
                    </h3>
                    {bhajan.singer && (
                      <p className="text-xs text-gold/70 mt-0.5">🎤 {bhajan.singer}</p>
                    )}
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
