# FlowScribe: Zentrales Einstellungen-Menü

## Überblick

Dieses Dokument beschreibt den Plan zur Implementierung eines zentralen, modularen Settings-Menüs für FlowScribe. Das Ziel ist eine skalierbare, benutzerfreundliche und accessible Lösung, die alle aktuellen und zukünftigen Einstellungen aufnehmen kann.

### 🚀 Aktueller Status (31.12.2025)

| Phase | Status | Beschreibung |
|-------|--------|--------------|
| Phase 1 | ✅ Fertig | Settings Shell (Sheet, Navigation, Content) |
| Phase 2 | ✅ Fertig | AI Settings (Provider, OpenAI, Ollama, Templates) |
| Phase 3 | 🔄 Teilweise | Template System (Basis vorhanden, Kategorien ausstehend) |
| Phase 4 | ✅ Fertig | Appearance Settings (Theme-Toggle integriert) |
| Phase 5 | ⏳ Ausstehend | Spellcheck & Glossar Migration |
| Phase 6 | ⏳ Ausstehend | Polish & Accessibility |
| Phase 7 | 🔄 Teilweise | Legacy Cleanup (Config-Tab entfernt) |

**Highlights:**
- AI Provider sind vollständig Provider-agnostisch (Ollama, OpenAI, Custom)
- Provider-Tests sind echte Verbindungstests (nicht gemockt)
- AISpeakerDialog nutzt jetzt Provider aus Settings
- Batch-Size bleibt im Dialog (Use-Case-spezifisch)

---

## 1. Motivation

### Aktueller Zustand
- Einstellungen sind verstreut über verschiedene Dialoge (AISpeakerDialog, SpellcheckDialog, GlossaryDialog)
- Theme-Toggle als separater Button
- Keine zentrale Stelle für globale Konfigurationen
- AI-Konfiguration (Server, Model, Templates) im AISpeakerDialog verpackt

### Probleme
- Schwer auffindbar für Nutzer
- Inkonsistente UX
- Schlechte Skalierbarkeit bei neuen Features
- Templates/Config zu eng mit Feature-Dialogen gekoppelt

---

## 2. Designprinzipien

### UX-Anforderungen
- **Leichtgewichtig**: Sheet/Drawer-basiert, nicht blockierendes Overlay
- **Hierarchisch**: Kategorisierte Tabs/Sections für einfache Navigation
- **Suchbar**: Globale Suche über alle Einstellungen (Phase 2)
- **Responsive**: Mobile-friendly mit angepasstem Layout
- **Schnell**: Lazy Loading für schwere Komponenten

### Accessibility (WCAG 2.1 AA)
- Vollständige Keyboard-Navigation
- Fokus-Management beim Tab-Wechsel
- ARIA-Labels für alle interaktiven Elemente
- Ausreichende Farbkontraste
- Screen-Reader-optimiert

### Architektur
- **Separation of Concerns**: Settings-State getrennt von Feature-State
- **Testbarkeit**: Atomare Settings-Komponenten, isoliert testbar
- **Erweiterbarkeit**: Plugin-artige Struktur für neue Kategorien
- **Persistenz**: Einheitlicher Storage-Layer (localStorage)

---

## 3. Struktur des Settings-Menüs

```
┌─────────────────────────────────────────────────────────────┐
│  ⚙️ Einstellungen                                      [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌──────────────────────────────────────┐  │
│  │             │  │                                      │  │
│  │  🤖 AI      │  │  AI Provider Configuration           │  │
│  │  ├─ Server  │  │  ─────────────────────────────────   │  │
│  │  └─ Prompts │  │                                      │  │
│  │             │  │  [Provider Dropdown: Ollama/OpenAI]  │  │
│  │  🎨 Design  │  │                                      │  │
│  │             │  │  ┌─────────────────────────────────┐ │  │
│  │  🔤 Sprache │  │  │ Server 1: localhost:11434      │ │  │
│  │             │  │  │ Model: llama3.2                │ │  │
│  │  ⚡ Editor  │  │  │ [Test] [Delete]                │ │  │
│  │             │  │  └─────────────────────────────────┘ │  │
│  │             │  │                                      │  │
│  │             │  │  ┌─────────────────────────────────┐ │  │
│  │             │  │  │ Server 2: OpenAI API           │ │  │
│  │             │  │  │ Model: gpt-4o                  │ │  │
│  │             │  │  │ [Test] [Delete]                │ │  │
│  │             │  │  └─────────────────────────────────┘ │  │
│  │             │  │                                      │  │
│  │             │  │  [+ Add Server]                      │  │
│  │             │  │                                      │  │
│  └─────────────┘  └──────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Kategorien

#### 🤖 AI (Künstliche Intelligenz)
```
AI
├── Server & Modelle
│   ├── Provider-Liste (Ollama, OpenAI, Custom)
│   ├── Server hinzufügen/bearbeiten/löschen
│   ├── Modell-Auswahl pro Server
│   ├── API-Key Management (verschlüsselt)
│   └── Verbindungstest
│
└── Prompt Templates
    ├── Template-Liste (Speaker Classification, Grammatik, etc.)
    ├── Template erstellen/bearbeiten/löschen
    ├── Template-Kategorie (Speaker, Grammar, Summary, etc.)
    ├── Import/Export
    └── Variablen-Referenz
