import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

export const defaultNS = 'translation';
export const resources = {
  uk: {
    translation: {
      appName: 'CareerOS',
      tagline: 'Перевір своє резюме проти вакансії за 60 секунд',
      subtitle: 'ШІ-помічник для пошуку першої роботи в IT в Україні',
      welcome: 'Ласкаво просимо в CareerOS',
      placeholderNotice: 'Прототип системи розгортається. Скоро тут буде аналіз CV, трекер відгуків та симулятор співбесід.',
      features: {
        analysis: 'Аналіз резюме та відповідність вакансії',
        tracker: 'Трекер відгуків та аналітика ефективності',
        interview: 'Текстова симуляція співбесіди',
      },
      language: 'Мова',
      status: 'Статус системи: Прототип активний',
    },
  },
  en: {
    translation: {
      appName: 'CareerOS',
      tagline: 'Check your CV against a vacancy in 60 seconds',
      subtitle: 'AI job search assistant for junior IT professionals in Ukraine',
      welcome: 'Welcome to CareerOS',
      placeholderNotice: 'Prototype system is initializing. CV analysis, application tracking, and mock interviews coming soon.',
      features: {
        analysis: 'CV analysis & vacancy match scoring',
        tracker: 'Application tracker & reply analytics',
        interview: 'Text mock interview practice',
      },
      language: 'Language',
      status: 'System status: Prototype active',
    },
  },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'uk',
    lng: 'uk',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
