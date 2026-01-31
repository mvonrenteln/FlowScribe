# Unified AI Command Panel Architecture

## Problem Analysis

### Problem 1: Overcrowded Top Navigation

The top navigation combines too many different functions and actions:

- Feature-specific buttons (Highlights, AI Speaker, AI Merge)
- AI Model Selector (only used for individual editing)
- Document actions (Save Revision, Export)
- App controls (Theme Toggle, Settings)

This results in broken lines, unclear hierarchy, and poor scalability for new features.

### Problem 2: Inconsistent AI Feature Interaction Patterns

Previously, **three different interaction paradigms** existed for AI features:

| Feature | Location | Interaction Pattern | Model Selection
|-----|-----|-----|-----
| Batch Text Revision | Left Sidebar | Panel with Start Button | In Panel
| Speaker Classification | Popup Modal | Full-screen Dialog | In Dialog
| Segment Merge | Different Modal | Different Structure | In Dialog

Users must learn different mental models and navigate between inconsistent interfaces.

## Solution Approach: "AI Command Panel"

Implement a **unified side panel** for all AI features with consistent structure, interaction, and feedback.

### Core Principles

#### 1. Unified Entry Point

- An **"AI Tools" button** in the top navigation opens the panel in batch mode
- The left sidebar focuses on **Filters & Review** (AI Tools removed from sidebar)

#### Prompt Persistence (Settings)

- AI prompt templates are stored in the global settings payload (localStorage).
- Chapter Detection templates are normalized on load; legacy `templates` arrays are upgraded to
  `prompts`.
- Built-in prompts are always restored and remain editable but not deletable.

#### 2. Consistent Panel Layout for All Features

Each AI feature follows this standardized structure:

1. **Tabs** for feature selection (Revision, Speaker, Merge, etc.)
2. **Scope**: Number of affected segments, filter options
3. **AI Configuration**: Provider and model selection
4. **Feature Settings**: Templates, parameters (specific per feature)
5. **Start Button** to begin batch processing
6. **Progress** and **Results** during/after execution
7. **Result Summary**: Grouped by confidence level (High/Medium/Low)

#### 3. Simplified Top Navigation

**Before** (overcrowded):

```text
[FlowScribe] [Files] [Highlights] [AI Speaker] [AI Merge] [qwen3:30b ▾] [Save] [Export] [☀] [⚙]
```

**After** (organized by function groups):

```text
[FlowScribe] [📄 Files] [⏱ History] [🤖 AI Tools] [💾 Save] [📤 Export] [☀] [⚙]
```

## Detailed Design Concept

### Sliding Panel – Three-Column Layout

The AI Command Panel **opens beside the Transcript** and divides space as follows:

- **Left Column (20%)**: Filters & Review (existing)
- **Center Column (50-55%)**: Transcript View with Waveform + Inline Results
- **Right Column (25-30%)**: AI Command Panel

The panel **does not overlay** transcript content. The transcript remains the primary work area and keeps full width for detailed suggestions.

**Design Benefits:**

- **Maximum space for results**: Transcript at 50-55% is ideal for Original/Revised side-by-side
- **Clear functional areas**: Control on right, results in center, filters on left
- **Non-intrusive**: Transcript is not hidden, sidebar just narrows
- **Familiar pattern**: Similar to established designs in Gmail, Notion, Figma with Sidebar+Main+Panel

**Layout – Panel Closed:**

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
│───────────│  │ Some words like this or...    [⚡]   │   │
│ REVIEW    │  └─────────────────────────────────────┘   │
│ Low conf  │  ┌─────────────────────────────────────┐   │
│ Spelling  │  │ 👤 MARC  31:08.71 - 31:18.42         │   │
└───────────┘  │ Things like that are...       [⚡]   │   │
               └─────────────────────────────────────┘   │
