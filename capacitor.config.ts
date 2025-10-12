import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'app.lovable.fd63d493bace4decb509380d11e36a5a',
  appName: 'commerce-cloud-ai',
  webDir: 'dist',
  server: {
    url: 'https://fd63d493-bace-4dec-b509-380d11e36a5a.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  ios: {
    contentInset: 'automatic'
  }
};

export default config;
