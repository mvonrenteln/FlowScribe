# AI Command Panel - Follow-ups (Vereinheitlichung)

Ziel: Logik an einer Stelle kapseln, damit Fixes (z.B. Scope/Filter) nicht doppelt gepflegt werden muessen.

## Vorschlaege zur Zentralisierung

### 26. Scope/Filter-Logik (isFiltered) zentralisieren
**Problem:** Der Fix musste in `SpeakerPanel` und `RevisionPanel` doppelt eingepflegt werden.

**Vorschlag (minimal):**
- Gemeinsamer Hook/Utility, z.B. `useScopedSegments`, der `segments`, `filteredSegmentIds` und `excludeConfirmed` annimmt.
- Rueckgabe: `scopedSegmentIds`, `isFiltered`, optional `segmentById`.
- Beide Panels nutzen nur noch den Hook, keine eigene Logik.

**Konkrete Schritte (Migration):**
1) `useScopedSegments` in `client/src/components/AICommandPanel/` oder `client/src/lib/` anlegen.
2) In `SpeakerPanel` und `RevisionPanel` die Berechnung von `scopedSegmentIds` + `isFiltered` ersetzen.
3) Tests fuer den Hook (z.B. `useScopedSegments.test.ts`) erstellen, damit das Verhalten stabil bleibt.

**Auswirkungen:**
- Korrekturen an der Filter-Definition passieren nur noch an einer Stelle.
- Konsistentes Verhalten zwischen Tabs (weniger Drift).
- Geringerer Testaufwand fuer Panel-spezifische Logik.

## Weitere Deduplication-Pfade (UI + Logik) inkl. Testkonzept

### Gemeinsamer Hook fuer Settings/Provider/Model
**Ziel:** Duplizierte Logik in `SpeakerPanel`/`RevisionPanel` fuer `initializeSettings`, Event-Listener und Defaulting zentralisieren.

**Vorschlag:** `useAiSettingsSelection` mit Rueckgabe
- `settings`, `selectedProviderId`, `selectedModel`
- Setter: `setSelectedProviderId`, `setSelectedModel`
- `refreshSettings` intern gekapselt

**Migration (Schritte):**
1) Hook in `client/src/components/AICommandPanel/` oder `client/src/lib/` anlegen.
2) Panels auf Hook umstellen, lokale `useEffect`/`useCallback` entfernen.
3) Panel-Tests auf Hook-Stubs umstellen (oder Hook in Isolation testen).

**Testkonzept (Vorher/Nachher):**
- Unit: `useAiSettingsSelection` testet Default-Provider, Provider-Wechsel, Model-Resolution, Event-Refresh.
- Snapshot/Component: Panels sollten weiterhin gleiche Provider/Model-Auswahl anzeigen und bei Settings-Event aktualisieren.
- Regression: Test mit Settings ohne Provider (Empty-State) bleibt unveraendert.

### Gemeinsamer Hook fuer Scope/Filter
**Ziel:** `scopedSegmentIds` + `isFiltered` nur einmal definieren.

**Vorschlag:** `useScopedSegments(segments, filteredSegmentIds, excludeConfirmed)`

**Migration (Schritte):**
1) Hook anlegen, vorherige Logik aus beiden Panels extrahieren.
2) Panels ersetzen, nur Hook-Output nutzen.
3) Panel-Tests reduzieren, Hook-Tests erweitern.

**Testkonzept (Vorher/Nachher):**
- Unit: Hook testet Filter-Definition (nur FilterPanel-Filter true), Exclude-Confirmed-Effekt.
- Component: ScopeSection-Rendering bleibt gleich ("All" vs "Filtered") bei identischen Inputs.

### Gemeinsamer Navigator fuer Segment-Sprung
**Ziel:** `setSelectedSegmentId` + `setCurrentTime` + `requestSeek` in einer Stelle.

**Vorschlag:** `scrollToSegment(segmentId, segmentById)` oder Hook `useSegmentNavigator`.

**Migration (Schritte):**
1) Helper/Hook anlegen.
2) Nutzung in Speaker/Revision (Results-Klicks) ersetzen.
3) Optional auch in Transcript-UI (falls identische Logik existiert).

**Testkonzept (Vorher/Nachher):**
- Unit: Funktion ruft die drei Store-Setter in richtiger Reihenfolge auf.
- Integration: Click auf Result item setzt Selection + Time wie zuvor.

### Utility fuer Truncation
**Ziel:** `truncateText` nicht mehrfach definieren.

**Vorschlag:** `truncateText(text, maxLength)` in `client/src/lib/`.

**Migration (Schritte):**
1) Utility anlegen, Panels importieren.
2) Inline-Funktionen entfernen.

**Testkonzept (Vorher/Nachher):**
- Unit: Tests fuer Kurz- und Langtexte (inkl. `...`).
- Optional: Snapshot eines Results-Items bleibt identisch.

### Shared Results-List-Container
**Ziel:** Scroll/List-Chrome und Key/Click-Handling vereinheitlichen; Feature-spezifische Gruppierung bleibt.

**Vorschlag:** `ResultsList`-Komponente mit Render-Prop fuer Items und optional Header/Meta.

**Migration (Schritte):**
1) Results-Container extrahieren (ScrollArea + Item-Look).
2) Speaker/Revision rendern Items via Render-Prop, behalten Gruppierung/Actions.

**Testkonzept (Vorher/Nachher):**
- Component: gleiche Anzahl/Anordnung Items und gleiche Scroll-Hoehen.
- Interaction: KeyDown (Enter/Space) Verhalten bleibt identisch.

