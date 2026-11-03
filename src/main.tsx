import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Automatically recover from stale chunk 404s after new builds or deployments
window.addEventListener('vite:preload-error', (event) => {
  console.warn('Vite dynamic chunk load failed, auto-reloading page...', event);
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
