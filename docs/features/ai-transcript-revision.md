# AI Transcript Revision - Feature Konzept

## Übersicht

**AI Transcript Revision** ermöglicht die intelligente Überarbeitung von Transkript-Segmenten durch KI. Anders als die AI Speaker Classification, die nur Sprecher zuordnet, kann dieses Feature den **Text selbst** korrigieren, verbessern oder umformulieren.

Das Feature integriert sich nahtlos in die bestehende UI, indem es kontextuelle Aktionen direkt an den Segmenten und einen globalen Batch-Modus über die bestehende FilterPanel-Infrastruktur anbietet.

---

## Use Cases

### Einzelsegment-Überarbeitung
- **Grammatik & Rechtschreibung**: Korrektur von Fehlern, die die automatische Spellcheck-Funktion erkannt hat
- **Stil & Klarheit**: Umformulierung für bessere Lesbarkeit
- **Fachbegriffe**: Korrektur falsch transkribierter Fachterminologie
- **Kontextuelle Korrektur**: AI nutzt umgebenden Kontext für bessere Korrekturen

### Batch-Überarbeitung
- **Nach Sprecher filtern**: Alle Segmente eines Sprechers überarbeiten
- **Uncertain Segments**: Nur Segmente mit niedriger Konfidenz
- **Spelling-Probleme**: Segmente mit Rechtschreibfehlern
- **Unbestätigte Segmente**: Alle noch nicht bestätigten Segmente

### Template-System: Custom First

Das System folgt dem Prinzip **Custom First** - jeder Nutzer hat eigene Workflows und Anforderungen.

**Default-Templates** (mitgeliefert, bearbeitbar, nicht löschbar):
1. **Transkript-Bereinigung**: Rechtschreibung, Füllwörter, Grammatik korrigieren
2. **Formulierung verbessern**: Klarere Ausdrucksweise, bessere Lesbarkeit
3. **Formalisieren**: Informelle Sprache → formell/professionell

**Custom Templates**: Vollständig benutzerdefiniert, nutzen die bestehenden AI Prompt Template Features

**Konfiguration in Settings:**
- **Default-Template**: Wird sofort per Tastenkürzel ausgeführt (ein Tastendruck)
- **Quick-Access Set**: Templates, die mit einem Klick im Menü erscheinen
- **Weitere**: Alle anderen Templates unter "Mehr..."

---

## UX Konzept

### Designprinzipien

1. **Keine neuen Dialoge/Listen** - Integration in bestehende UI-Elemente
2. **Kontextuell** - Aktionen erscheinen, wo sie gebraucht werden
3. **Progressive Disclosure** - Einfache Aktionen sofort, erweiterte auf Nachfrage
4. **Non-Blocking** - Nutzer kann weiterarbeiten während AI prozessiert
5. **Undo-First** - Jede Änderung ist rückgängig machbar

### Integration in bestehendes UI

#### 1. Segment-Level: Inline-Aktionen

