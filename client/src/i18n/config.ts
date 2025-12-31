import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import de from "@/translations/de.json";
import en from "@/translations/en.json";

let initialized = false;

export function getI18nInstance() {
  if (!initialized) {
    i18next.use(initReactI18next).init({
      resources: {
        en: { translation: en },
        de: { translation: de },
      },
      lng: "en",
      fallbackLng: "en",
      interpolation: { escapeValue: false },
      defaultNS: "translation",
    });
    initialized = true;
  }
  return i18next;
}

export function changeLanguage(locale: string) {
  getI18nInstance().changeLanguage(locale);
}
