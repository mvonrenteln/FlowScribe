# AI Transcript Revision - TODO Liste

## 📋 Übersicht

Diese TODO-Liste dokumentiert alle Implementierungsschritte für das AI Transcript Revision Feature.
Siehe [Konzept-Dokument](./ai-transcript-revision.md) für Details.

**Geschätzter Gesamtaufwand**: 8-13 Tage  
**Start**: TBD  
**Status**: 🟡 In Planung

---

## Phase 1: Foundation (2-3 Tage) ✅

### 1.1 Types & Interfaces
- [x] `RevisionType` Union Type definieren
- [x] `RevisionState` Interface erstellen
- [x] `TextChange` Interface für Diff erstellen
- [x] `AIRevisionConfig` Interface erstellen
- [x] `RevisionTemplate` Interface erstellen
- [x] `AIRevisionSlice` Interface definieren
- [x] Types zu `client/src/lib/store/types.ts` hinzufügen

### 1.2 Store Slice
- [x] `client/src/lib/store/slices/aiRevisionSlice.ts` erstellen
- [x] Initial State definieren
- [x] `startSingleRevision` Action implementieren
- [x] `startBatchRevision` Action implementieren
- [x] `cancelRevision` Action implementieren
- [x] `acceptRevision` Action implementieren
- [x] `rejectRevision` Action implementieren
- [x] `acceptAllRevisions` Action implementieren
- [x] `rejectAllRevisions` Action implementieren
- [x] `clearRevisions` Action implementieren
- [x] `updateRevisionConfig` Action implementieren
- [x] Slice in `store.ts` integrieren
- [x] `initialAIRevisionState` exportieren

### 1.3 Diff Utility
- [x] `client/src/lib/diffUtils.ts` erstellen (eigene Implementierung statt externes Package)
- [x] `computeTextChanges(original, revised)` Funktion
- [x] `summarizeChanges(changes)` Funktion
- [x] `getOriginalDiffSegments()` und `getRevisedDiffSegments()` für Side-by-Side

### 1.4 Service Layer
- [x] `client/src/lib/services/aiRevisionService.ts` erstellen
- [x] Default Revision Templates definieren (nicht löschbar, bearbeitbar):
  - [x] **Transkript-Bereinigung**: Rechtschreibung, Füllwörter, Grammatik
  - [x] **Formulierung verbessern**: Klarere Ausdrucksweise
  - [x] **Formalisieren**: Informell → formell
- [x] Template-Schema mit `isDefault` Flag für nicht-löschbare Templates
- [x] `buildRevisionPrompt(template, segment, context)` implementieren
- [x] `parseRevisionResponse(response)` implementieren
- [x] `reviseSegment(segment, templateId, context, config)` implementieren
- [x] `reviseSegmentsBatch()` als AsyncGenerator implementieren
- [x] Integration mit bestehendem AI Provider System

### 1.5 Unit Tests - Phase 1
- [x] `client/src/lib/__tests__/diffUtils.test.ts` (21 Tests)
- [x] `client/src/lib/store/slices/__tests__/aiRevisionSlice.test.ts` (26 Tests)

---

## Phase 2: Single Segment UI (2-3 Tage) 🟡

### 2.1 AI Button Component
- [x] `client/src/components/transcript-editor/AIRevisionPopover.tsx` erstellen
- [x] Sparkle Icon (✨)
- [x] Loading State (Spinner)
- [x] Success State (Checkmark Animation)
- [ ] Error State (Red Border)

### 2.2 Revision Popover
- [x] Radix Popover verwenden
- [x] Quick-Access Templates aus Settings laden und anzeigen
- [x] "Weitere Templates..." Link für alle anderen
- [ ] Keyboard Navigation (Arrow Keys)
- [x] Auto-Close nach Aktion

### 2.3 Default Template Hotkey
- [ ] Tastenkürzel (Alt+R) führt Default-Template sofort aus (kein Menü!)
- [ ] Default-Template aus Settings laden
- [ ] Direkter Aufruf der Revision ohne Popover

### 2.4 Integration in TranscriptSegment
- [x] `TranscriptSegment.tsx` erweitern:
  - [x] AI Button im Header hinzufügen
  - [x] Props für Revision State
  - [x] Conditional Rendering für Diff-Ansicht
- [x] Props Interface aktualisieren
- [x] Event Handler für AI-Aktionen

### 2.5 Diff View Component
- [x] `client/src/components/transcript-editor/SegmentDiffView.tsx` erstellen
- [x] **Side-by-Side Ansicht** (Original | Überarbeitet)
- [x] Highlighting für Änderungen:
  - [x] Rot/Durchgestrichen für entfernten Text im Original
  - [x] Grün/Hervorgehoben für neuen Text in Überarbeitung
