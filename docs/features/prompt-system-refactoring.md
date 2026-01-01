# Prompt System Refactoring - Task List

**Ziel:** Vereinheitlichung der Template-Systeme zu einem einzigen Prompt-System mit Typen `'speaker' | 'text'`

**Datum:** 1. Januar 2026

---

## ⚠️ Wichtige Hinweise für AI Agents

**File Sync:** Immer in-memory Änderungen speichern BEVOR Terminal-Befehle ausgeführt werden!
Sonst sieht das Terminal eine veraltete Version und es kommt zu Verwirrung.

**Prompt vs Prompt Template:**
- `prompt` = Das komplette Konfigurationsobjekt (AIPrompt)
- `promptTemplate` / `userPromptTemplate` = Der String mit Platzhaltern wie `{{text}}`

---

## 📋 Übersicht der Änderungen

### Terminologie
- ~~"Template"~~ → **"Prompt"**
- ~~"Default Template"~~ → **"Built-in Prompt"** (mitgeliefert)
- ~~"Default"~~ → **"Default"** (wird bei Hotkeys verwendet, pro Typ eines)
- ~~"Quick Access"~~ → **"Quick Access"** (bleibt gleich)
- ~~"Custom"~~ → Entfernt (ist Eigenschaft, keine Kategorie)

### Typen
- `type: 'speaker' | 'text'` (statt 'speaker' | 'grammar' | 'summary' | 'custom')
- `isBuiltIn: boolean` (statt isDefault für mitgelieferte)
- `isDefault: boolean` (für Hotkey-Default)
- `quickAccess: boolean`

---

## ✅ PHASE 1: Strukturelle Änderungen - DONE ✓

- [x] Type Definitions (`types.ts`)
- [x] Store Utils (`aiSpeakerConfig.ts`)  
- [x] AI Speaker Slice (`aiSpeakerSlice.ts`)
- [x] AI Revision Slice (`aiRevisionSlice.ts`)
- [x] Store exports (`store.ts`)
- [x] Settings Components (`AITemplateSettings.tsx`, `AIRevisionTemplateSettings.tsx`)
- [x] Tests (`aiRevisionSlice.test.ts`)
- [x] TypeScript kompiliert ✓
- [x] Alle 315 Tests bestanden ✓

---

## 🔄 PHASE 2: Cleanup & Konsistenz - DONE ✓

### 2.1 Verbleibende Component-Dateien prüfen
- [x] `AISpeakerDialog.tsx` - bereits sauber
- [x] `AIRevisionPopover.tsx` - template → promptItem Variable
- [x] `AIBatchRevisionSection.tsx` - bereits sauber
- [x] `useTranscriptEditor.ts` - bereits sauber

### 2.2 Services prüfen
- [x] `aiSpeakerService.ts` - bereits sauber
- [x] `aiRevisionService.ts` - bereits sauber

### 2.3 Deprecations & Legacy-Code entfernen
- [x] `types.ts` - Legacy alias `PromptTemplate` entfernt

### 2.4 i18n - en.json aktualisieren
- [x] Keine template-Referenzen in UI-Texten

### 2.5 Code-Kommentare aktualisieren
- [x] Keine verbleibenden template-Kommentare (außer userPromptTemplate)

### 2.6 Keyboard Shortcuts
- [x] `KeyboardShortcuts.tsx` - "template" → "prompt" in description

---

## 🔄 PHASE 3: UI-Zusammenführung - DONE ✓

**Ziel:** Beide Prompt-Typen (Speaker & Text) in einer einheitlichen Settings-UI verwalten

### 3.1 Basis: AITemplateSettings.tsx erweitern
- [x] Tab-Navigation für Type (Speaker/Text)
- [x] Type-Auswahl beim Erstellen neuer Prompts (automatisch nach Tab)
- [x] Placeholder-Hilfe je nach Type anzeigen
- [x] Built-in Badge für isBuiltIn Prompts
- [x] Default-Auswahl pro Type (für Hotkeys)
- [x] Quick Access Toggle (für Text Prompts)

### 3.2 Store-Konsolidierung
- [x] Beide Config-Objekte in einer UI anzeigen (über activeTab)

### 3.3 AIRevisionTemplateSettings.tsx entfernt
- [x] Funktionalität in AITemplateSettings.tsx integriert
- [x] Import aus SettingsSheet.tsx entfernt
- [x] Datei gelöscht

### 3.4 SettingsSheet.tsx angepasst
- [x] "AI Templates" → "AI Prompts" umbenannt
- [x] "ai-revision-templates" Sektion entfernt
- [x] Menü-Navigation aktualisiert

### 3.5 Placeholder-Dokumentation in UI
- [x] Speaker Type: {{speakers}}, {{segments}}
- [x] Text Type: {{text}}, {{speaker}}, {{previousText}}, {{nextText}}

---

## 📚 PHASE 4: Dokumentation

- [ ] Dokumentation in docs/ aktualisieren
- [ ] README.md aktualisieren falls nötig

---

**Status:** 🟢 Phase 3 Complete - Ready for Documentation
**Letzte Aktualisierung:** 1. Januar 2026

- [ ] i18n Keys aktualisieren
- [ ] Dokumentation aktualisieren

---

## 🎯 Kritische Punkte

### Store-Vereinheitlichung
**Aktuell:** Zwei getrennte Systeme
- `aiSpeakerConfig.templates` (für Speaker)
- `aiRevisionConfig.templates` (für Revision)

**Neu:** Ein System
- `aiPromptConfig.prompts: AIPrompt[]`
- Filtern nach `type: 'speaker'` oder `type: 'text'`

### Settings UI
**Aktuell:** Zwei getrennte Settings-Bereiche
- "AI Templates" (Speaker)
- "Revision Templates"

**Neu:** Ein Bereich "AI Prompts"
- Tabs oder Filter für Type
- Built-in Prompts (editierbar, nicht löschbar)
- Custom Prompts (editierbar, löschbar)
- Default-Auswahl pro Type
- Quick Access pro Type

### Placeholders
**Speaker Type:**
- `{{speakers}}` - Liste bekannter Sprecher
- `{{segments}}` - Transkript-Segmente

**Text Type:**
- `{{text}}` - Segment-Text
- `{{speaker}}` - Sprecher-Name
- `{{previousText}}` - Vorheriges Segment
- `{{nextText}}` - Nächstes Segment

---

## 📝 Notizen

- Alle Änderungen müssen rückwärtskompatibel mit gespeicherten Daten sein (Migration!)
- Built-in Prompts können editiert aber nicht gelöscht werden
- "Reset to Default" stellt Built-in Prompts wieder her
- Default Prompt ist das, was bei Hotkeys (Alt+R) verwendet wird
- Quick Access Prompts erscheinen im Popover-Menü

---

**Status:** 🟡 Strukturelle Änderungen DONE - Umbenennungen pending (User)
**Geschätzter Aufwand:** 4-6 Stunden
**Methode:** Datei für Datei, mit TypeScript-Check nach jeder Phase