```

#### 🎨 Design (Erscheinungsbild)
```
Design
├── Theme (Light/Dark/System)
├── Schriftgröße (Editor)
└── Farbschema (zukünftig)
```

#### 🔤 Sprache & Rechtschreibung
```
Sprache
├── Rechtschreibprüfung
│   ├── Aktiviert/Deaktiviert
│   ├── Sprachen (de, en)
│   ├── Ignorierte Wörter
│   └── Custom Wörterbücher
│
└── Glossar/Lexikon
    ├── Einträge verwalten
    ├── Fuzzy-Matching Schwellwert
    └── Hervorhebung (Unterstreichen, Hintergrund)
```

#### ⚡ Editor (zukünftig)
```
Editor
├── Auto-Save Intervall
├── Keyboard Shortcuts
└── Standardwerte
```

---

## 4. Technische Architektur

### 4.1 Neue Dateien & Struktur

```
client/src/
├── components/
│   ├── settings/
│   │   ├── SettingsSheet.tsx          # Haupt-Container (Sheet)
│   │   ├── SettingsNav.tsx            # Linke Navigation
│   │   ├── SettingsContent.tsx        # Rechter Content-Bereich
│   │   ├── SettingsSearch.tsx         # Globale Suche (Phase 2)
│   │   │
│   │   ├── sections/
│   │   │   ├── AISettingsSection.tsx
│   │   │   ├── AIServerSettings.tsx
│   │   │   ├── AITemplateSettings.tsx
│   │   │   ├── AppearanceSettings.tsx
│   │   │   ├── SpellcheckSettings.tsx
│   │   │   └── GlossarySettings.tsx
│   │   │
│   │   └── __tests__/
│   │       ├── SettingsSheet.test.tsx
│   │       ├── AIServerSettings.test.tsx
│   │       └── AITemplateSettings.test.tsx
│   │
│   └── ui/
│       └── ... (bestehende shadcn Komponenten)
│
├── lib/
│   ├── store/
│   │   ├── slices/
│   │   │   └── settingsSlice.ts       # Neuer Slice für Settings-UI-State
│   │   │
│   │   └── types.ts                   # Erweiterte Types
│   │
│   ├── services/
│   │   ├── aiProviderService.ts       # Abstraktion für AI Provider
│   │   ├── openaiService.ts           # OpenAI API Client
│   │   └── ollamaService.ts           # Ollama API Client (extrahiert)
│   │
│   └── settings/
│       ├── settingsStorage.ts         # Dedizierter Settings-Storage
│       ├── aiProviderConfig.ts        # AI Provider Konfiguration
│       └── __tests__/
│           ├── settingsStorage.test.ts
│           └── aiProviderConfig.test.ts
```

### 4.2 AI Provider Abstraktion

```typescript
// lib/services/aiProviderService.ts

export type AIProviderType = 'ollama' | 'openai' | 'custom';

export interface AIProviderConfig {
  id: string;
  type: AIProviderType;
  name: string;
  baseUrl: string;
  apiKey?: string;        // Nur für OpenAI/Custom
  model: string;
  isDefault?: boolean;
  lastTested?: number;
  testStatus?: 'success' | 'error' | 'pending';
}

export interface AIProviderService {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;
  listModels(): Promise<string[]>;
  testConnection(): Promise<boolean>;
}

// Factory für Provider-Instanzen
export function createAIProvider(config: AIProviderConfig): AIProviderService {
  switch (config.type) {
    case 'ollama':
      return new OllamaProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    case 'custom':
      return new CustomProvider(config);
  }
}
```

### 4.3 OpenAI Integration

```typescript
// lib/services/openaiService.ts

import OpenAI from 'openai';
import type { AIProviderConfig, AIProviderService, ChatMessage } from './aiProviderService';

