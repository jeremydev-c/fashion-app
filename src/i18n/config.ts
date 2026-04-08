import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import all language files
import en from './locales/en.json';
import ar from './locales/ar.json';
import bg from './locales/bg.json';
import cs from './locales/cs.json';
import da from './locales/da.json';
import de from './locales/de.json';
import el from './locales/el.json';
import es from './locales/es.json';
import fi from './locales/fi.json';
import fr from './locales/fr.json';
import he from './locales/he.json';
import hi from './locales/hi.json';
import hu from './locales/hu.json';
import id from './locales/id.json';
import it from './locales/it.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import ms from './locales/ms.json';
import nl from './locales/nl.json';
import no from './locales/no.json';
import pl from './locales/pl.json';
import pt from './locales/pt.json';
import ro from './locales/ro.json';
import ru from './locales/ru.json';
import sv from './locales/sv.json';
import sw from './locales/sw.json';
import th from './locales/th.json';
import tr from './locales/tr.json';
import uk from './locales/uk.json';
import vi from './locales/vi.json';
import zh from './locales/zh.json';

const resources = {
  en: { translation: en },
  ar: { translation: ar },
  bg: { translation: bg },
  cs: { translation: cs },
  da: { translation: da },
  de: { translation: de },
  el: { translation: el },
  es: { translation: es },
  fi: { translation: fi },
  fr: { translation: fr },
  he: { translation: he },
  hi: { translation: hi },
  hu: { translation: hu },
  id: { translation: id },
  it: { translation: it },
  ja: { translation: ja },
  ko: { translation: ko },
  ms: { translation: ms },
  nl: { translation: nl },
  no: { translation: no },
  pl: { translation: pl },
  pt: { translation: pt },
  ro: { translation: ro },
  ru: { translation: ru },
  sv: { translation: sv },
  sw: { translation: sw },
  th: { translation: th },
  tr: { translation: tr },
  uk: { translation: uk },
  vi: { translation: vi },
  zh: { translation: zh },
};

export const supportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
];

export const saveLanguage = async (langCode: string) => {
  try {
    await AsyncStorage.setItem('@fashion_fit_language', langCode);
    await i18n.changeLanguage(langCode);
    console.log('Language saved and changed to:', langCode);
  } catch (error) {
    console.error('Error saving language:', error);
  }
};

export const loadSavedLanguage = async () => {
  try {
    const savedLang = await AsyncStorage.getItem('@fashion_fit_language');
    if (savedLang && savedLang !== i18n.language) {
      await i18n.changeLanguage(savedLang);
      console.log('Loaded saved language:', savedLang);
    }
  } catch (error) {
    console.error('Error loading saved language:', error);
  }
};

// Initialize i18n synchronously with English as default
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    compatibilityJSON: 'v3',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
      bindI18n: 'languageChanged loaded',
      bindI18nStore: 'added removed',
    },
  });

// Load saved language after init
loadSavedLanguage();

export default i18n;
