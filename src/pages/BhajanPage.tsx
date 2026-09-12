import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { getBhajanById, getRelatedBhajans, subdivisions } from '@/data/content-loader';
import { transliterateText } from '@/lib/transliterate';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Play, Copy, Check, VolumeX, Download, Music, Type } from 'lucide-react';

const BhajanPage = () => {
  const { subdivisionId, bhajanId } = useParams<{ subdivisionId: string; bhajanId: string }>();
  const { t, language, fontSize, lineSpacing, useSerif, theme } = useApp();
  const [showRoman, setShowRoman] = useState(false);
  const [copied, setCopied] = useState(false);

  const bhajan = getBhajanById(subdivisionId || '', bhajanId || '');
  if (!bhajan) return null;

  const subdivision = subdivisions.find(s => s.id === bhajan.subdivision);
  const related = getRelatedBhajans(bhajan, 4);
  
  // Generate romanized text only when roman script is toggled on
  const romanizedLyrics = useMemo(() => {
    return showRoman ? transliterateText(bhajan.lyrics) : '';
  }, [showRoman, bhajan.lyrics]);

  const handleCopy = () => {
    navigator.clipboard.writeText(bhajan.lyrics);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePdfDownload = async () => {
    const { generateBhajanPdf } = await import('@/lib/pdf-generator');
    await generateBhajanPdf({
      title: bhajan.title,
      slug: bhajan.slug,
      singer: bhajan.singer,
      lyrics: bhajan.lyrics,
      theme,
    });
  };

  const readingClass = useSerif ? 'font-reading' : '';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-5xl">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6 flex-wrap devanagari-safe">
            <Link to="/bhajan" className="hover:text-gold transition-colors">{t('bhajan')}</Link>
            <span>/</span>
            {subdivision && (
              <>
                <Link to={`/bhajan/${subdivision.id}`} className="hover:text-gold transition-colors">
                  {language === 'hi' ? subdivision.nameHi : subdivision.nameEn}
                </Link>
                <span>/</span>
              </>
            )}
            <span className="text-foreground/80">{bhajan.title}</span>
          </div>

          {/* Title Section - Centered */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 text-center"
          >
            <h1 className="text-3xl md:text-4xl font-heading text-gradient-gold mb-3 devanagari-safe">
              {bhajan.title}
            </h1>
            {bhajan.singer && (
              <p className="text-sm text-gold/80">🎤 {t('singer')}: {bhajan.singer}</p>
            )}
          </motion.div>

          {/* Audio + Controls */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap gap-3 mb-8 justify-center"
          >
            {bhajan.audioUrl ? (
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold text-primary-foreground font-medium hover:opacity-90 transition-opacity">
                <Play className="w-4 h-4" /> {language === 'hi' ? 'सुनें' : 'Listen'}
              </button>
            ) : (
              <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary text-muted-foreground">
                <VolumeX className="w-4 h-4" />
                <span className="text-sm">{t('audioUnavailable')}</span>
              </div>
            )}

            {/* Roman Script toggle */}
            <button
              onClick={() => setShowRoman(!showRoman)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
                showRoman
                  ? 'bg-gold text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-gold/20'
              }`}
            >
              <Type className="w-4 h-4" />
              {showRoman ? t('hideRomanScript') : t('romanScript')}
            </button>

            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-gold/20 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-gold" /> : <Copy className="w-4 h-4" />}
              <span className="text-sm">{copied ? t('copied') : t('copyVerse')}</span>
            </button>

            <button
              onClick={handlePdfDownload}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-gold/20 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm">{t('downloadPdf')}</span>
            </button>
          </motion.div>

          {/* Lyrics */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className={`grid gap-6 ${showRoman ? 'md:grid-cols-2' : 'grid-cols-1'}`}
          >
            {/* Hindi lyrics */}
            <div className={`p-6 md:p-8 rounded-2xl bg-card border border-border/50 ${!showRoman ? 'max-w-[700px] mx-auto w-full' : ''}`}>
              <h3 className="text-sm font-medium text-gold mb-4 uppercase tracking-wider">{t('lyrics')}</h3>
              <div
                className={`whitespace-pre-line text-foreground/90 devanagari-safe ${readingClass}`}
                style={{ fontSize: `${fontSize}px`, lineHeight: lineSpacing }}
              >
                {bhajan.lyrics}
              </div>
            </div>

            {/* Roman transliteration - Auto-generated */}
            {showRoman && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-6 md:p-8 rounded-2xl bg-card border border-gold/20"
              >
                <h3 className="text-sm font-medium text-gold mb-4 uppercase tracking-wider">{t('transliteration')}</h3>
                <div
                  className="whitespace-pre-line text-foreground/80"
                  style={{ fontSize: `${Math.max(fontSize - 1, 12)}px`, lineHeight: lineSpacing }}
                >
                  {romanizedLyrics}
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Related Bhajans */}
          {related.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-16"
            >
              <h2 className="text-xl font-heading text-gradient-gold mb-6 devanagari-safe">
                {t('relatedBhajans')}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {related.map(r => (
                  <Link
                    key={r.id}
                    to={`/bhajan/${r.subdivision}/${r.slug}`}
                    className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card hover:border-gold/30 hover:bg-secondary transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
                      <Music className="w-5 h-5 text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground group-hover:text-gold transition-colors truncate devanagari-safe">
                        {r.title}
                      </h3>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default BhajanPage;
