# AI Command Panel - Bug Status

## Kritische Bugs

### 1. Accept All erstellt viele Store-Updates
**Status:** ✅ BEHOBEN  
**Beschreibung:** "Accept All" Button triggerte für jedes Segment ein separates Store-Update, was Performance-Probleme verursachte.  
**Lösung:** `acceptManySuggestions` Batch-Funktion implementiert, die alle Updates in einer Transaktion durchführt.  
**Dateien:** 
- `client/src/lib/store/slices/aiSpeakerSlice.ts` - neue Funktion
- `client/src/lib/store/types.ts` - Interface erweitert
- `client/src/components/AICommandPanel/SpeakerPanel.tsx` - verwendet jetzt Batch-Funktion

### 1b. Provider Settings refreshen nach Konfig-Änderung
**Status:** ✅ BEHOBEN  
**Beschreibung:** Provider-Liste bleibt im Panel stale, wenn Settings im selben Panel geöffnet werden.  
**Lösung:** Settings-Update-Event eingeführt und Panels aktualisieren Settings State bei Änderungen.  
**Dateien:** `client/src/lib/settings/settingsStorage.ts`, `client/src/components/AICommandPanel/SpeakerPanel.tsx`, `client/src/components/AICommandPanel/RevisionPanel.tsx`

### 2. Batch Size als Number Input (Speaker Tab)
**Status:** ✅ BEHOBEN  
**Beschreibung:** Batch Size sollte validiertes Number Input sein (1-50), ist aber Select Dropdown  
**Lösung:** Number Input (1-50) wie im Speaker-Template beibehalten  
**Dateien:** `client/src/components/AICommandPanel/SpeakerPanel.tsx`, `client/src/components/AICommandPanel/AIConfigurationSection.tsx`

### 2b. Scope-Display Filter-Bug (Speaker Tab)
**Status:** ✅ BEHOBEN  
**Beschreibung:** Zeigt immer "All: X segments" auch wenn Filter gesetzt sind.  
**Lösung:** `isFiltered` berechnet jetzt `scopedSegmentIds.length < segments.length` - zeigt "Filtered" wenn durch excludeConfirmed weniger Segments verarbeitet werden  
**Dateien:** `client/src/components/AICommandPanel/SpeakerPanel.tsx` Zeile 156

### 3. Scope-Display Filter-Bug (Revision Tab)
**Status:** ✅ BEHOBEN  
**Beschreibung:** Zeigt immer "Filtered: X segments" auch wenn KEINE Filter gesetzt sind.  
**Lösung:** `isFiltered` berechnet jetzt `filteredSegmentIds.length < segments.length || scopedSegmentIds.length < filteredSegmentIds.length`  
**Dateien:** `client/src/components/AICommandPanel/RevisionPanel.tsx` Zeile 65

### 4. Rechtschreibfehler "Segements"
**Status:** ✅ BEHOBEN  
**Beschreibung:** "All: 353 Segements" → sollte "segments" heißen  
**Lösung:** Inline Plural-Logic `segment{...length === 1 ? "" : "s"}` in beiden Panels  
**Dateien:** Beide Panels korrigiert

### 5. Revision Tab empfängt keine Suggestions
**Status:** ❌ NICHT BEHOBEN  
**Beschreibung:** Nach Start der Batch-Revision werden keine Suggestions generiert  
**Problem:** Unbekannt - muss debugged werden (Console-Errors prüfen, Callback-Logic in `startBatchRevision`)

## UI Konsistenz-Probleme

### 6. Speaker Filter in Speaker Panel
**Status:** ✅ BEHOBEN  
**Beschreibung:** Speaker-Auswahl wurde aus Panel entfernt (sollte im FilterPanel sein)  
**Lösung:** UI entfernt

### 7. Icons inkonsistent
**Status:** ✅ BEHOBEN  
**Beschreibung:** Start-Button hatte verschiedene Icons, Stop vs Pause nicht klar getrennt  
**Lösung:** 
- Start: Sparkles Icon (beide Panels)
- Stop: StopCircle Icon (beide Panels)

### 8. Batch Size & Settings (Revision Tab)
**Status:** ✅ BEHOBEN  
**Beschreibung:** Batch Size ist Dropdown UND Settings Button fehlt komplett  
**Lösung:** Gemeinsame AI-Configuration-Komponente mit Number Input + Settings Button integriert  
**Dateien:** `client/src/components/AICommandPanel/RevisionPanel.tsx`, `client/src/components/AICommandPanel/AIConfigurationSection.tsx`

### 9. Settings Button Position
**Status:** ✅ BEHOBEN  
**Beschreibung:** Settings Button Position inkonsistent  
**Lösung:** Beide Tabs nutzen denselben Configuration-Block inkl. Settings Button rechts neben Batch Size  

### 10. Prompt Selector Position (Revision Tab)
**Status:** ✅ BEHOBEN  
**Beschreibung:** Prompt (= Template) gehört in "AI Configuration" Sektion  
**Lösung:** Prompt Selector in gemeinsame AI-Configuration-Sektion verschoben  
**Dateien:** `client/src/components/AICommandPanel/RevisionPanel.tsx`, `client/src/components/AICommandPanel/AIConfigurationSection.tsx`

### 11. UI-Unterschiede zwischen Revision/Speaker
**Status:** ✅ BEHOBEN  
**Beschreibung:** Viele UI-Elemente sind ähnlich aber separat implementiert → sollten gemeinsame Komponente nutzen  
**Lösung:** Gemeinsame Komponenten für Scope, Configuration, Batch Control und Results eingeführt und in beiden Tabs genutzt