```
┌─────────────────────────────────────────────────────────────┐
│ [00:15.30] SPEAKER_01                        [⋮] [AI ✨] [✓] │
├─────────────────────────────────────────────────────────────┤
│ Der Spieler sagt das er den Drachen angreifen will mit     │
│ seinem Schwert und hofft das er trifft.                    │
│                                                             │
│    ┌──────────────────────────────────┐                    │
│    │ ✨ Transkript-Bereinigung        │ ← Quick-Access     │
│    │ 📝 Formulierung verbessern       │    (konfiguriert   │
│    │ 🎭 Rollenspiel-Stil              │    in Settings)    │
│    │ ─────────────────────────────────│                    │
│    │ ⋯ Weitere Templates...           │ ← Alle anderen     │
│    └──────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

**Interaktion:**
- Neuer **AI-Button (✨)** im Segment-Header (neben dem Mehr-Menü)
- **Click** öffnet Popover mit Quick-Access Templates (konfiguriert in Settings)
- **Tastenkürzel (Alt+R)** führt **Default-Template** sofort aus (kein Menü!)
- "Weitere Templates..." öffnet vollständige Liste
- Während Verarbeitung: Spinner statt Sparkle-Icon
- Nach Erfolg: Kurzes Checkmark-Feedback, dann zurück zu normal

**Template-Konfiguration in Settings:**
```
┌─────────────────────────────────────────────────────────────┐
│ AI Revision Templates                                       │
├─────────────────────────────────────────────────────────────┤
│ DEFAULT (Tastenkürzel führt sofort aus):                    │
│ [▼ Transkript-Bereinigung ▼]                               │
│                                                             │
│ QUICK-ACCESS (im Menü sichtbar):                           │
│ ☑ Transkript-Bereinigung                                   │
│ ☑ Formulierung verbessern                                  │
│ ☐ Formalisieren                                            │
│ ☑ Rollenspiel-Stil (Custom)                                │
│ ☐ Technische Doku (Custom)                                 │
│                                                             │
│ [+ Neues Template erstellen]                               │
└─────────────────────────────────────────────────────────────┘
```

#### 2. Segment-Level: Im Mehr-Menü

```
┌─────────────────────────────┐
│ ✏️ Edit                      │
│ ✂️ Split at cursor          │
│ 🔗 Merge with previous      │
│ 🔗 Merge with next          │
│ ─────────────────────────── │
│ ✨ AI Revision             ▶│
│   ├─ Transkript-Bereinigung │ ← Quick-Access
│   ├─ Formulierung verbessern│ ← Quick-Access  
│   ├─ Rollenspiel-Stil       │ ← Custom
│   └─ Weitere...             │
│ ─────────────────────────── │
│ 🗑️ Delete                   │
└─────────────────────────────┘
```

#### 3. Batch-Modus: Collapsible Filter Panel Integration

Das bestehende **FilterPanel** erhält einen neuen **Collapsible-Abschnitt**, der zunächst eingeklappt erscheint und sich nahtlos in die bestehenden Filter einfügt:

**Eingeklappt (Default):**
```
┌─────────────────────────────────┐
│ FILTER                          │
│ ─────────────────────────────── │
│ ☐ Nur niedrige Konfidenz        │
│ ☐ Nur Lesezeichen               │
│ ☐ Nur unbestätigt               │
│ ☐ Mit Rechtschreibfehlern       │
│                                 │
│ Sprecher:                       │
│ [▼ Alle Sprecher          ]     │
│                                 │
│ ─────────────────────────────── │
│ ▶ AI Batch Revision             │ ← Eingeklappt, wie Filter-Label
└─────────────────────────────────┘
```

**Ausgeklappt (nach Klick):**
```
┌─────────────────────────────────┐
│ FILTER                          │
│ ─────────────────────────────── │
│ ☐ Nur niedrige Konfidenz        │
│ ☐ Nur Lesezeichen               │
│ ☐ Nur unbestätigt               │
│ ☐ Mit Rechtschreibfehlern       │
│                                 │
│ Sprecher:                       │
│ [▼ Alle Sprecher          ]     │
│                                 │
│ ─────────────────────────────── │
│ ▼ AI Batch Revision             │
│   ┌─────────────────────────────┤
│   │ Template:                   │
│   │ [▼ Transkript-Bereinigung ] │
│   │                             │
│   │ 23 Segmente (gefiltert)     │
│   │                             │
│   │ [ ✨ Starten ]              │
│   └─────────────────────────────┤
└─────────────────────────────────┘
```

**Design-Prinzipien:**
- Sieht eingeklappt aus wie ein normaler Filter-Header
- Kein visueller Unterschied zu anderen Elementen
- Öffnet sich erst bei explizitem Klick
- Kompakte Darstellung auch im geöffneten Zustand
- Badge zeigt Anzahl der betroffenen Segmente basierend auf aktiven Filtern

**Workflow:**
1. Nutzer setzt Filter (Sprecher, uncertain, spelling, etc.)
2. Transcript-Liste zeigt gefilterte Segmente
3. Im FilterPanel: Revisions-Typ wählen
4. "AI Revision starten" klicken
5. **Inline-Progress** erscheint im FilterPanel
6. Ergebnisse werden als Diff angezeigt (siehe unten)

#### 4. Batch-Ergebnisse: Side-by-Side Diff-Ansicht

Statt einer Inline-Diff-Ansicht (die nur Entwickler verstehen) zeigen wir Änderungen **nebeneinander**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [00:15.30] SPEAKER_01                                    [✗ Ablehnen] [✓]   │
├──────────────────────────────────┬──────────────────────────────────────────┤
│ ORIGINAL                         │ ÜBERARBEITET                             │
├──────────────────────────────────┼──────────────────────────────────────────┤
│ Der Spieler sagt [das] er den    │ Der Spieler sagt[,] [dass] er den        │
│ Drachen angreifen will mit       │ Drachen angreifen will[,] mit            │
│ seinem Schwert und hofft [das]   │ seinem Schwert[,] und hofft[,] [dass]    │
│ er trifft.                       │ er trifft.                               │
└──────────────────────────────────┴──────────────────────────────────────────┘
```

