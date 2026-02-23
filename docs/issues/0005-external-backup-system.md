# External Backup System — File System Access API + Firefox Fallback

## Summary

FlowScribe currently persists all session data in `localStorage`. This works well for normal use, but a single `QuotaExceededError`, a browser data wipe, or a crash during a long editing session can cause irreversible data loss. This issue specifies a **privacy-first, local-only, low-friction backup system** that writes versioned snapshots to a user-chosen folder on disk.

The system is entirely opt-in. FlowScribe continues to work as-is without any setup. Once activated, backups run silently in the background. A crash-recovery flow detects available snapshots on startup and offers to restore them.

---

## Goals

| Goal | Description |
|------|-------------|
| **Default unchanged** | No setup required. IndexedDB/localStorage path is untouched. |
| **One-time setup** | User picks a folder once, grants permission, done. |
| **Crash-resilient** | On restart, FlowScribe detects an available backup and offers restore. |
| **Privacy-first** | Everything stays on disk. No cloud, no telemetry. |
| **Non-intrusive** | No repeated popups. Status visible but out of the way. |
| **Opt-out of reminders** | 20-minute dirty-reminder toasts can be permanently disabled. |

---

## Scope

| Dimension | Decision |
|-----------|----------|
| Backup granularity | Per session, dirty-marker driven |
| Global state | Everything except API keys (templates, prompts, provider config, glossary, spellcheck ignores, custom dicts) |
| Primary target | Chrome / Edge via File System Access API |
| Firefox fallback | Manual export with optional dirty reminders |
| Safari / iOS | Out of scope for now |

---

## Architecture

```
client/src/lib/backup/
├── types.ts                    — All types, no logic
├── BackupProvider.ts           — Provider interface
├── providers/
│   ├── FileSystemProvider.ts   — Chrome/Edge (File System Access API)
│   └── DownloadProvider.ts     — Firefox fallback
├── BackupScheduler.ts          — Dirty tracking, debounce, interval, critical events
├── BackupStore.ts              — Zustand slice (config + runtime status)
├── snapshotSerializer.ts       — Serialize → gzip → checksum (native + pako fallback)
├── retention.ts                — Cleanup logic
└── restore.ts                  — Startup restore check, schema migration

client/src/components/
├── settings/BackupSettings.tsx     — Settings tab
├── backup/RestoreBanner.tsx        — Startup restore banner
└── backup/BackupStatusIndicator.tsx — Toolbar status icon
```

The backup system is **fully additive**. It does not touch the existing localStorage persistence path (`storage.ts`, `createStorageScheduler`). It registers a separate Zustand subscriber alongside the existing one.

---

## Data Types

```typescript
// ── Config (persisted in PersistedGlobalState) ───────────────────────────

type BackupProviderType = "filesystem" | "download";
type BackupStatus       = "disabled" | "enabled" | "paused" | "error";
type BackupReason       = "scheduled" | "critical" | "manual" | "enabled" | "before-unload";

interface BackupConfig {
  providerType: BackupProviderType;
  enabled: boolean;
  includeGlobalState: boolean;        // default: true
  locationLabel: string | null;       // e.g. "flowscribe-backup"
  lastBackupAt: number | null;        // ms timestamp
  lastError: string | null;
  status: BackupStatus;
  maxSnapshotsPerSession: number;     // default: 50
  maxGlobalSnapshots: number;         // default: 20
  disableDirtyReminders: boolean;     // default: false — see § Reminders
}

// ── Manifest ─────────────────────────────────────────────────────────────

interface SnapshotEntry {
  filename: string;                   // relative path under sessions/<keyHash>/
  sessionKeyHash: string;             // first 8 chars of SHA-1(sessionKey) — folder name
  sessionLabel: string | null;        // human-readable label at snapshot time
  createdAt: number;
  reason: BackupReason;
  appVersion: string;
  schemaVersion: number;
  compressedSize: number;             // bytes on disk
  checksum: string;                   // SHA-256 of uncompressed JSON (hex)
}

interface BackupManifest {
  manifestVersion: 1;
  snapshots: SnapshotEntry[];         // newest first; per-session entries mixed
  globalSnapshots: SnapshotEntry[];   // newest first
}

// ── Snapshot file content (stored gzip-compressed) ───────────────────────

interface SessionSnapshot {
  schemaVersion: number;
  appVersion: string;
  createdAt: number;
  sessionKey: string;
  reason: BackupReason;
  checksum: string;                   // SHA-256 of JSON({...snapshot, checksum: ""})
  session: PersistedSession;
  globalState?: SanitizedGlobalState; // present when includeGlobalState is true
}

// Global state minus API keys
interface SanitizedGlobalState {
  aiTemplates: AITemplate[];
  aiProviders: Array<Omit<AIProvider, "apiKey">>;
  lexiconEntries: LexiconEntry[];
  lexiconThreshold: number;
  spellcheckEnabled: boolean;
  spellcheckLanguages: SpellcheckLanguage[];
  spellcheckIgnoreWords: string[];
  spellcheckCustomDictionaries: SpellcheckCustomDictionary[];
  // further global prefs as they are added
}
```

