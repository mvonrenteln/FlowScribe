
# Einheitliches UI AI Konzept

## Analyse der Hauptprobleme

### Problem 1: Überladene Top-Navigation

Die Top-Navigation enthält zu viele Elemente auf einer Ebene:

- Highlights, AI Speaker, AI Merge (Feature-Buttons)
- Model-Selector (nur für Einzelbearbeitung)
- Save revision, Export (Dokumentaktionen)
- Theme Toggle, Settings (App-Funktionen)

**Auswirkung:** Buttons brechen um, unklare Hierarchie, schlechte Skalierbarkeit

### Problem 2: Inkonsistente AI-Feature-Patterns

Aktuell gibt es **3 verschiedene Interaktionsmuster**:

| Feature | Location | Pattern | Model-Auswahl
|-----|-----|-----|-----
| AI Batch Revision | Linke Sidebar | Panel mit Start-Button | Im Panel
| AI Speaker Classification | Popup-Modal | Vollbild-Dialog | Im Dialog
| AI Segment Merge | Anderes Modal | Ähnlich aber anders | Im Dialog

**Auswirkung:** Nutzer müssen verschiedene Mental Models lernen, keine einheitliche UX

## Lösungskonzept: "AI Command Panel"

Ich schlage ein **einheitliches Side-Panel-System** vor, das alle AI-Features konsistent behandelt.

### Konzept-Übersicht (ASCII)

### Kernprinzipien

#### 1. **Einheitlicher Entry Point**

- Ein **"AI" Button** (⚡) in jedem Segment öffnet das AI Command Panel
- Ein **"AI Tools" Button** in der Top-Nav öffnet das Panel im Batch-Modus
- Linke Sidebar bleibt für **Filter & Review** (keine AI-Tools mehr dort)

#### 2. **Konsistentes Panel-Layout**

Jedes AI-Feature folgt der gleichen Struktur:

#### 3. **Vereinfachte Top-Navigation**

Vorher (zu voll):

```text
[FlowScribe] [Files] [Highlights] [AI Speaker] [AI Merge] [qwen3:30b ▾] [Save] [Export] [☀] [⚙]
```

Nachher (gruppiert):

```text
[FlowScribe] [📄 Files] [⏱ History] [🤖 AI Tools] [💾 Save] [📤 Export] [☀] [⚙]
```

## Detailliertes Design-Konzept

### Sliding Panel

**Charakteristik:** Panel gleitet von rechts über den Content, ähnlich wie ein Drawer

**Vorteile:**

- Maximaler Platz für Results
- Klare Trennung zwischen Haupt-UI und AI-Workspace
- Bekanntes Pattern (Gmail, Notion, etc.)

**ASCII Mockup - Geschlossener Zustand:**

```text
┌─────────────────────────────────────────────────────────┐
│ FlowScribe  [📄][⏱][🤖 AI Tools][💾][📤]     [☀][⚙] │
├───────────┬─────────────────────────────────────────────┤
│ FILTERS   │  [Waveform]                                 │
│           │                                             │
│ □ Marc    │  ▶ ━━━━━━━━━━━━━●──────  31:25 / 52:42   │
│ □ Carsten │                                             │
│ □ Daniel  │  ┌─────────────────────────────────────┐   │
│           │  │ 👤 MARC  30:58.45 - 31:08.69         │   │
│───────────│  │ Einige Worte halt so oder...  [⚡]   │   │
│ REVIEW    │  └─────────────────────────────────────┘   │
│ Low conf  │  ┌─────────────────────────────────────┐   │
│ Spelling  │  │ 👤 MARC  31:08.71 - 31:18.42         │   │
└───────────┘  │ Solche Sachen sind das...     [⚡]   │   │
               └─────────────────────────────────────┘   │
```