**Highlighting:**
- 🟥 **Rot/Durchgestrichen**: Entfernter/ersetzter Text im Original
- 🟩 **Grün/Hervorgehoben**: Neuer/geänderter Text in der Überarbeitung

**Kompaktere Alternative bei wenigen Änderungen:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [00:15.30] SPEAKER_01                                    [✗ Ablehnen] [✓]   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Der Spieler sagt, dass er den Drachen angreifen will, mit seinem Schwert,  │
│ und hofft, dass er trifft.                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 💡 4 Änderungen: +3 Kommas, 2× "das" → "dass"                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Interaktion:**
- **Ein Klick** auf das Segment wechselt zwischen Kompakt- und Diff-Ansicht
- Accept-Button (✓) übernimmt die Änderung
- Ablehnen (✗) verwirft und zeigt wieder das Original

#### 5. Toolbar: Quick-Access

```
┌─────────────────────────────────────────────────────────────────┐
│ [≡] FlowScribe  │ [↶][↷] │ [🔍] │ [✨ AI ▼] │ [⚙️] │ [☀️/🌙]  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌───────────────────────┐
                    │ 👤 Speaker Analysis    │ ← Bestehend
                    │ 📝 Revise Selection    │ ← Neu (wenn Segment gewählt)
                    │ 📝 Revise Filtered     │ ← Neu (wenn Filter aktiv)
                    │ ─────────────────────  │
                    │ ⚙️ AI Settings         │
                    └───────────────────────┘
```

### Accessibility

- **Keyboard Navigation**: Tab durch Optionen, Enter zum Ausführen
- **Screen Reader**: "AI Revision available. Press Enter for options."
- **Focus Management**: Nach Revision springt Fokus zum nächsten Segment
- **ARIA Labels**: Klar beschreibende Labels für alle AI-Aktionen
- **Reduced Motion**: Respektiert `prefers-reduced-motion` für Animationen
- **Status Announcements**: Live-Region für Fortschritt und Ergebnisse

---

## Architektur

### Übersicht

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI Layer                                │
├─────────────────────────────────────────────────────────────────┤
│  TranscriptSegment    │   FilterPanel    │    Toolbar          │
│  - AI Button          │   - Batch Config │    - AI Menu        │
│  - Inline Diff        │   - Progress     │    - Quick Actions  │
└───────────┬───────────┴────────┬─────────┴──────────┬───────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Zustand Store                              │
├─────────────────────────────────────────────────────────────────┤
│  aiRevisionSlice                                                │
│  - pendingRevisions: Map<segmentId, RevisionState>              │
│  - isProcessing: boolean                                        │
│  - batchProgress: { current, total }                            │
│  - activeRevisionType: RevisionType                             │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Service Layer                                │
├─────────────────────────────────────────────────────────────────┤
│  aiRevisionService.ts                                           │
│  - reviseSegment(segment, type, context)                        │
│  - reviseSegmentsBatch(segments, type, options)                 │
│  - buildRevisionPrompt(type, segment, context)                  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  AI Provider Layer                              │
├─────────────────────────────────────────────────────────────────┤
│  aiProviderService.ts (bestehend)                               │
│  - createAIProvider(config)                                     │
│  - provider.chat(messages)                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Store Slice: aiRevisionSlice

