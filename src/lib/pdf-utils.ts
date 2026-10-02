import jsPDF from 'jspdf';

export type PdfTheme = 'dark' | 'light';

export interface ThemePalette {
  bg: [number, number, number];
  text: [number, number, number];
  accent: [number, number, number];
  divider: [number, number, number];
}

export const themeColors: Record<PdfTheme, ThemePalette> = {
  dark: {
    bg: [24, 26, 33],
    text: [220, 210, 190],
    accent: [212, 168, 83],
    divider: [80, 75, 65],
  },
  light: {
    bg: [248, 244, 235],
    text: [30, 32, 45],
    accent: [160, 120, 50],
    divider: [200, 190, 170],
  },
};

export const devanagariFontFile = 'NotoSansDevanagari-Regular.ttf';
export const devanagariFontFamily = 'NotoSansDevanagari';

let devanagariFontBase64: string | null = null;

export function sanitizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .split('\n')
    .map(line => line.trim())
    .join('\n');
}

export async function loadDevanagariFont(doc: jsPDF): Promise<boolean> {
  try {
    if (!devanagariFontBase64) {
      const basePath = import.meta.env.BASE_URL || '/';
      const fontPath = `${basePath}fonts/${devanagariFontFile}`;
      const response = await fetch(fontPath);
      if (!response.ok) throw new Error('Font not found');
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      devanagariFontBase64 = btoa(binary);
    }
    doc.addFileToVFS(devanagariFontFile, devanagariFontBase64);
    doc.addFont(devanagariFontFile, devanagariFontFamily, 'normal');
    return true;
  } catch (err) {
    console.error('Failed to load Devanagari font for PDF:', err);
    return false;
  }
}
