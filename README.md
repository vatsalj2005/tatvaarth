# 🕉️ तत्त्वार्थ (Tatvaarth) — Jain Digital Library

> A high-performance, premium, offline-first digital library and reader for Jain Scriptures (Shastras), Commentaries (Teekas), and Devotional Bhajans.

![Tatvaarth Banner](./src/assets/hero-1.jpg)

---

## ✨ Core Features

### 📖 Interactive Scripture (Shastra) Reader
- **IntersectionObserver Navigation**: The sidebar table of contents automatically highlights the active verse as you scroll.
- **Auto-Follow Sidebar**: The sidebar smoothly scrolls to keep the currently active verse centered in view.
- **Multi-Commentary Support**: Switch between multiple commentators (such as *अमृतचंद्राचार्य* and *जयसेनाचार्य*) instantly using tabs.
- **Toggleable Sanskrit Text**: View original Sanskrit commentaries side-by-side with Hindi translations, or hide them for a cleaner reading experience.
- **Dynamic Commentary Tables**: Parses Markdown-style tables inside raw commentaries and renders them as beautiful HTML tables. Highlights specific rows and cells dynamically corresponding to the currently active verse.
- **Matra Clipping Prevention**: Implements custom typographic line heights (`.devanagari-safe`) to ensure Hindi/Devanagari characters and vowel markings (matras) are never clipped or truncated.

### 🎵 Devotional Bhajans
- **Categorized Playlists**: Browse bhajans grouped into Dev, Shastra, Guru, and Bhakti subdivisions.
- **transliteration**: View lyrics in Devanagari or toggle Roman script transliteration.
- **Clean Formatting**: Auto-formatted stanzas, normalized chorus markers, and consistent verse numbering.

### 🎨 Premium UI/UX & Customizations
- **Reading Themes**: Choose between **Dark** (default), **Soft Dark**, **Light**, and **Sepia** themes.
- **Typographic Adjustments**: Customize font size, line spacing, and toggle between Serif and Sans-serif fonts to optimize reading comfort.
- **Export & Print**: Render clean print layouts and download scriptures directly as PDFs using `html2canvas` and `jsPDF`.

---

## 🛠️ Technology Stack

- **Framework**: React 18 + TypeScript + Vite 8
- **Styling**: Tailwind CSS + Custom Vanilla CSS Variables (supporting HSL-based theme switching)
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **PDF Generation**: `jspdf` & `html2canvas`

---

## ⚙️ Architecture & Data Migration

Tatvaarth is **entirely serverless** and **static**. At build time, it eagerly scans, parses, and bundles all content files. This ensures lightning-fast loading speeds, complete offline-first usability, and zero database latency at runtime.

### Directory Structure

```text
├── Database/               # Raw HTML scripture databases (source)
├── New_bhajans/            # Raw HTML bhajan files (source)
├── scripts/                # Python/Node migration scripts
│   ├── parse-shastras.js   # Parses shastra HTMLs to flat txt & JSON manifests
│   ├── extract.js          # Extracts & formats raw bhajans to formatted txt
│   └── update-sitemap.cjs  # Romanizes sitemap.xml loc URLs
├── public/                 # Static assets, fonts, sitemap
└── src/
    ├── assets/             # Images and design assets
    ├── components/         # Shared React components (Header, Settings, PrintTemplate)
    ├── content/            # Migrated text databases (Target content)
    │   ├── granth/         # Output of parse-shastras.js
    │   └── bhajans/        # Output of extract.js
    ├── data/               # Vite import.meta.glob content loaders
    ├── contexts/           # AppState (Theme, FontSize, LineSpacing, Language)
    └── pages/              # Main UI views (Index, Reader, BhajanPage)
```

### Migration Pipelines

1. **Scripture Migration (`node scripts/parse-shastras.js`)**:
   Reads JQuery structures in raw `myItem.js` files, parses HTML gathas, extracts titles, Prakrit, Sanskrit, Hindi verses, Anvayarths, and Teekas (including nested Sanskrit commentaries), and converts them into flat, easily parsable `.txt` files under `src/content/granth/` alongside local `index.json` manifests.
   
2. **Bhajan Extraction (`node scripts/extract.js`)**:
   Extracts bhajan text from raw source files, normalizes stanzas, inserts proper refrain-abbreviations, ensures exact double-newline layout styling, and outputs them under `src/content/bhajans/`.

3. **Static Content Loader (`src/data/shastra-loader.ts`)**:
   Leverages Vite's `import.meta.glob` to eagerly load raw text files:
   ```typescript
   const gathaTexts = import.meta.glob('../content/granth/**/*.txt', { 
     query: '?raw', 
     import: 'default', 
     eager: true 
   }) as Record<string, string>;
   ```

---

## 🚀 Getting Started

### Prerequisites
Make sure you have Node.js (v18+) and npm installed.

### 1. Installation
Clone the repository and install dependencies:
```bash
npm install
```

### 2. Run Database Migration
If you need to parse the latest scriptures and bhajans from the `Database/` and `New_bhajans/` folders:
```bash
# Run scripture migration
node scripts/parse-shastras.js

# Run bhajan migration
node scripts/extract.js
```

### 3. Run Development Server
Start the local development server:
```bash
npm run dev
```
Open `http://localhost:8080/tatvaarth/` in your browser.

### 4. Build for Production
To build the application for deployment (outputs static build to `dist/`):
```bash
npm run build
```

---

## 📄 License
This project is private and created for religious study and reference. All scriptures and translations are subject to their respective copyright holders and scholars. Special thanks to Vijay Kumar Jain, Pandit Jayachandji Chhabra, and Dr. Hukamchand Bharill.