ASCII Mockup - Aufteilung mit AI Panel Offen:

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ FlowScribe  [Files] [History]  [Save] [Export]                  [☀] [⚙] │
├────────────┬─────────────────────────────────────────┬────────────────────┤
│  FILTERS   │      [Waveform & Playback]              │  AI COMMAND PANEL │
│            │                                          │                    │
│ □ Marc     │  ▶ ━━━━━━━●────────  31:25 / 52:42     │  [Tabs]            │
│ □ Carsten  │                                          │  ─────             │
│ □ Daniel   │  ┌──────────────────────────────────┐   │  Scope             │
│            │  │ MARC  30:58 - 31:08              │   │  Config            │
│────────────│  │ [Merge suggestion between ↑↓]    │   │  Settings          │
│ REVIEW     │  │ Einige Worte...           [✓][✗] │   │  ──────────────    │
│ Low conf   │  └──────────────────────────────────┘   │  [Start Batch]     │
│ Spelling   │  ┌──────────────────────────────────┐   │                    │
│            │  │ MARC  31:08 - 31:18              │   │  Progress          │
│            │  │ [Speaker: Marc→SL 95%]    [✓][✗] │   │  ▓▓▓▓▓░░ 65%      │
│            │  │ Solche Sachen sind das...        │   │  22/343            │
│            │  └──────────────────────────────────┘   │                    │
│            │                                          │  Summary           │
└────────────┴─────────────────────────────────────────┴────────────────────┘
```

#### Aufgabenteilung

**"Was ist besser - Vorschläge komplett in der Seitenleiste oder im Transcript View?"**

### Eindeutig: Im Transcript View

**Command Panel = Steuerung | Transcript View = Ergebnisse & Kontext**

**Gründe:**

1. **Platz:** Command Panel bei 25-30% Breite = zu eng für Details. Transcript bei 70%+ = genug Raum
2. **Kontext:** User sieht umgebende Segmente, Gesprächsfluss, Timeline
3. **Vergleichbarkeit:** Original/Revised side-by-side funktioniert nur mit Platz
4. **Fokus:** User arbeitet im Transcript, nicht in Sidebar
5. **Bewährtes Pattern:** Deine aktuelle Batch Revision zeigt bereits, dass es perfekt funktioniert

**Command Panel Rolle:**

- Konfiguration
- Batch starten/stoppen
- Progress monitoring
- Summary statistics
- Bulk actions (Accept All High, Reject All)

**Transcript View Rolle:**

- Einzelne Vorschläge im Detail
- Kontext sehen
- Individuelle Accept/Reject Entscheidungen
- Änderungen visualisieren

##### Die visuelle Aufteilung

- **Command Panel (rechts, ~25-30%):** Nur Konfiguration, Kontrolle, Progress, Summary
- **Transcript View (70-75%):** Alle Vorschläge inline im Kontext dargestellt
- **Element-Level (nur Text Revision):** Bleibt am Element mit Template-Menü

## Zusammenfassung der Verbesserungen

### Konsistenz-Gewinne

1. ✅ **Einheitlicher Entry Point** - Ein Ort für alle AI-Features
2. ✅ **Gleiches Layout** - Scope → Config → Settings → Actions → Results
3. ✅ **Einheitliche Model-Auswahl** - Immer im gleichen Bereich
4. ✅ **Konsistente Results-Darstellung** - Confidence-basiert gruppiert
5. ✅ **Gleiche Aktions-Buttons** - Accept/Reject pattern überall

### UX-Gewinne

1. ✅ **Reduzierte Top-Navigation** - Von 9+ auf 6 Hauptelemente
2. ✅ **Klarere Hierarchie** - Dokumentaktionen vs. AI-Tools getrennt
3. ✅ **Bessere Skalierbarkeit** - Neue AI-Features = neuer Tab
4. ✅ **Kontextuelle Nutzung** - Von Segment oder global starten
5. ✅ **Vorhersagbares Verhalten** - Einmal gelernt, überall anwendbar

## Layout Side Panel

Alle Batch-Features verwenden **exakt** diese Struktur:

```text
┌────────────────────────────────────┐
│ AI BATCH OPERATIONS           [×]  │
├────────────────────────────────────┤
│ [📝 Revision][👥 Speaker][🔗 Merge] │
│ ━━━━━━━━━━━━━                      │
│                                    │
│ SCOPE                              │
│ Filtered: 343 segments             │
│ ☐ Exclude confirmed                │
│                                    │
│ AI CONFIGURATION                   │
│ Provider  [Ollama Desktop ▾]       │
│ Model     [qwen3:30b-inst ▾]       │
│ Batch     [10 segments    ▾]       │
│                                    │
│ [FEATURE] SETTINGS                 │
│  Template  [Fix Grammar    ▾]      │
│           - Fix Grammar            │
│           - Remove Fillers         │
│           - Improve Clarity        │
│           - Custom Prompt 1        │
│ [Feature-spezifische Optionen]     │
│                                    │
│ [▶ Start Batch]                    │
│                                    │
│ ───────── wenn gestartet: ──────── │
│ PROGRESS                           │
│ ▓▓▓▓▓▓▓░░░ 65%                     │
│ Processing: 22 / 343               │
│                                    │
│ [⏸ Pause] [⏹ Stop] [🗑 Clear]      │
│                                    │
│ RESULTS SUMMARY                    │
│ ▼ High Confidence (12)             │
│   #045  0:45.2  Preview...       │
│   #089  1:23.5  Preview...       │
│   #145  2:15.8  Preview...       │
│                                    │
│ ▶ Medium Confidence (3)            │
│ ▶ Low Confidence (0)               │
│                                    │
│ [✓ Accept All High]                │
│ [✗ Reject All]                     │
│                                    │
│ Navigation                         │
│ [← Prev] [Next →]                  │
│ ☐ Show only suggestions            │
└────────────────────────────────────┘
```

Die Templates sind natürlich feature-Spezifisch.

Die Result Summery - Bereiche High/Medium/Low sind auf- und zuklappbar und beinhalten die entsprechenden Funde in Kurzform. Ein Klick führt zur entsprechender Section. Das Scrollen durch hunderte Sections wo vielleicht nur einige Änderungsvorschläge sind, wäre zu mühsam.

**Keyboard Navigation**

- `N` = Next suggestion
- `P` = Previous suggestion
- `A` = Accept current
- `R` = Reject current

**3. Toggle: "Show only suggestions"**

- Filtert Transcript View auf nur Segmente mit Vorschlägen
- Kontext-Segmente (±1) könnten ausgegraut bleiben für Übersicht

## Feature-spezifische Details

### 1. Text Revision (Element-Level)

**Bleibt am Element - KEIN Command Panel nötig**

```text
┌─────────────────────────────────────────────────┐
│ MARC  0:48.52 - 0:48.60       [✓] [🔖] [✨] [...] │
│                                         ↓       │
│ Mhm.                          ┌─────────────────┴──────┐
└───────────────────────────────│ ✨ Transcript Cleanup  │
                                │ ✨ Verbesserte Klarheit│
                                │ ✨ Remove Fillers      │
                                │ ────────────────────   │
                                │ More templates...    →│
                                │ ────────────────────   │
                                │ Provider [Ollama  ▾]  │
                                │ Model    [qwen3   ▾]  │
                                └────────────────────────┘
