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

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.has(key) ? (this.store.get(key) ?? null) : null;
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

const isStorageUsable = () => {
  try {
    if (!globalThis.localStorage) {
      return false;
    }
    const testKey = "__storage_test__";
    globalThis.localStorage.setItem(testKey, "1");
    globalThis.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
};

if (!isStorageUsable()) {
  Object.defineProperty(globalThis, "Storage", {
    value: MemoryStorage,
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
  });
}

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
