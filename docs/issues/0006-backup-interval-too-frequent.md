# Backup: interval too frequent and not configurable

**Type:** Bug
**Parent:** [#0005 External Backup System](./0005-external-backup-system.md)

---

## Problem

The `BackupScheduler` writes snapshots far too frequently. In a 5-minute test, 5 backups were created. With the default setting of `maxSnapshotsPerSession: 50`, the quota would be exhausted in under 2 hours.

Additionally, the backup interval is not configurable — timers are hardcoded.

---

## Root causes

### 1. Debounce drives backups instead of the interval

The scheduler posts a backup 30 seconds after every content change (debounce). The 3-minute hard interval is merely a fallback. This inverts the intended semantics: **the configured interval should be the primary driver**, not the debounce.

The correct mental model:
- The interval fires every N minutes → *then* a backup is written (immediately if the user is idle, or after a brief grace period if they are actively editing)
- The debounce is only a short grace period (≤ 30 s) to avoid writing a snapshot mid-edit

### 2. `BackupConfig` has no interval field

`backupIntervalMinutes` is missing from `BackupConfig` in [`types.ts`](../../client/src/lib/backup/types.ts). There is no way to control the interval from the settings UI.

---

## Expected behaviour

- **Backup interval** (`backupIntervalMinutes`, default 20): the *minimum* time between consecutive automatic backups. A backup is never triggered earlier than this.
- **Grace period** (30 s, fixed): when the interval fires and the user is actively editing, the backup is deferred by up to 30 s to avoid interrupting an in-progress edit.
- **Maximum deferral** (5 min): if the user edits continuously without pause, the backup happens at most 5 minutes after the interval would have fired. The total window is therefore at most `backupIntervalMinutes + 5 min`.
- **Content-only dirty detection**: `onStateChange` must only register a content change (and update `lastContentChangeAt`) when the session's segment count actually changes — not on every store notification (cursor position, selection, filter state, etc.).

With `maxSnapshotsPerSession: 50` and a 20-minute interval the quota covers ≈ 16 hours of editing.

---

## Desired solution

### A) Add `backupIntervalMinutes` to `BackupConfig`

```typescript
interface BackupConfig {
  // ...
  /** Minimum minutes between automatic backups. Default: 20. Range: 5–60. */
  backupIntervalMinutes: number;
}
```

Default: `20`.

### B) Interval-driven scheduling

Replace the debounce-driven approach with an interval-driven one:

1. The hard interval fires every `backupIntervalMinutes` minutes.
2. When it fires and dirty state exists:
   - If `Date.now() - lastContentChangeAt < 30 000` → user is editing → defer by `30 000 - elapsed` ms.
   - Re-check after the grace period. If still editing and total deferral < 5 min → defer again.
   - Otherwise → write backup immediately.
3. Manual / critical backups (`flowscribe:backup-critical`) always bypass the grace period.

When `backupIntervalMinutes` changes, restart the hard interval timer.

### C) Settings UI

Add a number input "Backup every X minutes" (range 5–60). The three snapshot/interval inputs should be listed as separate rows, not in a 2-column grid.

---

## Affected files

- `client/src/lib/backup/BackupScheduler.ts` — scheduling logic, `onStateChange`, `start()`
- `client/src/lib/backup/types.ts` — `BackupConfig` interface + `DEFAULT_BACKUP_CONFIG`
- `client/src/components/settings/sections/BackupSettings.tsx` — new setting field