`API keys are never written to backup files, not even in encrypted form.`

---

## Provider Interface

```typescript
interface BackupProvider {
  isSupported(): boolean;

  /** One-time setup: user picks folder / enables download mode */
  enable(): Promise<{ ok: true; locationLabel: string } | { ok: false; error: string }>;
  disable(): Promise<void>;

  /** Silent permission check — no browser prompt */
  verifyAccess(): Promise<boolean>;

  /** Write compressed snapshot bytes to the appropriate subfolder */
  writeSnapshot(entry: SnapshotEntry, data: Uint8Array): Promise<void>;

  /** Write (overwrite) manifest.json — called LAST after every successful snapshot write */
  writeManifest(manifest: BackupManifest): Promise<void>;

  /** Read manifest.json, returns null if missing */
  readManifest(): Promise<BackupManifest | null>;

  /** Read snapshot bytes by filename for restore */
  readSnapshot(filename: string): Promise<Uint8Array | null>;

  /** Delete snapshot files by filename (used by retention) */
  deleteSnapshots(filenames: string[]): Promise<void>;
}
```

---

## File System Access Provider (Chrome / Edge)

### Directory handle persistence

`FileSystemDirectoryHandle` is not JSON-serializable → stored in **IndexedDB**, not `localStorage`.

```
IndexedDB database : "flowscribe-backup"
  object store     : "handles"
  key              : "directoryHandle"
  value            : FileSystemDirectoryHandle (structured clone)
```

### Permission lifecycle

```
App start
  └─ queryPermission({ mode: "readwrite" })
        ├─ "granted"  → status = "enabled",  proceed normally
        ├─ "prompt"   → status = "paused",   show badge (no popup)
        └─ "denied"   → status = "paused",   show badge

First backup attempt after "paused"
  └─ requestPermission({ mode: "readwrite" })
        ├─ "granted"  → status = "enabled",  write snapshot
        └─ "denied"   → status = "error",    show error in settings
```

Permission is **never requested proactively** outside of a user gesture or an explicit backup attempt.

### Folder layout

```
flowscribe-backup/
├── manifest.json
├── sessions/
│   ├── a3f2b1c4/                        ← SHA-1(sessionKey)[:8]
│   │   ├── 2026-02-23T07-58-12Z__scheduled.json.gz
│   │   ├── 2026-02-23T08-14-00Z__critical.json.gz
│   │   └── .tmp_2026-02-23T08-14-00Z__critical.json.gz  ← cleaned on startup
│   └── c9d4e2f1/
│       └── ...
├── global/
│   └── 2026-02-23T08-00-00Z.json.gz
└── logs/
    └── backup.log                        ← optional diagnostic log
```

Filename format: `<ISO-compact-datetime>__<reason>.json.gz`
ISO compact = colons replaced with hyphens: `2026-02-23T07-58-12Z`

### Atomic write pattern

The File System Access API has no atomic rename. The closest safe pattern is:

```
1. Write full data to sessions/<hash>/.tmp_<filename>
2. Flush and close writable
3. Write final data to sessions/<hash>/<filename>  (complete overwrite)
4. Delete .tmp_<filename>
5. Update manifest.json  ← ALWAYS LAST
```

