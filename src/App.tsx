import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import { AudioPlayerProvider } from "@/contexts/AudioPlayerContext";
import ScrollToTop from "./components/ScrollToTop";
import ErrorBoundary from "./components/ErrorBoundary";
import FloatingAudioController from "./components/FloatingAudioController";

// Core routes directly imported for instant 0ms navigation without chunk load failures
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import BhajanLanding from "./pages/BhajanLanding";
import SubdivisionPage from "./pages/SubdivisionPage";
import BhajanPage from "./pages/BhajanPage";
import ShastraLanding from "./pages/ShastraLanding";
import ComingSoon from "./pages/ComingSoon";

// Lazy-loaded heavy reader for scriptures
const ShastraReader = lazy(() => import("./pages/ShastraReader"));

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-gold/20 border-t-gold rounded-full animate-spin" />
  </div>
);

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <BrowserRouter basename="/tatvaarth">
          <AudioPlayerProvider>
            <ScrollToTop />
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />

                <Route path="/bhajan" element={<BhajanLanding />} />
                <Route path="/bhajan/:subdivisionId" element={<SubdivisionPage />} />
                <Route path="/bhajan/:subdivisionId/:bhajanId" element={<BhajanPage />} />

                <Route path="/shastra" element={<ShastraLanding />} />
                <Route path="/shastra/:categorySlug" element={<ShastraLanding />} />
                <Route path="/shastra/:categorySlug/:shastraSlug" element={<ShastraReader />} />

                <Route path="/pooja" element={<ComingSoon title="पूजा | Pooja" />} />
                <Route path="/granth" element={<ShastraLanding />} />
                <Route path="/teeka" element={<ShastraLanding />} />
                <Route path="/paath" element={<ComingSoon title="पाठ | Paath" />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            <FloatingAudioController />
          </AudioPlayerProvider>
        </BrowserRouter>
      </AppProvider>
    </ErrorBoundary>
  );
}