```

**Layout – Panel Open:**

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
│ REVIEW     │  │ Some words...               [✓][✗]   │  ──────────────    │
│ Low conf   │  └──────────────────────────────────┘   │  [Start Batch]     │
│ Spelling   │  ┌──────────────────────────────────┐   │                    │
│            │  │ MARC  31:08 - 31:18              │   │  Progress          │
│            │  │ [Speaker: Marc→SL 95%]      [✓][✗]   │  ▓▓▓▓▓░░ 65%       │
│            │  │ Things like this are...          │   │  22/343            │
│            │  └──────────────────────────────────┘   │                    │
│            │                                         │  Summary           │
└────────────┴─────────────────────────────────────────┴────────────────────┘
```

### Task Division: Control vs. Results

**Core Design Decision**: Suggestions and results belong **in the Transcript**, not in the Command Panel.

**Reasoning:**

1. **Space Efficiency**: Panel at ~25-30% width is too narrow for detailed suggestions. Transcript at ~50-55% provides optimal space
2. **Context Safety**: Users see surrounding segments, conversation flow, and timeline
3. **Comparison**: Original/Revised side-by-side only works with sufficient space
4. **Intuitive Workflow**: Users work primarily in the transcript
5. **Proven Pattern**: Current batch revision demonstrates the effectiveness of this approach

**Command Panel focuses on:**

- Configuration (Provider, Model, Templates)
- Batch Control (Start, Pause, Stop)
- Progress Monitoring (Statistics, Timing)
- Brief Summary (grouped by confidence level)
- Bulk Actions (Accept/Reject All per category)

**Transcript View shows:**

- Individual suggestions in full context
- Detailed reasoning
- Direct Accept/Reject per element
- Visual highlighting of changes

**Panel Arrangement:**

- **Command Panel (right, 25-30%)**: Configuration, control, progress, summary only
- **Transcript View (center, 50-55%)**: All suggestions inline in full context
- **Filter Sidebar (left, 20%)**: Existing filters and review categories
- **Important**: Panel **does not overlay** content. It's a three-column layout, not an overlay

## Summary of Improvements

### Consistency Gains Through Unified Design

1. ✅ **Unified Entry Point** – One place for all AI features
2. ✅ **Standardized Layout** – Scope → Configuration → Settings → Actions → Results
3. ✅ **Unified Model Selection** – Always in the same location
4. ✅ **Consistent Result Display** – Grouped by confidence level
5. ✅ **Standardized Controls** – Accept/Reject pattern everywhere

### UX Gains for Users

1. ✅ **Reduced Top Navigation** – From 9+ to 6 main elements
2. ✅ **Clearer Hierarchy** – Document actions vs. AI Tools spatially separated
3. ✅ **Better Scalability** – New AI Features = new tab in panel
4. ✅ **Flexible Context** – Start from single segment or globally
5. ✅ **Predictable Behavior** – Once learned, applies everywhere

## Standardized Panel Structure

All batch processing features use **this exact structure**:

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
│   (User-confirmed segments)        │
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
│ [Feature-specific options]         │
│                                    │
│ [▶ Start Batch]                    │
│                                    │
│ ───────── when running: ──────── │
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

**Structure Explanations:**

**Scope & Filter:**
- **Exclude Confirmed**: Prevents already user-confirmed segments from being reprocessed. "Confirmed" is a status the user sets on a segment to mark it as reviewed and correct
- **Filtered vs. All**: Shows the current count of segments to process

**Results Summary:**
- Templates are feature-specific (text templates, speaker profiles, merge parameters)
- Confidence categories (High/Medium/Low) are **collapsible**
- They contain **short summaries** of changes
- **Clicking a summary entry (e.g. "#045 0:45.2") navigates directly to that segment in the Transcript** – enables fast navigation without sequential traversal
- Prevents tedious scrolling through hundreds of segments

**Keyboard Navigation:**

- `N` = Next suggestion
- `P` = Previous suggestion
- `A` = Accept current
- `R` = Reject current
- `ESC` = Close panel

**Filter Toggle: "Show only suggestions"**

- Filters Transcript View to segments with suggestions
- Context segments (±1) remain visible
- Enables focused review without distraction

## Feature-Specific Implementations

### 1. Inline Text Revision (Element-Level)

**Format**: No Command Panel – directly on segment

The feature remains **directly on the text element**. A star button (✨) opens an inline menu with frequently used templates and model selection.

