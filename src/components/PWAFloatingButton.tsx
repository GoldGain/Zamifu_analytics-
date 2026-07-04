import { useState, useEffect } from 'react';
import { Download, X, Smartphone, Check } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAFloatingButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    if ((window as any).standalone === true) {
      setIsInstalled(true);
      return;
    }

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      // Show button after a short delay
      setTimeout(() => setIsVisible(true), 1500);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for app installed
    const installedHandler = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setInstallPrompt(null);
    };
    window.addEventListener('appinstalled', installedHandler);

    // Also check if prompt was already captured before component mounted
    const checkPrompt = setTimeout(() => {
      if (installPrompt === null && !isInstalled) {
        // Show button anyway for manual install guidance
        setIsVisible(true);
      }
    }, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
      clearTimeout(checkPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setIsVisible(false);
      }
      setInstallPrompt(null);
    } else {
      // Fallback: show tooltip with instructions
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 5000);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Store in session so it doesn't show again this session
    sessionStorage.setItem('pwa-button-dismissed', 'true');
  };

  // Don't render if installed, not visible, or dismissed this session
  if (isInstalled || !isVisible || sessionStorage.getItem('pwa-button-dismissed')) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Tooltip */}
      {showTooltip && (
        <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 max-w-[200px] shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
          <p>To install: tap the menu button in your browser and select &quot;Add to Home Screen&quot; or &quot;Install App&quot;</p>
        </div>
      )}

      {/* Install button */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleDismiss}
          className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors shadow-sm"
          title="Dismiss"
        >
          <X className="w-4 h-4 text-gray-600" />
        </button>

        <button
          onClick={handleInstall}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="group flex items-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white pl-4 pr-5 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95"
          title="Install Zamifu Analytics App"
        >
          <div className="relative">
            <Smartphone className="w-5 h-5" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-[#2563EB] group-hover:border-[#1d4ed8] transition-colors" />
          </div>
          <span className="text-sm font-semibold whitespace-nowrap">Get the App</span>
          <Download className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>
    </div>
  );
}