If the process crashes between steps 3 and 5, a `.tmp_` file may remain. On startup, any `.tmp_` files in the sessions folder are deleted before any new writes.

---

## Download Provider (Firefox fallback)

Firefox does not implement the File System Access API. The download provider is a **first-class, low-friction fallback** — not an afterthought.

### Behavior

The download provider does not auto-download. Auto-triggering repeated `<a download>` calls is blocked by browsers and creates a poor experience. Instead:

1. When a backup would be written, the provider stores `pendingDownload` in memory.
2. The toolbar icon changes to indicate a download is ready.
3. User clicks the icon → a single download is triggered with the latest snapshot filename.
4. Optionally: a toast reminder fires every 20 minutes while the session is dirty (can be disabled — see § Reminders below).

### "Backup pending" toolbar icon state

```
Firefox + backup enabled + dirty > 5 min:

  [ ⬇ ] ← toolbar icon, amber color
  Tooltip: "Backup ready to download — click to save"
```

---

## Dirty Tracking & Scheduler

### Dirty map

```typescript
interface DirtySession {
  sessionKey: string;
  dirtyAt: number;            // timestamp of first change since last backup
  lastBackedUpAt: number | null;
}

// O(1) lookup
const dirtySessions = new Map<string, DirtySession>();
```

### Trigger hierarchy

```
Store subscription fires
  → compare current session state to last-backed-up state
  → if changed: dirtySessions.set(sessionKey, { dirtyAt: now })

                    ┌──────────────────────────────────────┐
                    │                                      │
              Debounce timer                        Hard interval
              30s after last change                 every 3 min
              (reset on each change)                (runs if any dirty sessions exist)
                    │                                      │
                    └──────────────┬───────────────────────┘
                                   ▼
                         backupDirtySessions()

Critical event  ──────────────────▶  backupNow(reason)  (no debounce)
```

### Critical events (immediate trigger)

Fired via `window.dispatchEvent(new CustomEvent("flowscribe:backup-critical", { detail: { reason } }))`:

| Trigger site | Reason string |
|---|---|
| Transcription finished | `"transcription-finished"` |
| Bulk edit / merge | `"bulk-edit"` |
| Import finished | `"import-finished"` |
| Manual button in settings | `"manual"` |

### `beforeunload` handling

`FileSystemProvider.writeSnapshot` is async and cannot reliably complete inside a synchronous `beforeunload` handler. The approach:

1. In `beforeunload`: set `sessionStorage.setItem("flowscribe:dirty-unload", "1")`.
2. On next startup: if the flag is present and a backup folder is configured, run `backupNow("before-unload")` before clearing the flag.

---

## Snapshot Serialization

### Compression: native first, pako fallback

```typescript
async function compress(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream !== "undefined") {
    // Native — Chrome 80+, Firefox 113+
    const cs = new CompressionStream("gzip");
    const writer = cs.writable.getWriter();
    writer.write(bytes);
    writer.close();
    return new Uint8Array(await new Response(cs.readable).arrayBuffer());
  }
  // Fallback: pako (added as dependency)
  const { gzip } = await import("pako");
  return gzip(bytes);
}

async function decompress(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== "undefined") {
    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  }
  const { ungzip } = await import("pako");
  return ungzip(bytes);
}
```

`pako` is imported dynamically so it is only loaded on browsers that need it.

### Checksum

```typescript
async function computeChecksum(json: string): Promise<string> {
  const bytes = new TextEncoder().encode(json);
  const hash  = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
```

On restore, the checksum is recomputed and compared. A mismatch causes the restore to skip to the next-newest snapshot automatically, with a visible warning.

---

## Retention

Two independent retention limits, both configurable in settings:

| Setting | Default | What it governs |
|---------|---------|-----------------|
| `maxSnapshotsPerSession` | 50 | Snapshots kept per session folder |
| `maxGlobalSnapshots` | 20 | Global-state snapshots kept |

Cleanup runs **after** each successful write + manifest update, never before. Algorithm: sort by `createdAt` descending, keep first N, delete the rest.

