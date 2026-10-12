/**
 * Internationalisation (i18n) with i18next and react-i18next.
 *
 * Every text shown to the user comes from a translation file, by key:
 *   const { t } = useTranslation();
 *   t("signIn.button")                    → "Sign in with Google" / "Kirjaudu Googlella"
 *   t("profile.welcome", { name: "Ada" }) → "Welcome, Ada!"
 *
 * Changing the language re-renders every component that uses useTranslation().
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en";
import fi from "./fi";

export const LANGUAGES = { en: "English", fi: "Suomi" } as const;
export type Language = keyof typeof LANGUAGES;

const STORAGE_KEY = "profile-viewer:language";

function isLanguage(value: string | null | undefined): value is Language {
  return value != null && Object.hasOwn(LANGUAGES, value);
}

// The saved choice, or the browser's preferred language, or English.
function initialLanguage(): Language {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (isLanguage(saved)) return saved;

  const browser = navigator.language.slice(0, 2); // "fi-FI" → "fi"
  return isLanguage(browser) ? browser : "en";
}

// Type-safe keys: tell TypeScript what the translations look like, so that
// t("profile.welcom") (a typo) is a compile error instead of a missing text.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof en };
  }
}

void i18n.use(initReactI18next).init({
  lng: initialLanguage(),
  fallbackLng: "en", // if a key is missing in Finnish, show the English text
  resources: {
    en: { translation: en },
    fi: { translation: fi },
  },
  interpolation: {
    // React already escapes values when rendering, so i18next must not do it
    // a second time (which would show "&amp;" etc.).
    escapeValue: false,
  },
});

// Remember the choice, and keep <html lang="…"> correct for screen readers,
// spell checkers and search engines.
document.documentElement.lang = i18n.language;
i18n.on("languageChanged", (language) => {
  localStorage.setItem(STORAGE_KEY, language);
  document.documentElement.lang = language;
});

export default i18n;
