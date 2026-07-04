import { usePWA } from '@/hooks/usePWA';
import { Download, Smartphone } from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'button' | 'nav' | 'icon';
  className?: string;
}

export default function PWAInstallButton({ variant = 'button', className = '' }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, install } = usePWA();

  // Don't render if already installed or not installable
  if (isInstalled || !isInstallable) return null;

  const handleInstall = async () => {
    await install();
  };

  if (variant === 'nav') {
    return (
      <button
        onClick={handleInstall}
        className={`flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors ${className}`}
        title="Install Zamifu Analytics App"
      >
        <Download className="w-4 h-4" />
        <span className="hidden lg:inline">Download App</span>
      </button>
    );
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={handleInstall}
        className={`p-2 hover:bg-blue-50 rounded-lg transition-colors text-blue-600 ${className}`}
        title="Install Zamifu Analytics App"
      >
        <Smartphone className="w-5 h-5" />
      </button>
    );
  }

  // Default button variant
  return (
    <button
      onClick={handleInstall}
      className={`inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm ${className}`}
    >
      <Download className="w-4 h-4" />
      Download App
    </button>
  );
}
