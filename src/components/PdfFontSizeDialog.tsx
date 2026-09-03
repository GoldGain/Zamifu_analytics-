import { useState } from 'react';
import { FileDown, X } from 'lucide-react';
import {
  DEFAULT_PDF_FONT_SIZE,
  PDF_FONT_SIZE_OPTIONS,
  type PdfFontSize,
} from '@/lib/pdfFontSize';

interface PdfFontSizeDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  onCancel: () => void;
  onConfirm: (fontSize: PdfFontSize) => void | Promise<void>;
}

export default function PdfFontSizeDialog({
  open,
  title = 'Download Options',
  description = 'Choose the font size for the downloaded PDF.',
  onCancel,
  onConfirm,
}: PdfFontSizeDialogProps) {
  const [fontSize, setFontSize] = useState<PdfFontSize>(DEFAULT_PDF_FONT_SIZE);
  const [confirming, setConfirming] = useState(false);

  if (!open) return null;

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm(fontSize);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !confirming) onCancel();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-font-size-title"
        aria-describedby="pdf-font-size-description"
      >
        <div className="flex items-start justify-between border-b border-gray-100 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <FileDown className="h-5 w-5" />
            </div>
            <div>
              <h2 id="pdf-font-size-title" className="text-lg font-bold text-[#111111]">{title}</h2>
              <p id="pdf-font-size-description" className="mt-1 text-sm text-[#666666]">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            aria-label="Close download options"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-[#111111]">Select Font Size</legend>
            <div className="space-y-2">
              {PDF_FONT_SIZE_OPTIONS.map((option) => (
                <label
                  key={option}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
                    fontSize === option
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                      : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="pdf-font-size"
                      value={option}
                      checked={fontSize === option}
                      onChange={() => setFontSize(option)}
                      disabled={confirming}
                      className="h-4 w-4 accent-blue-600"
                    />
                    <span className="text-sm font-medium text-[#111111]">{option}</span>
                  </span>
                  <span className="text-xs text-gray-500">
                    {option === 10 ? 'Small' : option === 12 ? 'Compact' : option === 14 ? 'Default · Recommended' : 'Large'}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={confirming}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-[#666666] transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirming}
              className="flex-1 rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {confirming ? 'Preparing...' : 'Download'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
