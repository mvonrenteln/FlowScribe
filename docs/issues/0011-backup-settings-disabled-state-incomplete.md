# Backup: Settings incomplete in disabled state

**Type:** Bug
**Oberticket:** [#0005 External Backup System](./0005-external-backup-system.md)

---


## Problem

The disabled state of the backup settings only shows the "Choose backup folder" button. Two elements specified in the spec are missing:

1. **"Automatic backups [Off]" toggle** — completely missing
2. **"Remind me to save" toggle** — only present in enabled state, not in disabled

---


## Expected Behavior (Spec)

From the spec [#0005, section "Backup tab (disabled state)"]:

```
┌─ Backup ──────────────────────────────────────────────────────────────┐
│                                                                       │
│  Automatic backups                                        [Off ──○]  │
│                                                                       │
│  FlowScribe can save versioned snapshots of your work to a           │
│  folder on your computer. Nothing is sent to any server.             │
│                                                                       │
│  [ Choose backup folder ]                                             │
│                                                                       │
│  Remind me to save when unsaved changes > 20 min  [On ●──]          │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---


## Current State

In [`BackupSettings.tsx`](../../client/src/components/settings/sections/BackupSettings.tsx), disabled branch (`!backupConfig.enabled`):

```tsx
<div className="space-y-3">
  <p className="text-sm text-muted-foreground">
    Choose a folder to store backup snapshots...
  </p>
  <Button onClick={handleEnable}>Choose backup folder</Button>
  {backupConfig.lastError && <p>{backupConfig.lastError}</p>}
</div>
```


No toggle, no remind toggle.

---


## Discussion: "Automatic backups" toggle

The toggle only makes sense in the disabled state if an "Off" switch is shown that enables activation. The current implementation instead uses a button ("Choose backup folder"), which is more idiomatic for the primary flow (FileSystem API) — the toggle would do exactly the same.

**Recommendation**: Omit the toggle, but improve the description instead. Alternatively: show a toggle that opens the folder picker when enabled.

---


## Desired Solution

### "Remind me to save" toggle in disabled state

This toggle is also relevant without a backup folder — it controls whether a toast appears after 20 minutes of unsaved changes (especially relevant for Firefox users without auto-backup).

Move the toggle block from the enabled state to a shared section below both branches:

```tsx
{/* Gilt unabhängig vom Aktivierungszustand */}
<Separator />
<div className="flex items-center justify-between">
  <div className="space-y-0.5">
    <Label htmlFor="disable-reminders">Disable unsaved reminders</Label>
    <p className="text-xs text-muted-foreground">
      Stop periodic toast notifications about unsaved backups
    </p>
  </div>
  <Switch
    id="disable-reminders"
    checked={backupConfig.disableDirtyReminders}
    onCheckedChange={(v) => setBackupConfig({ disableDirtyReminders: v })}
  />
</div>
```

---


## Affected Files

- `client/src/components/settings/sections/BackupSettings.tsx` — move "Remind me" toggle from enabled branch to shared area