```text
┌─────────────────────────────────────────────────┐
│ MARC  0:48.52 - 0:48.60       [✓] [🔖] [✨] [...] │
│                                         ↓       │
│ Mhm.                          ┌─────────────────┴──────┐
└───────────────────────────────│ ✨ Transcript Cleanup  │
                                │ ✨ Improve Clarity     │
                                │ ✨ Remove Fillers      │
                                │ ────────────────────   │
                                │ More templates...    →│
                                │ ────────────────────   │
                                │ Provider [Ollama  ▾]  │
                                │ Model    [qwen3   ▾]  │
                                └────────────────────────┘
```

**Benefits:**
- One-click access to frequent revision templates
- Fast, focused editing of individual segments
- Model selection optional – uses default if unchanged

### 2. Batch Text Revision

**Format**: Command Panel + Inline Results

Command Panel (standard):

- Scope, configuration, template selection
- Start/Pause/Stop control
- Confidence-grouped summary

Transcript View (inline):

- Original and revised version side-by-side
- Changes visually highlighted
- Accept/Reject buttons per segment

```text
┌──────────────────────────────────────────────────────────┐
│ DANIEL  0:49.74 - 1:02.86                  [✓] [🔖] [...] │
│                                                           │
│ ORIGINAL                      │ REVISED                   │
│ Word X can somehow sense it?  │ Word X can somehow sense  │
│ Because he saw it only from Y │ it? Because he saw it    │
│ and sort of has described it. │ only from Y and has sort │
│                               │ of described it.         │
│                               │                          │
│                        [Reject] [✓ Accept]               │
└──────────────────────────────────────────────────────────┘
```

### 3. Speaker Classification (Batch)

**Format**: Command Panel + Inline Suggestions

Command Panel:
- Scope (optionally filter by specific speakers)
- Configuration
- Prompt Template
- Batch Control
- Confidence Overview

Transcript View:
- Suggestion as **box above the segment**
- Shows: Assigned Speaker + Confidence Percentage
- Reasoning from AI analysis
- Direct Accept/Reject

```text
┌─────────────────────────────────────────────────────────────┐
│ ┌─ AI Suggestion ───────────────────────────────────────┐  │
│ │ Marc → GM (Game Master)  95% ●               [✓][✗]  │  │
│ │ Reasoning: Describes the world in 2nd person...      │  │
│ └───────────────────────────────────────────────────────┘  │
│ MARC  1:04.23 - 1:31.60                      [✓] [🔖] [...] │
│                                                             │
│ You look toward the mountains determined, ready to face    │
│ this danger and pursue the creatures...                    │
└─────────────────────────────────────────────────────────────┘
```

### 4. Segment Merging

**Format**: Command Panel + Inline Merge Widget

Command Panel:
- Scope (optionally filter by speaker)
- Configuration (Provider, Model)
- Merge Settings:
  - Max. Time Gap
  - Min. Confidence
  - Same speaker only
  - Enable text smoothing
- Batch Control
- Confidence Overview with navigation links

Transcript View:
- Merge suggestion as **inline widget between segments**
- Shows: Gap, Confidence, Reasoning
- Displays **merged text** (changes highlighted)
- Accept/Reject buttons

```text
┌─────────────────────────────────────────────────┐
│ CARSTEN  31:18.52 - 31:26.35      [✓] [🔖] [...]│
│                                                 │
│ these words taken and made them merge together  │
│ without the                                      │
├─ ╔══════════════════════════════════════════╗ ──┤
│  ║ MERGE SUGGESTION  Gap: 0.79s  Conf: 95% ║    │
│  ║                            [✗ Reject] [✓]║   │
│  ╠══════════════════════════════════════════╣   │
│  ║ MERGED TEXT:                             ║   │
│  ║ these words taken and made them merge    ║   │
│  ║ together without the overall result      ║   │
│  ║ making sense for you                     ║   │
│  ║                                          ║   │
│  ║ ℹ Reasoning: Incomplete sentence         ║   │
│  ║   continuation, same speaker, minimal    ║   │
│  ║   pause indicates natural speech flow    ║   │
│  ╚══════════════════════════════════════════╝   │
├─────────────────────────────────────────────────┤
│ CARSTEN  31:26.37 - 31:32.65      [✓] [🔖] [...]│
│                                                 │
│ making sense for you overall.                   │
└─────────────────────────────────────────────────┘
```