- [x] Kompakt-Modus: Nur neuer Text mit Änderungs-Summary
- [x] Toggle zwischen Kompakt- und Diff-Ansicht per Klick
- [x] Accept Button (✓)
- [x] Reject Button (✗)
- [ ] Animation bei Accept/Reject

### 2.6 Unit Tests - Phase 2
- [ ] `AIRevisionPopover.test.tsx`
- [ ] `SegmentDiffView.test.tsx`

---

## Phase 3: Batch Processing (2-3 Tage)

### 3.1 FilterPanel Extension (Collapsible)
- [ ] "AI Batch Revision" als **Collapsible-Abschnitt** in `FilterPanel.tsx`
- [ ] **Eingeklappt (Default)**: Sieht aus wie normaler Filter-Header
- [ ] **Ausgeklappt**: Template-Selector + Start Button
- [ ] Chevron-Icon für Expand/Collapse State
- [ ] Template Selector (zeigt alle verfügbaren Templates)
- [ ] Segment Count Badge (dynamisch basierend auf aktiven Filtern)
- [ ] "Starten" Button
- [ ] Disabled State wenn keine Segmente gefiltert
- [ ] Kompakte Darstellung auch im geöffneten Zustand

### 3.2 Progress Component
- [ ] `client/src/components/transcript-editor/AIRevisionProgress.tsx`
- [ ] Progress Bar
- [ ] Current/Total Counter
- [ ] Estimated Time Remaining (optional)
- [ ] Cancel Button
- [ ] Fehler-Anzeige

### 3.3 Batch State Management
- [ ] `useAIRevisionBatch` Hook erstellen
- [ ] Gefilterte Segment IDs sammeln
- [ ] Progress Tracking
- [ ] Error Aggregation
- [ ] Partial Results Handling

### 3.4 Batch Results UI
- [ ] Accept All Button im FilterPanel
- [ ] Reject All Button im FilterPanel
- [ ] Results Counter (X accepted, Y pending)
- [ ] Navigation zu nächstem pending Segment

### 3.5 Scroll & Navigation
- [ ] Auto-Scroll zu erstem pending Segment nach Batch
- [ ] Keyboard Navigation zwischen pending Segmenten
- [ ] Visual Indicator für Segmente mit pending Revision

### 3.6 Unit Tests - Phase 3
- [ ] FilterPanel AI Section Tests
- [ ] `AIRevisionProgress.test.tsx`
- [ ] `useAIRevisionBatch.test.ts`

---

## Phase 4: Settings & Advanced Features (1-2 Tage)

### 4.1 Settings: Template Configuration UI
- [ ] Neuer Bereich "AI Revision Templates" in Settings
- [ ] **Default-Template Dropdown**: Template für Tastenkürzel-Ausführung
- [ ] **Quick-Access Checkboxen**: Templates im Menü sichtbar
- [ ] Template-Liste mit Bearbeiten/Löschen (Custom) bzw. nur Bearbeiten (Default)
- [ ] "Neues Template erstellen" Button
- [ ] Default-Templates sind bearbeitbar aber nicht löschbar (`isDefault: true`)

### 4.2 Template Create/Edit Dialog
- [ ] Name-Feld
- [ ] System Prompt Textarea
- [ ] User Prompt Template Textarea (mit Platzhalter-Hints)
- [ ] Speichern/Abbrechen
- [ ] Validierung

### 4.3 Toolbar Integration
- [ ] AI Dropdown in `Toolbar.tsx` erweitern:
  - [ ] "Speaker Analysis" (bestehend)
  - [ ] Separator
  - [ ] "Revise Selected Segment" (wenn ausgewählt)
  - [ ] "Revise Filtered Segments" (wenn Filter aktiv)
  - [ ] Separator
  - [ ] "AI Settings"
- [ ] Conditional Rendering basierend auf State
- [ ] Keyboard Shortcut Hints

### 4.4 Mehr-Menü Integration
- [ ] `TranscriptSegment.tsx` Mehr-Menü erweitern
- [ ] "AI Revision" Submenu mit Quick-Access Templates
- [ ] "Weitere..." Link für alle Templates

### 4.5 Context Enhancement
- [ ] Previous/Next Segment Context mitgeben
- [ ] Spellcheck Errors an AI übergeben
- [ ] Lexicon Matches berücksichtigen
- [ ] Speaker Information nutzen