```typescript
// types.ts - Ergänzungen

export type RevisionType = 
  | "grammar" 
  | "clarity" 
  | "formalize" 
  | "transcription-cleanup" 
  | "custom";

export interface RevisionState {
  segmentId: string;
  originalText: string;
  revisedText: string;
  status: "pending" | "accepted" | "rejected";
  revisionType: RevisionType;
  changes: TextChange[];
  reasoning?: string;
}

export interface TextChange {
  type: "insert" | "delete" | "replace";
  position: number;
  oldText?: string;
  newText?: string;
}

export interface AIRevisionConfig {
  selectedProviderId?: string;
  selectedModel?: string;
  batchSize: number;
  templates: RevisionTemplate[];
  activeTemplateId?: string;
}

export interface RevisionTemplate {
  id: string;
  name: string;
  type: RevisionType;
  systemPrompt: string;
  userPromptTemplate: string;
}

// Store Slice
export interface AIRevisionSlice {
  // State
  aiRevisionPending: Map<string, RevisionState>;
  aiRevisionIsProcessing: boolean;
  aiRevisionProgress: { current: number; total: number };
  aiRevisionConfig: AIRevisionConfig;
  aiRevisionError: string | null;
  
  // Actions
  startSingleRevision: (segmentId: string, type: RevisionType, customPrompt?: string) => void;
  startBatchRevision: (segmentIds: string[], type: RevisionType) => void;
  cancelRevision: () => void;
  acceptRevision: (segmentId: string) => void;
  rejectRevision: (segmentId: string) => void;
  acceptAllRevisions: () => void;
  rejectAllRevisions: () => void;
  clearRevisions: () => void;
  updateRevisionConfig: (config: Partial<AIRevisionConfig>) => void;
}
```

### Service: aiRevisionService.ts

```typescript
// aiRevisionService.ts

export interface RevisionResult {
  segmentId: string;
  revisedText: string;
  changes: TextChange[];
  reasoning?: string;
}

export interface RevisionContext {
  previousSegment?: Segment;
  nextSegment?: Segment;
  speaker: Speaker;
  lexiconEntries?: LexiconEntry[];
  spellcheckIssues?: string[];
}

// Default Templates
export const REVISION_TEMPLATES: Record<RevisionType, RevisionTemplate> = {
  grammar: {
    id: "default-grammar",
    name: "Grammar Fix",
    type: "grammar",
    systemPrompt: `Du bist ein Grammatik-Experte. Korrigiere Grammatik- und 
      Rechtschreibfehler, aber verändere nicht den Inhalt oder Stil.`,
    userPromptTemplate: `Korrigiere die Grammatik im folgenden Text.
      
KONTEXT (nicht verändern):
Vorheriges Segment: {{previousText}}
Nächstes Segment: {{nextText}}

ZU KORRIGIEREN:
{{text}}

Antworte NUR mit dem korrigierten Text, keine Erklärungen.`
  },
  // ... weitere Templates
};

export async function reviseSegment(
  segment: Segment,
  type: RevisionType,
  context: RevisionContext,
  config: AIRevisionConfig,
  abortSignal?: AbortSignal
): Promise<RevisionResult> {
  // Implementation
}

export async function* reviseSegmentsBatch(
  segments: Segment[],
  type: RevisionType,
  context: BatchRevisionContext,
  config: AIRevisionConfig,
  abortSignal?: AbortSignal
): AsyncGenerator<RevisionResult> {
  // Yields results as they complete for progressive UI updates
}
```

### Komponenten-Struktur

```
components/
├── TranscriptSegment.tsx          # Erweitert mit AI-Button
├── transcript-editor/
│   ├── FilterPanel.tsx            # Erweitert mit Batch-Section
│   ├── Toolbar.tsx                # Erweitert mit AI-Menu
│   ├── AIRevisionPopover.tsx      # Neu: Inline Quick-Actions
│   ├── AIRevisionProgress.tsx     # Neu: Progress-Anzeige
│   └── SegmentDiffView.tsx        # Neu: Inline Diff
└── ui/
    └── diff-view.tsx              # Neu: Generische Diff-Komponente
```

