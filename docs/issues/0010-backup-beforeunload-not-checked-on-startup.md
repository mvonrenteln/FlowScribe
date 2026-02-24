# Backup: beforeunload-Flag wird beim Startup nicht ausgewertet

**Type:** Bug
**Oberticket:** [#0005 External Backup System](./0005-external-backup-system.md)

---

## Problem

Der `BackupScheduler` setzt beim `beforeunload`-Event ein Flag in `sessionStorage`, um einen Crash oder unerwarteten Seitenabschluss zu markieren. Dieses Flag wird beim nächsten App-Start jedoch **nicht ausgewertet** — kein sofortiger Backup wird ausgelöst, das Flag bleibt liegen oder wird ignoriert.

---

## Erwartetes Verhalten (Spec)

Aus dem Spec [#0005, Abschnitt "beforeunload handling"]:

> 1. In `beforeunload`: `sessionStorage.setItem("flowscribe:dirty-unload", "1")`
> 2. On next startup: if the flag is present and a backup folder is configured, run `backupNow("before-unload")` before clearing the flag.

---

## Ist-Zustand

### Setzen (korrekt implementiert)

In [`BackupScheduler.ts`](../../client/src/lib/backup/BackupScheduler.ts), `start()`:

```typescript
window.addEventListener("beforeunload", () => {
  if (this.hasDirty()) {
    try {
      sessionStorage.setItem("flowscribe:backup-dirty", "1");
    } catch (_e) { /* ignore */ }
  }
});
```

**Hinweis**: Der Schlüssel lautet `"flowscribe:backup-dirty"` — im Spec steht `"flowscribe:dirty-unload"`. Kleinere Inkonsistenz.

### Auswerten beim Start (fehlt)

In [`store.ts`](../../client/src/lib/store.ts), `initBackup()`:

```typescript
const initBackup = async () => {
  const fsProvider = new FileSystemProvider();
  await fsProvider.initialize();
  const provider = fsProvider.isSupported() ? fsProvider : new DownloadProvider();
  const scheduler = new BackupScheduler(provider);
  scheduler.start(useTranscriptStore);
  // ❌ Kein Check auf sessionStorage-Flag!
};
```

Das Flag wird beim Start nicht geprüft, und `backupNow("before-unload")` wird nie aufgerufen.

---

## Gewünschte Lösung

In `initBackup()` nach `scheduler.start()`:

```typescript
const DIRTY_UNLOAD_KEY = "flowscribe:backup-dirty"; // konsistent mit Scheduler

const wasDirtyOnUnload = (() => {
  try { return !!sessionStorage.getItem(DIRTY_UNLOAD_KEY); }
  catch { return false; }
})();

if (wasDirtyOnUnload) {
  try { sessionStorage.removeItem(DIRTY_UNLOAD_KEY); } catch { /* ignore */ }
  const state = useTranscriptStore.getState();
  if (state.backupConfig.enabled) {
    void scheduler.backupNow("before-unload");
  }
}
```

Alternativ in `BackupScheduler.checkDirtyUnload()` kapseln und von `start()` aufrufen.

**Schlüssel-Konsistenz**: Entweder `"flowscribe:backup-dirty"` oder `"flowscribe:dirty-unload"` festlegen — beide Stellen anpassen.

---

## Betroffene Dateien

- `client/src/lib/store.ts` — `initBackup()` um Flag-Check erweitern
- `client/src/lib/backup/BackupScheduler.ts` — optional: `checkDirtyUnload()` Methode + Schlüssel-Konstante
