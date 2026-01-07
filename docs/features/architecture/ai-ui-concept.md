
# Einheitliches AI-Bedienkonzept für FlowScribe

## Problemanalyse

### Problem 1: Überladene Top-Navigation

Die Top-Navigation vereint zu viele unterschiedliche Funktionen und Aktionen:

- Feature-spezifische Buttons (Highlights, AI Speaker, AI Merge)
- AI-Model-Selector (nur für Einzelbearbeitung verwendet)
- Dokumentaktionen (Save Revision, Export)
- App-Steuerung (Theme Toggle, Settings)

Dies führt zu gebrochenen Zeilen, einer unkaren Prioritätsverteilung und mangelnder Skalierbarkeit für neue Features.

### Problem 2: Inkonsistente AI-Feature-Bedienung

Derzeit existieren **drei unterschiedliche Bedienparadigmen** für AI-Features:

| Feature | Position | Bedienung | Model-Auswahl
|-----|-----|-----|-----
| Batch Text-Revision | Linke Sidebar | Panel mit Start-Button | Im Panel
| Speaker-Klassifikation | Popup-Modal | Vollbild-Dialog | Im Dialog
| Segment-Merge | Anderes Modal | Abweichende Struktur | Im Dialog

Benutzer müssen unterschiedliche mentale Modelle erlernen und navigieren zwischen inkonsistenten Schnittstellen.

## Lösungsansatz: „AI Command Panel"

Implementierung eines **einheitlichen Seitenpanels** für alle AI-Features mit konsistenter Struktur, Bedienung und Rückmeldung.

### Kernprinzipien der Lösung

#### 1. Einheitlicher Einstiegspunkt

- Ein **„AI Tools"-Button** in der Top-Navigation öffnet das Panel im Batch-Modus
- Die linke Sidebar konzentriert sich auf **Filter & Review** (AI-Tools ziehen aus)

#### 2. Konsistentes Panel-Layout für alle Features

Jedes AI-Feature folgt diesem standardisierten Aufbau:

1. **Tabs** zur Feature-Auswahl (Revision, Speaker, Merge, etc.)
2. **Scope**: Anzahl betroffener Segmente, Filteroptionen
3. **AI-Konfiguration**: Provider und Modell-Auswahl
4. **Feature-Einstellungen**: Templates, Parameter (spezifisch pro Feature)
5. **Start-Button** zum Starten der Batch-Verarbeitung
6. **Fortschritt** und **Ergebnisse** während/nach Ausführung
7. **Ergebnis-Zusammenfassung**: Gruppiert nach Konfidenz (Hoch/Mittel/Niedrig)

#### 3. Vereinfachte Top-Navigation

**Vorher** (überbelastet):

```text
[FlowScribe] [Files] [Highlights] [AI Speaker] [AI Merge] [qwen3:30b ▾] [Save] [Export] [☀] [⚙]
```

**Nachher** (strukturiert nach Funktionsbereichen):

```text
[FlowScribe] [📄 Files] [⏱ History] [🤖 AI Tools] [💾 Save] [📤 Export] [☀] [⚙]
```

## Detailliertes Design-Konzept

### Sliding Panel – Dreigeteiltes Layout

Das AI Command Panel **öffnet sich neben dem Transcript** und teilt den Platz nach folgendem Schema:

- **Linke Spalte (20%)**: Filter & Review (existierend)
- **Mittlere Spalte (50-55%)**: Transcript View mit Waveform + Inline-Ergebnisse
- **Rechte Spalte (25-30%)**: AI Command Panel

Das Panel **überlagert nicht** den Transcript-Inhalt. Der Transcript bleibt der Haupt-Arbeitsbereich und behält seine volle Breite für detaillierte Vorschläge.

**Designvorteile:**

- **Maximaler Platz für Ergebnisse**: Transcript bei 50-55% ist ideal für Original/Überarbeitet nebeneinander
- **Klare Funktionsbereiche**: Steuerung rechts, Ergebnisse in der Mitte, Filter links
- **Nicht-intrusiv**: Der Transcript wird nicht verdeckt, nur die Seitenspalte reduziert sich
- **Vertrautes Muster**: Ähnelt etablierten Designs in Gmail, Notion, Figma mit Sidebar+Main+Panel

