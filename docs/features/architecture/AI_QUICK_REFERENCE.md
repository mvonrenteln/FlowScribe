# Quick Reference: AI Features API

> **TL;DR** - How to use and extend AI features in FlowScribe

---

## The Single Unified API

```typescript
import { executeFeature, executeBatch } from "@/lib/ai/core/aiFeatureService";

// Single execution
const result = await executeFeature<OutputType>(featureId, variables, options);

// Batch execution  
const result = await executeBatch<OutputType>(featureId, inputs, options, callbacks);
```

---

## Usage Pattern #1: Single Feature

**When:** Revise one segment

```typescript
const result = await executeFeature<string>(
  "text-revision",
  {
    text: "Um, hello there!",
    speaker: "Alice",
  },
  { model: "gpt-4" }
);

if (result.success) {
  console.log(result.data);  // "Hello there!" (revised)
}
```

---

## Usage Pattern #2: Batch Processing

**When:** Revise 50 segments with progress

```typescript
const result = await executeBatch<string>(
  "text-revision",
  segments.map(s => ({
    text: s.text,
    speaker: s.speaker,
  })),
  { model: "gpt-4" },
  {
    onProgress: (done, total) => updateProgressBar(done, total),
    onItemComplete: (i, result) => updateSegment(i, result.data),
  }
);
```

---

## Available Features Today

| Feature | Input | Output | Batch? |
|---------|-------|--------|--------|
| `text-revision` | `{ text, speaker, previousText?, nextText? }` | `string` | ✅ Yes |
| `speaker-classification` | `{ speakers, segments }` | `SpeakerSuggestion[]` | ✅ Yes |
| `segment-merge` | `{ segmentPairs, maxTimeGap, enableSmoothing }` | `MergeSuggestion[]` | ✅ Yes |

---

## How to Implement a New Feature

### Step 1: Define Config

```typescript
// /src/lib/ai/features/my-feature/config.ts

export const MY_FEATURE_SYSTEM_PROMPT = `You are analyzing...`;
export const MY_FEATURE_USER_TEMPLATE = `Analyze: {{text}}`;

export const myFeatureConfig: AIFeatureConfig = {
  id: "my-feature",
  name: "My Feature",
  category: "metadata",
  
  systemPrompt: MY_FEATURE_SYSTEM_PROMPT,
  userPromptTemplate: MY_FEATURE_USER_TEMPLATE,
  
  batchable: true,
  streamable: false,
  defaultBatchSize: 10,
  
  requiresConfirmation: true,
  availablePlaceholders: ["text"],
  
  responseSchema: {
    type: "array",
    items: {
      type: "object",
      properties: {
        tag: { type: "string" },
      },
      required: ["tag"],
    },
  },
};
```

### Step 2: Implement Service

```typescript
// /src/lib/ai/features/my-feature/service.ts

export async function analyzeWithMyFeature(text: string) {
  return executeFeature("my-feature", { text }, { model: "gpt-4" });
}
```

### Step 3: Use It

```typescript
const result = await analyzeWithMyFeature("some text");
if (result.success) {
  console.log(result.data);
}
```

---

## Prompt Template Variables

### Always Available
```
{{text}}           # Main text to process
{{speaker}}        # Speaker tag
{{previousText}}   # Context before
{{nextText}}       # Context after
```

### Handlebars Syntax
```
{{#if variable}}
  Conditional content
{{/if}}

{{#each items}}
  {{this.property}}
{{/each}}
```

---

## Response Parsing

Parser automatically:
1. Extracts JSON from response (even if in code blocks)
2. Validates against provided schema
3. Coerces types (string "123" → number 123)
4. Applies default values
5. Returns typed result

```typescript
const result = parseResponse<Chapter[]>(aiResponse, {
  schema: {
    type: "array",
    items: {
      type: "object",
      properties: {
        title: { type: "string" },
        startTime: { type: "number", default: 0 },
      },
      required: ["title"],
    },
  },
});

// result.data is properly typed as Chapter[]
// result.metadata contains warnings, extraction method, etc.
```

---

## Feature IDs Available

