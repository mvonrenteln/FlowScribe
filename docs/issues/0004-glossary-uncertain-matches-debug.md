# Debug Report: Uncertain Glossary Matches – Root Cause & Fix

**Branch:** `codex/fix-glossary-entry-variant-matching`
**Status:** ✅ **RESOLVED** – Root cause identified and fixed
**Datum:** 2026-02-22

---

## Symptom

The "Uncertain Glossary Matches" counter in the sidebar showed **0** despite glossary entries having many variants (e.g. "Glymbar" with 25 variants) that clearly appeared in the transcript.

---

## Architecture: Two independent matching systems

| System | File | Purpose |
|--------|------|---------|
| **System 1** | `useSpellcheck.ts` | Spellcheck underlines + suggestions in context menu |
| **System 2** | `useLexiconMatches.ts` | "Uncertain Glossary Matches" counter + filter |

Both systems are independent. System 1 was fixed in an earlier commit. This report covers System 2.

### Scoring model in `useLexiconMatches.ts`

For each transcript word, `computeSegmentMatches` produces a score:

| Match type | Score | Counted as |
|-----------|-------|-----------|
| Exact term match (`rawPart === entry.raw`) | `1.0` | `lexiconMatchCount` only |
| Explicit variant match (`variantRawSet.has(rawPart)`) | `0.99` | `lexiconMatchCount` **and** `lexiconLowScoreMatchCount` |
| Fuzzy similarity match (Levenshtein) | `threshold…0.99` | `lexiconMatchCount` **and** `lexiconLowScoreMatchCount` |

**Key insight:** Variants like "Glimmer" for "Glymbar" have a Levenshtein similarity of ~0.57 — far below any useful threshold. The *only* path that correctly matches them is the explicit `variantRawSet` lookup. If that path is blocked, the counter stays at 0.

---

## Root Cause: False positive check blocked explicit variant matches

### The bug

```typescript
// BEFORE (buggy): false positive check applied unconditionally
if (candidateScore < lexiconThreshold) return;

if (
  entry.falsePositiveRawSet.has(rawPart) ||        // ← fired even for variants!
  entry.falsePositiveNormalizedSet.has(normalizedPart)
) {
  return;  // ← silently discarded the variant match
}
```

When a word was listed as **both a variant and a false positive** of the same entry, the false positive check fired *after* the variant match was computed — and discarded the match. The variant never reached the score-comparison step.

**Concrete example from the real data:**
- Entry **"Gor"** had variant `"gar"` AND false positive `"gar"`
- Every occurrence of "gar" in the transcript was silently discarded
- `lowScoreMatchCount` stayed at 0

### Why variants and false positives are semantically contradictory

- **Variant**: *"this word IS an accepted form of the term; match it"*
- **False positive**: *"this word looks similar to the term but is NOT the term; ignore it"*

Having a word in both lists is a user error. The correct resolution is that **explicit variants always win**: if the user took the trouble of listing "gar" as a variant, that intention overrides any false positive entry.

False positives are only meaningful for *fuzzy similarity* matches — words that score above the threshold by accident because they happen to be typographically similar.

---

## The Fix

```typescript
// AFTER (fixed): false positives only filter fuzzy similarity matches
if (candidateScore < lexiconThreshold) return;

// False positives only filter fuzzy similarity matches, not explicit variants or exact terms.
// A word listed as both a variant and a false positive should always match as a variant.
if (!isExactTermMatch && !hasVariantMatch) {
  if (
    entry.falsePositiveRawSet.has(rawPart) ||
    entry.falsePositiveNormalizedSet.has(normalizedPart)
  ) {
    return;
  }

  // fuzzy false-positive score check (unchanged)
  let bestFalsePositiveScore = 0;
  if (entry.falsePositiveNormalized.length > 0) {
    for (const falsePositive of entry.falsePositiveNormalized) {
      // ...
    }
  }
}
```

The guard `!isExactTermMatch && !hasVariantMatch` ensures:
- **Exact term match** (`score = 1.0`): never filtered by false positives
- **Explicit variant match** (`score = 0.99`): never filtered by false positives
- **Fuzzy similarity match** (`score = threshold…0.99`): still filtered by false positives ✓

---

## How the bug was found: step-by-step debug session

### Step 1: Debug log placement was wrong

The existing debug log was in `computeLexiconMatches` (exported function used only in tests), not in `useLexiconMatches` (the hook used by the UI). The logs never appeared in the browser.

**Fix:** Moved debug logging into the `useMemo` of `useLexiconMatches`.

### Step 2: PRE-log confirmed data reached the hook correctly

```
entriesIn: 56, entriesNormalized: 56, variantRawCount: 25 (for Glymbar)
segmentCount: 1603, confirmedCount: 5, lexiconThreshold: 0.66
```

- H5 (all segments confirmed) ruled out: only 5/1603 confirmed
- H1 (empty variants) ruled out: `variantRawCount: 25` for the target entry

### Step 3: POST-log revealed the symptom

```
matchCount: 101, lowScoreMatchCount: 0, segmentsWithMatches: 97
```

101 exact-term matches, but **zero** variant matches. All 101 had `score = 1.0`.

### Step 4: Variant words found in transcript

Added a scan that checked whether variant words literally appeared in the transcript:
```
variantWordsFoundInTranscript: ["gar", "gar", "gar", "Glimmer", "Glimmer", ...]
```

The words **were** in the transcript. Something was preventing them from being counted.

### Step 5: Diagnosis per word

```
{ word: 'gar',     variantOfEntries: 'Gor',    falsePositiveOfEntries: 'Gor'  }  ← BUG
{ word: 'Glimmer', variantOfEntries: 'Glymbar', falsePositiveOfEntries: 'none' }  ← cache
```

- **"gar"**: variant AND false positive of "Gor" → false positive check blocked it → **Bug #1 (fixed)**
- **"Glimmer"**: variant of "Glymbar", no false positive → `forcedRecompute` showed a fresh `computeSegmentMatches` call correctly returned `score: 0.99` → the live data was correct, but the **segment result cache** (`reuseMatches: true`) held a stale empty result from before the variants were added → **resolves naturally on next lexicon edit**

### Step 6: Fix applied and verified

After applying the fix:
```
lowScoreMatchCount: 15  (was: 0)
matchCount: 144         (was: 101)
```

---

## Test coverage added

| Test | File | What it proves |
|------|------|---------------|
| `variant matches are not blocked when the word is also listed as a false positive` | `useLexiconMatches.test.ts` | Regression for Bug #1: `Glimmer` as variant+FP still matches |
| `variant matches are not blocked by false positives` | `FilterPanel.test.tsx` | Integration: counter shows ≥ 1, not 0 |
| `false positives block fuzzy similarity matches in the filter` | `FilterPanel.test.tsx` | Fuzzy FP filtering still works correctly |
| `returns zero matches when all segments are confirmed` | `useLexiconMatches.test.ts` | H5 regression coverage |

---

## Files changed

| File | Change |
|------|--------|
| `client/src/components/transcript-editor/useLexiconMatches.ts` | Bug fix: false positive check gated on `!isExactTermMatch && !hasVariantMatch` |
| `client/src/components/transcript-editor/__tests__/useLexiconMatches.test.ts` | 2 new tests |
| `client/src/components/transcript-editor/__tests__/FilterPanel.test.tsx` | 1 updated + 1 new test |
