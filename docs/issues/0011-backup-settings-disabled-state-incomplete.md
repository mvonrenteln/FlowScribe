# Backup: Settings im deaktivierten Zustand unvollständig

**Type:** Bug
**Oberticket:** [#0005 External Backup System](./0005-external-backup-system.md)

---

## Problem

Der deaktivierte Zustand der Backup-Settings zeigt nur den "Choose backup folder"-Button. Zwei im Spec vorgesehene Elemente fehlen:

1. **"Automatic backups [Off]"-Toggle** — fehlt komplett
2. **"Remind me to save"-Toggle** — ist nur im aktivierten Zustand vorhanden, nicht im deaktivierten

---

## Erwartetes Verhalten (Spec)

Aus dem Spec [#0005, Abschnitt "Backup tab (disabled state)"]:

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

## Ist-Zustand

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

Kein Toggle, kein Remind-Toggle.

---

## Diskussion: "Automatic backups"-Toggle

Der Toggle macht im disabled-State nur Sinn wenn ein "Off"-Schalter angezeigt wird, der das Aktivieren ermöglicht. Die aktuelle Implementierung nutzt stattdessen einen Button ("Choose backup folder"), was für den primären Flow (FileSystem API) idiomatischer ist — der Toggle würde genau dasselbe tun.

**Empfehlung**: Den Toggle weglassen, aber stattdessen die Beschreibung verbessern. Alternativ: Toggle anzeigen, der beim Einschalten den Folder-Picker öffnet.

---

## Gewünschte Lösung

### "Remind me to save"-Toggle im deaktivierten Zustand

Dieser Toggle ist auch ohne Backup-Ordner relevant — er steuert, ob bei ungesicherten Änderungen nach 20 Minuten ein Toast erscheint (besonders relevant für Firefox-Nutzer ohne Auto-Backup).

Den Toggle-Block aus dem enabled-State in einen gemeinsamen Abschnitt unterhalb beider Branches verschieben:

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

## Betroffene Dateien

- `client/src/components/settings/sections/BackupSettings.tsx` — "Remind me"-Toggle aus dem enabled-Branch in einen gemeinsamen Bereich verschieben
