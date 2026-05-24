import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { Music, BookOpen, Library, FileText, ScrollText } from 'lucide-react';

const categories = [
  { key: 'bhajan', path: '/bhajan', icon: Music, ready: true },
  { key: 'pooja', path: '/pooja', icon: BookOpen, ready: false },
  { key: 'granth', path: '/shastra', icon: Library, ready: true },
  { key: 'paath', path: '/paath', icon: ScrollText, ready: false },
] as const;

const CategoryBlocks = () => {
  const { t } = useApp();

  return (
    <section className="relative py-20 px-4" style={{ zIndex: 1 }}>
      <div className="container mx-auto max-w-5xl">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-heading text-center text-gradient-gold mb-12 devanagari-safe"
        >
          {t('categories')}
        </motion.h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {categories.map((cat, i) => {
            const Icon = cat.icon;
            const descKey = `${cat.key}Desc` as const;
            return (
              <motion.div
                key={cat.key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Link
                  to={cat.ready ? cat.path : '#'}
                  className={`block p-6 rounded-2xl border border-border/50 bg-card hover:bg-secondary transition-all group text-center relative overflow-visible ${
                    !cat.ready ? 'opacity-60' : ''
                  }`}
                >
                  {!cat.ready && (
                    <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-gold/20 text-gold">
                      {t('comingSoon')}
                    </span>
                  )}
                  <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gold/10 flex items-center justify-center group-hover:bg-gold/20 transition-colors">
                    <Icon className="w-7 h-7 text-gold" />
                  </div>
                  <h3 className="font-heading text-lg text-foreground mb-1 devanagari-safe">
                    {t(cat.key)}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed devanagari-safe">
                    {t(descKey as any)}
                  </p>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CategoryBlocks;
