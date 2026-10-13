import type { jsPDF } from 'jspdf';

const fontAssets = [
  { file: 'DejaVuSans.ttf', style: 'normal', url: new URL('../assets/fonts/DejaVuSans.ttf', import.meta.url).href },
  { file: 'DejaVuSans-Bold.ttf', style: 'bold', url: new URL('../assets/fonts/DejaVuSans-Bold.ttf', import.meta.url).href },
  { file: 'LiberationSans-Italic.ttf', style: 'italic', url: new URL('../assets/fonts/LiberationSans-Italic.ttf', import.meta.url).href },
] as const;
let cachedFonts: Promise<Array<{ file: string; style: string; data: string }>> | undefined;

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  }
  return btoa(binary);
}

/** Override the existing Helvetica aliases so every renderer and table uses the Unicode font consistently. */
export async function registerUnicodeExamFonts(doc: jsPDF): Promise<void> {
  cachedFonts ??= Promise.all(fontAssets.map(async (font) => {
    const response = await fetch(font.url);
    if (!response.ok) throw new Error('The print font could not be loaded. Please retry the PDF export.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length < 4 || bytes[0] !== 0 || bytes[1] !== 1 || bytes[2] !== 0 || bytes[3] !== 0) {
      throw new Error('The print font response was invalid. Please retry the PDF export.');
    }
    return { file: font.file, style: font.style, data: base64(bytes) };
  })).catch((error) => { cachedFonts = undefined; throw error; });
  for (const font of await cachedFonts) {
    doc.addFileToVFS(font.file, font.data);
    doc.addFont(font.file, 'helvetica', font.style);
  }
  doc.setFont('helvetica', 'normal');
}