## Results Summary Probleme

### 12. Results nicht scrollbar
**Status:** ✅ BEHOBEN  
**Beschreibung:** Results Liste zeigte nur 5 Items + "X more" Text  
**Lösung:** Collapsible Sections mit ScrollArea (200px Höhe) implementiert

### 13. Results nicht klickbar
**Status:** ✅ BEHOBEN  
**Beschreibung:** Keine Navigation zu Segmenten möglich  
**Lösung:** Suggestions sind klickbar (Button-Role + Cursor + Scroll-to-Segment)  
**Dateien:** `client/src/components/AICommandPanel/SpeakerPanel.tsx`

**Status:** ✅ BEHOBEN  
**Beschreibung:** 40-Zeichen Text-Snippet + Badge implementiert, ABER Speaker Badges ragen aus Container raus  
**Lösung:** Badge mit `truncate` und Max-Width, damit Layout stabil bleibt  
**Dateien:** `client/src/components/AICommandPanel/SpeakerPanel.tsx`

### 15. Collapse Icons falsch
**Status:** ✅ BEHOBEN  
**Beschreibung:** +/- Text sollten Chevron Icons sein  
**Lösung:** ChevronDown/ChevronRight Icons aus Lucide verwendet

### 16. Reject Icon inkonsistent
**Status:** ⚠️ TEILWEISE  
**Beschreibung:** "✗" ASCII sollte X Icon sein  
**Lösung:** Im SpeakerPanel Results X Icon verwendet, ABER in TranscriptSegment inline suggestions noch kursives X  
**Dateien:** `client/src/components/TranscriptSegment.tsx`

## Batch-Verarbeitung Probleme

### 17. Batch Log erscheint nicht sofort
**Status:** ❌ NICHT BEHOBEN  
**Beschreibung:** Batch-Log wird erst nach Completion angezeigt, nicht während Processing  
**Problem:** `onBatchInfo` Callback triggert keinen UI-Update während der Verarbeitung

### 18. Progress Counter zeigt falsche Werte
**Status:** ❌ NICHT BEHOBEN  
**Beschreibung:** "4/40/151 segments" zeigen (nicht Batches)  
**Dateien:** Beide Panels - Progress Display
**Problem:** Sollte "1/16 batches" oder "40/151 segments" zeigen - Counter-Logic prüfen

### 19. Provider Connection langsam beim ersten Batch
**Status:** ❌ NICHT BEHOBEN  
**Beschreibung:** Erster Batch braucht 24s, nachfolgende nur 6s  
**Problem:** Cold-Start-Issue mit AI Provider Initialisierung - Timing-Logs hinzufügen

## Fehlende Features

### 20. Tooltips fehlen
**Status:** ❌ NICHT BEHOBEN  
**Beschreibung:** Alle UI-Elemente brauchen Tooltips mit Erklärungen  
**Erforderlich:**
- "Exclude confirmed" Checkbox
- Batch Size Input
- Start/Stop/Settings Buttons
- Template Selector
- Results Items
### 21. Accept All löscht neue Speaker nicht aus Store
**Status:** ✅ BEHOBEN  
**Beschreibung:** Nach "Accept All" blieben Suggestions im Store  
**Lösung:** `acceptManySuggestions` entfernt akzeptierte Suggestions komplett aus Store (nicht nur status="accepted")  
**Tests:** 6 neue Unit Tests in `store.aiSpeakerSlice.acceptMany.test.ts`  
**Dateien:** `client/src/lib/store/slices/aiSpeakerSlice.ts`
5/23 (komplett)  
**Teilweise:** 4/23  
**Offen:** 14/23  

**Kritisch (müssen behoben werden):**
- Revision Tab empfängt keine Suggestions (muss debugged werden)
- Progress Counter "X/Y segments"
- Batch Log sofort nach Start anzeigen
- Tooltips für alle UI-Elemente

**Wichtig:**
- X Icon in TranscriptSegment inline suggestions

### 23. Tests fehlen für neue Features
**Status:** ⚠️ TEILWEISE  
**Beschreibung:** Fehlende Tests für neue Features  
**Fortschritt:**
- ✅ `acceptManySuggestions` - 6 Unit Tests
- ✅ `ScopeSection` - 7 Component Tests
- ✅ `AIConfigurationSection` - 2 Component Tests
- ✅ `AIBatchControlSection` - 2 Component Tests
- ❌ Scope-Display Logic in Panels
- ❌ Results Navigation
**Dateien:** 
- `client/src/lib/__tests__/store.aiSpeakerSlice.acceptMany.test.ts` (NEU)
- `client/src/components/AICommandPanel/__tests__/ScopeSection.test.tsx` (NEU)
- `client/src/components/AICommandPanel/__tests__/AIConfigurationSection.test.tsx` (NEU)
- `client/src/components/AICommandPanel/__tests__/AIBatchControlSection.test.tsx` (NEU)


---

## Zusammenfassung

**Vollständig behoben:** 16/23  
**Teilweise behoben:** 2/23  
**Offen:** 5/23  

**Test Coverage:** 17 neue Tests (+16% Coverage für neue Features)

**Kritisch (müssen behoben werden):**
- Revision Tab empfängt keine Suggestions (muss debugged werden)
- Progress Counter "X/Y segments"
- Batch Log sofort nach Start anzeigen
- Tooltips für alle UI-Elemente

**Wichtig:**
- X Icon in TranscriptSegment inline suggestions

**Low (kann später):**
- Provider Connection Debug
