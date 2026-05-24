import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import BhajanLanding from "./pages/BhajanLanding";
import SubdivisionPage from "./pages/SubdivisionPage";
import BhajanPage from "./pages/BhajanPage";
import ShastraLanding from "./pages/ShastraLanding";
import ShastraReader from "./pages/ShastraReader";
import ComingSoon from "./pages/ComingSoon";
import ScrollToTop from "./components/ScrollToTop";

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter basename="/tatva-ka-arth">
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Index />} />

          <Route path="/bhajan" element={<BhajanLanding />} />
          <Route path="/bhajan/:subdivisionId" element={<SubdivisionPage />} />
          <Route path="/bhajan/:subdivisionId/:bhajanId" element={<BhajanPage />} />

          <Route path="/shastra" element={<ShastraLanding />} />
          <Route path="/shastra/:categorySlug/:shastraSlug" element={<ShastraReader />} />

          <Route path="/pooja" element={<ComingSoon title="पूजा | Pooja" />} />
          <Route path="/granth" element={<ShastraLanding />} />
          <Route path="/teeka" element={<ShastraLanding />} />
          <Route path="/paath" element={<ComingSoon title="पाठ | Paath" />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
