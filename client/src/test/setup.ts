import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

Object.defineProperty(Element.prototype, "scrollIntoView", {
  value: vi.fn(),
  writable: true,
});

if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
    return window.setTimeout(() => callback(performance.now()), 0);
  };
}

// Provide a minimal i18n instance for react-i18next used in components
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: "en",
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  });
}

// Suppress expected noisy console warnings from libraries during tests
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const text = args.join(" ");
  if (
    text.includes("Invalid search regex:") ||
    text.includes("Missing `Description` or `aria-describedby") ||
    text.includes("An update to") ||
    text.includes("useTranslation: You will need to pass in an i18next instance") ||
    text.includes("indexedDB is not defined")
  ) {
    return;
  }
  return originalWarn.call(console, ...args);
};
