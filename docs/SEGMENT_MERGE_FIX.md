# Fix: AI Segment Merge - Format vereinfacht, Batch Size & Live-Updates

## Probleme

### 1. Fehlende Logs
Die Raw Response wurde nur auf 5000 Zeichen gekürzt - zu wenig für große Responses.

### 2. Falsche Segment-Zuordnung
Die AI gab verschiedene Formate zurück (`segmentA/B`, `pairIndex`, `mergeId`), was zu:
- Verwirrung der AI führte
- Falschen Segment-Zuordnungen
- Inkonsistenten Responses

### 3. Zu große Batches
Default Batch-Size von 20 überlastete kleinere Modelle und führte zu schlechter Qualität.

### 4. UI-Updates erst nach Batch-Ende
Suggestions erschienen erst nach Verarbeitung aller Batches, nicht nach jedem einzelnen Batch.
Progress-Anzeige (0/356) wurde nicht aktualisiert.

### 5. AI macht zu viel Arbeit
Gap- und Speaker-Filterung wurde von AI gemacht, was zu Inkonsistenzen führte.

## Lösung

### 1. Logging verbessert
- Response-Preview: 5k → 15k Zeichen
- Zeigt Anfang + Ende der Response

### 2. Format auf EIN einziges vereinfacht
**Nur noch `segmentIds` akzeptiert:**
```typescript
export function isRawMergeSuggestion(item: unknown): item is RawMergeSuggestion {
  return typeof item === "object" && item !== null && "segmentIds" in item;
}
```

**ENTFERNT:** `pairIndex`, `mergeId`, `segmentId`, `segmentA/segmentB`

### 3. Batch-Size Parameter hinzugefügt
- **UI:** Neues Input-Feld (Range: 5-50, Default: 10)
- **Service:** Teilt Segmente in Batches auf
- **Vorteil:** Kleinere Batches = bessere Qualität

### 4. Live-Updates während Batch-Verarbeitung
**onProgress Callback implementiert:**
```typescript
onProgress: (progress) => {
  // Update UI after each batch
  const currentSuggestions = get().aiSegmentMergeSuggestions;
  const newSuggestions = progress.batchSuggestions.map(toStoreSuggestion);
  
  set({
    aiSegmentMergeSuggestions: [...currentSuggestions, ...newSuggestions],
    aiSegmentMergeProcessedCount: progress.processedCount,
  });
}
```

**Effekt:**
- ✅ Suggestions erscheinen sofort nach jedem Batch
- ✅ Progress-Anzeige wird live aktualisiert (z.B. 10/356, 20/356, ...)
- ✅ Benutzer sieht sofort Ergebnisse

### 5. Gap- und Speaker-Filterung im Code
**Vorher:** AI musste Filterung durchführen
**Nachher:** Programmatische Filterung in `collectSegmentPairsWithSimpleIds`

```typescript
// Nur Paare mit gleichem Speaker (wenn aktiviert)
if (sameSpeakerOnly && !isSameSpeaker(segmentA, segmentB)) {
  continue;
}

// Nur Paare innerhalb des Gap-Limits
const gap = calculateTimeGap(segmentA, segmentB);
if (!isTimeGapAcceptable(gap, maxTimeGap)) {
  continue;
}
```

**Prompt vereinfacht:**
```
IMPORTANT: All segment pairs presented to you have already been pre-filtered:
- Only same-speaker pairs (if speaker filtering is enabled)
- Only pairs with acceptable time gaps

Your job is to evaluate the CONTENT and determine if merging makes sense.
```

**Vorteile:**
- ✅ AI muss nur noch Inhalt bewerten, nicht filtern
- ✅ Konsistente Filterung (kein AI-Raten)
- ✅ Einfacherer, klarerer Prompt
- ✅ Bessere Performance

### 6. Diagnose-Logging
Zeigt genau welche IDs nicht gefunden werden und warum.

### 7. Tests für Same-Speaker-Filterung
Umfassende Test-Suite hinzugefügt um sicherzustellen, dass die Filterung korrekt funktioniert:

**Tests in `utils.test.ts`:**
- ✅ `isSameSpeaker` erkennt gleiche/verschiedene Speaker korrekt
- ✅ `collectSegmentPairsWithSimpleIds` filtert nur Same-Speaker-Paare (wenn aktiviert)
- ✅ Kombination von Speaker- und Gap-Filterung funktioniert
- ✅ Mit `sameSpeakerOnly: false` werden alle Paare gesammelt
- ✅ Simple-IDs werden korrekt zugewiesen
- ✅ Pair-Mapping wird korrekt befüllt

**Test-Cases:**
```typescript
// Test 1: Nur Same-Speaker mit sameSpeakerOnly: true
segments: [Alice, Alice, Bob, Alice]
result: nur Pair (Alice-Alice)

// Test 2: Alle Paare mit sameSpeakerOnly: false  
segments: [Alice, Bob, Alice]
result: (Alice-Bob) + (Bob-Alice)

// Test 3: Gap-Filterung
segments: [Alice(0-1s), Alice(1.1-2s), Alice(5-6s)]
maxGap: 0.5s
result: nur Pair (Alice-Alice) mit 0.1s Gap

// Test 4: Kombiniert Speaker + Gap
segments: [Alice, Alice(small gap), Bob, Bob(large gap)]
result: nur Pair (Alice-Alice) - Bob-Bob hat zu große Lücke
```

## Ergebnis

✅ **NUR** `segmentIds: [1, 2]` akzeptiert
✅ Konfigurierbare Batch-Size (Default: 10)
✅ Besseres Logging (15k Preview)
✅ **Live-Updates:** Suggestions erscheinen nach jedem Batch
✅ **Live-Progress:** Counter wird kontinuierlich aktualisiert
✅ Jeder Batch mit eigener ID-Mapping
✅ **Gap/Speaker-Filterung im Code:** AI bewertet nur noch Inhalt
✅ Keine Verwirrung mehr durch multiple Formate

**Geänderte Dateien:**
1. `aiFeatureService.ts` - Logging
2. `responseProcessor.ts` - Nur segmentIds
3. `config.ts` - Prompt vereinfacht + defaultBatchSize: 10
4. `service.ts` - Batch-Verarbeitung + onProgress Callback
5. `utils.ts` - Diagnose-Logging (Gap/Speaker bereits gefiltert)
6. `types.ts` - batchSize + onProgress Parameter
7. `AISegmentMergeDialog.tsx` - Batch Size UI
8. `aiSegmentMergeSlice.ts` - batchSize + onProgress Handler
9. `responseProcessor.test.ts` - Tests

## Workflow-Verbesserung

**Vorher:**
1. User startet Analyse
2. Warten... (keine Updates)
3. Alle Batches fertig → Suggestions erscheinen
4. Progress zeigt 0/356 → dann plötzlich 356/356

**Nachher:**
1. User startet Analyse
2. Batch 1 fertig → Suggestions erscheinen (Progress: 10/356)
3. Batch 2 fertig → Mehr Suggestions (Progress: 20/356)
4. ... kontinuierliche Updates ...
5. Alle Batches fertig (Progress: 356/356)

✅ **Sofortiges Feedback**
✅ **Transparenter Fortschritt**
✅ **Bessere User Experience**