---

## Implementierungsplan

### Phase 1: Foundation (2-3 Tage) ✅

**1.1 Store Slice**
- [x] `aiRevisionSlice.ts` erstellen
- [x] Types definieren (`RevisionState`, `RevisionType`, etc.)
- [x] In `store.ts` integrieren
- [x] Unit Tests für Slice

**1.2 Service Layer**
- [x] `aiRevisionService.ts` erstellen
- [x] Default Templates definieren
- [x] Prompt-Building-Logik
- [x] Integration mit `aiProviderService.ts`
- [x] Unit Tests für Service

**1.3 Diff-Utility**
- [x] Text-Diff-Algorithmus (oder `diff` Library nutzen)
- [x] `TextChange` Berechnung
- [x] Unit Tests

### Phase 2: Single Segment UI (2-3 Tage) ✅

**2.1 AI Button in Segment**
- [x] Button in `TranscriptSegment.tsx` hinzufügen
- [x] `AIRevisionPopover.tsx` Komponente
- [x] Quick-Action Menü
- [x] Keyboard Shortcuts

**2.2 Inline Revision Flow**
- [x] Processing State (Spinner)
- [x] Success/Error Feedback
- [x] Diff-Anzeige nach Completion

**2.3 Diff View**
- [x] `SegmentDiffView.tsx` Komponente
- [x] Accept/Reject Buttons
- [x] Compact vs Detailed Mode
- [x] Accessibility

### Phase 3: Batch Processing (2-3 Tage) ✅

**3.1 FilterPanel Integration**
- [x] "AI Batch Revision" Section in FilterPanel
- [x] Revisions-Typ Selector
- [x] Segment-Count Anzeige
- [x] Start Button

**3.2 Progress & Feedback**
- [x] `AIRevisionProgress.tsx` Komponente
- [x] In FilterPanel integrieren
- [x] Cancel-Funktion

**3.3 Batch Results**
- [x] Multiple Segments mit Diff
- [x] Accept All / Reject All
- [x] Individual Accept/Reject

### Phase 4: Advanced Features (1-2 Tage) ✅

**4.1 Toolbar Integration**
- [x] AI-Dropdown erweitern
- [x] "Revise Selection" Option
- [x] "Revise Filtered" Option

**4.2 Custom Prompts**
- [x] Custom Prompt Input Dialog
- [x] Prompt History
- [x] Template Management (in Settings)

**4.3 Kontext-Features**
- [ ] Spellcheck-Fehler an AI übergeben _(future enhancement)_
- [ ] Lexikon-Matches berücksichtigen _(future enhancement)_
- [ ] Segment-Kontext (vorher/nachher) _(future enhancement)_

### Phase 5: Polish & Testing (1-2 Tage) ✅

**5.1 E2E Tests**
- [x] Single Revision Flow _(manual testing completed)_
- [x] Batch Revision Flow _(manual testing completed)_
- [x] Error Handling
- [x] Undo/Redo Integration

**5.2 Accessibility Audit**
- [x] Keyboard Navigation
- [x] Screen Reader Tests _(ARIA labels implemented)_
- [x] Focus Management

**5.3 Performance**
- [x] Large Batch Handling
- [x] Memory Management
- [x] Debouncing/Throttling

---

## Technische Details

### Diff-Berechnung

Verwende `diff-match-patch` oder `fast-diff` Library:

```typescript
import { diff } from "fast-diff";

function computeChanges(original: string, revised: string): TextChange[] {
  const diffs = diff(original, revised);
  const changes: TextChange[] = [];
  let position = 0;
  
  for (const [type, text] of diffs) {
    if (type === diff.DELETE) {
      changes.push({ type: "delete", position, oldText: text });
    } else if (type === diff.INSERT) {
      changes.push({ type: "insert", position, newText: text });
      position += text.length;
    } else {
      position += text.length;
    }
  }
  
  return changes;
}
```

### Progressive Batch Updates

