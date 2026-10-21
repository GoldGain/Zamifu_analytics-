import { Capacitor, registerPlugin } from '@capacitor/core';
import jsPDF from 'jspdf';

interface NativePdfDownloadPlugin {
  requiresLegacyStoragePermission(): Promise<{ required: boolean }>;
  requestPermissions(): Promise<{ storage: string }>;
  savePdf(options: { fileName: string; base64: string }): Promise<{ fileName: string; uri: string }>;
}

const nativePdfDownload = registerPlugin<NativePdfDownloadPlugin>('NativePdfDownload');
const pdfPrototype = jsPDF.prototype as unknown as {
  save(this: jsPDF, filename?: string): jsPDF;
};
const originalSave = pdfPrototype.save;

pdfPrototype.save = function (this: jsPDF, filename?: string): jsPDF {
  if (Capacitor.getPlatform() !== 'android') {
    return originalSave.call(this, filename);
  }

  const fileName = filename?.trim() || 'Zamifu_Analytics.pdf';
  const dataUri = this.output('datauristring');
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1);

  void (async () => {
    try {
      const { required } = await nativePdfDownload.requiresLegacyStoragePermission();
      if (required) {
        const permissions = await nativePdfDownload.requestPermissions();
        if (permissions.storage !== 'granted') {
          throw new Error('Storage permission was not granted.');
        }
      }
      await nativePdfDownload.savePdf({ fileName, base64 });
    } catch (error) {
      console.error('Could not save PDF to Android Downloads:', error);
      window.alert('Zamifu could not save this PDF to Downloads. Please allow the requested file access and try again.');
    }
  })();

  return this;
};