export class OpenAIProvider implements AIProviderService {
  private client: OpenAI;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      dangerouslyAllowBrowser: true, // Für Browser-Nutzung
    });
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const completion = await this.client.chat.completions.create({
      model: this.config.model,
      messages: messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
      max_tokens: options?.maxTokens ?? 2048,
      temperature: options?.temperature ?? 0.7,
    });
    
    return {
      content: completion.choices[0]?.message?.content ?? '',
      usage: completion.usage,
    };
  }

  async listModels(): Promise<string[]> {
    const models = await this.client.models.list();
    return models.data.map(m => m.id);
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.listModels();
      return true;
    } catch {
      return false;
    }
  }
}
```

### 4.4 Settings Storage

```typescript
// lib/settings/settingsStorage.ts

const SETTINGS_STORAGE_KEY = 'flowscribe:settings';

export interface PersistedSettings {
  version: 1;
  
  // AI Settings
  aiProviders: AIProviderConfig[];
  defaultProviderId?: string;
  
  // Prompt Templates (kategorisiert)
  promptTemplates: PromptTemplate[];
  
  // Appearance
  theme: 'light' | 'dark' | 'system';
  fontSize?: number;
  
  // Spellcheck (migriert aus globalState)
  // ...
}

export function readSettings(): PersistedSettings | null { ... }
export function writeSettings(settings: PersistedSettings): void { ... }
export function migrateFromLegacy(): PersistedSettings { ... }
```

---

## 5. Aufgabenliste

### Phase 1: Grundstruktur (Settings Shell) ✅
- [x] **1.1** Settings-Sheet Grundgerüst erstellen (`SettingsSheet.tsx`)
- [x] **1.2** Navigation mit Tab-Struktur (`SettingsNav.tsx`)
- [x] **1.3** Content-Container mit Lazy Loading (`SettingsContent.tsx`)
- [x] **1.4** Settings-Button in App-Header integrieren
- [x] **1.5** Keyboard-Navigation und Focus-Management
- [x] **1.6** Unit-Tests für Shell-Komponenten

### Phase 2: AI Settings Migration ✅
- [x] **2.1** AI Provider Abstraktion implementieren (`aiProviderService.ts`)
- [x] **2.2** OpenAI Service mit offizieller Lib (`openaiProvider.ts`)
- [x] **2.3** Ollama Service extrahieren (`ollamaProvider.ts`)
- [x] **2.4** Multi-Provider State im Settings Storage (`settingsStorage.ts`)
- [x] **2.5** AI Server Settings UI (`AIServerSettings.tsx`)
  - [x] Provider hinzufügen/bearbeiten/löschen
  - [x] Verbindungstest mit visueller Rückmeldung (echte Tests, nicht gemockt)
  - [x] API-Key Input (Password-Feld, nie in Logs)
  - [x] Modell-Dropdown (dynamisch geladen)
- [x] **2.6** Unit-Tests für AI Services
- [x] **2.7** AISpeakerDialog auf neue Provider-Auswahl umgestellt
  - [x] Config-Tab entfernt
  - [x] Provider-Dropdown im Analyze-Tab
  - [x] Batch-Size im Dialog belassen (Use-Case-spezifisch)

### Phase 3: Template System erweitern
- [ ] **3.1** Template-Kategorien einführen (Speaker, Grammar, Summary)
- [x] **3.2** Template Settings UI (`AITemplateSettings.tsx`) - Basis vorhanden
- [ ] **3.3** Template-Editor mit Syntax-Highlighting (optional)
- [ ] **3.4** Variablen-Referenz und Validierung
- [ ] **3.5** Import/Export für Templates
- [ ] **3.6** Unit-Tests für Template-Management

### Phase 4: Appearance Settings ✅
- [x] **4.1** Theme-Toggle in Settings integriert
- [x] **4.2** Appearance Settings Section (`AppearanceSettings.tsx`)
- [ ] **4.3** System-Theme-Detection verbessern (optional)

### Phase 5: Spellcheck & Glossar Migration
- [ ] **5.1** Spellcheck Settings extrahieren (`SpellcheckSettings.tsx`)
- [ ] **5.2** Glossar Settings extrahieren (`GlossarySettings.tsx`)
- [ ] **5.3** Bestehende Dialoge auf Settings verlinken

### Phase 6: Polish & Accessibility
- [ ] **6.1** ARIA-Labels und Rollen überprüfen
- [ ] **6.2** Screen-Reader Tests
- [ ] **6.3** Mobile Layout optimieren
- [ ] **6.4** Settings-Suche implementieren (optional)
- [ ] **6.5** Keyboard Shortcuts Dokumentation

### Phase 7: Legacy Cleanup (teilweise erledigt)
- [x] **7.1** Alte Config-Teile aus AISpeakerDialog entfernt (Config-Tab entfernt)
- [x] **7.2** Storage-Migration implementieren (Legacy-Migration vorhanden)
- [ ] **7.3** Deprecation-Warnungen entfernen (nach vollständiger Migration)
- [ ] **7.4** Dokumentation aktualisieren

---

## 6. Datenmodell-Erweiterungen

### 6.1 Erweiterte Types

```typescript
// lib/store/types.ts - Erweiterungen

