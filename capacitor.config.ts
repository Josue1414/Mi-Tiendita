import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ahorratiempo.mitienda',
  appName: 'AhorraTiempo MI TIENDA',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
};

export default config;