```typescript
// Im Store
async function processBatch(segmentIds: string[]) {
  set({ aiRevisionIsProcessing: true, aiRevisionProgress: { current: 0, total: segmentIds.length } });
  
  const generator = reviseSegmentsBatch(segments, type, context, config, abortController.signal);
  
  for await (const result of generator) {
    // Update einzelnes Segment sofort
    set((state) => ({
      aiRevisionPending: new Map(state.aiRevisionPending).set(result.segmentId, {
        segmentId: result.segmentId,
        originalText: getSegment(result.segmentId).text,
        revisedText: result.revisedText,
        status: "pending",
        revisionType: type,
        changes: result.changes,
        reasoning: result.reasoning,
      }),
      aiRevisionProgress: {
        current: state.aiRevisionProgress.current + 1,
        total: state.aiRevisionProgress.total,
      },
    }));
  }
  
  set({ aiRevisionIsProcessing: false });
}
```

### Undo/Redo Integration

```typescript
// acceptRevision integriert mit History
acceptRevision: (segmentId: string) => {
  const pending = get().aiRevisionPending.get(segmentId);
  if (!pending || pending.status !== "pending") return;
  
  // Nutzt bestehendes updateSegmentText, das History trackt
  get().updateSegmentText(segmentId, pending.revisedText);
  
  // Markiere als accepted
  const updated = new Map(get().aiRevisionPending);
  updated.set(segmentId, { ...pending, status: "accepted" });
  set({ aiRevisionPending: updated });
}
```

### Error Handling

```typescript
interface RevisionError {
  segmentId?: string;
  type: "network" | "parse" | "provider" | "abort";
  message: string;
  retryable: boolean;
}

// Im Service
try {
  const response = await provider.chat(messages, { signal: abortSignal });
  return parseRevisionResponse(response);
} catch (error) {
  if (error.name === "AbortError") {
    throw { type: "abort", message: "Cancelled", retryable: false };
  }
  throw { type: "network", message: error.message, retryable: true };
}
```

---

## Testing Strategie

### Unit Tests

```typescript
// aiRevisionService.test.ts
describe("aiRevisionService", () => {
  describe("buildRevisionPrompt", () => {
    it("includes context segments", () => { /* ... */ });
    it("uses correct template for type", () => { /* ... */ });
    it("handles missing context gracefully", () => { /* ... */ });
  });
  
  describe("reviseSegment", () => {
    it("returns revised text", async () => { /* ... */ });
    it("calculates correct diff", async () => { /* ... */ });
    it("handles provider errors", async () => { /* ... */ });
    it("respects abort signal", async () => { /* ... */ });
  });
});

// aiRevisionSlice.test.ts
describe("aiRevisionSlice", () => {
  it("starts single revision", () => { /* ... */ });
  it("accepts revision and updates segment", () => { /* ... */ });
  it("rejects revision without modifying segment", () => { /* ... */ });
  it("clears all pending revisions", () => { /* ... */ });
  it("integrates with undo/redo", () => { /* ... */ });
});
```

### Component Tests

```typescript
// AIRevisionPopover.test.tsx
describe("AIRevisionPopover", () => {
  it("opens on AI button click", () => { /* ... */ });
  it("shows quick action options", () => { /* ... */ });
  it("triggers revision on option select", () => { /* ... */ });
  it("is keyboard accessible", () => { /* ... */ });
  it("closes after action", () => { /* ... */ });
});

// SegmentDiffView.test.tsx
describe("SegmentDiffView", () => {
  it("highlights insertions in green", () => { /* ... */ });
  it("highlights deletions in red", () => { /* ... */ });
  it("calls onAccept when accept clicked", () => { /* ... */ });
  it("calls onReject when reject clicked", () => { /* ... */ });
  it("has accessible labels", () => { /* ... */ });
});
```

### E2E Tests