````

### 2. Text Revision (Batch) - In-Transcript Results

Side Panel wie default.

Transcript View zeigt (wie bisher):

```text
┌──────────────────────────────────────────────────────────┐
│ DANIEL  0:49.74 - 1:02.86                  [✓] [🔖] [...] │
│                                                           │
│ ORIGINAL                      │ REVISED                   │
│ Durrandir kann Durrandir das  │ Durrandir kann das auch   │
│ auch irgendwie erspüren? Weil │ irgendwie erspüren? Weil  │
│ gesehen hat er es ja nur      │ gesehen hat er es ja nur  │
│ Oswin und so ansatzweise hat  │ Oswin, und so hat er das  │
│ er das beschrieben.           │ ansatzweise beschrieben.  │
│                                                           │
│                               [Reject] [✓ Accept]         │
└──────────────────────────────────────────────────────────┘
```

### Speaker Classification

Transcript View:

```text
┌─────────────────────────────────────────────────────────────┐
│ ┌─ AI Suggestion ──────────────────────────────────────────┐│
│ │ Marc → SL (Spielleiter)  95% ●                     [✓][✗]││
│ │ Reasoning: Beschreibung der Welt in 2. Person...         ││
│ └──────────────────────────────────────────────────────────┘│
│ MARC  1:04.23 - 1:31.60                      [✓] [🔖] [...] │
│                                                             │
│ Ihr schaut in Richtung der Berge entschlossen, dieser       │
│ Gefahr entgegenzutreten und die Chimären zu verfolgen...    │
└─────────────────────────────────────────────────────────────┘
```

### Segment Merge

Side Panel (Ausschnitt):

