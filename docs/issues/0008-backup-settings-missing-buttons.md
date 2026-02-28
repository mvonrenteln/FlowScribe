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

### ~~"Open backup folder"~~ — dropped

The File System Access API exposes only `FileSystemDirectoryHandle.name` (the last path segment), never the full filesystem path. A "copy folder name" button is not useful enough to justify the UI noise. Feature is dropped; the existing **"Change folder"** button already lets users re-select the folder via the OS picker.

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
