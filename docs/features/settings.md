# Settings Menu - Feature Documentation
*Last Updated: December 31, 2025*

---

- **Summary Templates**: Generate summaries of transcripts
- **Grammar Templates**: Pre-built templates for grammar checking
- **Profiles**: Multiple configuration profiles for different projects
- **Export/Import**: Backup and restore all settings
- **Themes**: Additional theme options and customization
- **Settings Search**: Find any setting by keyword
- **Cloud Sync**: Sync settings across devices

Planned enhancements for future versions:

## What's Next?

---

| **Space** | Toggle focused checkbox/switch |
| **Enter** | Activate focused button |
| **Shift + Tab** | Navigate backwards |
| **Tab** | Navigate between sections |
| **Escape** | Close Settings |
| **Cmd/Ctrl + ,** | Open Settings |
|----------|--------|
| Shortcut | Action |

## Keyboard Shortcuts

---

5. **Combine with glossary** for comprehensive quality control
4. **Review custom dictionary lists** to avoid bloat
3. **Consider custom dictionaries** for specialized content
2. **Use ignored words** for proper nouns and technical terms
1. **Enable built-in languages** that match your content

### Spellcheck Strategy

5. **Export your glossary** to reuse across projects
4. **Review false positives** to avoid noise
3. **Adjust fuzzy threshold** based on your needs
2. **Start with high confidence variants** (exact matches)
1. **Build glossary gradually** as you encounter errors

### Glossary Workflow

- Use the search field to filter by term, variants, or false positives.
- Click Add term to open the form; edit with the pencil icon and delete with the trash icon.
- The add/edit form stays hidden until you open it, and closes again on save or cancel.

5. **Export regularly** to back up your configurations
4. **Document your templates** with descriptive names
3. **Test templates** on small batches first
2. **Use clear system prompts** that explain the task
1. **Start with defaults** before creating custom templates

### Template Management

5. **Have a backup provider** in case one fails
4. **Keep API keys secure** - don't share or commit to git
3. **Use descriptive names** to distinguish multiple providers
2. **Test connections** before relying on a provider
1. **Start with Ollama** for privacy and zero cost

### AI Provider Setup

## Best Practices

---

- Verify you have a preferred term defined (not just variants)
- Ensure segment isn't in edit mode
- Check the term has a valid preferred form
**Apply Button Not Working**

- Verify highlighting is enabled (underline or background)
- Ensure term isn't in false positives list
- Check fuzzy matching threshold (try lowering it)
- Verify glossary entry exists and is spelled correctly
**Terms Not Matching**

### Glossary Not Highlighting

- Try re-importing the dictionary
- Ensure files aren't corrupted
- Check file encoding (should be UTF-8)
- Verify .aff and .dic files are valid Hunspell format
**Custom Dictionary Not Loading**

- Try disabling custom dictionaries temporarily
- Ensure word isn't in ignored words list
- Check at least one language is selected
- Verify spellcheck is enabled (toggle in Settings)
**Words Not Being Checked**

### Spellcheck Issues

- Verify prompt doesn't exceed model's context limit
- Ensure batch size isn't too large
- Check model supports the requested task
- Review system prompt for clarity
**AI Response Errors**

- Verify variable name matches exactly
- Ensure variable is defined in the template system
- Check variable syntax: `{{variableName}}` (double braces)
**Variable Not Replaced**

### Template Not Working

- Test with curl or Postman first
- Ensure the API is OpenAI-compatible
- Check authentication requirements
- Verify the endpoint URL is accessible
**Custom Provider Issues**

- Review rate limits on OpenAI dashboard
- Ensure you have access to the selected model
- Check your OpenAI account has credits
- Verify API key is correct and active
**OpenAI API Errors**

- Try pulling a model: `ollama pull llama3.2`
- Ensure firewall allows local connections
- Check URL is correct: `http://localhost:11434`
- Verify Ollama is running: `ollama serve`
**Ollama Not Connecting**

### Provider Connection Issues

## Troubleshooting

---

- Settings stored only in your browser
- No telemetry or usage data sent to external servers
- FlowScribe doesn't track your settings
**No Analytics**

- Custom provider: Data sent to the endpoint you specify
- OpenAI provider: Data sent to OpenAI servers per their privacy policy
- Ollama provider: All data stays on your machine
**Local Processing**