```text
│ AI CONFIGURATION                  │
│ Provider  [AI Hub         ▾]      │
│ Model     [qwen3-235b     ▾]      │
│ Batch     [10 pairs       ▾]      │
│                                    │
│ MERGE SETTINGS                     │
│ Max Gap       [2.0 sec]            │
│ Min Confidence [Medium ▾]          │
│ ☑ Same speaker only                │
│ ☑ Enable text smoothing            │
````
Transcript View zeigt Merge-Vorschlag:

```text
┌─────────────────────────────────────────────────┐
│ CARSTEN  31:18.52 - 31:26.35      [✓] [🔖] [...]│
│                                                 │
│ solche Worte genommen und hat die miteinander   │
│ verschmolzen, ohne dass das                     │
├─ ╔══════════════════════════════════════════╗ ──┤
│  ║ MERGE SUGGESTION  Gap: 0.79s  Conf: 95% ║    │
│  ║                            [✗ Reject] [✓]║   │
│  ╠══════════════════════════════════════════╣   │
│  ║ MERGED TEXT:                             ║   │
│  ║ solche Worte genommen und hat die        ║   │
│  ║ miteinander verschmolzen, ohne dass das  ║   │
│  ║ Gesamtergebnis für dich einen Sinn ergibt║   │
│  ║                                          ║   │
│  ║ ℹ Reasoning: Incomplete sentence         ║   │
│  ║   continuation, same speaker, minimal    ║   │
│  ║   pause indicates natural speech flow    ║   │
│  ╚══════════════════════════════════════════╝   │
├─────────────────────────────────────────────────┤
│ CARSTEN  31:26.37 - 31:32.65      [✓] [🔖] [...]│
│                                                 │
│ Gesamtergebnis für dich einen Sinn ergibt.      │
└─────────────────────────────────────────────────┘
````


## Mockup aller Bestandteile

