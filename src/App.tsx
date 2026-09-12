import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import ScrollToTop from "./components/ScrollToTop";

// Lazy-loaded route components for optimal initial bundle size
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const BhajanLanding = lazy(() => import("./pages/BhajanLanding"));
const SubdivisionPage = lazy(() => import("./pages/SubdivisionPage"));
const BhajanPage = lazy(() => import("./pages/BhajanPage"));
const ShastraLanding = lazy(() => import("./pages/ShastraLanding"));
const ShastraReader = lazy(() => import("./pages/ShastraReader"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-gold/20 border-t-gold rounded-full animate-spin" />
  </div>
);

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter basename="/tatvaarth">
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
      </BrowserRouter>
    </AppProvider>
  );
}
