# Backup: "Open backup folder" und "View snapshots" fehlen in den Settings

**Type:** Bug
**Oberticket:** [#0005 External Backup System](./0005-external-backup-system.md)

---

## Problem

Im aktivierten Zustand der Backup-Settings fehlen zwei im Spec vorgesehene Aktionen:
1. **"Open backup folder"** — Öffnet den Backup-Ordner im Datei-Explorer
2. **"View snapshots"** — Öffnet einen Snapshot-Browser zur Übersicht und manuellen Wiederherstellung

---

## Erwartetes Verhalten (Spec)

Aus dem Spec [#0005, Abschnitt "Backup tab (enabled state)"]:

```
│  [ Backup now ]  [ Open backup folder ]  [ View snapshots ]
```

Und dazu der vollständige Snapshot-Browser:

```
┌─ Snapshots ─────────────────────────────────────────────────────────┐
│  Session: "Interview with Dr. Müller"  [▼ switch session]           │
│                                                                     │
│  Date/Time             Reason        Size    Action                 │
│  ─────────────────────────────────────────────────────────────────  │
│  Today 14:23           scheduled     48 KB   [ Restore ]           │
│  Today 12:01           critical      47 KB   [ Restore ]           │
│  ...                                                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Ist-Zustand

In [`BackupSettings.tsx`](../../client/src/components/settings/sections/BackupSettings.tsx) (enabled-State):

```tsx
<Button variant="outline" size="sm" onClick={handleBackupNow}>Backup now</Button>
<Button variant="outline" size="sm" onClick={handleEnable}>Change folder</Button>
<Button variant="ghost"   size="sm" onClick={handleDisable}>Disable</Button>
```

Kein "Open backup folder", kein "View snapshots".

---

## Gewünschte Lösung

### "Open backup folder"

Chrome/Edge: Über `FileSystemProvider` das gespeicherte `FileSystemDirectoryHandle` abrufen und per `showOpenFilePicker` oder `window.showDirectoryPicker` den Ordner im OS-Dateimanager öffnen.

**Hinweis**: Die File System Access API bietet keine direkte "Reveal in Finder/Explorer"-Funktion. Alternative: Tooltip mit dem gespeicherten `locationLabel`-Pfad anzeigen + Copy-to-Clipboard-Button, der den Pfad kopiert.

### "View snapshots" / Snapshot-Browser

Neuer Abschnitt in `BackupSettings.tsx` (oder eigene Unterkomponente `SnapshotBrowser.tsx`):
- Liest `manifest.json` via `provider.readManifest()`
- Gruppiert Snapshots nach Session (`sessionKeyHash` / `sessionLabel`)
- Zeigt Tabelle mit Datum, Reason, Größe, [Restore]-Button
- [Restore] ruft `restoreSnapshot(provider, entry)` aus `restore.ts` auf

---

## Betroffene Dateien

- `client/src/components/settings/sections/BackupSettings.tsx` — Button "Open backup folder" + "View snapshots"
- `client/src/components/settings/sections/SnapshotBrowser.tsx` — neu zu erstellen
