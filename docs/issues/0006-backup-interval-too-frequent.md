# Backup: Intervall zu häufig und nicht konfigurierbar

**Type:** Bug
**Oberticket:** [#0005 External Backup System](./0005-external-backup-system.md)

---

## Problem

Der BackupScheduler schreibt Snapshots viel zu häufig. In einem 5-Minuten-Test entstanden 5 Backups. Mit den Standard-Einstellungen (`maxSnapshotsPerSession: 50`) wäre das Kontingent in unter 2 Stunden aufgebraucht.

Außerdem bietet die UI kein konfigurierbares Backup-Intervall — Debounce und Hard-Interval sind fest im Code verdrahtet.

---

## Ursachen (im Code)

### 1. Zu kurze Hardcoded-Timer

In [`BackupScheduler.ts`](../../client/src/lib/backup/BackupScheduler.ts):

```typescript
const DEBOUNCE_MS = 30_000;       // 30 Sekunden Debounce nach letzter Änderung
const HARD_INTERVAL_MS = 3 * 60_000;  // Alle 3 Minuten hard interval
```

Das Spec-Dokument nennt diese Werte zwar, aber für reale Nutzung ist 3 Minuten Hard-Interval zu kurz — und führt in Kombination mit dem Debounce dazu, dass jede Änderung nach 30 Sekunden ein Backup auslöst.

### 2. `globalDirty = true` bei JEDER Store-Änderung

```typescript
// Mark global state as potentially dirty on any store change
this.globalDirty = true;
this.scheduleBatch();
```

`onStateChange` wird bei *jeder* Store-Subscription ausgelöst — auch bei reinen UI-State-Änderungen wie Segment-Selektion, Cursor-Position, Filter-Zustand. Dadurch wird bei jeder Benutzeraktion ein 30-Sekunden-Debounce angestoßen.

### 3. `BackupConfig` hat kein Intervall-Feld

In [`types.ts`](../../client/src/lib/backup/types.ts) fehlt `backupIntervalMinutes` in `BackupConfig`. Es gibt keine Möglichkeit, das Intervall über die Settings zu steuern.

---

## Erwartetes Verhalten (Spec)

Aus dem Spec nicht explizit genannt, aber impliziert: Das System soll **nicht mehrfach pro Minute** sichern. Reasonable defaults:

- Debounce: 2 Minuten nach letzter echter Änderung
- Hard-Interval: **konfigurierbar**, Default **20 Minuten**
- `globalDirty` nur setzen bei echten Inhaltsänderungen (Segmente, Speaker, Tags), nicht bei reinen UI-Zustandsänderungen

Mit `maxSnapshotsPerSession: 50` und 20-Minuten-Intervall: Kontingent reicht für ~16 Stunden Editierzeit.

---

## Gewünschte Lösung

### A) Konfigurierbar machen

`BackupConfig` um `backupIntervalMinutes: number` erweitern (Default: 20):

```typescript
interface BackupConfig {
  // ...
  backupIntervalMinutes: number;  // default: 20
}
```

`BackupScheduler.start()` liest `backupIntervalMinutes` aus dem Store und verwendet es für den Hard-Interval. Bei Konfigurationsänderung den Timer neu starten.

Settings-UI: Slider oder Number-Input "Backup every X minutes" (Bereich: 5–60 min).

### B) Dirty-Erkennung verbessern

`globalDirty` nur bei echten Inhaltsänderungen setzen. Die `onStateChange`-Subscription sollte einen engeren Selector verwenden (z.B. nur `segments`, `speakers`, `tags`, `aiTemplates` etc.), nicht den gesamten Store-State.

### C) Debounce anpassen

`DEBOUNCE_MS` auf 2 Minuten (120_000) erhöhen oder ebenfalls konfigurierbar machen.

---

## Betroffene Dateien

- `client/src/lib/backup/BackupScheduler.ts` — Timer-Konstanten, `onStateChange`, `start()`
- `client/src/lib/backup/types.ts` — `BackupConfig` Interface + `DEFAULT_BACKUP_CONFIG`
- `client/src/components/settings/sections/BackupSettings.tsx` — neues Setting-Feld
