import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Settings, Globe } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { motion, AnimatePresence } from 'framer-motion';
import SettingsPanel from './SettingsPanel';

const Header = () => {
  const { t, language, setLanguage } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img 
              src="/tatvaarth/favicon.ico" 
              alt="Tatvaarth" 
              className="w-8 h-8 object-contain"
            />
            <span className="text-xl font-heading text-gold font-semibold tracking-wide">
              {t('siteName')}
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-sm text-foreground/80 hover:text-gold transition-colors">{t('home')}</Link>
            <Link to="/bhajan" className="text-sm text-foreground/80 hover:text-gold transition-colors">{t('bhajan')}</Link>
            <Link to="/pooja" className="text-sm text-foreground/80 hover:text-gold transition-colors">{t('pooja')}</Link>
            <Link to="/granth" className="text-sm text-foreground/80 hover:text-gold transition-colors">{t('granth')}</Link>
            <Link to="/paath" className="text-sm text-foreground/80 hover:text-gold transition-colors">{t('paath')}</Link>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLanguage(language === 'hi' ? 'en' : 'hi')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-gold hover:text-primary-foreground transition-colors"
            >
              <Globe className="w-4 h-4" />
              {language === 'hi' ? 'EN' : 'हि'}
            </button>

            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-gold hover:text-primary-foreground transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-lg bg-secondary text-secondary-foreground"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden border-t border-border/50 bg-background/95 backdrop-blur-xl"
            >
              <div className="container mx-auto px-4 py-4 flex flex-col gap-3">
                {['/', '/bhajan', '/pooja', '/granth', '/paath'].map((path, i) => {
                  const keys = ['home', 'bhajan', 'pooja', 'granth', 'paath'] as const;
                  return (
                    <Link
                      key={path}
                      to={path}
                      onClick={() => setMenuOpen(false)}
                      className="text-foreground/80 hover:text-gold py-2 transition-colors"
                    >
                      {t(keys[i])}
                    </Link>
                  );
                })}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
};

export default Header;
