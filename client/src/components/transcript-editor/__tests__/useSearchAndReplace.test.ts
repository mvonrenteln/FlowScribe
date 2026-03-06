import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Segment } from "../../../lib/store";
import { useSearchAndReplace } from "../useSearchAndReplace";

describe("useSearchAndReplace", () => {
  const mockUpdateSegmentsTexts = vi.fn();
  const segments: Segment[] = [
    {
      id: "seg-1",
      speaker: "A",
      tags: [],
      start: 0,
      end: 1,
      text: "hello world",
      words: [
        { word: "hello", start: 0, end: 0.5 },
        { word: "world", start: 0.5, end: 1 },
      ],
    },
    {
      id: "seg-2",
      speaker: "B",
      tags: [],
      start: 2,
      end: 3,
      text: "hello again",
      words: [
        { word: "hello", start: 2, end: 2.5 },
        { word: "again", start: 2.5, end: 3 },
      ],
    },
  ];

  beforeEach(() => {
    mockUpdateSegmentsTexts.mockClear();
  });

  it("finds matches across segments", () => {
    const { result } = renderHook(() =>
      useSearchAndReplace(segments, mockUpdateSegmentsTexts, "hello", false),
    );

    expect(result.current.totalMatches).toBe(2);
    expect(result.current.currentMatchIndex).toBe(0); // Initially selects first match
  });

  it("navigates through matches", () => {
    const { result } = renderHook(() =>
      useSearchAndReplace(segments, mockUpdateSegmentsTexts, "hello", false),
    );

    expect(result.current.currentMatchIndex).toBe(0);
    expect(result.current.currentMatch?.segmentId).toBe("seg-1");

    act(() => {
      result.current.goToNextMatch();
    });
    expect(result.current.currentMatchIndex).toBe(1);
    expect(result.current.currentMatch?.segmentId).toBe("seg-2");

    act(() => {
      result.current.goToNextMatch();
    });
    expect(result.current.currentMatchIndex).toBe(0); // Loops back
  });

  it("replaces current match", () => {
    const { result } = renderHook(() =>
      useSearchAndReplace(segments, mockUpdateSegmentsTexts, "hello", false),
    );

    act(() => {
      result.current.setReplaceQuery("hi");
    });

    // Index 0 (hello world) is already selected

    act(() => {
      result.current.replaceCurrent();
    });

    expect(mockUpdateSegmentsTexts).toHaveBeenCalledWith([{ id: "seg-1", text: "hi world" }]);
  });

  it("replaces all matches", () => {
    const { result } = renderHook(() =>
      useSearchAndReplace(segments, mockUpdateSegmentsTexts, "hello", false),
    );

    act(() => {
      result.current.setReplaceQuery("hi");
    });

    act(() => {
      result.current.replaceAll();
    });

    expect(mockUpdateSegmentsTexts).toHaveBeenCalledWith([
      { id: "seg-1", text: "hi world" },
      { id: "seg-2", text: "hi again" },
    ]);
  });

  it("replaces current regex match with capture groups", () => {
    const regexSegments: Segment[] = [
      {
        id: "seg-1",
        speaker: "A",
        start: 0,
        end: 1,
        text: "Tanzenprobe- Generalprobe",
        words: [
          { word: "Tanzenprobe-", start: 0, end: 0.4 },
          { word: "Generalprobe", start: 0.4, end: 1 },
        ],
      },
    ];
    const { result } = renderHook(() =>
      useSearchAndReplace(regexSegments, mockUpdateSegmentsTexts, "Tanzenprobe- (.*)probe", true),
    );

    act(() => {
      result.current.setReplaceQuery("$1-Probe");
    });

    act(() => {
      result.current.replaceCurrent();
    });

    expect(mockUpdateSegmentsTexts).toHaveBeenCalledWith([{ id: "seg-1", text: "General-Probe" }]);
  });

  it("replaces all regex matches with capture groups", () => {
    const regexSegments: Segment[] = [
      {
        id: "seg-1",
        speaker: "A",
        start: 0,
        end: 1,
        text: "Tanzenprobe- Generalprobe",
        words: [
          { word: "Tanzenprobe-", start: 0, end: 0.4 },
          { word: "Generalprobe", start: 0.4, end: 1 },
        ],
      },
      {
        id: "seg-2",
        speaker: "B",
        start: 2,
        end: 3,
        text: "Tanzenprobe- Hauptprobe",
        words: [
          { word: "Tanzenprobe-", start: 2, end: 2.4 },
          { word: "Hauptprobe", start: 2.4, end: 3 },
        ],
      },
    ];
    const { result } = renderHook(() =>
      useSearchAndReplace(regexSegments, mockUpdateSegmentsTexts, "Tanzenprobe- (.*)probe", true),
    );

    act(() => {
      result.current.setReplaceQuery("$1-Probe");
    });

    act(() => {
      result.current.replaceAll();
    });

    expect(mockUpdateSegmentsTexts).toHaveBeenCalledWith([
      { id: "seg-1", text: "General-Probe" },
      { id: "seg-2", text: "Haupt-Probe" },
    ]);
  });

  it("handles numeric group fallback in regex replacements", () => {
    const regexSegments: Segment[] = [
      {
        id: "seg-1",
        speaker: "A",
        start: 0,
        end: 1,
        text: "ab",
        words: [
          { word: "a", start: 0, end: 0.5 },
          { word: "b", start: 0.5, end: 1 },
        ],
      },
    ];
    const { result } = renderHook(() =>
      useSearchAndReplace(regexSegments, mockUpdateSegmentsTexts, "(a)", true),
    );

    act(() => {
      result.current.setReplaceQuery("$10");
    });

    act(() => {
      result.current.replaceCurrent();
    });

    expect(mockUpdateSegmentsTexts).toHaveBeenCalledWith([{ id: "seg-1", text: "a0b" }]);
  });

  it("keeps numeric tokens literal when no capture groups exist", () => {
    const regexSegments: Segment[] = [
      {
        id: "seg-1",
        speaker: "A",
        start: 0,
        end: 1,
        text: "ab",
        words: [
          { word: "a", start: 0, end: 0.5 },
          { word: "b", start: 0.5, end: 1 },
        ],
      },
    ];
    const { result } = renderHook(() =>
      useSearchAndReplace(regexSegments, mockUpdateSegmentsTexts, "a", true),
    );

    act(() => {
      result.current.setReplaceQuery("$10");
    });

    act(() => {
      result.current.replaceCurrent();
    });

    expect(mockUpdateSegmentsTexts).toHaveBeenCalledWith([{ id: "seg-1", text: "$10b" }]);
  });

  it("treats missing single-digit capture as empty string", () => {
    const regexSegments: Segment[] = [
      {
        id: "seg-1",
        speaker: "A",
        start: 0,
        end: 1,
        text: "ab",
        words: [
          { word: "a", start: 0, end: 0.5 },
          { word: "b", start: 0.5, end: 1 },
        ],
      },
    ];
    const { result } = renderHook(() =>
      useSearchAndReplace(regexSegments, mockUpdateSegmentsTexts, "(a)", true),
    );

    act(() => {
      result.current.setReplaceQuery("$2");
    });

    act(() => {
      result.current.replaceCurrent();
    });

    // $2 should be treated as empty string when only one capture exists
    expect(mockUpdateSegmentsTexts).toHaveBeenCalledWith([{ id: "seg-1", text: "b" }]);
  });

  it("matches and replaces words with umlauts using regex \n\\w class", () => {
    const umlautSegments: Segment[] = [
      {
        id: "seg-1",
        speaker: "A",
        start: 0,
        end: 1,
        text: "Fährtenleseprobe",
        words: [{ word: "Fährtenleseprobe", start: 0, end: 1 }],
      },
    ];

    // Use the pattern that previously failed: (\w*)probe
    const { result } = renderHook(() =>
      useSearchAndReplace(umlautSegments, mockUpdateSegmentsTexts, "(\\w*)probe", true),
    );

    act(() => {
      result.current.setReplaceQuery("$1-REPL");
    });

    // Replace the first (and only) match
    act(() => {
      result.current.replaceCurrent();
    });

    expect(mockUpdateSegmentsTexts).toHaveBeenCalledWith([
      { id: "seg-1", text: "Fährtenlese-REPL" },
    ]);
  });

  describe("searchableSegments stability", () => {
    const baseSegments: Segment[] = [
      {
        id: "seg-1",
        speaker: "A",
        tags: [],
        start: 0,
        end: 1,
        text: "hello world",
        words: [
          { word: "hello", start: 0, end: 0.5 },
          { word: "world", start: 0.5, end: 1 },
        ],
      },
      {
        id: "seg-2",
        speaker: "B",
        tags: [],
        start: 2,
        end: 3,
        text: "hello again",
        words: [
          { word: "hello", start: 2, end: 2.5 },
          { word: "again", start: 2.5, end: 3 },
        ],
      },
    ];

    it("returns stable allMatches reference when only segment tags change", () => {
      const { result, rerender } = renderHook(
        ({ query, hookSegments }) =>
          useSearchAndReplace(hookSegments, mockUpdateSegmentsTexts, query, false),
        { initialProps: { hookSegments: baseSegments, query: "hello" } },
      );

      const originalAllMatches = result.current.allMatches;
      const updatedSegments: Segment[] = [
        { ...baseSegments[0], tags: ["tag-1"] },
        { ...baseSegments[1], tags: ["tag-2"] },
      ];

      rerender({ hookSegments: updatedSegments, query: "hello" });

      expect(result.current.allMatches).toBe(originalAllMatches);
    });

    it("returns stable currentMatch reference when only segment tags change", () => {
      const { result, rerender } = renderHook(
        ({ query, hookSegments }) =>
          useSearchAndReplace(hookSegments, mockUpdateSegmentsTexts, query, false),
        { initialProps: { hookSegments: baseSegments, query: "hello" } },
      );

      const originalCurrentMatch = result.current.currentMatch;
      const updatedSegments: Segment[] = [
        { ...baseSegments[0], tags: ["tag-1"] },
        { ...baseSegments[1], tags: ["tag-2"] },
      ];

      rerender({ hookSegments: updatedSegments, query: "hello" });

      expect(result.current.currentMatch).toBe(originalCurrentMatch);
    });

    it("updates allMatches when segment text changes", () => {
      const { result, rerender } = renderHook(
        ({ query, hookSegments }) =>
          useSearchAndReplace(hookSegments, mockUpdateSegmentsTexts, query, false),
        { initialProps: { hookSegments: baseSegments, query: "hello" } },
      );

      const originalAllMatches = result.current.allMatches;
      const updatedSegments: Segment[] = [
        { ...baseSegments[0], text: "goodbye world" },
        baseSegments[1],
      ];

      rerender({ hookSegments: updatedSegments, query: "hello" });

      expect(result.current.allMatches).not.toBe(originalAllMatches);
      expect(result.current.totalMatches).toBe(1);
    });

    it("updates allMatches when segments are added", () => {
      const { result, rerender } = renderHook(
        ({ query, hookSegments }) =>
          useSearchAndReplace(hookSegments, mockUpdateSegmentsTexts, query, false),
        { initialProps: { hookSegments: baseSegments, query: "hello" } },
      );

      const addedSegment: Segment = {
        id: "seg-3",
        speaker: "C",
        tags: [],
        start: 4,
        end: 5,
        text: "hello there",
        words: [
          { word: "hello", start: 4, end: 4.5 },
          { word: "there", start: 4.5, end: 5 },
        ],
      };

      rerender({ hookSegments: [...baseSegments, addedSegment], query: "hello" });

      expect(result.current.totalMatches).toBe(3);
    });

    it("updates allMatches when segments are removed", () => {
      const { result, rerender } = renderHook(
        ({ query, hookSegments }) =>
          useSearchAndReplace(hookSegments, mockUpdateSegmentsTexts, query, false),
        { initialProps: { hookSegments: baseSegments, query: "hello" } },
      );

      expect(result.current.totalMatches).toBe(2);

      rerender({ hookSegments: [baseSegments[0]], query: "hello" });

      expect(result.current.totalMatches).toBe(1);
    });

    it("updates allMatches when segment order changes", () => {
      const { result, rerender } = renderHook(
        ({ query, hookSegments }) =>
          useSearchAndReplace(hookSegments, mockUpdateSegmentsTexts, query, false),
        { initialProps: { hookSegments: baseSegments, query: "hello" } },
      );

      const originalAllMatches = result.current.allMatches;

      rerender({ hookSegments: [baseSegments[1], baseSegments[0]], query: "hello" });

      expect(result.current.allMatches).not.toBe(originalAllMatches);
    });
  });
});