```typescript
function pruneManifest(
  manifest: BackupManifest,
  maxPerSession: number,
  maxGlobal: number,
): { manifest: BackupManifest; toDelete: string[] } {
  const bySession = groupBy(manifest.snapshots, s => s.sessionKeyHash);
  const kept: SnapshotEntry[] = [];
  const toDelete: string[] = [];

  for (const entries of Object.values(bySession)) {
    const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt);
    kept.push(...sorted.slice(0, maxPerSession));
    toDelete.push(...sorted.slice(maxPerSession).map(e => e.filename));
  }

  const sortedGlobal = [...manifest.globalSnapshots].sort((a, b) => b.createdAt - a.createdAt);
  const keptGlobal  = sortedGlobal.slice(0, maxGlobal);
  const deletedGlobal = sortedGlobal.slice(maxGlobal).map(e => e.filename);

  return {
    manifest: { ...manifest, snapshots: kept, globalSnapshots: keptGlobal },
    toDelete: [...toDelete, ...deletedGlobal],
  };
}
```

---

## Restore Flow

### Startup check

```
App initializes
  └─ backupConfig.enabled?
        └─ yes → verifyAccess()
              └─ provider reachable?
                    └─ yes → readManifest()
                          └─ any snapshots?
                                └─ yes → is localStorage empty / no segments?
                                              └─ yes → show RestoreBanner
```

The banner is shown at most once per browser session (`sessionStorage` flag). Dismissing it does not disable backups.

### Restore banner

```
┌─────────────────────────────────────────────────────────────────┐
│  🔄  Backup found · "Interview with Dr. Müller" · 2 minutes ago │
│                                                                 │
│  [  Restore  ]  [ View all snapshots ]  [ Dismiss ]            │
└─────────────────────────────────────────────────────────────────┘
```

- **Restore**: loads snapshot → validates checksum → runs schema migrations → writes to localStorage → activates session. If checksum fails, tries next snapshot.
- **View all snapshots**: opens the snapshot browser in Settings > Backup.
- **Dismiss**: stores `sessionStorage` flag, does not affect backup operation.

### Schema migration

```typescript
interface SnapshotMigration {
  fromVersion: number;
  toVersion: number;
  migrate: (snapshot: SessionSnapshot) => SessionSnapshot;
}

const migrations: SnapshotMigration[] = [
  // populated as schema evolves, e.g.:
  // { fromVersion: 1, toVersion: 2, migrate: v1ToV2 }
];
```

Migration is applied in order. After migration the checksum is NOT re-validated (it was computed at write time against the original schema version).

---

## Settings UI

### Backup tab (enabled state)

```
┌─ Backup ─────────────────────────────────────────────────────────────┐
│                                                                      │
│  Automatic backups                                         [ On ●──] │
│  Folder: ~/Documents/flowscribe-backup/                              │
│                                                                      │
│  Last backup: 3 minutes ago                                          │
│  Backup folder size: ~2.4 MB                                         │
│                                                                      │
│  [ Backup now ]  [ Open backup folder ]  [ View snapshots ]          │
│                                                                      │
│  ──────────────────────────────────────────────────────────────────  │
│                                                                      │
│  Include settings in backup                                [On ●──]  │
│  (templates, glossary, providers — API keys are never backed up)     │
│                                                                      │
│  Max snapshots per session            [ 50  ▲▼ ]                    │
│  Max global settings snapshots        [ 20  ▲▼ ]                    │
│                                                                      │
│  ──────────────────────────────────────────────────────────────────  │
│                                                                      │
│  Remind me to save when unsaved changes > 20 min  [On ●──]          │
│  (shows a toast — only relevant for browsers without auto-backup)   │
│                                                                      │
│  [ Disable backups ]                                                 │
└──────────────────────────────────────────────────────────────────────┘
```

### Backup tab (paused — permission lost)

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

### Backup tab (disabled state)

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

### Snapshot browser (within Settings > Backup)

