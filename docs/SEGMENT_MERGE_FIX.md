# Fix: AI Segment Merge - Format vereinfacht & Batch Size hinzugefügt

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

**Prompt verschärft:**
```
CRITICAL: Use ONLY the format shown below. Do NOT use any other format.

Example output:
[
  {
    "segmentIds": [1, 2],
    "confidence": 0.95,
    "reason": "..."
  }
]
```

### 3. Batch-Size Parameter hinzugefügt
- **UI:** Neues Input-Feld (Range: 5-50, Default: 10)
- **Service:** Teilt Segmente in Batches auf
- **Vorteil:** Kleinere Batches = bessere Qualität

### 4. Batch-Verarbeitung implementiert
```typescript
// Split segments into batches
for (let i = 0; i < segments.length; i += batchSize) {
  const batch = segments.slice(i, i + batchSize);
  // Process batch separately with own ID mapping
}
```

### 5. Diagnose-Logging
Zeigt genau welche IDs nicht gefunden werden und warum.

## Ergebnis

✅ **NUR** `segmentIds: [1, 2]` akzeptiert
✅ Konfigurierbare Batch-Size (Default: 10)
✅ Besseres Logging (15k Preview)
✅ Jeder Batch mit eigener ID-Mapping
✅ Keine Verwirrung mehr durch multiple Formate

**Geänderte Dateien:**
1. `aiFeatureService.ts` - Logging
2. `responseProcessor.ts` - Nur segmentIds
3. `config.ts` - Prompt + defaultBatchSize: 10
4. `service.ts` - Batch-Verarbeitung
5. `utils.ts` - Diagnose-Logging
6. `types.ts` - batchSize Parameter
7. `AISegmentMergeDialog.tsx` - Batch Size UI
8. `aiSegmentMergeSlice.ts` - batchSize durchgereicht
9. `responseProcessor.test.ts` - Tests