// === AI Provider Types ===

export type AIProviderType = 'ollama' | 'openai' | 'custom';

export interface AIProviderConfig {
  id: string;
  type: AIProviderType;
  name: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  isDefault?: boolean;
  lastTested?: number;
  testStatus?: 'success' | 'error' | 'pending';
}

// === Template Types (erweitert) ===

export type TemplateCategory = 'speaker' | 'grammar' | 'summary' | 'custom';

export interface PromptTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  systemPrompt: string;
  userPromptTemplate: string;
  isDefault?: boolean;
  variables?: TemplateVariable[];
}

export interface TemplateVariable {
  name: string;
  description: string;
  required: boolean;
}

// === Settings State ===

export interface SettingsState {
  isOpen: boolean;
  activeSection: SettingsSection;
}

export type SettingsSection = 
  | 'ai-servers' 
  | 'ai-templates' 
  | 'appearance' 
  | 'spellcheck' 
  | 'glossary';

export interface SettingsSlice {
  settings: SettingsState;
  openSettings: (section?: SettingsSection) => void;
  closeSettings: () => void;
  setActiveSection: (section: SettingsSection) => void;
  
  // AI Providers
  aiProviders: AIProviderConfig[];
  addAIProvider: (provider: Omit<AIProviderConfig, 'id'>) => void;
  updateAIProvider: (id: string, updates: Partial<AIProviderConfig>) => void;
  removeAIProvider: (id: string) => void;
  setDefaultAIProvider: (id: string) => void;
  testAIProvider: (id: string) => Promise<boolean>;
}
```

### 6.2 Migration bestehender Daten

Die bestehende `AISpeakerConfig` wird zu `AIProviderConfig[]` migriert:

```typescript
// Alte Struktur
{
  ollamaUrl: "http://localhost:11434",
  model: "llama3.2",
  batchSize: 10,
  templates: [...],
  activeTemplateId: "default"
}

// Neue Struktur
{
  aiProviders: [
    {
      id: "legacy-ollama",
      type: "ollama",
      name: "Local Ollama",
      baseUrl: "http://localhost:11434",
      model: "llama3.2",
      isDefault: true
    }
  ],
  promptTemplates: [
    {
      id: "default",
      name: "RPG Transcript Classifier",
      category: "speaker",
      systemPrompt: "...",
      userPromptTemplate: "...",
      isDefault: true
    }
  ],
  aiBatchSize: 10
}
```

---

## 7. UI/UX Details

### 7.1 Sheet vs Modal vs Page

**Entscheidung: Sheet (Drawer)**

| Aspekt | Sheet ✅ | Modal | Page |
|--------|----------|-------|------|
| Kontext-Erhalt | Ja | Teilweise | Nein |
| Schneller Zugriff | Ja | Ja | Nein |
| Platz für Inhalt | Gut | Begrenzt | Sehr gut |
| Mobile-Friendly | Sehr gut | Gut | Gut |
| Nicht-blockierend | Ja | Nein | Ja |

### 7.2 Responsive Verhalten

```
Desktop (>1024px):
┌─────────────────────────────────────────────┐
│  [Nav-Sidebar 200px] │ [Content ~600px]     │
└─────────────────────────────────────────────┘

Tablet (768-1024px):
┌─────────────────────────────────────────────┐
│  [Nav 160px] │ [Content 100%]               │
└─────────────────────────────────────────────┘

Mobile (<768px):
┌─────────────────────────────────────────────┐
│  [Tabs oben]                                │
│  [Content 100%]                             │
└─────────────────────────────────────────────┘
```

### 7.3 Animationen

- Sheet: Slide-in von rechts (300ms ease-out)
- Tab-Wechsel: Fade (150ms)
- Speichern: Subtle pulse auf Save-Button
- Fehler: Shake-Animation auf fehlerhaften Feldern

---

## 8. Testing-Strategie

### 8.1 Unit Tests

```typescript
// __tests__/AIServerSettings.test.tsx