**Layout – Panel geschlossen:**

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

**Layout – Panel offen:**

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ FlowScribe  [Files] [History]  [Save] [Export]                  [☀] [⚙]   │
├────────────┬─────────────────────────────────────────┬────────────────────┤
│  FILTERS   │      [Waveform & Playback]              │  AI COMMAND PANEL  │
│            │                                         │                    │
│ □ Marc     │  ▶ ━━━━━━━●────────  31:25 / 52:42      │  [Tabs]            │
│ □ Carsten  │                                         │  ─────             │
│ □ Daniel   │  ┌──────────────────────────────────┐   │  Scope             │
│            │  │ MARC  30:58 - 31:08              │   │  Config            │
│────────────│  │ [Merge suggestion between ↑↓]    │   │  Settings          │
│ REVIEW     │  │ Einige Worte...           [✓][✗] │   │  ──────────────    │
│ Low conf   │  └──────────────────────────────────┘   │  [Start Batch]     │
│ Spelling   │  ┌──────────────────────────────────┐   │                    │
│            │  │ MARC  31:08 - 31:18              │   │  Progress          │
│            │  │ [Speaker: Marc→SL 95%]    [✓][✗] │   │  ▓▓▓▓▓░░ 65%       │
│            │  │ Solche Sachen sind das...        │   │  22/343            │
│            │  └──────────────────────────────────┘   │                    │
│            │                                         │  Summary           │
└────────────┴─────────────────────────────────────────┴────────────────────┘
```

### Aufgabenteilung: Steuerung vs. Ergebnisse

**Kerndesign-Entscheidung**: Vorschläge und Ergebnisse gehören **ins Transcript**, nicht ins Command Panel.

**Begründung:**

1. **Platzeffizienz**: Das Panel (~25-30% Breite) ist zu schmal für detaillierte Vorschläge. Der Transcript (~70-75%) bietet optimalen Platz
2. **Kontextsicherheit**: Benutzer sehen umgebende Segmente, Gesprächsfluss und Timeline
3. **Vergleichbarkeit**: Original/Überarbeitete Version nebeneinander funktioniert nur mit ausreichend Platz
4. **Intuitiver Workflow**: Benutzer arbeiten primär im Transcript
5. **Bewährtes Pattern**: Die aktuelle Batch-Revision beweist die Wirksamkeit dieser Aufteilung

**Command Panel konzentriert sich auf:**

- Konfiguration (Provider, Modell, Templates)
- Batch-Steuerung (Start, Pause, Stopp)
- Fortschrittsüberwachung (Statistiken, Zeitangaben)
- Kurzzusammenfassung (nach Konfidenz-Niveau gruppiert)
- Bulk-Aktionen (Accept/Reject All für jede Kategorie)

**Transcript View zeigt:**

- Einzelne Vorschläge im vollständigen Kontext
- Detaillierte Begründungen
- Direktes Accept/Reject pro Element
- Visuelle Hervorhebung von Änderungen

**Panel-Anordnung:**

- **Command Panel (rechts, 25-30%)**: Nur Konfiguration, Kontrolle, Progress, Summary
- **Transcript View (Mitte, 50-55%)**: Alle Vorschläge inline im vollständigen Kontext dargestellt
- **Filter-Sidebar (links, 20%)**: Bestehende Filter und Review-Kategorien
- **Wichtig**: Das Panel **verdeckt nichts**. Es ist eine Dreierspalten-Aufteilung, nicht ein Overlay

## Zusammenfassung der Verbesserungen

### Konsistenz-Gewinne durch einheitliches Design

1. ✅ **Einheitlicher Einstiegspunkt** – Ein Ort für alle AI-Features
2. ✅ **Standardisiertes Layout** – Scope → Konfiguration → Einstellungen → Aktionen → Ergebnisse
3. ✅ **Einheitliche Model-Auswahl** – Immer an der gleichen Position
4. ✅ **Konsistente Ergebnisdarstellung** – Nach Konfidenz-Niveau gruppiert
5. ✅ **Standardisierte Bedienelemente** – Accept/Reject-Pattern überall

### UX-Gewinne für Benutzer

1. ✅ **Reduzierte Top-Navigation** – Von 9+ auf 6 Hauptelemente
2. ✅ **Klarere Hierarchie** – Dokumentaktionen vs. AI-Tools räumlich getrennt
3. ✅ **Bessere Skalierbarkeit** – Neue AI-Features = neuer Tab im Panel
4. ✅ **Flexibler Kontext** – Von einzelnem Segment oder global starten
5. ✅ **Vorhersagbares Verhalten** – Einmal gelernt, überall gleich anwendbar

## Standardisierte Panel-Struktur

Alle Batch-Processing-Features verwenden **diese exakte Struktur**:

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
│   (Manuell bestätigte Segmente)    │
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

**Erklärungen zur Struktur:**

**Scope & Filter:**
- **Exclude Confirmed**: Verhindert, dass bereits vom Benutzer manuell bestätigte Segmente erneut bearbeitet werden. „Confirmed" ist ein Status, den der Benutzer auf einem Segment setzt, um zu markieren, dass es reviewed und korrekt ist
- **Filtered vs. All**: Zeigt die aktuelle Anzahl zu verarbeitender Segmente an

**Results Summary:**
- Templates sind feature-spezifisch (Text-Vorlagen, Speaker-Profile, Merge-Parameter)
- Die Konfidenz-Kategorien (Hoch/Mittel/Niedrig) sind **auf- und zuklappbar**
- Sie enthalten **kurze Zusammenfassungen** der Änderungen
- **Ein Klick auf einen Summary-Eintrag (z.B. „#045  0:45.2") navigiert direkt zum betreffenden Segment im Transcript** – ermöglicht schnelle Navigation ohne sequentielle Durchlauf
- Das verhindert mühsames Scrollen durch hunderte von Segmenten

**Tastaturnavigation:**

- `N` = Nächster Vorschlag
- `P` = Vorheriger Vorschlag
- `A` = Aktuellen akzeptieren
- `R` = Aktuellen ablehnen
- `ESC` = Panel schließen

**Filter-Toggle: „Nur Vorschläge zeigen"**

- Filtert Transcript-View auf Segmente mit Vorschlägen
- Kontext-Segmente (±1) bleiben sichtbar
- Ermöglicht fokussiertes Review ohne Ablenkung

## Feature-spezifische Implementierungen

### 1. Inline Text-Revision (Element-Level)

**Format**: Kein Command Panel – direkt am Segment

Das Feature bleibt **direkt am Text-Element**. Ein Sternchen-Button (✨) öffnet ein Inline-Menü mit häufig genutzten Templates und Modell-Auswahl.

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

**Vorteile:**
- One-Click-Zugriff auf häufige Revisions-Vorlagen
- Schnelle, fokussierte Bearbeitung einzelner Segmente
- Model-Auswahl optional – nutzt Standard, wenn nicht geändert

### 2. Batch Text-Revision

**Format**: Command Panel + Inline-Ergebnisse

Command Panel (standard):

- Scope, Konfiguration, Template-Auswahl
- Start/Pause/Stopp-Steuerung
- Konfidenz-Gruppierte Zusammenfassung

Transcript View (inline):

- Original und Überarbeitete Version nebeneinander
- Änderungen visuell hervorgehoben
- Accept/Reject-Buttons pro Segment

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

### 3. Speaker-Klassifikation (Batch)

**Format**: Command Panel + Inline-Vorschläge

Command Panel:
- Scope (ggf. auf bestimmte Speaker filtern)
- Konfiguration
- Prompt-Template
- Batch-Steuerung
- Konfidenz-Übersicht

Transcript View:
- Vorschlag als **Box oberhalb des Segments**
- Zeigt: Zugeordneter Speaker + Konfidenz-Prozentzahl
- Begründung aus der AI-Analyse
- Direktes Accept/Reject

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

### 4. Segment-Zusammenführung (Merge)

**Format**: Command Panel + Inline-Zusammenführungs-Widget

Command Panel:
- Scope (ggf. nach Speaker filtern)
- Konfiguration (Provider, Modell)
- Merge-Einstellungen:
  - Max. Zeitlücke
  - Min. Konfidenz
  - Nur gleiche Speaker
  - Text-Glättung aktivieren
- Batch-Steuerung
- Konfidenz-Übersicht mit Navigations-Links

Transcript View:
- Zusammenführungs-Vorschlag als **Inline-Widget zwischen Segmenten**
- Zeigt: Lücke, Konfidenz, Begründung
- Visualisiert den **zusammengeführten Text** (Änderungen hervorgehoben)
- Accept/Reject-Buttons

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

**Besonderheiten bei Merge:**
- Visuelle Klammer oder Verbindungslinie zwischen den zwei Segmenten
- Neue Zeitstempel nach Zusammenführung klar erkennbar
- Option zum Anschauen des zusammengeführten Textes vor Bestätigung

## Implementierungs-Referenz: React-Komponenten-Mockup

Die folgende React-Komponente demonstriert die vollständige Bedienoberfläche mit Command Panel und Inline-Ergebnissen:

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

## Design-Rationale

### Element-Level vs. Batch: Unterschiedliche Workflows für unterschiedliche Aufgaben

Das Konzept unterscheidet zwischen zwei fundamentalen AI-Workflows:

**Element-Level (Text-Revision nur):**
- **Einsatz**: Benutzer will einzelne Segmente schnell verfeinern
- **Umsetzung**: Inline-Menü direkt am Segment (Sternchen-Button)
- **Vorteil**: One-Click-Zugriff auf häufige Templates, kein Panel-Overhead
- **Warum nicht Batch?** Command Panel würde unnötige Schritte erzeugen und Workflow verlangsamen

**Batch-Level (Speaker, Merge, Content-Generierung):**
- **Einsatz**: Benutzer will konsistent über mehrere/viele Segmente arbeiten
- **Umsetzung**: Command Panel mit Start/Pause/Ergebnisse
- **Vorteil**: Konfigurieren einmal, 343 Segmente auf einmal verarbeiten
- **Warum nicht Element?** Speaker-Vorschläge auf einzelnen Segmenten haben keinen Mehrwert gegenüber manueller Auswahl. Merge ist per Tastenkürzel (M) schneller erkannt als auf AI-Vorschläge zu warten

### Platz-Aufteilung: Transcript ist Haupt-Arbeitsbereich

Die Dreierspalten-Aufteilung (Filter | Transcript | Panel) folgt dieser Logik:

- **Command Panel (25-30%)**: Nur Konfiguration, Fortschritt, Kurz-Summary
- **Transcript View (50-55%)**: Alle detaillierten Vorschläge im Kontext (Originale/Überarbeitete nebeneinander möglich)
- **Filter-Sidebar (20%)**: Vor-Filterung und Review-Kategorien

**Begründung**: Ein Panel mit 25-30% Breite ist zu schmal für detaillierte Ergebnisse. Vorschläge gehören dorthin, wo der Benutzer arbeitet: im Transcript mit vollständigem Kontext (umgebende Segmente, Timeline, Sprecher).

### Navigation: Click + Keyboard für beide Use Cases

Zwei parallele Navigationsansätze decken alle User-Szenarien ab:

**Sequentielle Review** (Keyboard: N/P/A/R):
- Schnell durch eine Serie von Vorschlägen navigieren
- Ideal für „alle hohen Konfidenz akzeptieren" Workflows
- Shortcuts ermöglichen Hände-auf-Tastatur-Arbeit

**Selective Review** (Mouse: Click auf Summary):
- Ein Klick auf „#045 0:45.2" in der Summary springt direkt zum Segment
- Ideal für „nur bestimmte Vorschläge durchsehen" Workflows
- Schneller als N/P durchnavigieren bei großen Abständen

### Konsistenz durch Standardisierung

Alle Batch-Features nutzen die **exakt gleiche Panel-Struktur** (Tabs → Scope → Config → Settings → Start → Progress → Summary). Nur die Feature-Einstellungen unterscheiden sich. Das macht das System nach einer Lernkurve vorhersagbar und skalierbar für neue Features.

### Sidebar: Aktiver Filter, nicht Ergebnis-Viewer

Die Filter-Sidebar arbeitet **vor** der Batch, nicht parallel dazu:
- Speaker-Filter vor Start anwenden → reduziert Scope
- „Exclude Confirmed" verhindert Wiederbearbeitung von bereits bestätigten Segmenten
- Review-Kategorien helfen beim nachgelagerten Filtern (z.B. „nur Low-Confidence zeigen")

Die Sidebar **unterstützt den Workflow**, ohne dass AI-Tools sie überladen.