### 4.6 Keyboard Shortcuts
- [ ] `Alt + R`: **Default-Template sofort ausführen** (kein Menü!)
- [ ] `Alt + Shift + R`: AI Revision Popover öffnen (Template wählen)
- [ ] `Escape`: Cancel Revision
- [ ] `Enter`: Accept (wenn Diff fokussiert)
- [ ] Shortcuts in `KeyboardShortcuts.tsx` dokumentieren

### 4.7 Unit Tests - Phase 4
- [ ] Settings Template UI Tests
- [ ] Toolbar AI Menu Tests
- [ ] Context Enhancement Tests
- [ ] Keyboard Shortcut Tests

---

## Phase 5: Polish & Testing (1-2 Tage)

### 5.1 Accessibility Audit
- [ ] ARIA Labels für alle AI-Buttons
- [ ] Screen Reader Announcements:
  - [ ] "Revision started"
  - [ ] "Revision complete, X changes suggested"
  - [ ] "Revision accepted/rejected"
- [ ] Focus Management nach Accept/Reject
- [ ] `prefers-reduced-motion` respektieren
- [ ] Color Contrast Check für Diff View
- [ ] Keyboard-only Testing

### 5.2 Error Handling Polish
- [ ] User-friendly Error Messages
- [ ] Retry Mechanism für retryable Errors
- [ ] Partial Success Handling bei Batch
- [ ] Network Error Recovery
- [ ] Provider-spezifische Error Hints

### 5.3 Performance Optimization
- [ ] Debounce für Custom Prompt Input
- [ ] Virtualization bei vielen pending Revisions
- [ ] Memory Cleanup nach Batch Complete
- [ ] Abort Controller Cleanup
- [ ] Request Cancellation bei Dialog Close

### 5.4 Visual Polish
- [ ] Loading Animations
- [ ] Success/Error Micro-Animations
- [ ] Consistent Spacing & Typography
- [ ] Dark Mode Verifizierung
- [ ] Mobile Responsive Check

### 5.5 E2E Tests
- [ ] Single Segment Revision Flow
- [ ] Batch Revision Flow
- [ ] Accept/Reject Flow
- [ ] Undo nach Accept
- [ ] Cancel während Processing
- [ ] Error Recovery
- [ ] Keyboard Navigation

### 5.6 Documentation
- [ ] `docs/usage.md` aktualisieren
- [ ] `docs/shortcuts.md` aktualisieren
- [ ] README Features aktualisieren
- [ ] Inline Code Comments
- [ ] JSDoc für Public APIs

---

## 🔧 Technische Abhängigkeiten

### Neue Packages
- [ ] `fast-diff` oder `diff-match-patch` für Text Diffing

### Zu modifizierende Dateien
- `client/src/lib/store/types.ts` - Types ergänzen
- `client/src/lib/store.ts` - Slice integrieren
- `client/src/components/TranscriptSegment.tsx` - AI Button & Diff
- `client/src/components/transcript-editor/FilterPanel.tsx` - Batch Section
- `client/src/components/transcript-editor/Toolbar.tsx` - AI Menu
- `client/src/components/settings/` - Template Management

### Neue Dateien
- `client/src/lib/store/slices/aiRevisionSlice.ts`
- `client/src/lib/services/aiRevisionService.ts`
- `client/src/lib/diffUtils.ts`
- `client/src/components/transcript-editor/AIRevisionButton.tsx`
- `client/src/components/transcript-editor/AIRevisionPopover.tsx`
- `client/src/components/transcript-editor/AIRevisionProgress.tsx`
- `client/src/components/transcript-editor/SegmentDiffView.tsx`
- `client/src/components/transcript-editor/CustomRevisionDialog.tsx`
- `client/src/hooks/useAIRevisionBatch.ts`

---

## 📊 Progress Tracking

| Phase | Status | Fortschritt | Notizen |
|-------|--------|-------------|---------|
| Phase 1: Foundation | ✅ Complete | 100% | Types, Store Slice, Service, Diff Utils |
| Phase 2: Single Segment | 🟡 In Progress | 70% | AIRevisionPopover, SegmentDiffView, Integration |
| Phase 3: Batch Processing | 🟡 In Progress | 50% | AIBatchRevisionSection, FilterPanel Integration |
| Phase 4: Settings & Advanced | ⬜ Not Started | 0% | |
| Phase 5: Polish | ⬜ Not Started | 0% | |

**Legend**:
- ⬜ Not Started
- 🟡 In Progress
- ✅ Complete
- ⏸️ Blocked

---

## 📝 Session Notes

### Session 1 (TBD)
- [ ] Notes hier...

### Session 2 (TBD)
- [ ] Notes hier...

---

## 🔗 Related Issues/PRs

- TBD

---

*Erstellt: 31. Dezember 2025*  
*Letztes Update: 31. Dezember 2025*