### Data Privacy

- Keep keys confidential
- Rotate keys regularly
- Use separate API keys for browser-based usage
**Recommendations**

- Keys are masked in the UI (shown as `••••••••`)
- Never sent to any server except the AI provider you configure
- API keys are stored in browser's localStorage
**Local Storage**

### API Key Storage

## Privacy & Security

---

- Option to save or discard before closing
- Settings panel warns if you have unsaved changes in forms
**Unsaved Changes**

- Press **Cmd/Ctrl + ,** again (toggle)
- Click outside the settings panel (backdrop)
- Press **Escape** key
- Click the X button in top-right corner
**Multiple Methods**

### Closing Settings

- Validation prevents saving invalid configurations
- Cancel button discards changes
- Complex forms (providers, templates) have explicit Save buttons
**Manual Save**

- Immediate feedback when settings are applied
- No "Save" button required for simple toggles
- Most settings save automatically when changed
**Auto-Save**

### Saving Changes

- Clear visual hierarchy
- Icon and description help identify each category
- Active section shows with accent background
**Section Indicators**

- Current section is highlighted
- Keyboard: Use **Tab** to move between sections
- Click any category in the left sidebar
**Tab-Based Navigation**

### Navigation

- Available in desktop app version
- Access from application menu
**Via Menu** _(Future)_

- Quick access without mouse interaction
- Press **Cmd + ,** (Mac) or **Ctrl + ,** (Windows/Linux)
**Via Keyboard Shortcut**

- Always visible regardless of which page you're on
- Click the gear icon (⚙️) in the top toolbar
**Via Toolbar**

### Opening Settings

## Settings Access

---

- Current mode is clearly indicated
- Slider is disabled when in Auto mode
- Threshold value shows as percentage or "Auto"

#### Display

- **Auto**: Let FlowScribe determine reasonable threshold based on your data
- **Manual**: You know the quality level you want to check
**When to Use Each**

- Adapts to each transcript's quality
- Maximum threshold is capped at 40%
- Calculates the 10th percentile of all confidence scores
- Click **Reset to Auto** to enable automatic calculation
**Auto Mode**

- Example: 40% highlights all words with <40% confidence
- Words below this threshold are highlighted
- Use the slider to set a specific percentage (0-100%)
**Manual Threshold**

#### Confidence Threshold

- Quick access also in Highlights dropdown
- When enabled, low-confidence words are highlighted
- Toggle confidence highlighting on/off

#### Enable/Disable Highlighting

- **Low confidence** (<40%): Word probably needs correction
- **Medium confidence** (40-80%): Word might need review
- **High confidence** (>80%): Word is likely correct
Whisper/WhisperX assigns confidence scores to each transcribed word:

#### What is Confidence?

Configure low confidence highlighting for transcript quality review.

### ⚡ Confidence

---

- Merges with existing entries
- Follows the same format as export
- Click **Import** and select a text file
**Import Glossary**

- One entry per line
- Format: `term | variant1, variant2 | falsepos1, falsepos2`
- Click **Export** to download as text file
**Export Glossary**

#### Import/Export

- Available in the sidebar filter panel
- **Uncertain Matches**: Show only fuzzy matches that need review
- **Glossary Filter**: Show only segments with glossary matches
**Filters**

4. Click **Ignore** to add as false positive
3. Click **Apply** to replace with preferred term
2. Hover over a highlighted word to see options
1. Glossary terms are highlighted automatically
**In the Transcript**

#### Using Glossary Matches

- Or choose one for a more subtle appearance
- Use both underline and background for maximum visibility
**Combine Both**

- Works in combination with underline
- Subtle highlight to catch your attention
- Toggle background color on/off
**Background Highlighting**

- Green color indicates preferred term available
- Dotted underline indicates uncertain match
- Toggle underline on/off for glossary matches
**Underline Style**

#### Highlighting Options

- At 60%: "Dungon" matches "Dungeon"
- At 80%: "Dungeons & Dragens" matches "Dungeons & Dragons"
**Examples**

- Default: 80%
- **Lower values**: More lenient, catches distant variations
- **Higher values**: More strict, only close matches
**Threshold Slider (0-100%)**

