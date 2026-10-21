import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let updateReloadPromptActive = false;

export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches,
  );
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    let registration: ServiceWorkerRegistration | null = null;
    const controllerAtLoad = 'serviceWorker' in navigator ? navigator.serviceWorker.controller : null;
    const handleControllerChange = () => {
      const currentController = navigator.serviceWorker.controller;
      if (!controllerAtLoad || !currentController || currentController === controllerAtLoad || updateReloadPromptActive) return;
      updateReloadPromptActive = true;
      const reloadNow = window.confirm('A new Zamifu Analytics update is ready. Reload now to get the latest payroll and report-card fixes?');
      if (reloadNow) window.location.reload();
    };
    const checkForUpdates = () => {
      if (!document.hidden && registration) {
        void registration.update().catch((err) => console.warn('App update check failed:', err));
      }
    };

    // Register and explicitly check for updates when the app opens or returns to the foreground.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((reg) => {
          registration = reg;
          console.log('SW registered:', reg.scope);
          checkForUpdates();
        })
        .catch((err) => {
          console.warn('SW registration failed:', err);
      });
    }
    window.addEventListener('focus', checkForUpdates);
    document.addEventListener('visibilitychange', checkForUpdates);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Listen for install prompt
    const handler = (e: Event) => {
      console.log('beforeinstallprompt event fired');
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    // Use capture phase to ensure we catch the event
    const beforeInstallOptions: AddEventListenerOptions = { capture: true };
    window.addEventListener('beforeinstallprompt', handler, beforeInstallOptions);

    // Listen for app installed
    const installedHandler = () => {
      console.log('App installed successfully');
      setIsInstalled(true);
      setIsInstallable(false);
      setInstallPrompt(null);
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      if ('serviceWorker' in navigator) navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      window.removeEventListener('focus', checkForUpdates);
      document.removeEventListener('visibilitychange', checkForUpdates);
      window.removeEventListener('beforeinstallprompt', handler, beforeInstallOptions);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) {
      console.warn('Install prompt not available');
      return false;
    }
    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      console.log('User choice:', outcome);
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
        setInstallPrompt(null);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Install error:', err);
      return false;
    }
  };

  return { isInstallable, isInstalled, install };
}

// Push notification helpers
export const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

export async function subscribeToPush(
  userId: string,
  supabaseClient: {
    from: (table: 'push_subscriptions') => {
      upsert: (
        values: { user_id: string; subscription: object },
        options: { onConflict: 'user_id' },
      ) => PromiseLike<{ error: unknown | null }>;
    };
  },
): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications not supported');
    return false;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    // Save subscription to Supabase
    await supabaseClient
      .from('push_subscriptions')
      .upsert({ user_id: userId, subscription: subscription.toJSON() }, { onConflict: 'user_id' });

    return true;
  } catch (err) {
    console.error('Push subscription failed:', err);
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
