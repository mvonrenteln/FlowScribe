# Backup: "Open backup folder" and "View snapshots" missing in Settings

**Type:** Bug
**Oberticket:** [#0005 External Backup System](./0005-external-backup-system.md)

---


## Problem

In the enabled state of the backup settings, two actions specified in the spec are missing:
1. **"Open backup folder"** — Opens the backup folder in the file explorer
2. **"View snapshots"** — Opens a snapshot browser for overview and manual restore

---


## Expected Behavior (Spec)

From the spec [#0005, section "Backup tab (enabled state)"]:

```
│  [ Backup now ]  [ Open backup folder ]  [ View snapshots ]
```


And the complete snapshot browser:

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


## Current State

In [`BackupSettings.tsx`](../../client/src/components/settings/sections/BackupSettings.tsx) (enabled-State):

```tsx
<Button variant="outline" size="sm" onClick={handleBackupNow}>Backup now</Button>
<Button variant="outline" size="sm" onClick={handleEnable}>Change folder</Button>
<Button variant="ghost"   size="sm" onClick={handleDisable}>Disable</Button>
```


No "Open backup folder", no "View snapshots".

---


## Desired Solution

### "Open backup folder"

Chrome/Edge: Use `FileSystemProvider` to retrieve the stored `FileSystemDirectoryHandle` and open the folder in the OS file manager via `showOpenFilePicker` or `window.showDirectoryPicker`.

**Note**: The File System Access API does not provide a direct "Reveal in Finder/Explorer" function. Alternative: Show a tooltip with the stored `locationLabel` path + a copy-to-clipboard button to copy the path.

### "View snapshots" / Snapshot browser

New section in `BackupSettings.tsx` (or a separate subcomponent `SnapshotBrowser.tsx`):
- Reads `manifest.json` via `provider.readManifest()`
- Groups snapshots by session (`sessionKeyHash` / `sessionLabel`)
- Displays a table with date, reason, size, [Restore] button
- [Restore] calls `restoreSnapshot(provider, entry)` from `restore.ts`

---


## Affected Files

- `client/src/components/settings/sections/BackupSettings.tsx` — Button "Open backup folder" + "View snapshots"
- `client/src/components/settings/sections/SnapshotBrowser.tsx` — to be created