- Catches typos and spelling variations
- Uses Levenshtein distance algorithm
- Finds terms that are similar but not exact matches
**What is Fuzzy Matching?**

#### Fuzzy Matching

- Existing highlights in transcript are removed
- Removes term and all its variants
- Click **Delete** and confirm
**Deleting Entries**

- Changes apply immediately to transcript
- Modify term, variants, or false positives
- Click **Edit** on any glossary entry
**Editing Entries**

- **False Positives**: Words to ignore even if they match
- **Variants**: Alternative spellings or common mistakes
- **Preferred Term**: The correct form you want to use
**Term Structure**

4. Save the entry
3. Optionally add false positives to ignore
2. Add common variants/mistakes (e.g., "Dungeons and Dragons", "DnD")
1. Enter your preferred term (e.g., "Dungeons & Dragons")
**Adding a Term**

#### Managing Glossary Entries

Click a glossary entry row to open it for editing, or use the **Edit** and **Delete** buttons on
the right side of each entry. The edit form also includes a **Delete** button.

- Apply corrections with a single click
- Highlight terms that need review or correction
- Catch common transcription errors (e.g., "Delphi" → "Delhi")
- Define preferred terminology for your transcripts
The glossary helps you:

#### What is the Glossary?

Manage your term glossary with fuzzy matching and smart highlighting.

### 📚 Glossary

---

- Useful for troubleshooting dictionary issues
- Shows detailed information in console
- Enable debug logging for spellcheck

#### Debug Mode _(Advanced)_

- This ensures only your domain-specific vocabulary is used
- Built-in German and English are ignored
- When custom dictionaries are enabled, they **replace** built-in languages
**Custom vs Built-in**

- Delete dictionaries you no longer need
- See word count for each dictionary
- View all installed custom dictionaries
**Managing Dictionaries**

5. Save the dictionary
4. Upload .dic file (word list)
3. Upload .aff file (affix rules)
2. Enter a name (e.g., "Medical Terms")
1. Click **Add Dictionary**
**Adding Custom Dictionaries**

- **.dic**: Dictionary word list (Hunspell format)
- **.aff**: Affix rules (Hunspell format)
- **.oxt**: LibreOffice extension files
**Supported Formats**

- Support for industry-specific terminology
- Replace built-in dictionaries with domain-specific ones
- Add specialized vocabulary (medical, technical, etc.)
**Why Custom Dictionaries?**

#### Custom Dictionaries

- Word won't be highlighted in future sessions
- Select "Ignore" to add to this list
- Right-click any highlighted misspelling
**Auto-Adding Words**

- Click **Clear All** to reset the list
- Remove words to re-enable spellcheck for them
- Add new words manually via input field
- View list of words you've marked to ignore
**Managing Ignored Words**

#### Ignored Words

- Select one language at a time
- Click another language to switch
- Useful for transcripts with a primary language
**Language Switching**

- **English (en)**: English language rules and dictionary
- **German (de)**: German language rules and dictionary
**Built-in Languages**

#### Language Selection

- Quick access also available via Highlights dropdown in toolbar
- When disabled, no spelling errors are highlighted
- Toggle spellcheck on/off globally

#### Enable/Disable Spellcheck

- Spellcheck runs as soon as it is enabled and does not wait for waveform readiness

Configure language checking and custom dictionaries.

### ✓ Spellcheck

---

- Selection indicator when active
- Description of the theme
- Icon representation (Sun/Moon/Monitor)
Each theme option shows a visual preview with:

#### Theme Preview

- Responds to system theme changes in real-time
- Switches between light and dark based on OS settings
- Automatically follows your operating system preference
**System**

- Popular for extended editing sessions
- Reduces eye strain in low-light conditions
- Dark backgrounds and light text
**Dark**

- Reduces screen glare
- Optimal for well-lit environments
- Bright backgrounds and dark text
**Light**

Choose from three theme options:

#### Theme Selection

Customize the visual appearance of FlowScribe.

### 🎨 Appearance

---

- Does not overwrite existing templates
- Adds templates to your existing collection
- Click **Import** and select a JSON file
**Import Templates**

- Includes template metadata and prompts
- Useful for backup or sharing with team members
- Click **Export All** to download all templates as JSON
**Export Templates**

