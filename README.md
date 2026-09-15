# 🕉️ तत्त्वार्थ (Tatvaarth) — Jain Digital Library

> A high-performance, offline-first digital library and reader for Jain Scriptures (*Shastras*), Commentaries (*Teekas*), and Devotional Hymns (*Bhajans*).

<p align="center">
  <img src="./src/assets/hero-1.jpg" alt="Tatvaarth Banner" width="92%" style="border-radius: 12px;" />
</p>

<p align="center">
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-18-blue.svg" alt="Built with React" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.8-blue.svg" alt="TypeScript" /></a>
  <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-8-646CFF.svg" alt="Vite" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg" alt="Tailwind CSS" /></a>
  <a href="#-acknowledgments--license"><img src="https://img.shields.io/badge/License-Educational%20%2F%20Non--Commercial-amber.svg" alt="License" /></a>
</p>

---

## 🌟 Highlights

- **📖 Interactive Scripture Reader**: Original Prakrit verses, Sanskrit *Chhaya*, Hindi poetic translations (*Gadya*), word-by-word meanings (*Anvayarth*), and comprehensive Acharya commentaries (*Teekas*).
- **📑 Multi-Commentary Tabs**: Seamlessly switch between commentators (e.g., *Acharya Amritchandra*, *Acharya Jayasena*) with optional toggleable original Sanskrit commentary.
- **🧭 Auto-Follow Table of Contents**: Sidebar highlights the current verse using `IntersectionObserver` and smoothly centers the active chapter.
- **📊 Dynamic Commentary Tables & Diagrams**: Renders embedded comparison tables with active verse highlighting, as well as tree-based conceptual mindmaps.
- **🎵 Devotional Bhajans**: Categorized bhajan collection with real-time Roman transliteration, lyric copying, and formatted export.
- **🔍 5-Tier Smart Search**: Intelligent search supporting Hinglish phonetics, typo tolerance (Levenshtein), category scoping, and automatic site-wide fallback.
- **🎨 Reading Customization**: Four curated reading themes (*Dark*, *Soft Dark*, *Light*, *Sepia*), adjustable font sizes, line spacing, and Serif/Sans-serif typography.
- **🖨️ PDF Generation**: High-fidelity, client-side PDF export for both individual bhajans and entire scriptures with embedded Devanagari fonts.
- **⚡ Static & Serverless**: Bundled with Vite for instant loading, zero database latency, and automated deployment to GitHub Pages.

---

## 📂 Project Architecture

```text
Tatvaarth/
├── src/
│   ├── assets/             # Media and heritage illustrations
│   ├── components/         # Shared UI: Header, Footer, Hero, Settings, Reader components
│   ├── content/
│   │   ├── granth/         # Parsed scriptures and chapter manifests
│   │   └── bhajans/        # Formatted devotional hymn texts
│   ├── contexts/           # AppState (Theme, Font Size, Line Spacing, Language)
│   ├── data/               # Vite import.meta.glob eager & on-demand loaders
│   ├── i18n/               # Hindi & English localized dictionaries
│   ├── lib/                # Smart search engine, transliterator, PDF compiler, text parsers
│   └── pages/              # Application routes (Home, Reader, Bhajan directories)
├── scripts/
│   ├── parse-shastras.js   # Parser for raw scripture databases
│   ├── extract.js          # Formatter for raw bhajan files
│   └── update-sitemap.cjs  # Sitemap URL synchronizer
├── public/                 # Favicon, fonts, sitemap.xml, robots.txt, 404 fallback
└── Database/               # Source databases (raw scriptures and commentaries)
```

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- `npm` (bundled with Node.js)

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/vatsalj2005/tatvaarth.git
cd tatvaarth
npm install
```

### 2. Development Server
Start the local development server:
```bash
npm run dev
```
Open [http://localhost:8080/tatvaarth/](http://localhost:8080/tatvaarth/) in your browser.

### 3. Production Build
Compile and bundle static assets for production:
```bash
npm run build
```
The optimized output will be generated inside the `dist/` directory.

---

## 🛠️ Data Pipeline & Migration

If you modify or add raw content in the `Database/` or `New_bhajans/` folders:

```bash
# Ingest and parse raw scriptures into structured text and manifests
node scripts/parse-shastras.js

# Format raw hymns into standardized bhajan entries
node scripts/extract.js

# Update sitemap with romanized URLs
node scripts/update-sitemap.cjs
```

---

## 📜 Available Scriptures

Currently migrated scriptures under **द्रव्यानुयोग (Dravyanuyog)**:

1. **समयसार** (*Samayasara*) — कुन्दकुन्दाचार्य
2. **प्रवचनसार** (*Pravachanasara*) — कुन्दकुन्दाचार्य
3. **पञ्चास्तिकाय** (*Panchastikaya*) — कुन्दकुन्दाचार्य
4. **द्रव्यसंग्रह** (*Dravyasangraha*) — नेमिचंद्र सिद्धांतचक्रवर्ती
5. **समाधितन्त्र** (*Samadhitantra*) — आचार्य पूज्यपाद
6. **स्वरूप-संबोधन** (*Swaroop Sambodhan*) — अकलंक देव
7. **इष्टोपदेश** (*Ishtopadesh*) — आचार्य पूज्यपाद
8. **परमात्मप्रकाश** (*Paramatmaprakash*) — योगींदुदेव
9. **योगसार-प्राभृत** (*Yogasar Prabhrit*) — अमितगति आचार्य
10. **तत्त्वार्थसूत्र** (*Tatvaarthasutra*) — आचार्य उमास्वामी
11. **योगसार** (*Yogasar*) — योगींदुदेव
12. **पंचाध्यायी** (*Panchadhyayi*) — पं. राजमलजी
13. **पाहुड-दोहा** (*Pahud-Doha*) — राम-सिंह-मुनि
14. **परम-अध्यात्म-तरंगिणी** (*Param Adhyatma Tarangini*) — अमृतचंद्राचार्य

---

## 🙏 Acknowledgments & License

This project is created for religious study, spiritual contemplation, and educational reference. All original scriptures, verses, and translations belong to their respective revered Acharyas, scholars, and trust publications.

Special gratitude to the scholarly contributions of:
- **पंडित जयचंदजी छाबड़ा**
- **आचार्य ज्ञानसागर**
- **क्षुल्लक मनोहर वर्णी**
- **डॉ. हुकमचंद भारिल्ल**
- **आर्यिका ज्ञानमती माताजी**
- **प्रो. पारसमल अग्रवाल**
- **श्री विजय कुमार जैन**
