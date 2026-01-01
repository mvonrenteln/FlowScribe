import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { getI18nInstance } from "@/i18n/config";

export function I18nProvider({ children }: { children: ReactNode }) {
  const i18n = getI18nInstance();
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