#### Import/Export

- **Expand/Collapse**: View full prompt preview
- **Delete**: Remove template (cannot delete default)
- **Duplicate**: Create a copy to customize
- **Edit**: Modify existing template
**Template Actions**

- Active template is used in AI feature dialogs
- Click **Set Active** to make a template the default
- One template can be marked as active per category
**Active Template**

- `{{segments}}`: Transcript segments to analyze
- `{{speakers}}`: List of known speakers
**Available Variables**

- Variables are replaced with actual data at runtime
- Use variables like `{{speakers}}` and `{{segments}}`
- The actual message sent to the AI per batch
**User Prompt Template**

- Example: "You are an expert at analyzing conversational transcripts..."
- Should include clear instructions and context
- Defines the AI's role and behavior
**System Prompt**

3. Save the template
   - **User Prompt Template**: Message template with variables
   - **System Prompt**: Instructions for the AI model
   - **Category**: Select the use case type
   - **Name**: Descriptive name (e.g., "RPG Session Classifier")
2. Enter template details:
1. Click **Create Template**
**Creating a Template**

#### Managing Templates

- Full control over system and user prompts
- Create templates for your specific needs
**Custom**

- Configurable detail levels
- Generate summaries of transcript content
**Summary** _(Future)_

- Suggest improvements to sentence structure
- Check and correct grammatical errors
**Grammar Check** _(Future)_

- Variables: `{{speakers}}`, `{{segments}}`
- Default template optimized for conversational content
- Analyze transcript segments to identify and classify speakers
**Speaker Classification**

Templates are organized into categories based on their use case:

#### Template Categories

Manage prompt templates that define how AI models process your transcripts.

### 📝 AI Templates

---

- Useful for new models or custom deployments
- If automatic fetching fails, you can enter model names manually
**Manual Entry**

- Custom: Enter model name manually
- OpenAI: Shows available models from OpenAI API
- Ollama: Automatically fetches installed models from your local server
**Dynamic Model Lists**

#### Model Selection

- You can override the default on a per-use basis
- The default provider is automatically selected in AI feature dialogs
- Set one provider as default using the **Set as Default** button
**Default Provider**

- Provider configurations are removed from storage
- Cannot delete a provider if it's currently selected for use
- Click **Delete** and confirm
**Deleting Providers**

- Re-test connection to verify changes
- Modify connection details, model selection, or name
- Click **Edit** on any provider card
**Editing Providers**

- Test results show clear success/error messages
- For OpenAI: Validates API key and retrieves model list
- For Ollama: Verifies server is reachable and lists available models
- The Test button performs a real connection check
**Testing Connections**

5. Save the provider
4. Click **Test Connection** to verify setup
   - **Model**: Select from available models or enter manually
   - **API Key**: Required for OpenAI and Custom providers
   - **Base URL**: API endpoint (e.g., `http://localhost:11434` for Ollama)
   - **Name**: Friendly name for this provider (e.g., "My Local Ollama")
3. Enter connection details:
2. Select provider type (Ollama/OpenAI/Custom)
1. Click **Add Provider** in the AI Providers section
**Adding a Provider**

#### Managing Providers

- Supports custom base URLs and authentication
- Useful for self-hosted models or alternative providers
- Connect to any OpenAI-compatible API endpoint
**Custom (Self-Hosted)**

- Pay-per-use pricing
- Access to latest GPT-4o and GPT-4o-mini models
- Requires API key from OpenAI platform
- Use OpenAI's GPT models via API
**OpenAI (Cloud)**

- Recommended models: `llama3.2`, `mistral`, `gemma2`
- Full privacy - data never leaves your computer
- No API costs or internet required
- Run AI models locally on your machine
**Ollama (Local)**

#### Supported Provider Types

Configure one or multiple AI providers to power FlowScribe's intelligent features like speaker classification.

### 🤖 AI Providers

## Settings Categories

---

The Settings panel uses a non-blocking drawer interface that slides in from the right, allowing you to adjust preferences without losing context of your current work.

FlowScribe provides a centralized Settings menu that gives you complete control over AI providers, appearance, language tools, and other application preferences. Access it via the gear icon in the toolbar or press **Cmd/Ctrl + ,**.

## Overview
