<p align="center">
  <img src="src/assets/hero-1.jpg" alt="Tatvaarth — Jain Shastra Digital Library" width="100%" style="border-radius: 12px;" />
</p>

<h1 align="center">🙏 तत्त्वार्थ — Tatvaarth</h1>

<p align="center">
  <strong>जैन शास्त्र डिजिटल पुस्तकालय — Jain Shastra Digital Library</strong>
</p>

<p align="center">
  <em>भजन, पूजा, ग्रंथ, टीका और पाठ — सब एक स्थान पर</em><br/>
  <em>Bhajans, Pooja, Granth, Teeka & Paath — all in one place</em>
</p>

<p align="center">
  <a href="https://vatsalj2005.github.io/tatvaarth/">
    <img src="https://img.shields.io/badge/🌐_Live_Demo-Visit_Site-D4A853?style=for-the-badge" alt="Live Demo" />
  </a>
  &nbsp;
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
</p>

---

## 📖 About

**Tatvaarth** (तत्त्वार्थ) is a modern, open-source digital library dedicated to preserving and making accessible the sacred texts of Jainism. Built as a fast, offline-capable static web app, it provides a beautiful reading experience for devotional bhajans and philosophical scriptures — complete with multi-language support, smart search, transliteration, and PDF export.

### 🎯 Mission

To digitize, preserve, and freely distribute Jain spiritual literature in a modern, accessible, and beautifully designed digital format — ensuring these timeless teachings reach every seeker, everywhere.

---

## ✨ Features

### 📚 Content Library

| Section | Status | Description |
|---------|--------|-------------|
| **भजन (Bhajans)** | ✅ Live | 161 devotional bhajans across multiple categories |
| **ग्रंथ (Granth)** | ✅ Live | Complete Samaysar (समयसार) — 222 gathas with dual commentaries |
| **पूजा (Pooja)** | 🚧 Coming Soon | Pooja rituals and mantras |
| **पाठ (Paath)** | 🚧 Coming Soon | Daily recitations and prayers |

### 🔍 Smart Search Engine

A sophisticated **7-pass bilingual search engine** that understands:

- **Hindi text** — Direct matching on titles, lyrics, tags, and singer names
- **Hinglish** — Type `"mahavir"` to find `"महावीर"`, `"tumhare"` to find `"तुम्हारे"`
- **English moods** — Search `"devotion"` or `"peace"` to discover thematically relevant bhajans
- **Phonetic matching** — Tolerates typos and spelling variations
- **Vowel normalization** — `"tumhaare"` and `"tumhare"` both work
- **Semantic inference** — Maps English concepts to Hindi spiritual vocabulary

### 🎨 Theming & Customization

| Feature | Options |
|---------|---------|
| **Themes** | 🌑 Dark · 🌘 Soft Dark · ☀️ Light · 📜 Sepia |
| **Font Size** | 12px → 24px adjustable slider |
| **Line Spacing** | 1.2 → 3.0 adjustable slider |
| **Font Style** | Sans-serif / Serif (Noto Serif Devanagari) toggle |
| **Language** | हिंदी / English toggle |

All settings are **persisted to localStorage** and applied instantly.

### 📄 PDF Export

- **Bhajan PDF** — Downloads Hindi lyrics + auto-generated Roman transliteration with theme-matching colors
- **Scripture PDF** — Full book-style PDF with interactive Table of Contents, page-linked navigation, chapter headers, and all commentaries

### 🔤 Auto-Transliteration

- Real-time **Devanagari → Roman** script conversion for all bhajans
- Side-by-side view: Hindi lyrics alongside Roman transliteration
- Supports all Devanagari characters including conjuncts, matras, anusvara, and chandrabindu

### 📖 Scripture Reader (शास्त्र पाठक)

A feature-rich reader for deep scriptural study:

