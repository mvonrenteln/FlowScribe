export const DIRTY_UNLOAD_KEY = "flowscribe:dirty-unload";
const DIRTY_UNLOAD_MAX_AGE_MS = 24 * 60 * 60_000; // 24 hours

export function setDirtyUnloadFlag(): void {
  try {
    localStorage.setItem(DIRTY_UNLOAD_KEY, String(Date.now()));
  } catch {
    // ignore — localStorage may be unavailable
  }
}

export function readDirtyUnloadFlag(): { present: true; age: number } | { present: false } {
  try {
    const raw = localStorage.getItem(DIRTY_UNLOAD_KEY);
    if (!raw) return { present: false };
    const ts = Number(raw);
    if (Number.isNaN(ts)) return { present: false };
    const age = Date.now() - ts;
    if (age > DIRTY_UNLOAD_MAX_AGE_MS) {
      localStorage.removeItem(DIRTY_UNLOAD_KEY);
      return { present: false };
    }
    return { present: true, age };
  } catch {
    return { present: false };
  }
}

export function clearDirtyUnloadFlag(): void {
  try {
    localStorage.removeItem(DIRTY_UNLOAD_KEY);
  } catch {
    // ignore
  }
}