```javascript
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ChevronRight, ChevronDown, Pause, Square, Trash2, Check, X } from 'lucide-react'

export default function AIBatchOperationsMockups() {
  const [activeTab, setActiveTab] = useState<'speaker' | 'merge' | 'revision'>('speaker')
  const [isRunning, setIsRunning] = useState(true)
  const [expandedConfidence, setExpandedConfidence] = useState<string[]>(['high'])

  const toggleConfidence = (level: string) => {
    setExpandedConfidence(prev => 
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    )
  }

  const suggestions = {
    high: [
      { id: '#045', time: '0:45.2', preview: 'Marc → SL', confidence: 95 },
      { id: '#089', time: '1:23.5', preview: 'Beschreibung der Welt...', confidence: 95 },
      { id: '#145', time: '2:15.8', preview: 'Ihr schaut in Richtung...', confidence: 92 },
      { id: '#234', time: '3:42.1', preview: 'Die Chimären zu verfolgen...', confidence: 91 },
    ],
    medium: [
      { id: '#067', time: '1:05.3', preview: 'Marc → Daniel', confidence: 78 },
      { id: '#178', time: '2:45.7', preview: 'Uncertain speaker...', confidence: 72 },
    ],
    low: []
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-[1600px] mx-auto">
        <h1 className="text-3xl font-semibold mb-8 text-zinc-100">FlowScribe AI Batch Operations</h1>
        
        <div className="grid grid-cols-[1fr_400px] gap-6">
          {/* Main Content Area - Transcript View */}
          <div className="space-y-4">
            <Card className="bg-zinc-950 border-zinc-800 p-6">
              <h2 className="text-xl font-medium mb-4 text-zinc-200">Transcript View with Inline Suggestions</h2>
              
              {/* Segment with Speaker Classification Suggestion */}
              <div className="space-y-4">
                <div className="border border-blue-500/30 rounded-lg p-4 bg-blue-500/5">
                  <div className="bg-zinc-900 border border-zinc-700 rounded-md p-3 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-zinc-400">AI Suggestion</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10">
                          <X className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-400 hover:text-green-300 hover:bg-green-500/10">
                          <Check className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-blue-400 font-medium">Marc → SL (Spielleiter)</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500" style={{ width: '95%' }} />
                        </div>
                        <span className="text-xs text-zinc-400">95%</span>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">
                      Reasoning: Beschreibung der Welt in 2. Person, narrative Perspektive
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-full bg-blue-500 rounded-full" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-blue-400">MARC</span>
                        <span className="text-xs text-zinc-500">1:04.23 - 1:31.60</span>
                      </div>
                      <p className="text-zinc-300">
                        Ihr schaut in Richtung der Berge entschlossen, dieser Gefahr entgegenzutreten und die 
                        Chimären zu verfolgen und bei der Gelegenheit vielleicht in Erfahrung zu bringen, was 
                        sie eigentlich sind und woher sie kommen.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Segment with Merge Suggestion */}
                <div className="border border-amber-500/30 rounded-lg p-4 bg-amber-500/5">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-full bg-green-500 rounded-full" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-green-400">CARSTEN</span>
                        <span className="text-xs text-zinc-500">31:18.52 - 31:26.35</span>
                      </div>
                      <p className="text-zinc-300">
                        solche Worte genommen und hat die miteinander verschmolzen, ohne dass das
                      </p>
                    </div>
                  </div>

                  <div className="my-4 border border-amber-500/50 rounded-lg bg-zinc-900 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-amber-400">MERGE SUGGESTION</span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-zinc-400">Gap: 0.79s</span>
                          <span className="text-zinc-600">•</span>
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 h-1 bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full bg-green-500" style={{ width: '95%' }} />
                            </div>
                            <span className="text-zinc-400">95%</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" className="h-7 px-3 text-red-400 hover:text-red-300 hover:bg-red-500/10">
                          Reject
                        </Button>
                        <Button size="sm" className="h-7 px-3 bg-green-600 hover:bg-green-500 text-white">
                          Accept
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-zinc-300">
                        <span className="text-zinc-500 mr-2">MERGED TEXT:</span>
                        solche Worte genommen und hat die miteinander verschmolzen, ohne dass das 
                        Gesamtergebnis für dich <span className="bg-green-500/20 text-green-300">einen Sinn ergibt</span>
                      </p>
                      <p className="text-xs text-zinc-500 mt-2">
                        Reasoning: Incomplete sentence continuation, same speaker, minimal pause indicates natural speech flow
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-2 h-full bg-green-500 rounded-full" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-green-400">CARSTEN</span>
                        <span className="text-xs text-zinc-500">31:26.37 - 31:32.65</span>
                      </div>
                      <p className="text-zinc-300">
                        Gesamtergebnis für dich einen Sinn ergibt.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Regular Segment */}
                <div className="flex items-start gap-3 p-4 rounded-lg hover:bg-zinc-900/50">
                  <div className="w-2 h-full bg-green-500 rounded-full" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-green-400">CARSTEN</span>
                      <span className="text-xs text-zinc-500">31:32.47 - 31:35.34</span>
                    </div>
                    <p className="text-zinc-300">
                      Also einfach so runtergegeliert, ein Wort ans andere gereiht.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Command Panel */}
          <Card className="bg-zinc-950 border-zinc-800 p-5 h-fit sticky top-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-zinc-100">AI Batch Operations</h3>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-200">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-5 p-1 bg-zinc-900 rounded-lg">
              <button
                onClick={() => setActiveTab('revision')}
                className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                  activeTab === 'revision' 
                    ? 'bg-zinc-800 text-zinc-100' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Revision
              </button>
              <button
                onClick={() => setActiveTab('speaker')}
                className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                  activeTab === 'speaker' 
                    ? 'bg-zinc-800 text-zinc-100' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Speaker
              </button>
              <button
                onClick={() => setActiveTab('merge')}
                className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                  activeTab === 'merge' 
                    ? 'bg-zinc-800 text-zinc-100' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Merge
              </button>
            </div>

            <div className="space-y-5">
              {/* Scope */}
              <div>
                <h4 className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wide">Scope</h4>
                <div className="text-sm text-zinc-300 mb-2">Filtered: 343 segments</div>
                <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                  <input type="checkbox" className="rounded border-zinc-700 bg-zinc-900" />
                  <span>Exclude confirmed</span>
                </label>
              </div>

              {/* AI Configuration */}
              <div>
                <h4 className="text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wide">AI Configuration</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block">Provider</label>
                    <select className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200">
                      <option>Ollama auf Desktop</option>
                      <option>AI Hub</option>
                      <option>OpenAI</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block">Model</label>
                    <select className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200">
                      <option>qwen3:30b-instruct</option>
                      <option>qwen3-235b</option>
                      <option>gpt-4</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block">Batch Size</label>
                    <select className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200">
                      <option>10 segments</option>
                      <option>20 segments</option>
                      <option>50 segments</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Feature Settings */}
              <div>
                <h4 className="text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wide">
                  {activeTab === 'speaker' && 'Speaker Classification'}
                  {activeTab === 'merge' && 'Merge Settings'}
                  {activeTab === 'revision' && 'Revision Settings'}
                </h4>
                {activeTab === 'speaker' && (
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block">Prompt Template</label>
                    <select className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200">
                      <option>RPG - Marc</option>
                      <option>Interview Style</option>
                      <option>Custom Prompt 1</option>
                    </select>
                  </div>
                )}
                {activeTab === 'merge' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-zinc-500 mb-1.5 block">Max Time Gap</label>
                      <input 
                        type="number" 
                        defaultValue="2.0"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 mb-1.5 block">Min Confidence</label>
                      <select className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200">
                        <option>Medium and above</option>
                        <option>High only</option>
                        <option>All</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-zinc-400">
                      <input type="checkbox" defaultChecked className="rounded border-zinc-700 bg-zinc-900" />
                      <span>Same speaker only</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-400">
                      <input type="checkbox" defaultChecked className="rounded border-zinc-700 bg-zinc-900" />
                      <span>Enable text smoothing</span>
                    </label>
                  </div>
                )}
                {activeTab === 'revision' && (
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block">Template</label>
                    <select className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200">
                      <option>Fix Grammar & Style</option>
                      <option>Remove Fillers</option>
                      <option>Improve Clarity</option>
                      <option>Custom Prompt 1</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Start/Actions */}
              {!isRunning ? (
                <Button className="w-full bg-blue-600 hover:bg-blue-500 text-white" onClick={() => setIsRunning(true)}>
                  Start Batch
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="h-px bg-zinc-800" />
                  
                  {/* Progress */}
                  <div>
                    <h4 className="text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wide">Progress</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-zinc-300">Processing: 22 / 343</span>
                        <span className="text-zinc-500">65%</span>
                      </div>
                      <Progress value={65} className="h-2" />
                      <div className="text-xs text-zinc-500">Elapsed: 1m 23s</div>
                    </div>
                  </div>

                  {/* Control Buttons */}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                      <Pause className="w-3.5 h-3.5 mr-1.5" />
                      Pause
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                      <Square className="w-3.5 h-3.5 mr-1.5" />
                      Stop
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" className="w-full border-zinc-700 text-zinc-400 hover:bg-zinc-800">
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Clear Results
                  </Button>

                  {/* Results Summary */}
                  <div>
                    <h4 className="text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wide">Results Summary</h4>
                    <div className="space-y-1">
                      {/* High Confidence */}
                      <div className="bg-zinc-900 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleConfidence('high')}
                          className="w-full flex items-center justify-between p-3 hover:bg-zinc-800/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {expandedConfidence.includes('high') ? (
                              <ChevronDown className="w-4 h-4 text-zinc-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-zinc-400" />
                            )}
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-sm text-zinc-300">High Confidence</span>
                          </div>
                          <span className="text-sm font-medium text-zinc-400">{suggestions.high.length}</span>
                        </button>
                        {expandedConfidence.includes('high') && (
                          <div className="px-3 pb-3 space-y-1">
                            {suggestions.high.map((item) => (
                              <button
                                key={item.id}
                                className="w-full flex items-center justify-between p-2 text-left hover:bg-zinc-800 rounded transition-colors group"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-zinc-500 font-mono">{item.id}</span>
                                    <span className="text-zinc-600">•</span>
                                    <span className="text-zinc-500">{item.time}</span>
                                  </div>
                                  <div className="text-sm text-zinc-400 truncate group-hover:text-zinc-300">
                                    {item.preview}
                                  </div>
                                </div>
                                <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 flex-shrink-0 ml-2" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Medium Confidence */}
                      <div className="bg-zinc-900 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleConfidence('medium')}
                          className="w-full flex items-center justify-between p-3 hover:bg-zinc-800/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {expandedConfidence.includes('medium') ? (
                              <ChevronDown className="w-4 h-4 text-zinc-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-zinc-400" />
                            )}
                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                            <span className="text-sm text-zinc-300">Medium Confidence</span>
                          </div>
                          <span className="text-sm font-medium text-zinc-400">{suggestions.medium.length}</span>
                        </button>
                      </div>

                      {/* Low Confidence */}
                      <div className="bg-zinc-900 rounded-lg overflow-hidden opacity-50">
                        <button
                          disabled
                          className="w-full flex items-center justify-between p-3"
                        >
                          <div className="flex items-center gap-2">
                            <ChevronRight className="w-4 h-4 text-zinc-400" />
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-sm text-zinc-300">Low Confidence</span>
                          </div>
                          <span className="text-sm font-medium text-zinc-400">0</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Bulk Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-500 text-white">
                      Accept All High
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 border-zinc-700 text-red-400 hover:bg-red-500/10">
                      Reject All
                    </Button>
                  </div>

                  {/* Navigation */}
                  <div>
                    <h4 className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wide">Navigation</h4>
                    <div className="flex gap-2 mb-2">
                      <Button size="sm" variant="outline" className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                        Prev
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                        Next
                      </Button>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                      <input type="checkbox" className="rounded border-zinc-700 bg-zinc-900" />
                      <span>Show only suggestions</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
```

