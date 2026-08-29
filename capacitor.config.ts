import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zamifu.analytics',
  appName: 'Zamifu Analytics',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