**Special Merge Features:**
- Visual bracket or connection line between the two segments
- New timestamps after merge clearly visible
- Option to preview merged text before confirmation

## Implementation Reference: React Component Mockup

The following React component demonstrates the complete UI with Command Panel and inline results:

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
      { id: '#045', time: '0:45.2', preview: 'Marc → GM', confidence: 95 },
      { id: '#089', time: '1:23.5', preview: 'Describes the world...', confidence: 95 },
      { id: '#145', time: '2:15.8', preview: 'You look toward...', confidence: 92 },
      { id: '#234', time: '3:42.1', preview: 'To pursue the creatures...', confidence: 91 },
    ],
    medium: [
      { id: '#067', time: '1:05.3', preview: 'Marc → Player', confidence: 78 },
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
                      <span className="text-blue-400 font-medium">Marc → GM (Game Master)</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500" style={{ width: '95%' }} />
                        </div>
                        <span className="text-xs text-zinc-400">95%</span>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">
                      Reasoning: Describes world in 2nd person, narrative perspective
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
                        You look toward the mountains determined, ready to face this danger and pursue 
                        the creatures and perhaps discover what they are and where they come from.
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
                        these words taken and made them merge together without the
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
                        these words taken and made them merge together without the 
                        overall result <span className="bg-green-500/20 text-green-300">making sense</span>
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
                        overall result making sense.
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
                      Just simply like that, one word lined up with another.
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
                      <option>Ollama Desktop</option>
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

## Design Rationale

### Element-Level vs. Batch: Different Workflows for Different Tasks

The concept distinguishes between two fundamental AI workflows:

**Element-Level (Text Revision only):**

- **Use**: User wants to quickly refine individual segments
- **Implementation**: Inline menu directly on segment (star button)
- **Advantage**: One-click access to frequent templates, no panel overhead
- **Why not Batch?** Command Panel would add unnecessary steps and slow the workflow

**Batch-Level (Speaker, Merge, Content Generation):**

- **Use**: User wants to work consistently across multiple/many segments
- **Implementation**: Command Panel with Start/Pause/Results
- **Advantage**: Configure once, process 343 segments at once
- **Why not Element?** Speaker suggestions on single segments have no value over manual selection. Merge is faster recognized with shortcut (M) than waiting for AI suggestions

### Space Division: Transcript is Primary Work Area

The three-column layout (Filter | Transcript | Panel) follows this logic:

- **Command Panel (25-30%)**: Configuration, progress, brief summary only
- **Transcript View (50-55%)**: All detailed suggestions in context (side-by-side Original/Revised possible)
- **Filter Sidebar (20%)**: Pre-filtering and review categories

**Reasoning**: A panel at 25-30% width is too narrow for detailed results. Suggestions belong where the user works: in the Transcript with full context (surrounding segments, timeline, speakers).

### Navigation: Click + Keyboard for Both Use Cases

Two parallel navigation approaches cover all user scenarios:

**Sequential Review** (Keyboard: N/P/A/R):

- Quickly navigate through a series of suggestions
- Ideal for "accept all high confidence" workflows
- Shortcuts enable hands-on-keyboard work

**Selective Review** (Mouse: Click on Summary):

- Click on "#045 0:45.2" in summary jumps directly to segment
- Ideal for "review only specific suggestions" workflows
- Faster than N/P navigation at large distances

### Consistency Through Standardization

All batch features use the **exact same panel structure** (Tabs → Scope → Config → Settings → Start → Progress → Summary). Only the feature settings differ. This makes the system predictable after one learning curve and scalable for new features.

### Sidebar: Active Filter, Not Result Viewer

The filter sidebar works **before** the batch, not in parallel:

- Apply speaker filters before start → reduces scope
- "Exclude Confirmed" prevents reprocessing of already confirmed segments
- Review categories help with post-filtering (e.g. "show only Low-Confidence")

The sidebar **supports the workflow** without overloading with AI tools.
