import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { subdivisions, getBhajansBySubdivision } from '@/data/content-loader';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ScopedSearchBar from '@/components/ScopedSearchBar';

const BhajanLanding = () => {
  const { t, language } = useApp();

  const searchScope = useMemo(() => ({
    pathPrefix: '/bhajan',
    label: language === 'hi' ? 'भजन संग्रह' : 'Bhajans'
  }), [language]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="pt-24 pb-16 px-4">
        <div className="container mx-auto">
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

          {/* Scoped Search Bar */}
          <ScopedSearchBar
            scope={searchScope}
            placeholder={language === 'hi' ? 'भजन खोजें...' : 'Search bhajans...'}
          />

          {/* Subdivision Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
