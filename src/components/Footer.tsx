import { useApp } from '@/contexts/AppContext';

const Footer = () => {
  const { t } = useApp();

  return (
    <footer className="border-t border-border/50 py-8 px-4 relative" style={{ zIndex: 1 }}>
      <div className="container mx-auto text-center">
        <div className="flex items-center justify-center gap-2 text-gold font-heading text-lg mb-2">
          <img src="/tatvaarth/favicon.ico" alt="Logo" className="w-6 h-6 object-contain" />
          <span>{t('siteName')}</span>
        </div>
        <p className="text-sm text-muted-foreground">{t('siteTagline')}</p>
      </div>
    </footer>
  );
};

export default Footer;
