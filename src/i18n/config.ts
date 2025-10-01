import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { fr } from './locales/fr';
import { en } from './locales/en';
import { es } from './locales/es';
import { de } from './locales/de';
import { it } from './locales/it';
import { zh } from './locales/zh';
import { pt } from './locales/pt';
import { uk } from './locales/uk';
import { ja } from './locales/ja';
import { ar } from './locales/ar';
import { hi } from './locales/hi';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      es: { translation: es },
      de: { translation: de },
      it: { translation: it },
      zh: { translation: zh },
      pt: { translation: pt },
      uk: { translation: uk },
      ja: { translation: ja },
      ar: { translation: ar },
      hi: { translation: hi },
    },
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