```typescript
// aiRevision.e2e.ts
describe("AI Revision E2E", () => {
  it("revises single segment via AI button", async () => {
    await page.click('[data-testid="segment-ai-button"]');
    await page.click('[data-testid="revision-grammar"]');
    await expect(page.locator('[data-testid="segment-diff"]')).toBeVisible();
    await page.click('[data-testid="accept-revision"]');
    // Verify text changed
  });
  
  it("batch revises filtered segments", async () => {
    await page.click('[data-testid="filter-uncertain"]');
    await page.selectOption('[data-testid="revision-type"]', 'grammar');
    await page.click('[data-testid="start-batch-revision"]');
    await expect(page.locator('[data-testid="revision-progress"]')).toBeVisible();
    // Wait for completion and verify
  });
});
```

---

## Dokumentation

### User Documentation

Ergänze `docs/usage.md`:

```markdown
## AI Transcript Revision

### Einzelnes Segment überarbeiten

1. Fahren Sie mit der Maus über ein Segment
2. Klicken Sie auf das ✨ AI-Symbol
3. Wählen Sie eine Option:
   - **Grammar Fix**: Korrigiert Rechtschreibung und Grammatik
   - **Improve Clarity**: Verbessert die Verständlichkeit
   - **Clean Transcription**: Entfernt Füllwörter und Wiederholungen
   - **Custom**: Eigene Anweisungen eingeben
4. Prüfen Sie die vorgeschlagenen Änderungen
5. Klicken Sie auf **Accept** oder **Reject**

### Mehrere Segmente überarbeiten

1. Öffnen Sie das Filter-Panel (linke Seitenleiste)
2. Filtern Sie die gewünschten Segmente:
   - Nach Sprecher
   - Nur unsichere Segmente
   - Nur mit Rechtschreibfehlern
3. Wählen Sie einen Revisionstyp im "AI Batch Revision" Bereich
4. Klicken Sie auf **AI Revision starten**
5. Die Ergebnisse werden inline angezeigt
6. Nutzen Sie **Accept All** oder prüfen Sie einzeln

### Tastaturkürzel

- `Alt + R`: AI Revision für ausgewähltes Segment
- `Alt + G`: Grammar Fix (Schnellzugriff)
- `Escape`: Revision abbrechen
```

---

## Risiken & Mitigationen

| Risiko | Wahrscheinlichkeit | Auswirkung | Mitigation |
|--------|-------------------|------------|------------|
| AI-Antworten sind inkonsistent | Mittel | Hoch | Robustes Parsing, Retry-Logik |
| Performance bei vielen Segmenten | Mittel | Mittel | Batching, Progressive Loading |
| Nutzer übersehen Änderungen | Niedrig | Mittel | Deutliche Diff-Visualisierung |
| Undo funktioniert nicht korrekt | Niedrig | Hoch | Umfangreiche Tests, Integration mit bestehendem History |
| Provider-Ausfälle | Niedrig | Mittel | Error-Handling, Retry-Option |

---

## Offene Fragen

1. ~~**Custom Prompt UX**: Soll Custom Prompt ein Modal sein oder Inline-Input?~~ → **Entschieden:** Template-System mit Settings-Konfiguration
2. ~~**Template-Verwaltung**: Im Settings-Dialog oder eigener Bereich?~~ → **Entschieden:** In Settings, mit Default-Template und Quick-Access Konfiguration
3. **Confidence Threshold**: Soll AI Änderungen mit Konfidenz bewerten?
4. **Word-Level Timing**: Bei Textänderungen - wie Word-Timing aktualisieren?
5. **Batch-Limit**: Maximale Segment-Anzahl pro Batch?

---

## Appendix

### Alternative UX-Optionen (verworfen)

**Option A: Separater Revision-Dialog**
- ❌ Mehr UI-Komplexität
- ❌ Kontextverlust zum Transcript

**Option B: Split-View Editor**
- ❌ Benötigt viel Platz
- ❌ Mobile-unfriendly

**Option C: Command Palette**
- ⚠️ Interessant für Power-User
- ⚠️ Kann später ergänzt werden

### Referenzen

- Bestehende AI Speaker Dialog: `client/src/components/AISpeakerDialog.tsx`
- AI Provider Service: `client/src/lib/services/aiProviderService.ts`
- Store Patterns: `client/src/lib/store/slices/`
- UI Components: `client/src/components/ui/`

---

*Erstellt: 31. Dezember 2025*
*Status: ✅ Implementierung abgeschlossen*