```typescript
"text-revision"             // Text Revision (3 prompt variants)
"speaker-classification"    // Speaker Classification
"segment-merge"             // Segment Merge Suggestions (with smoothing)
```

---

## Options Object

```typescript
interface AIFeatureOptions {
  providerId?: string;           // Use specific provider
  model?: string;                // Override default model
  customPrompt?: {               // Override default prompts
    systemPrompt?: string;
    userPromptTemplate?: string;
  };
  chatOptions?: {                // Provider-specific options
    temperature?: number;
    maxTokens?: number;
  };
  signal?: AbortSignal;          // For cancellation
}
```

---

## Result Object

```typescript
interface AIFeatureResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  rawResponse?: string;
  metadata: {
    featureId: string;
    providerId: string;
    model: string;
    durationMs: number;
    tokenUsage?: {
      prompt: number;
      completion: number;
      total: number;
    };
  };
}
```

---

## Batch Result Object

```typescript
interface AIBatchResult<T> {
  results: AIFeatureResult<T>[];  // Individual results
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    durationMs: number;
  };
}
```

---

## Common Patterns

### Error Handling

```typescript
const result = await executeFeature("text-revision", vars, options);

if (result.success) {
  // Use result.data
} else {
  // result.error contains user-friendly message
  console.error(result.error);
}
```

### With Context (revision)

```typescript
const result = await executeFeature<string>(
  "text-revision",
  {
    text: segment.text,
    speaker: segment.speaker,
    previousText: segment.previous?.text,  // Provides context
    nextText: segment.next?.text,          // Provides context
  },
  { model: "gpt-4" }
);
```

### Batch with Callbacks

```typescript
await executeBatch<string>(
  "text-revision",
  inputs,
  { model: "gpt-4" },
  {
    onProgress: (done, total) => {
      // Called on each item
      updateUI(done, total);
    },
    onItemComplete: (index, result) => {
      // Called when item completes
      if (result.success) {
        applyRevision(index, result.data);
      }
    },
    onItemError: (index, error) => {
      // Called on error
      logError(index, error);
    },
  }
);
```

---

## Testing

### Test a Service Function

```typescript
import { reviseSegment } from "@/lib/ai/features/revision";

describe("reviseSegment", () => {
  it("should revise text", async () => {
    const result = await reviseSegment({
      segment: { text: "Um, hello", speaker: "Alice" },
      prompt: getDefaultPrompt(),
    });
    
    expect(result.success).toBe(true);
    expect(result.revised).not.toContain("um");
  });
});
```

### Test Prompt Compilation

```typescript
import { compileTemplate } from "@/lib/ai/prompts/promptBuilder";

const compiled = compileTemplate("Hello {{name}}", { name: "Alice" });
expect(compiled).toBe("Hello Alice");
```

---

## File Structure

```
/src/lib/ai/
├── core/
│   ├── aiFeatureService.ts      # Main API (use this!)
│   ├── featureRegistry.ts       # Feature management
│   ├── types.ts                 # TypeScript interfaces
│   └── ...
├── features/
│   ├── speaker/                 # Speaker classification
│   │   ├── types.ts
│   │   ├── config.ts            # Prompts here
│   │   ├── service.ts           # Service functions here
│   │   └── ...
│   ├── revision/                # Text revision
│   └── index.ts                 # Public exports
├── providers/                   # Provider adapters
├── prompts/                     # Prompt building
├── parsing/                     # Response parsing
└── __tests__/                   # Tests
```

---

## Import Paths

```typescript
// Main API
import { executeFeature, executeBatch } from "@/lib/ai/core/aiFeatureService";

// Features
import { reviseSegment } from "@/lib/ai/features/revision";
import { classifySpeakers } from "@/lib/ai/features/speaker";

// Utilities
import { compileTemplate } from "@/lib/ai/prompts/promptBuilder";
import { parseResponse } from "@/lib/ai/parsing/responseParser";
```

---

## More Information

- **Full API Docs:** `docs/features/architecture/ai-features-unified.md`
- **Migration Details:** `AI_FEATURES_MIGRATION_PR.md`
- **Implementation Examples:** See Speaker & Revision features
- **Tests:** `src/lib/ai/__tests__/`

---

*Quick Reference - Updated January 4, 2026*