describe('AIServerSettings', () => {
  it('renders empty state when no providers configured', () => {...});
  it('displays all configured providers', () => {...});
  it('allows adding a new Ollama provider', () => {...});
  it('allows adding a new OpenAI provider with API key', () => {...});
  it('validates required fields before saving', () => {...});
  it('tests connection and shows result', () => {...});
  it('masks API key in display', () => {...});
  it('handles deletion with confirmation', () => {...});
});

// __tests__/openaiService.test.ts

describe('OpenAIProvider', () => {
  it('initializes client with correct config', () => {...});
  it('sends chat request with correct format', () => {...});
  it('handles rate limit errors gracefully', () => {...});
  it('lists available models', () => {...});
  it('tests connection successfully', () => {...});
  it('handles connection timeout', () => {...});
});
```

### 8.2 Integration Tests

```typescript
describe('Settings Integration', () => {
  it('persists provider changes to localStorage', () => {...});
  it('migrates legacy config on first load', () => {...});
  it('uses selected provider in AI analysis', () => {...});
});
```

### 8.3 Accessibility Tests

```typescript
describe('Settings Accessibility', () => {
  it('is navigable by keyboard only', () => {...});
  it('announces section changes to screen readers', () => {...});
  it('has proper focus trap in sheet', () => {...});
  it('closes on Escape key', () => {...});
});
```

---

## 9. Sicherheitsüberlegungen

### API-Key Handling
- API-Keys werden im localStorage gespeichert (wie vom User gewünscht)
- Keys werden nie in Console-Logs ausgegeben
- Input-Felder nutzen `type="password"`
- Optional: Verschlüsselung mit Browser-spezifischem Key

### CORS & Browser-Sicherheit
- OpenAI SDK benötigt `dangerouslyAllowBrowser: true`
- Hinweis in UI, dass API-Key im Browser gespeichert wird
- Empfehlung: Separate API-Keys für Browser-Nutzung

---

## 10. Abhängigkeiten

### Neue npm Packages

```json
{
  "dependencies": {
    "openai": "^4.x"
  }
}
```

### Bestehende Packages (genutzt)
- `zustand` - State Management
- `@radix-ui/react-*` - UI Primitives (Sheet, Tabs, etc.)
- `lucide-react` - Icons

---

## 11. Zeitschätzung

| Phase | Aufwand | Priorität |
|-------|---------|-----------|
| Phase 1: Grundstruktur | 4-6h | Hoch |
| Phase 2: AI Settings | 8-12h | Hoch |
| Phase 3: Templates | 4-6h | Mittel |
| Phase 4: Appearance | 2h | Niedrig |
| Phase 5: Spellcheck/Glossar | 4h | Mittel |
| Phase 6: Polish | 4h | Mittel |
| Phase 7: Cleanup | 2h | Niedrig |

**Gesamt: ~28-36 Stunden**

---

## 12. Offene Fragen

1. **API-Key Verschlüsselung**: Soll eine zusätzliche Verschlüsselungsschicht implementiert werden? - Ja, so, dass sie mit Browser-Mitteln gespeichert werden kann. Prüfe gängige Standards (OWASP).
2. **Provider-Import**: Soll es möglich sein, Provider-Konfigurationen zu exportieren/importieren? - Zweitrangig, da sehr einfach
3. **Mehrere Default-Provider**: Soll es pro Template-Kategorie einen Default geben? - ja, später
4. **Cloud-Sync**: Ist ein zukünftiger Cloud-Sync der Settings geplant? - Nein

---

## Anhang: Bestehende Einstellungen (Inventar)

### Aus AISpeakerDialog
- `ollamaUrl` - Server URL
- `model` - Modellname
- `batchSize` - Batch-Größe für Analyse
- `templates[]` - Prompt Templates
- `activeTemplateId` - Aktives Template

### Aus SpellcheckDialog
- `spellcheckEnabled` - Aktiviert/Deaktiviert
- `spellcheckLanguages[]` - Aktive Sprachen
- `spellcheckIgnoreWords[]` - Ignorierte Wörter
- `spellcheckCustomDictionaries[]` - Custom Wörterbücher
- `spellcheckCustomEnabled` - Custom Dicts aktiviert

### Aus GlossaryDialog
- `lexiconEntries[]` - Glossar-Einträge
- `lexiconThreshold` - Fuzzy-Matching Schwellwert
- `lexiconHighlightUnderline` - Unterstreichung aktiv
- `lexiconHighlightBackground` - Hintergrund-Highlight aktiv

### Aus ThemeToggle
- `theme` - Light/Dark (localStorage: "theme")

---

*Erstellt: 31.12.2025*
*Status: Entwurf*

