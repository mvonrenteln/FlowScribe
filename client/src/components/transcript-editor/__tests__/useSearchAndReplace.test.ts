import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Segment } from "@/lib/store";
import { useSearchAndReplace } from "../useSearchAndReplace";

describe("useSearchAndReplace", () => {
  const mockUpdateSegmentsTexts = vi.fn();
  const segments: Segment[] = [
    {
      id: "seg-1",
      speaker: "A",
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
});
