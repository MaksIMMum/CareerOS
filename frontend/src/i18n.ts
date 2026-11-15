import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { uk } from './locales/uk.js';
import { en } from './locales/en.js';

export const defaultNS = 'translation';
export const resources = {
  uk: { translation: uk },
  en: { translation: en },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    // Ukrainian by default; a language picked with the header switch is remembered in
    // localStorage (or forced with ?lang=en). Browser language is deliberately ignored.
    fallbackLng: 'uk',
    supportedLngs: ['uk', 'en'],
    detection: {
      order: ['querystring', 'localStorage'],
      lookupQuerystring: 'lang',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
