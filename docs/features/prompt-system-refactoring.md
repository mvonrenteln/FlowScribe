# Prompt System Refactoring - Task List

**Ziel:** Vereinheitlichung der Template-Systeme zu einem einzigen Prompt-System mit Typen `'speaker' | 'text'`

**Datum:** 1. Januar 2026

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

## ✅ Aufgaben

### 🔧 STRUKTURELLE ÄNDERUNGEN (Copilot)

#### Phase 1: Type Definitions (`types.ts`) - DONE
- [x] 1.1. Neues Interface `AIPrompt` mit `type`, `isBuiltIn`, `quickAccess`
- [x] 1.2. `PromptType = 'speaker' | 'text'`
- [x] 1.3. `AISpeakerConfig` und `AIRevisionConfig` Properties anpassen
- [x] 1.4. Slice-Interface Methoden anpassen

#### Phase 2: Store Utils (`aiSpeakerConfig.ts`) - DONE
- [x] 2.1. `DEFAULT_SPEAKER_PROMPT` mit neuen Properties erstellen
- [x] 2.2. `normalizeAISpeakerConfig` anpassen

#### Phase 3: AI Speaker Slice (`aiSpeakerSlice.ts`) - DONE
- [x] 3.1. Methoden-Implementierung anpassen (prompts statt templates)

#### Phase 4: AI Revision Slice (`aiRevisionSlice.ts`) - DONE
- [x] 4.1. `DEFAULT_TEXT_PROMPTS` mit neuen Properties
- [x] 4.2. `normalizeAIRevisionConfig` anpassen
- [x] 4.3. `startSingleRevision` → promptId statt templateId
- [x] 4.4. `startBatchRevision` → promptId statt templateId
- [x] 4.5. Suggestion-Objekte → promptId statt templateId
- [x] 4.6. Prompt-Management Methoden anpassen

---

### 🏷️ UMBENENNUNGEN (User - IDE Refactoring)

Nach den strukturellen Änderungen diese Umbenennungen durchführen:

#### In `aiRevisionSlice.ts`:
- [ ] `templateId` Parameter → `promptId` (in startSingleRevision, startBatchRevision)
- [ ] `template` Variable → `selectedPrompt` (in Funktionen)
- [ ] `templateId` in Suggestion-Objekten → `promptId`

#### In `aiRevisionService.ts`:
- [ ] `template` Parameter → `prompt`
- [ ] Alle `template.` Zugriffe → `prompt.`

#### In `aiSpeakerService.ts`:
- [ ] `template` Variable/Parameter → `prompt`
- [ ] `activeTemplate` → `activePrompt`

#### In `store.ts`:
- [ ] `addTemplate` → `addPrompt`
- [ ] `updateTemplate` → `updatePrompt`
- [ ] `deleteTemplate` → `deletePrompt`
- [ ] `setActiveTemplate` → `setActivePrompt`

#### In Components:
- [ ] `AISpeakerDialog.tsx`: `setActiveTemplate` → `setActivePrompt`, `templates` → `prompts`
- [ ] `AIRevisionPopover.tsx`: `templates` → `prompts`, `templateId` → `promptId`
- [ ] `AIBatchRevisionSection.tsx`: analog
- [ ] `useTranscriptEditor.ts`: `defaultTemplateId` → `defaultPromptId`

#### In Settings:
- [ ] `AITemplateSettings.tsx` → `AISpeakerPromptSettings.tsx`
- [ ] `AIRevisionTemplateSettings.tsx` → `AITextPromptSettings.tsx`
- [ ] Alle internen `template` Referenzen

#### In Tests:
- [ ] Alle Test-Dateien entsprechend anpassen

---

### 🔍 FEHLER-BEHEBUNG (Copilot)

Nach Umbenennungen:
- [ ] TypeScript-Fehler beheben
- [ ] Lint-Fehler beheben
- [ ] Test-Fehler beheben

---

### 📚 DOKUMENTATION (Copilot)

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