## Hintergründe / Gedanken

Das Text revision Feature ist das Einzige, das wirklich auf Element-Ebene Sinn macht. Hier möchte ich auch oft einen Textausschnitt verfeinern. Und das soll schnell gehen. Deswegen sind in dem Ai Menü mit dem Sternchen auch alle Templates, die man oft braucht (auswählbar in den Settings) direkt erreichbar und alle weiteren in einem kleinen Submenü versteck (siehe neues Bild). Ziel ist One-Click Navigation für die häufigsten Aktionen. Speaker, Segment Merge, Content Generierung, Kapitel-Überschriften arbeiten alle grundsätzlich als Batch. Auf einzelnen Elementen machen sie keinen Sinn oder bieten keinen Mehrwert gegenüber manueller Bearbeitung (ich habe schneller erkannt, dass eine Section gemerged werden sollte und "m" gedrückt, als mir die KI das zurückmeldet -> kein mehrwert).

Im Command Panel sollte vielleicht eher die Steuerung stattfinden. Die Vorschläge/ergebnisse finde ich besser im Transcript-View selbst. Die aktuellen AI-Fenster haben das Problem, dass alles viel zu klein ist, um etwas zu erkennen. Wenn ich einen Command Panel auf etwa 1/3 Breite habe, dann kann das wieder eng werden. Und auf jeden Fall wird es von der Höhe her schmal, denn ich habe die Einstellungen darüber und darunter dann vielleich 1/2 bis 1/3 des Panels für die Ergebnisse - und das ist das wichtigste.

