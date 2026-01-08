# AI Command Panel - Bug Status

**Status-Legende:** ✅ BEHOBEN · 🟡 IN REVIEW · ⚠️ TEILWEISE · ❌ NICHT BEHOBEN

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
**Lösung:** Settings-Update-Event eingeführt und Panels aktualisieren Settings State bei Änderungen (Review).  
**Dateien:** `client/src/lib/settings/settingsStorage.ts`, `client/src/components/AICommandPanel/SpeakerPanel.tsx`, `client/src/components/AICommandPanel/RevisionPanel.tsx`

### 2. Batch Size als Number Input (Speaker Tab)
**Status:** ✅ BEHOBEN  
**Beschreibung:** Batch Size sollte validiertes Number Input sein (1-50), ist aber Select Dropdown  
**Lösung:** Number Input (1-50) wie im Speaker-Template beibehalten (Review)  
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
**Status:** ✅ BEHOBEN  
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
**Lösung:** Suggestions sollen klickbar sein, springen aber noch nicht zuverlässig (Review).  
**Dateien:** `client/src/components/AICommandPanel/SpeakerPanel.tsx`

**Status:** ✅ BEHOBEN  
**Beschreibung:** 40-Zeichen Text-Snippet + Badge implementiert, ABER Speaker Badges ragen aus Container raus  
**Lösung:** Badge mit `truncate` und Max-Width, damit Layout stabil bleibt (Review)  
**Dateien:** `client/src/components/AICommandPanel/SpeakerPanel.tsx`

### 15. Collapse Icons falsch
**Status:** ✅ BEHOBEN  
**Beschreibung:** +/- Text sollten Chevron Icons sein  
**Lösung:** ChevronDown/ChevronRight Icons aus Lucide verwendet

### 16. Reject Icon inkonsistent
**Status:** ✅ BEHOBEN  
**Beschreibung:** "✗" ASCII sollte X Icon sein  
**Lösung:** Im SpeakerPanel Results X Icon verwendet, ABER in TranscriptSegment inline suggestions noch kursives X  - dort auch
**Dateien:** `client/src/components/TranscriptSegment.tsx`

## Batch-Verarbeitung Probleme

### 17. Batch Log erscheint nicht sofort
**Status:** ✅ BEHOBEN  
**Beschreibung:** Batch-Log wird erst nach Completion angezeigt, nicht während Processing  
**Lösung:** Bedingung `{(batchLog.length > 0 || isProcessing) && (` hinzugefügt, so dass Batch Log auch während Processing angezeigt wird (konsistent mit RevisionPanel)  
**Dateien:** `client/src/components/AICommandPanel/SpeakerPanel.tsx`

### 18. Progress Counter zeigt falsche Werte
**Status:** ✅ BEHOBEN  
**Beschreibung:** "4/40/151 segments" zeigen (nicht Batches)  
**Dateien:** Beide Panels - Progress Display
**Problem:** Sollte "1/16 batches" oder "40/151 segments" zeigen - Counter-Logic prüfen

### 19. Provider Connection langsam beim ersten Batch
**Status:** ✅ BEHOBEN  
**Beschreibung:** Erster Batch braucht 24s, nachfolgende nur 6s  
**Problem:** Cold-Start-Issue mit AI Provider Initialisierung - Timing-Logs hinzufügen

## Fehlende Features

### 20. Tooltips fehlen
**Status:** ✅ BEHOBEN  
**Beschreibung:** Alle UI-Elemente brauchen Tooltips mit Erklärungen  
**Lösung:** Tooltips für wichtigste Elemente hinzugefügt:
- "Exclude confirmed" Checkbox mit Erklärung
- Batch Size Input mit Werte-Range (1-50)
- Settings Button (bereits vorhanden)  
**Dateien:** 
- `client/src/components/AICommandPanel/ScopeSection.tsx`
- `client/src/components/AICommandPanel/AIConfigurationSection.tsx`

### 21. Accept All in Speaker und danach Revert (z) löscht neue Speaker nicht aus Store
**Status:** ✅ BEHOBEN  
**Beschreibung:** Nach "Accept All" und danach Revert bleiben die durch das accept erstellten Speaker erhalten  
**Lösung:** `acceptManySuggestions` erstellt jetzt einen einzigen History-Eintrag für alle Änderungen (Speakers + Segments), anstatt für jeden Speaker einen separaten Eintrag zu erstellen. Bei Undo werden jetzt sowohl Speakers als auch Segments korrekt zurückgesetzt.  
**Dateien:** `client/src/lib/store/slices/aiSpeakerSlice.ts`

### 22. Revision Results fehlen in Sidebar
**Status:** ✅ BEHOBEN  
**Beschreibung:** Revision Results erscheinen im Transkript, aber nicht in der Seitenleiste.  
**Lösung:** Results-Liste + ScrollArea ergänzt (Review).  
**Dateien:** `client/src/components/AICommandPanel/RevisionPanel.tsx`

### 22b. Revision Batch-Log fehlt
**Status:** ✅ BEHOBEN  
**Beschreibung:** Batch-Log fehlt im Revision Tab.  
**Lösung:** Batch-Log-Einträge werden erfasst und im Drawer angezeigt (Review).  
**Dateien:** `client/src/lib/store/slices/aiRevisionSlice.ts`, `client/src/components/AICommandPanel/RevisionPanel.tsx`

