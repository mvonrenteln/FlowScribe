// Performance monitoring utilities (DEV-only)
const IS_DEV = import.meta.env.DEV;

type PerfEvent = {
  ts: number;
  kind: "mark" | "measure" | "time";
  name: string;
  duration?: number;
  meta?: Record<string, unknown>;
};

class PerfMonitor {
  private events: PerfEvent[] = [];
  private enabled: boolean = IS_DEV;

  mark(name: string, meta?: Record<string, unknown>) {
    if (!this.enabled) return;
    this.events.push({ ts: Date.now(), kind: "mark", name, meta });
    try {
      performance?.mark?.(name);
    } catch {}
  }

  measure(name: string, startMark: string, endMark: string, meta?: Record<string, unknown>) {
    if (!this.enabled) return;
    try {
      performance?.measure?.(name, startMark, endMark);
      const entry = performance.getEntriesByName(name).pop();
      const duration = entry ? entry.duration : undefined;
      this.events.push({ ts: Date.now(), kind: "measure", name, duration, meta });
    } catch (_e) {
      this.events.push({ ts: Date.now(), kind: "measure", name, meta });
    }
  }

  time<T>(name: string, fn: () => T, meta?: Record<string, unknown>): T {
    if (!this.enabled) return fn();
    const start = performance.now();
    try {
      return fn();
    } finally {
      const duration = performance.now() - start;
      this.events.push({ ts: Date.now(), kind: "time", name, duration, meta });
    }
  }

  async timeAsync<T>(
    name: string,
    fn: () => Promise<T>,
    meta?: Record<string, unknown>,
  ): Promise<T> {
    if (!this.enabled) return fn();
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - start;
      this.events.push({ ts: Date.now(), kind: "time", name, duration, meta });
    }
  }

  exportMetrics(): string {
    return JSON.stringify(this.events, null, 2);
  }

  clear() {
    this.events = [];
  }
}

export const perfMonitor = new PerfMonitor();
export const mark = perfMonitor.mark.bind(perfMonitor);
export const measure = perfMonitor.measure.bind(perfMonitor);
export const time = perfMonitor.time.bind(perfMonitor);
export const timeAsync = perfMonitor.timeAsync.bind(perfMonitor);

// Expose globally in DEV for quick copy/export from console
if (IS_DEV) {
  // Expose as a safe typed property for dev debugging
  const w = window as Window & { perfMonitor?: PerfMonitor };
  w.perfMonitor = perfMonitor;
}