```
┌─ Snapshots ─────────────────────────────────────────────────────────┐
│                                                                     │
│  Session: "Interview with Dr. Müller"  [▼ switch session]          │
│                                                                     │
│  Date/Time             Reason        Size    Action                 │
│  ─────────────────────────────────────────────────────────────────  │
│  Today 14:23           scheduled     48 KB   [ Restore ]           │
│  Today 12:01           critical      47 KB   [ Restore ]           │
│  Today 09:15           manual        46 KB   [ Restore ]           │
│  Yesterday 18:44       scheduled     44 KB   [ Restore ]           │
│  ...                                                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Toolbar Status Indicator

A small icon placed next to the settings gear. Hidden when backups are disabled.

| State | Visual | Tooltip |
|-------|--------|---------|
| OK (last backup < 5 min) | green icon | "Last backup: 3 min ago" |
| Working / dirty > 5 min | amber icon | "Backup scheduled…" |
| Paused (permission lost) | amber icon | "Backups paused — click to re-authorize" |
| Error | red icon | "Backup error — see Settings" |

Clicking the icon navigates to Settings > Backup.

---

## 20-Minute Dirty Reminder

A toast fires when a session has unsaved-to-backup changes for more than 20 minutes. This is the primary UX for the Firefox fallback but is also relevant when the File System Provider is paused.

The toast reads:
> **Unsaved changes** — Your session hasn't been backed up for 20 minutes.
> [Back up now] [Open Settings] [Don't remind me]

**"Don't remind me"** permanently sets `backupConfig.disableDirtyReminders = true`. This is also exposed as a toggle in Settings > Backup (see mockup above) so users can re-enable it later.

---

## Opt-in Activation Triggers

The backup feature is never pushed on every launch. It is offered once, in context, when the risk is elevated:

| Trigger | Condition |
|---------|-----------|
| Large session | Segment count > 500 or audio > 30 min |
| Long session | Active editing for > 20 min with no backup configured |
| First audio import | On the very first `setAudioReference` call, show once |
| Quota exceeded | `flowscribe:storage-quota-exceeded` event already shows a dialog — add backup CTA |

The activation prompt is stored in `localStorage` as "offered once". It does not reappear after being dismissed.

### Activation dialog

```
┌──────────────────────────────────────────────────────┐
│  Enable automatic backups?                           │
│                                                      │
│  FlowScribe can save snapshots to a folder on your  │
│  computer. Helps after crashes or browser resets.   │
│                                                      │
│  [ Choose folder ]   [ Not now ]   [ Learn more ↗ ] │
└──────────────────────────────────────────────────────┘
```

---

## Integration Points with Existing Code

| File | Change |
|------|--------|
| `client/src/lib/store.ts` | Register `BackupScheduler` as a second subscriber |
| `client/src/lib/store/types.ts` | Add `backupConfig: BackupConfig` to `PersistedGlobalState` |
| `client/src/lib/store/utils/globalState.ts` | Add `sanitizeForBackup()` that strips API keys |
| `client/src/lib/storage.ts` | No changes — `readSessionsState()` used as source in scheduler |
| `client/src/components/StorageQuotaDialog.tsx` | Add backup activation CTA |
| Settings components | Add "Backup" tab |
| Toolbar component | Mount `BackupStatusIndicator` |

No existing file is modified in a breaking way. All changes are additive.

---

## Decisions Already Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Compression | Native `CompressionStream`, pako as dynamic fallback | Zero bundle cost on Chrome/Firefox 113+; pako loaded only when needed |
| Directory handle storage | IndexedDB | `FileSystemDirectoryHandle` requires structured clone, not JSON |
| Manifest timing | Written last, after all snapshot files are flushed | Manifest integrity: a missing manifest entry means a missing file was never committed |
| API keys in backup | Never included | User expectation, security hygiene — keys have separate export paths if needed |
| Reminder opt-out | Persistent toggle in `BackupConfig` | Prevents nag fatigue; survives page reloads |
| Safari / iOS | Out of scope | No File System Access API; no good fallback story without cloud |
| beforeunload | Flag in `sessionStorage`, backup on next startup | Async write cannot complete reliably inside synchronous `beforeunload` |
| Snapshot integrity failure | Skip to next snapshot, warn user | Silent corruption should never silently restore corrupt data |

---

## Out of Scope (this issue)

- Audio file backup (large binary, opt-in if added later)
- Delta / journal mode (full snapshots are sufficient at current scale)
- Time-based retention tiers (hourly / daily — FIFO with configurable max is sufficient for v1)
- WebDAV / Nextcloud provider
- Cloud sync