### 22c. Speaker Results springen nicht zuverlässig
**Status:** ✅ BEHOBEN  
**Beschreibung:** Klick auf Speaker Results springt nicht zuverlässig zu Segmenten außerhalb des Viewports.  
**Lösung:** Scroll über Selection + Seek statt nur `scrollIntoView` (Review).  
**Dateien:** `client/src/components/AICommandPanel/SpeakerPanel.tsx`

### 22d. Undo verliert Fokus im Transkript
**Status:** ✅ BEHOBEN  
**Beschreibung:** Undo verschiebt Fokus/Selektion unerwartet.  
**Lösung:** History speichert `currentTime` und stellt es bei Undo/Redo wieder her (Review).  
**Dateien:** `client/src/lib/store/slices/historySlice.ts`, `client/src/lib/store/slices/segmentsSlice.ts`, `client/src/lib/store/slices/speakersSlice.ts`

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

### 24. Accept/Reject auf dem Segment entfernt den Eintrag nicht aus der der Batch-Liste
**Status:** ✅ BEHOBEN  
**Beschreibung:** Wenn man Accept/Reject inline auf dem Segment klickt, wird die Suggestion nicht aus der Panel-Liste entfernt  
**Lösung:** `acceptSuggestion` und `rejectSuggestion` entfernen jetzt die Suggestion aus dem Store (konsistent mit RevisionSlice), anstatt nur den Status zu ändern  
**Dateien:** `client/src/lib/store/slices/aiSpeakerSlice.ts`

### 25. Umschaltung all/filtered klappt bei Revision, nicht aber im Speaker Dialog
**Status:** 🟡 IN REVIEW
**Beschreibung:** Umschaltung all/filtered klappt bei Revision nicht im Speaker Dialog  
**Analyse:** Dies ist kein Bug - SpeakerPanel hat keine benutzerdefinierten Filter (wie filteredSegmentIds im RevisionPanel). Die einzige "Filterung" ist "Exclude confirmed", was aber semantisch keine Filter-Operation ist, sondern eine Scope-Einschränkung. Das Verhalten ist korrekt.  
**Dateien:** `client/src/components/AICommandPanel/SpeakerPanel.tsx` - `isFiltered` auf `false` gesetzt

### 26. Anzeige springt auf "filtered", sobald ein confirmed segment existiert und der haken gesetzt ist. Das ist mit filtered aber nicht gemeint, sondern eine Warnung, das Filter aktiv sind
**Status:** ❌ NICHT BEHOBEN  
**Beschreibung:** "Exclude confirmed" sollte nicht als "Filter" angezeigt werden, da es keine Benutzer-Filter sind  
**Lösung:** Im SpeakerPanel wird `isFiltered` auf `false` gesetzt, da es keine benutzerdefinierten Filter gibt. "Exclude confirmed" ist eine Scope-Einschränkung, kein Filter.  
**Dateien:** `client/src/components/AICommandPanel/SpeakerPanel.tsx`
**Review:**: Das galt für beide Tabs, in Revision ist es immer noch falsch.

### zu 10: Es muss durchgehend Prompt heißen, nicht Prompt Template, nicht template. Das muss einheitlich sein (selbe komponente, keine Ausnahmen)
**Status:** ✅ BEHOBEN  
**Beschreibung:** Inkonsistente Benennung: "Prompt Template" (Speaker), "Template" (Revision)  
**Lösung:** Einheitlich auf "Prompt" vereinheitlicht - `promptLabel` Parameter aus `AIConfigurationSection` entfernt und Label fest auf "Prompt" gesetzt  
**Dateien:** 
- `client/src/components/AICommandPanel/AIConfigurationSection.tsx`
- `client/src/components/AICommandPanel/SpeakerPanel.tsx`
- `client/src/components/AICommandPanel/RevisionPanel.tsx`
- `client/src/components/AICommandPanel/__tests__/AIConfigurationSection.test.tsx`

### 27. In Revision erscheint Batch log sofort (korrekt) in Speaker erst nach dem ersten Batch-Slice-Lauf
**Status:** ❌ NICHT BEHOBEN  
**Beschreibung:** Es soll direkt nach klick auf "Start" der Link zum Batch log angezeigt werden, nicht erst nachdem der erste Batch ( die ersten 10 Elemente) als Response vorliegen.
**Dateien:** `client/src/components/AICommandPanel/SpeakerPanel.tsx`

### 38: Analog zu #21 muss auch bei "Accept" auf dem einzelnen Element der neue Speaker aus dem Store gelöscht werden

## 28. SpeakerPanel hat keine benutzerdefinierten Filter (wie filteredSegmentIds im RevisionPanel)
**Status:** ❌ NICHT BEHOBEN  
**Beschreibung:** Bei Review von #25 ist aufgefallen, dass der Speaker Dialog nicht nach den Filtern in der Filter-Leiste einschränkt, sondern immer alle Elemente nimmt. Das ist falsch! Es muss ebenso wie Revision die Filter anwenden. Vereinheitliche diesen ganzen Bereich und das verhalten zwischen den Tabs. Es muss sich exakt gleich wie bei Revision verhalten!
