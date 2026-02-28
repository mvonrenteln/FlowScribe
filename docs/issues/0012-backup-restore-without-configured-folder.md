# Backup: Restore from backup folder when no backup is configured

**Type:** Feature
**Parent:** [#0005 External Backup System](./0005-external-backup-system.md)
**Related:** [#0008 Backup settings missing buttons](./0008-backup-settings-missing-buttons.md)

---

## Problem

When a user has no backup configured — either because they never set one up, or because the browser lost its IndexedDB data (private mode, profile reset, etc.) — there is no way to restore from an existing backup folder. Both current restore paths (`RestoreBanner` on startup and `SnapshotBrowser` in Settings) require a previously stored `DirectoryHandle` in IndexedDB.

In practice, this is exactly the scenario where restore matters most: the user's localStorage is gone, there is no backup handle, but a backup folder on disk still contains all their snapshots.

---

## Goals

| Goal | Description |
|------|-------------|
| **Ad-hoc restore** | User can pick any backup folder from the file system without pre-configuration |
| **No side effects by default** | Picking a folder for restore does not automatically enable ongoing backups |
| **Opt-in to keep folder** | After a successful restore, the user is offered the option to enable the folder as their ongoing backup location |
| **Two entry points** | Accessible via Backup Settings (disabled state) and via the empty transcript editor state |
| **i18n-compliant** | All new user-facing strings go through `react-i18next` |

---

## Solution

### Overview

The core idea is to allow a temporary, non-persisted `FileSystemProvider` instance to be used **just for reading snapshots and restoring** — without writing anything to IndexedDB or touching the backup config. Only if the user explicitly opts in does the folder get saved.

---

### 1. New utility: `openRestoreFromFolder()` in `restore.ts`

Add a new exported function to [`client/src/lib/backup/restore.ts`](../../client/src/lib/backup/restore.ts):

```typescript
/**
 * Lets the user pick a backup folder ad-hoc via showDirectoryPicker().
 * Creates a temporary FileSystemProvider without persisting the handle.
 * Validates the folder contains a readable manifest.json.
 *
 * @returns { provider, manifest } on success, or throws on cancel / invalid folder.
 */
export async function openRestoreFromFolder(): Promise<{
  provider: BackupProvider;
  manifest: BackupManifest;
}>
```

- Opens `showDirectoryPicker()` — throws if user cancels (caller handles this as a no-op)
- Creates a `FileSystemProvider` with the chosen handle **without** calling `saveDirectoryHandle()`
- Calls `provider.readManifest()` — throws with a user-facing error if not a valid backup folder
- Returns `{ provider, manifest }` for the caller to pass to `SnapshotBrowser`

---

### 2. Extend `SnapshotBrowser` with `externalProvider` prop

[`client/src/components/settings/sections/SnapshotBrowser.tsx`](../../client/src/components/settings/sections/SnapshotBrowser.tsx) currently always resolves its provider by loading the stored `DirectoryHandle` from IndexedDB.

Add an optional prop:

```typescript
interface SnapshotBrowserProps {
  open: boolean;
  onClose: () => void;
  externalProvider?: BackupProvider; // if set, use this instead of loading from IndexedDB
}
```

When `externalProvider` is provided, skip the `loadDirectoryHandle()` call and use it directly. This avoids duplicating any restore logic and reuses the full snapshot table UI.

---

### 3. "Restore from backup folder" button in `BackupSettings` (disabled state)

In the **disabled state** of [`BackupSettings.tsx`](../../client/src/components/settings/sections/BackupSettings.tsx), add a new button below the existing "Choose backup folder" button:

```
[ Choose backup folder ]
[ Restore from backup folder ]   ← new, only when hasFsAccess() === true
```

Handler flow:

1. Call `openRestoreFromFolder()` → if user cancels, do nothing
2. If folder is invalid (no manifest), show an error toast
3. On success: store the returned `provider` in local state, open `SnapshotBrowser` with `externalProvider={provider}`
4. After successful restore in `SnapshotBrowser`: show the "Keep folder?" dialog (see §5)

---

### 4. "Restore from backup" button in empty editor state

In [`TranscriptList.tsx`](../../client/src/components/transcript-editor/TranscriptList.tsx), when `segments.length === 0` and no active filter is set, the empty state panel is shown. Add a "Restore from backup" button below the existing description text.

Conditions for showing the button:
- `hasFsAccess()` is `true`
- An optional prop `onRestoreFromBackup?: () => void` is provided (so `TranscriptList` stays decoupled from backup logic)

Wire up `onRestoreFromBackup` in [`useTranscriptEditor.ts`](../../client/src/components/transcript-editor/useTranscriptEditor.ts): call `openRestoreFromFolder()` and open `SnapshotBrowser` with the temporary provider. This hook already has access to the store and can manage the modal state.

---

### 5. "Keep this folder?" inline dialog after restore

After `SnapshotBrowser` signals a successful restore (via callback), if the provider was an `externalProvider` (i.e. not already the configured backup folder), show an inline `AlertDialog`:

```
┌─ Use this folder for ongoing backups? ──────────────────────┐
│                                                              │
│  The folder "<name>" was used to restore your session.      │
│  Would you like to enable it as your automatic backup        │
│  location going forward?                                     │
│                                                              │
│  [ Yes, enable backup ]       [ No, thanks ]                 │
└──────────────────────────────────────────────────────────────┘
```

"Yes, enable backup":
- Calls `saveDirectoryHandle(handle)` to persist the handle in IndexedDB
- Calls `setBackupConfig({ enabled: true, providerType: "filesystem", locationLabel })`
- Calls `setBackupState({ status: "enabled", lastError: null })`
- Dispatches `flowscribe:backup-critical` to trigger an immediate backup

"No, thanks":
- Closes the dialog, no side effects

The dialog is rendered inline in `BackupSettings.tsx` (not a separate component file) since it needs direct access to the handle and store actions.

---

### 6. i18n fixes (mandatory, not optional)

Both `BackupSettings.tsx` and `RestoreBanner.tsx` contain hardcoded English strings that violate Non-negotiable #5. These must be fixed as part of this issue.

**`BackupSettings.tsx`** — strings to migrate:
- `"Automatic Backup"` (CardTitle)
- `"Save compressed snapshots…"` (CardDescription)
- `"Backup location"`, `"Last backup:"`, `"Never"`, `"Just now"`, `"m ago"`, `"h ago"`, `"d ago"` (via `formatLastBackup`)
- `"Choose backup folder"`, `"Enable download backups"`, `"Backup now"`, `"Change folder"`, `"Disable"`
- All `<Label>` texts for switches and number inputs

**`RestoreBanner.tsx`** — strings to migrate:
- `"Backup found"`, `"Restore"`, `"Dismiss"`, `"Try previous backup"`, `"View snapshots"`
- Any date/time formatting strings

**`useFiltersAndLexicon.ts`** — `getEmptyStateMessage()` returns hardcoded English strings:
- Accept a `t` function as parameter (or move translation to the call site in `useTranscriptEditor.ts`) so the empty state title/description are translated

All new and migrated keys must be added to both `en.json` and `de.json`.

---

## New i18n Keys (proposed)

```json
// en.json additions
{
  "backup.settings.title": "Automatic Backup",
  "backup.settings.description": "Save compressed snapshots of your sessions to a local folder. Protects against browser data loss.",
  "backup.settings.locationLabel": "Backup location",
  "backup.settings.lastBackup": "Last backup:",
  "backup.settings.lastBackupNever": "Never",
  "backup.settings.lastBackupJustNow": "Just now",
  "backup.settings.lastBackupMinutes": "{{count}}m ago",
  "backup.settings.lastBackupHours": "{{count}}h ago",
  "backup.settings.lastBackupDays": "{{count}}d ago",
  "backup.settings.chooseFolderButton": "Choose backup folder",
  "backup.settings.enableDownloadButton": "Enable download backups",
  "backup.settings.restoreFromFolderButton": "Restore from backup folder",
  "backup.settings.backupNowButton": "Backup now",
  "backup.settings.changeFolderButton": "Change folder",
  "backup.settings.disableButton": "Disable",
  "backup.settings.includeGlobalLabel": "Include global settings",
  "backup.settings.includeGlobalDescription": "Back up templates, prompts and dictionaries in addition to sessions.",
  "backup.settings.disableRemindersLabel": "Disable unsaved reminders",
  "backup.settings.disableRemindersDescription": "Suppress the periodic toast when changes have not been backed up.",
  "backup.settings.intervalLabel": "Backup every (minutes)",
  "backup.settings.maxPerSessionLabel": "Max snapshots per session",
  "backup.settings.maxGlobalLabel": "Max global snapshots",
  "backup.settings.invalidFolderErrorTitle": "Invalid backup folder",
  "backup.settings.invalidFolderErrorDescription": "The selected folder does not contain a valid FlowScribe backup.",
  "backup.restore.keepFolderTitle": "Use this folder for ongoing backups?",
  "backup.restore.keepFolderDescription": "The folder \"{{name}}\" was used to restore your session. Would you like to enable it as your automatic backup location going forward?",
  "backup.restore.keepFolderConfirm": "Yes, enable backup",
  "backup.restore.keepFolderDismiss": "No, thanks",
  "backup.banner.title": "Backup found",
  "backup.banner.restoreButton": "Restore",
  "backup.banner.dismissButton": "Dismiss",
  "backup.banner.tryPreviousButton": "Try previous backup",
  "backup.banner.viewSnapshotsButton": "View snapshots",
  "transcript.emptyState.noTranscriptTitle": "No transcript loaded",
  "transcript.emptyState.noTranscriptDescription": "Upload an audio file and its Whisper or WhisperX JSON transcript to get started.",
  "transcript.emptyState.restoreFromBackupButton": "Restore from backup"
}
```

---

## Affected Files

| File | Change |
|------|--------|
| `client/src/lib/backup/restore.ts` | Add `openRestoreFromFolder()` |
| `client/src/components/settings/sections/SnapshotBrowser.tsx` | Add `externalProvider?` prop |
| `client/src/components/settings/sections/BackupSettings.tsx` | New button (disabled state), "Keep folder?" dialog, i18n fixes |
| `client/src/components/backup/RestoreBanner.tsx` | i18n fixes |
| `client/src/components/transcript-editor/TranscriptList.tsx` | New `onRestoreFromBackup?` prop + button in empty state |
| `client/src/components/transcript-editor/useTranscriptEditor.ts` | Wire up `onRestoreFromBackup`, manage `externalProvider` state |
| `client/src/components/transcript-editor/useFiltersAndLexicon.ts` | Accept `t` param in `getEmptyStateMessage()` |
| `client/src/translations/en.json` | All new and migrated keys |
| `client/src/translations/de.json` | German translations for all new keys |

---

## Tests Required

| Test file | Coverage |
|-----------|----------|
| `client/src/lib/backup/__tests__/restore.test.ts` | `openRestoreFromFolder`: success, cancel (no-op), invalid folder (no manifest), unsupported API |
| `client/src/components/settings/sections/__tests__/SnapshotBrowser.test.tsx` | `externalProvider` prop is used instead of IndexedDB lookup |
| `client/src/components/settings/sections/__tests__/BackupSettings.test.tsx` | "Restore from backup folder" button appears in disabled state (when `hasFsAccess`); absent when API unavailable |
| `client/src/components/transcript-editor/__tests__/TranscriptList.test.tsx` | "Restore from backup" button appears in empty state when prop provided |
| `client/src/components/transcript-editor/__tests__/hooks.test.tsx` | `getEmptyStateMessage` with `t` param returns translated strings |

---

## Acceptance Criteria

- [ ] `openRestoreFromFolder()` is exported from `restore.ts`; cancel is a no-op, invalid folder shows an error toast
- [ ] `SnapshotBrowser` accepts and uses `externalProvider` when provided
- [ ] "Restore from backup folder" button appears in `BackupSettings` disabled state (File System Access API only)
- [ ] "Restore from backup" button appears in the empty transcript editor state (File System Access API only)
- [ ] After successful restore via `externalProvider`, a dialog asks the user whether to keep the folder as backup location
- [ ] Confirming "Yes" enables backup with the chosen folder; "No" closes with no side effects
- [ ] All hardcoded strings in `BackupSettings.tsx` and `RestoreBanner.tsx` are replaced with `t()` calls
- [ ] `getEmptyStateMessage()` no longer returns hardcoded English strings
- [ ] All new i18n keys are present in both `en.json` and `de.json`
- [ ] `npm run check && npm run lint:fix && npm test` passes with no regressions
- [ ] New tests cover the critical paths listed above
