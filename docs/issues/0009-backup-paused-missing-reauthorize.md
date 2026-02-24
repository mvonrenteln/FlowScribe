# Backup: Paused-Zustand hat keinen "Re-authorize"-Button

**Type:** Bug
**Oberticket:** [#0005 External Backup System](./0005-external-backup-system.md)

---

## Problem

Wenn der Backup-Ordner nach einem Browser-Neustart keine Leseberechtigung mehr hat (status = `"paused"`), zeigt die Settings-UI nur einen Warnhinweis-Text, aber keinen dedizierten **"Re-authorize"**-Button. Der Benutzer muss stattdessen "Change folder" klicken und denselben Ordner neu auswählen, was unintuiv ist.

---

## Erwartetes Verhalten (Spec)

Aus dem Spec [#0005, Abschnitt "Backup tab (paused — permission lost)"]:

```
┌─ Backup ──────────────────────────────────────────────────────────────┐
│                                                                       │
│  ⚠  Backups paused — browser permission was revoked                  │
│     [ Re-authorize ]                                                  │
│                                                                       │
│  Folder: ~/Documents/flowscribe-backup/                               │
│  Last successful backup: yesterday at 14:23                           │
│                                                                       │
│  [ Disable backups ]                                                  │
└───────────────────────────────────────────────────────────────────────┘
```

Der "Re-authorize"-Button ruft `requestPermission({ mode: "readwrite" })` auf dem gespeicherten Handle auf — **ohne** den Benutzer einen Ordner neu auswählen zu lassen.

---

## Ist-Zustand

In [`BackupSettings.tsx`](../../client/src/components/settings/sections/BackupSettings.tsx):

```tsx
{backupConfig.status === "paused" && (
  <div className="rounded-md bg-amber-50 ...">
    Backup folder is not accessible. Re-open your browser and grant permission,
    or choose a new folder.
  </div>
)}
```

Kein Button — der Benutzer muss "Change folder" klicken und erneut navigieren.

---

## Gewünschte Lösung

Neuer Handler `handleReauthorize`:

```typescript
const handleReauthorize = useCallback(async () => {
  const { FileSystemProvider } = await import("@/lib/backup/providers/FileSystemProvider");
  const provider = new FileSystemProvider();
  const granted = await provider.reauthorize(); // requestPermission auf gespeichertem Handle
  if (granted) {
    setBackupConfig({ status: "enabled", lastError: null });
    window.dispatchEvent(new CustomEvent("flowscribe:backup-critical"));
  } else {
    setBackupConfig({ status: "error", lastError: "Permission denied" });
  }
}, [setBackupConfig]);
```

`FileSystemProvider` braucht eine neue Methode `reauthorize()`:
```typescript
async reauthorize(): Promise<boolean> {
  const handle = await this.getHandle();
  if (!handle) return false;
  const typedHandle = handle as ExtendedDirHandle;
  if (!typedHandle.requestPermission) return true;
  const perm = await typedHandle.requestPermission({ mode: "readwrite" });
  return perm === "granted";
}
```

Im Paused-State der Settings:
```tsx
{backupConfig.status === "paused" && (
  <div className="rounded-md bg-amber-50 ...">
    <p>⚠ Backups paused — browser permission was revoked</p>
    <Button onClick={handleReauthorize}>Re-authorize</Button>
  </div>
)}
```

---

## Betroffene Dateien

- `client/src/lib/backup/providers/FileSystemProvider.ts` — neue Methode `reauthorize()`
- `client/src/lib/backup/BackupProvider.ts` — Interface erweitern
- `client/src/components/settings/sections/BackupSettings.tsx` — Handler + Button
