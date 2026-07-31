import { describe, expect, it } from "vitest";
import { compileTemplate, extractPlaceholders } from "../promptBuilder";

describe("compileTemplate – simple variable substitution", () => {
  it("replaces a single variable", () => {
    expect(compileTemplate("Hello {{name}}!", { name: "Alice" })).toBe("Hello Alice!");
  });

  it("replaces multiple variables", () => {
    const result = compileTemplate("{{greeting}}, {{name}}.", {
      greeting: "Hi",
      name: "Bob",
    });
    expect(result).toBe("Hi, Bob.");
  });

  it("leaves unresolved variables intact (no value provided)", () => {
    const result = compileTemplate("Value: {{missing}}", {});
    expect(result).toBe("Value: {{missing}}");
  });
});

describe("compileTemplate – {{#if}} without else", () => {
  it("includes block content when variable is truthy", () => {
    const result = compileTemplate("A{{#if flag}} shown{{/if}}B", { flag: true });
    expect(result).toBe("A shownB");
  });

  it("excludes block content when variable is falsy (false)", () => {
    const result = compileTemplate("A{{#if flag}} shown{{/if}}B", { flag: false });
    expect(result).toBe("AB");
  });

  it("excludes block content when variable is undefined", () => {
    const result = compileTemplate("A{{#if flag}} shown{{/if}}B", {});
    expect(result).toBe("AB");
  });

  it("excludes block content when variable is empty string", () => {
    const result = compileTemplate("A{{#if flag}} shown{{/if}}B", { flag: "" });
    expect(result).toBe("AB");
  });

  it("includes block content when variable is a non-empty string", () => {
    const result = compileTemplate("Mode: {{#if mode}}active{{/if}}", { mode: "on" });
    expect(result).toBe("Mode: active");
  });
});

describe("compileTemplate – {{#if}} with {{else}}", () => {
  it("returns truthy branch when condition is true", () => {
    const result = compileTemplate(
      "Status: {{#if enableSmoothing}}ENABLED{{else}}DISABLED{{/if}}",
      { enableSmoothing: true },
    );
    expect(result).toBe("Status: ENABLED");
  });

  it("returns falsy branch when condition is false", () => {
    const result = compileTemplate(
      "Status: {{#if enableSmoothing}}ENABLED{{else}}DISABLED{{/if}}",
      { enableSmoothing: false },
    );
    expect(result).toBe("Status: DISABLED");
  });

  it("returns falsy branch when variable is undefined", () => {
    const result = compileTemplate(
      "Status: {{#if enableSmoothing}}ENABLED{{else}}DISABLED{{/if}}",
      {},
    );
    expect(result).toBe("Status: DISABLED");
  });

  it("returns falsy branch when variable is empty string", () => {
    const result = compileTemplate("Mode: {{#if active}}yes{{else}}no{{/if}}", { active: "" });
    expect(result).toBe("Mode: no");
  });

  it("does not leak {{else}} text into output when condition is true", () => {
    const result = compileTemplate("{{#if flag}}A{{else}}B{{/if}}", { flag: true });
    expect(result).not.toContain("else");
    expect(result).toBe("A");
  });

  it("does not leak {{else}} text into output when condition is false", () => {
    const result = compileTemplate("{{#if flag}}A{{else}}B{{/if}}", { flag: false });
    expect(result).not.toContain("else");
    expect(result).toBe("B");
  });

  it("handles multi-word content in both branches", () => {
    const result = compileTemplate(
      "Smoothing: {{#if smooth}}Apply corrections across segments{{else}}Leave text unchanged{{/if}}.",
      { smooth: false },
    );
    expect(result).toBe("Smoothing: Leave text unchanged.");
  });

  it("substitutes variables inside the chosen branch", () => {
    const result = compileTemplate("{{#if show}}Count: {{count}}{{else}}hidden{{/if}}", {
      show: true,
      count: 42,
    });
    expect(result).toBe("Count: 42");
  });
});

describe("compileTemplate – nested conditionals", () => {
  it("handles nested if blocks (innermost resolved first)", () => {
    const template =
      "{{#if outer}}{{#if inner}}both{{else}}outer only{{/if}}{{else}}neither{{/if}}";

    expect(compileTemplate(template, { outer: true, inner: true })).toBe("both");
    expect(compileTemplate(template, { outer: true, inner: false })).toBe("outer only");
    expect(compileTemplate(template, { outer: false, inner: true })).toBe("neither");
    expect(compileTemplate(template, { outer: false, inner: false })).toBe("neither");
  });
});

describe("batch size warning threshold", () => {
  const THRESHOLD = 10;
  const shouldWarn = (n: number): boolean => n > THRESHOLD;

  it("does not warn at the threshold value (10)", () => {
    expect(shouldWarn(10)).toBe(false);
  });

  it("warns for a value just above the threshold (11)", () => {
    expect(shouldWarn(11)).toBe(true);
  });

  it("warns for a large batch size (50)", () => {
    expect(shouldWarn(50)).toBe(true);
  });

  it("does not warn for values below the threshold (1, 5, 9)", () => {
    expect(shouldWarn(1)).toBe(false);
    expect(shouldWarn(5)).toBe(false);
    expect(shouldWarn(9)).toBe(false);
  });
});

describe("extractPlaceholders", () => {
  it("extracts simple variable names", () => {
    const result = extractPlaceholders("Hello {{name}}, you have {{count}} messages.");
    expect(result).toContain("name");
    expect(result).toContain("count");
  });

  it("extracts conditional variable names", () => {
    const result = extractPlaceholders("{{#if flag}}yes{{/if}}");
    expect(result).toContain("flag");
  });

  it("does not include reserved keywords (this, @index)", () => {
    const result = extractPlaceholders("{{#each items}}{{this}} {{@index}}{{/each}}");
    expect(result).not.toContain("this");
    expect(result).not.toContain("@index");
  });
});