- **Sidebar navigation** with chapter hierarchy and gatha-level TOC
- **Auto-follow** — sidebar highlights the currently visible verse as you scroll
- **Multiple commentaries** — Tabbed interface for switching between commentators (e.g., Amritchandra Acharya & Jaysen Acharya)
- **Sanskrit toggle** — Show/hide original Sanskrit commentary text
- **Rich formatting** — Highlighted bracketed terms in Anvayarth, color-coded verse types, meter headers
- **Cover page** — Beautiful title page for each scripture
- **Responsive** — Full sidebar on desktop, overlay drawer on mobile

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | [React 18](https://react.dev/) + [TypeScript 5.8](https://www.typescriptlang.org/) |
| **Bundler** | [Vite 8](https://vitejs.dev/) with Rolldown |
| **Styling** | [Tailwind CSS 3.4](https://tailwindcss.com/) + custom HSL CSS variable system |
| **Animations** | [Framer Motion](https://www.framer.com/motion/) |
| **Routing** | [React Router v6](https://reactrouter.com/) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **PDF** | [jsPDF](https://github.com/parallax/jsPDF) + [html2canvas](https://html2canvas.hertzen.com/) |
| **Fonts** | Google Fonts (Noto Sans/Serif Devanagari, Playfair Display, Inter) |
| **Deployment** | [GitHub Pages](https://pages.github.com/) via GitHub Actions |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Static Content                       │
│                                                          │
│  Database/ (raw HTML)  ──► scripts/ ──► src/content/     │
│  (gitignored)              extract     bhajans/*.txt     │
│                            parse       granth/*.txt      │
│                                        + index.json      │
│                                        + manifest.json   │
└────────────────┬────────────────────────────────────────┘
                 │  import.meta.glob (build-time)
                 ▼
┌─────────────────────────────────────────────────────────┐
│                    Data Layer                             │
│                                                          │
│  content-loader.ts ──► BhajanData[]                      │
│  shastra-loader.ts ──► ShastraIndex, GathaContent         │
│  smart-search.ts   ──► SearchResult[] (7-pass engine)    │
│  transliterate.ts  ──► Hindi ↔ Roman conversion          │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│                   Application Layer                      │
│                                                          │
│  AppContext ──► Theme, Language, Font Settings            │
│  App.tsx    ──► React Router (8 routes)                   │
│  Pages     ──► Index, BhajanLanding, BhajanPage,         │
│                SubdivisionPage, ShastraLanding,           │
│                ShastraReader, ComingSoon, NotFound        │
│  Components──► Header, Footer, HeroSection,              │
│                CategoryBlocks, SettingsPanel,             │
│                ShastraPrintTemplate, ScrollToTop          │
└─────────────────────────────────────────────────────────┘
```

### Key Design Decisions

- **📦 Zero API calls** — All content is bundled at build time via Vite's `import.meta.glob`. The site works fully offline after the first load.
- **📂 Filesystem-as-database** — Content is organized as plain `.txt` files with a custom `=== Section ===` delimiter format, making it easy to add/edit content without any CMS.
- **🔎 Client-side search** — The 7-pass smart search runs entirely in the browser with a pre-computed index, delivering instant results.
- **🎨 Theme-first CSS** — All colors derive from HSL CSS custom properties, enabling seamless theme switching without JS-based style recalculation.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 20.x
- npm (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/vatsalj2005/tatvaarth.git
cd tatvaarth

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be running at **http://localhost:8080**

### Build for Production

```bash
npm run build
```

The optimized output will be in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

---

## 📁 Project Structure

```
tatvaarth/
├── .github/workflows/
│   └── deploy.yml                  # GitHub Actions CI/CD pipeline
├── public/
│   ├── fonts/                      # NotoSansDevanagari TTF (for PDF export)
│   ├── 404.html                    # SPA redirect for GitHub Pages
│   ├── favicon.ico
│   ├── robots.txt
│   └── sitemap.xml                 # SEO sitemap
├── scripts/
│   ├── extract.js                  # HTML → TXT converter for bhajans
│   └── parse-shastras.js           # HTML → TXT+JSON converter for shastras
├── src/
│   ├── assets/                     # Hero background images
│   ├── components/
│   │   ├── Header.tsx              # Fixed header with nav + language + settings
│   │   ├── HeroSection.tsx         # Landing hero with slideshow + search
│   │   ├── CategoryBlocks.tsx      # Category navigation cards
│   │   ├── Footer.tsx              # Site footer
│   │   ├── SettingsPanel.tsx       # Slide-out settings drawer
│   │   ├── ScrollToTop.tsx         # Auto-scroll on route change
│   │   └── ShastraPrintTemplate.tsx # Full scripture PDF renderer
│   ├── content/
│   │   ├── bhajans/dev/            # 161 bhajan text files
│   │   └── granth/                 # Scripture data (manifest + chapters)
│   ├── contexts/
│   │   └── AppContext.tsx          # Global state provider
│   ├── data/
│   │   ├── content-loader.ts      # Bhajan data loading + tag extraction
│   │   └── shastra-loader.ts      # Scripture data loading + parsing
│   ├── i18n/
│   │   └── translations.ts        # Hindi/English translation keys
│   ├── lib/
│   │   ├── smart-search.ts        # 7-pass bilingual search engine
│   │   ├── transliterate.ts       # Devanagari ↔ Roman transliteration
│   │   ├── pdf-generator.ts       # Bhajan PDF export
│   │   └── shastra-pdf-generator.ts # Scripture PDF export
│   ├── pages/
│   │   ├── Index.tsx               # Home page
│   │   ├── BhajanLanding.tsx       # Bhajan categories overview
│   │   ├── SubdivisionPage.tsx     # Bhajan list within a category
│   │   ├── BhajanPage.tsx          # Individual bhajan reader
│   │   ├── ShastraLanding.tsx      # Scripture catalog
│   │   ├── ShastraReader.tsx       # Full scripture reader
│   │   ├── ComingSoon.tsx          # Placeholder page
│   │   └── NotFound.tsx            # 404 page
│   ├── App.tsx                     # Root component with routing
│   ├── main.tsx                    # Application entry point
│   └── index.css                   # Global styles + theme definitions
├── tailwind.config.ts              # Extended Tailwind configuration
├── vite.config.ts                  # Vite configuration
├── tsconfig.json                   # TypeScript configuration
└── package.json
```

---

## 📝 Adding Content

### Adding a New Bhajan

1. Create a `.txt` file in `src/content/bhajans/<subdivision>/` (e.g., `dev/`, `guru/`, `bhakti/`, `shastra/`)
2. Name the file using the bhajan title in Devanagari or transliterated English with hyphens:
   ```
   src/content/bhajans/dev/महावीर-स्वामी.txt
   ```
3. Optionally add frontmatter for metadata:
   ```
   ---
   title: महावीर स्वामी
   singer: Artist Name
   ---
   जय जय महावीर प्रभु ॥
   तुम हो जगत के तारणहार ॥
   ...
   ```
4. If no frontmatter is provided, the title is auto-generated from the filename and tags are auto-extracted from lyrics.

### Adding a New Scripture

1. Place raw HTML source files in the `Database/shastra/` directory
2. Run the parsing script:
   ```bash
   node scripts/parse-shastras.js
   ```
3. Update `src/content/granth/manifest.json` with the new scripture entry
4. The `index.json` inside the scripture folder defines chapters and gatha ordering

---

## 🌐 Deployment

The project auto-deploys to GitHub Pages on every push to `main` via the GitHub Actions workflow in `.github/workflows/deploy.yml`.

### Manual Deployment

```bash
npm run build
# Deploy the contents of dist/ to any static hosting provider
```

### Configuration

- **Base path**: Set in `vite.config.ts` (`base: "/tatvaarth/"`) and `App.tsx` (`basename="/tatvaarth"`)
- **SPA routing**: The `public/404.html` handles client-side routing on GitHub Pages by redirecting all 404s back to `index.html` with the original path encoded as a query parameter

---

## 🔍 SEO

The project includes comprehensive SEO configuration:

- ✅ Open Graph meta tags (title, description, type, url)
- ✅ Twitter Card meta tags
- ✅ Google Site Verification
- ✅ Bing Webmaster Verification
- ✅ Canonical URL
- ✅ `robots.txt` — allows all crawlers
- ✅ `sitemap.xml` — comprehensive URL listing
- ✅ Semantic HTML with proper heading hierarchy
- ✅ Hindi language declaration (`lang="hi"`)

---

## 🤝 Contributing

Contributions are welcome! Here are some ways you can help:

- 📜 **Add more bhajans** — Simply add `.txt` files to the content directory
- 📚 **Digitize more scriptures** — Help parse and format more Jain texts
- 🌍 **Improve translations** — Enhance English translations or add new languages
- 🐛 **Report bugs** — Open an issue on GitHub
- 💡 **Suggest features** — Share ideas for improving the reading experience

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Commit: `git commit -m "Add my feature"`
5. Push: `git push origin feature/my-feature`
6. Open a Pull Request

---

## 📊 Content Statistics

| Metric | Count |
|--------|-------|
| Bhajan text files | 161 |
| Scripture gathas (Samaysar) | 222 |
| Commentary traditions | 2 (Amritchandra & Jaysen Acharya) |
| Translation keys | 80+ per language |
| Supported themes | 4 |
| Hero images | 4 |
| Total bundled content | ~2.5 MB |

---

## 📜 License

This project is open source and available for non-commercial, educational, and religious purposes. The scriptural content belongs to the Jain community and is shared freely for spiritual study.

---

<p align="center">
  <strong>॥ णमो अरिहंताणं ॥</strong><br/>
  <em>Salutations to the Arihantas</em>
</p>

<p align="center">
  Made with 🙏 and ❤️ for the Jain community
</p>
