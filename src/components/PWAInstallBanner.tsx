import { useState, useEffect } from 'react';
import { usePWA } from '@/hooks/usePWA';
import { Download, X } from 'lucide-react';

export default function PWAInstallBanner() {
  const { isInstallable, install, isInstalled } = usePWA();
  const [dismissed, setDismissed] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  // Show banner after a short delay to avoid immediate popup
  useEffect(() => {
    if (isInstallable && !dismissed) {
      const timer = setTimeout(() => setShowBanner(true), 2000);
      return () => clearTimeout(timer);
    }
    if (!isInstallable) setShowBanner(false);
  }, [isInstallable, dismissed]);

  // Don't render if installed, not installable, dismissed, or not ready to show
  if (isInstalled || !isInstallable || dismissed || !showBanner) return null;

  const handleInstall = async () => {
    const installed = await install();
    if (installed) {
      setDismissed(true);
      setShowBanner(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowBanner(false);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50">
      <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-300">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Download className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#111111]">Install Zamifu Analytics App</p>
          <p className="text-xs text-[#666666] mt-0.5">
            Add to your home screen for quick access, even offline.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              className="flex-1 bg-[#2563EB] text-white text-xs font-medium py-2 rounded-lg hover:bg-[#1d4ed8] transition-colors"
            >
              Install App
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 text-xs text-gray-500 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Later
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