Suggestions mit Progress, dann aufteilung in Confidence mit Acccept/reject all finde ich gut. Vielleicht sieht man hier aber nur eine kurzinfo zu jedem element und ein Klick bringt einen zu dem Segement im Transkript, wo dann weiteres steht? Segment Merge könnte dann als klammer zwischen den beiden Elementen dargestellt werden, mit Confidence, Begründung... Der Gemergte Text könnte sogar inline dargestellt werden, die Änderungen farblich hervorgehoben...

Jedes feature sollte exakt gleich aufgebau sein und sich nicht wie in den ASCII Bildern unterscheiden. Scope: Filtered, all; Provider Configuration; spezial Settings (keine advanced Settungs, custom templates sind im Template Dropdown mit aufgeführt; Sart Batch, clear/pause/stop erst nach Batch start, Progress mit % und Anzahl, darunter die Ergebnisse wie besprochen. Es gibt keinen Grund warum sich die Menüs unterscheiden sollten. Außer in den Optionen unter "xy settings". Speaker werden über den allgemeinen Filter angewandt und allenfalls filtered / all ausgewählt (kann man eigentlich auch weglassen und einfach anzeigen wie viele ausgewählt sind.) Außer exclude confiremed - das braucht man, da muss entscheiden werden, ob in die Filter-Leiste oder hier. Es müssen optionen wie cancel, reject all etc. schnell zugreifbar sein, wenn ich die Aktion schnell verwerfen will. Vielleicht sollten die Vorschläge auch sofort ausgeblendet (aber nicht gelöscht) werden wenn ich den View schließe - dann kann ich dort später weitermachen.

Also: Einzel-Bearbeitung will ich weiter am Element und ohne Seitenleiste - da fehlt dann nur die Modell/Provider Auswahl (Optional) - kann da mit rein. Batches alle soweit irgend geht einheitlich. Filter-Seitenleiste aktiv nutzen. Transkript Bereich aktiv nutzen (siehe Vorher Nachher View bei Text Revision, das ist perfekt.)

