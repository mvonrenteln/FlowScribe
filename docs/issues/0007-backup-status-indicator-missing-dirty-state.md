# Backup: Toolbar-Indikator zeigt keinen Dirty-Zustand

**Type:** Bug
**Oberticket:** [#0005 External Backup System](./0005-external-backup-system.md)

---

## Problem

Der `BackupStatusIndicator` in der Toolbar kennt nur drei Zustände: `enabled` (grün), `paused` (amber), `error` (rot). Der Spec beschreibt zusätzlich einen **Amber-Zustand für "dirty > X Minuten"**, der anzeigt, dass ungesicherte Änderungen vorliegen.

---

## Erwartetes Verhalten (Spec)

Aus dem Spec [#0005, Abschnitt "Toolbar Status Indicator"]:

| State | Visual | Tooltip |
|-------|--------|---------|
| OK (last backup < 5 min) | green icon | "Last backup: 3 min ago" |
| **Working / dirty > 5 min** | **amber icon** | **"Backup scheduled…"** |
| Paused (permission lost) | amber icon | "Backups paused — click to re-authorize" |
| Error | red icon | "Backup error — see Settings" |

---

## Ist-Zustand

In [`BackupStatusIndicator.tsx`](../../client/src/components/backup/BackupStatusIndicator.tsx):

```typescript
const getIcon = () => {
  switch (backupConfig.status) {
    case "enabled":  return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "paused":   return <PauseCircle  className="h-4 w-4 text-amber-500" />;
    case "error":    return <AlertCircle  className="h-4 w-4 text-destructive" />;
    default:         return <HardDrive   className="h-4 w-4 text-muted-foreground" />;
  }
};
```

Der Indikator liest nur `backupConfig.status` aus dem Store. Es gibt keine Information darüber, ob gerade ungesicherte Änderungen vorliegen oder wann zuletzt etwas geändert wurde.

---

## Gewünschte Lösung

Der Indikator soll amber werden, wenn:
- Backup ist `enabled`
- Es gibt ungesicherte Änderungen (`dirty`)
- Die letzte Sicherung ist älter als der konfigurierte Schwellwert (z.B. 5 Minuten oder die Hälfte des konfigurierten Intervalls)

**Option A**: `BackupScheduler` schreibt einen `isDirty: boolean`-Flag in den Store (`backupConfig` oder separater Slice), den der Indikator lesen kann.

**Option B**: Der Indikator liest `backupConfig.lastBackupAt` und vergleicht mit `Date.now()`. Wenn die Differenz > Threshold und Backup enabled, amber anzeigen.

Option B ist simpler und benötigt keine Scheduler-Änderung.

---

## Betroffene Dateien

- `client/src/components/backup/BackupStatusIndicator.tsx` — Icon-Logik erweitern
