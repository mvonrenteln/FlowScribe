import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TranscriptSegment } from "@/components/TranscriptSegment";
import type { Segment, Speaker } from "@/lib/store";

const speakers: Speaker[] = [
  { id: "s1", name: "SPEAKER_00", color: "hsl(217, 91%, 48%)" },
  { id: "s2", name: "SPEAKER_01", color: "hsl(142, 76%, 36%)" },
];

const segment: Segment = {
  id: "seg-1",
  speaker: "SPEAKER_00",
  tags: [],
  start: 0,
  end: 2,
  text: "Hallo Welt",
  words: [
    { word: "Hallo", start: 0, end: 1 },
    { word: "Welt", start: 1, end: 2 },
  ],
};

describe("TranscriptSegment", () => {
  it("renders word tokens and seeks on click", async () => {
    const onSeek = vi.fn();
    const onSelect = vi.fn();
    render(
      <TranscriptSegment
        segment={segment}
        speakers={speakers}
        tags={[]}
        isSelected={false}
        isActive={false}
        onSelect={onSelect}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={onSeek}
      />,
    );

    const segmentCard = screen.getByTestId("segment-seg-1");
    fireEvent.keyDown(segmentCard, { key: "Enter" });
    const word = screen.getByTestId("word-seg-1-0");
    await userEvent.click(word);

    expect(onSelect).toHaveBeenCalled();
    expect(onSeek).toHaveBeenCalledWith(0);
    expect(screen.getByText("Hallo")).toBeInTheDocument();
    expect(screen.getByText("Welt")).toBeInTheDocument();
  });

  it("splits on selected word", async () => {
    const onSplit = vi.fn();
    render(
      <TranscriptSegment
        tags={[]}
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={onSplit}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const word = screen.getByTestId("word-seg-1-1");
    fireEvent.click(word, { shiftKey: true });

    const splitButton = screen.getByTestId("button-split-seg-1");
    await userEvent.click(splitButton);

    expect(onSplit).toHaveBeenCalledWith(1);
  });

  it("saves edited text on Enter", async () => {
    const onTextChange = vi.fn();
    render(
      <TranscriptSegment
        tags={[]}
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        onSelect={vi.fn()}
        onTextChange={onTextChange}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const textBlock = screen.getByTestId("text-segment-seg-1");
    fireEvent.doubleClick(textBlock);

    const textarea = screen.getByTestId("textarea-segment-seg-1");
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Hallo zusammen");
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onTextChange).toHaveBeenCalledWith("Hallo zusammen");
  });

  it("uses the view height for the editor size", async () => {
    render(
      <TranscriptSegment
        tags={[]}
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const textBlock = screen.getByTestId("text-segment-seg-1");
    const textWrapper = textBlock.parentElement as HTMLDivElement;
    textWrapper.getBoundingClientRect = () =>
      ({
        height: 140,
        width: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
      }) as DOMRect;
    fireEvent.doubleClick(textBlock);

    const textarea = screen.getByTestId("textarea-segment-seg-1");
    fireEvent.change(textarea, { target: { value: "Hallo zusammen" } });

    await waitFor(() => {
      expect(textarea.style.height).toBe("140px");
    });
  });

  it("cancels edits on Escape", async () => {
    const onTextChange = vi.fn();
    render(
      <TranscriptSegment
        tags={[]}
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        onSelect={vi.fn()}
        onTextChange={onTextChange}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const textBlock = screen.getByTestId("text-segment-seg-1");
    fireEvent.doubleClick(textBlock);

    const textarea = screen.getByTestId("textarea-segment-seg-1");
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Andere Worte");
    fireEvent.keyDown(textarea, { key: "Escape" });

    expect(onTextChange).not.toHaveBeenCalled();
    expect(screen.getByText("Hallo")).toBeInTheDocument();
    expect(screen.getByText("Welt")).toBeInTheDocument();
  });

  it("saves edited text via the save button", async () => {
    const onTextChange = vi.fn();
    render(
      <TranscriptSegment
        tags={[]}
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        onSelect={vi.fn()}
        onTextChange={onTextChange}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const textBlock = screen.getByTestId("text-segment-seg-1");
    fireEvent.doubleClick(textBlock);

    const textarea = screen.getByTestId("textarea-segment-seg-1");
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Neue Worte");
    await userEvent.click(screen.getByTestId("button-save-segment-seg-1"));

    expect(onTextChange).toHaveBeenCalledWith("Neue Worte");
  });

  it("cancels edits via the cancel button", async () => {
    const onTextChange = vi.fn();
    render(
      <TranscriptSegment
        tags={[]}
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        onSelect={vi.fn()}
        onTextChange={onTextChange}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const textBlock = screen.getByTestId("text-segment-seg-1");
    fireEvent.doubleClick(textBlock);

    const textarea = screen.getByTestId("textarea-segment-seg-1");
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Andere Worte");
    await userEvent.click(screen.getByTestId("button-cancel-segment-seg-1"));

    expect(onTextChange).not.toHaveBeenCalled();
    expect(screen.getByText("Hallo")).toBeInTheDocument();
    expect(screen.getByText("Welt")).toBeInTheDocument();
  });

  it("opens edit mode on double-click anywhere in segment (not just on text)", async () => {
    render(
      <TranscriptSegment
        tags={[]}
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const segmentElement = screen.getByTestId("segment-seg-1");
    fireEvent.doubleClick(segmentElement);

    // Edit mode should be active
    expect(screen.getByTestId("textarea-segment-seg-1")).toBeInTheDocument();
  });

  it("does not call onSelect during a double-click on inactive segment", async () => {
    vi.useFakeTimers();
    const onSelect = vi.fn();

    render(
      <TranscriptSegment
        tags={[]}
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        onSelect={onSelect}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const segmentElement = screen.getByTestId("segment-seg-1");

    // Simulate a double-click (two clicks in rapid succession)
    fireEvent.click(segmentElement);
    fireEvent.click(segmentElement);
    fireEvent.doubleClick(segmentElement);

    // Advance timers to trigger any delayed onSelect calls
    vi.advanceTimersByTime(300);

    // onSelect should not be called during a double-click
    expect(onSelect).not.toHaveBeenCalled();

    // Edit mode should be active
    expect(screen.getByTestId("textarea-segment-seg-1")).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("seeks when activating word with keyboard", () => {
    const onSeek = vi.fn();
    render(
      <TranscriptSegment
        tags={[]}
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={onSeek}
      />,
    );

    const word = screen.getByTestId("word-seg-1-0");
    fireEvent.keyDown(word, { key: "Enter" });

    expect(onSeek).toHaveBeenCalledWith(0);
  });

  it("uses fallback speaker color when missing speaker data", () => {
    render(
      <TranscriptSegment
        tags={[]}
        segment={segment}
        speakers={[]}
        isSelected={false}
        isActive={false}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const segmentCard = screen.getByTestId("segment-seg-1");
    const colorSwatch = segmentCard.querySelector("div[style]");

    expect(colorSwatch).toHaveStyle({ backgroundColor: "hsl(217, 91%, 48%)" });
  });

  it("splits at the current word from the segment menu", async () => {
    const onSplit = vi.fn();
    render(
      <TranscriptSegment
        tags={[]}
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={true}
        activeWordIndex={1}
        splitWordIndex={1}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={onSplit}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByTestId("button-segment-menu-seg-1"));
    await userEvent.click(screen.getByText("Split at current word"));

    expect(onSplit).toHaveBeenCalledWith(1);
  });

  it("does not split at the current word when the segment is inactive", async () => {
    const onSplit = vi.fn();
    render(
      <TranscriptSegment
        tags={[]}
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        activeWordIndex={1}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={onSplit}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByTestId("button-segment-menu-seg-1"));
    await userEvent.click(screen.getByText("Split at current word"));

    expect(onSplit).not.toHaveBeenCalled();
  });

  it("confirms the segment from the menu", async () => {
    const onConfirm = vi.fn();
    render(
      <TranscriptSegment
        tags={[]}
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={onConfirm}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByTestId("button-segment-menu-seg-1"));
    await userEvent.click(screen.getByText("Confirm block"));

    expect(onConfirm).toHaveBeenCalled();
  });

  it("confirms the segment via the quick action button", async () => {
    const onConfirm = vi.fn();
    render(
      <TranscriptSegment
        tags={[]}
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={onConfirm}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByTestId("button-confirm-seg-1"));

    expect(onConfirm).toHaveBeenCalled();
  });

  it("toggles bookmark via the quick action button", async () => {
    const onToggleBookmark = vi.fn();
    render(
      <TranscriptSegment
        tags={[]}
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={onToggleBookmark}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByTestId("button-bookmark-seg-1"));

    expect(onToggleBookmark).toHaveBeenCalled();
  });

  it("shows the confirmed badge and icon when a segment is confirmed", () => {
    const confirmedSegment: Segment = { ...segment, confirmed: true };
    render(
      <TranscriptSegment
        tags={[]}
        segment={confirmedSegment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByLabelText("Segment confirmed")).toBeDisabled();
  });

  it("highlights low confidence words when enabled", () => {
    const scoredSegment: Segment = {
      ...segment,
      words: [
        { word: "Hallo", start: 0, end: 1, score: 0.15 },
        { word: "Welt", start: 1, end: 2, score: 0.8 },
      ],
    };

    render(
      <TranscriptSegment
        tags={[]}
        segment={scoredSegment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        highlightLowConfidence={true}
        lowConfidenceThreshold={0.3}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const lowWord = screen.getByTestId("word-seg-1-0");
    const highWord = screen.getByTestId("word-seg-1-1");

    expect(lowWord.querySelector("span")?.className).toContain("decoration-dotted");
    expect(highWord.querySelector("span")?.className).not.toContain("decoration-dotted");
  });

  it("highlights lexicon matches when provided", () => {
    const lexiconMatch = new Map<number, { term: string; score: number }>();
    lexiconMatch.set(1, { term: "Welt", score: 0.9 });

    render(
      <TranscriptSegment
        tags={[]}
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        lexiconMatches={lexiconMatch}
        showLexiconMatches={true}
        lexiconHighlightUnderline={true}
        lexiconHighlightBackground={true}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const matchWord = screen.getByTestId("word-seg-1-1");
    expect(matchWord.querySelector("span")?.className).toContain("bg-amber-100/70");
    expect(matchWord).toHaveTextContent("Welt");
  });

  it("applies a glossary suggestion from the tooltip", async () => {
    const onTextChange = vi.fn();
    const lexiconMatch = new Map<number, { term: string; score: number }>();
    lexiconMatch.set(1, { term: "Welt", score: 0.9 });

    render(
      <TranscriptSegment
        tags={[]}
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        lexiconMatches={lexiconMatch}
        showLexiconMatches={true}
        lexiconHighlightUnderline={true}
        lexiconHighlightBackground={true}
        onSelect={vi.fn()}
        onTextChange={onTextChange}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const matchWord = screen.getByTestId("word-seg-1-1");
    await userEvent.hover(matchWord);

    const applyButton = await screen.findAllByTestId("button-apply-glossary-seg-1-1");
    await userEvent.click(applyButton[0]);

    expect(onTextChange).toHaveBeenCalledWith("Hallo Welt");
  });

  it("adds a false positive from the glossary tooltip", async () => {
    const onIgnoreLexiconMatch = vi.fn();
    const lexiconMatch = new Map<number, { term: string; score: number }>();
    lexiconMatch.set(1, { term: "Welt", score: 0.9 });

    render(
      <TranscriptSegment
        tags={[]}
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        lexiconMatches={lexiconMatch}
        showLexiconMatches={true}
        lexiconHighlightUnderline={true}
        lexiconHighlightBackground={true}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onIgnoreLexiconMatch={onIgnoreLexiconMatch}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const matchWord = screen.getByTestId("word-seg-1-1");
    await userEvent.hover(matchWord);

    const ignoreButton = await screen.findAllByTestId("button-ignore-glossary-seg-1-1");
    await userEvent.click(ignoreButton[0]);

    expect(onIgnoreLexiconMatch).toHaveBeenCalledWith("Welt", "Welt");
  });

  it("highlights only the matched lexicon part in a hyphenated word", () => {
    const lexiconMatch = new Map<number, { term: string; score: number; partIndex?: number }>();
    lexiconMatch.set(0, { term: "Geweihte", score: 0.9, partIndex: 1 });
    const segmentWithHyphen: Segment = {
      ...segment,
      text: "Tsa-Geweihte",
      words: [{ word: "Tsa-Geweihte", start: 0, end: 2 }],
    };

    render(
      <TranscriptSegment
        tags={[]}
        segment={segmentWithHyphen}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        lexiconMatches={lexiconMatch}
        showLexiconMatches={true}
        lexiconHighlightUnderline={true}
        lexiconHighlightBackground={true}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const wordElement = screen.getByTestId("word-seg-1-0");
    const highlighted = wordElement.querySelectorAll(".decoration-emerald-600");
    expect(highlighted.length).toBe(1);
    expect(highlighted[0]?.textContent).toBe("Geweihte");
  });

  it("applies a spellcheck suggestion from the tooltip", async () => {
    const onTextChange = vi.fn();
    const onIgnoreSpellcheckMatch = vi.fn();
    const onAddSpellcheckToGlossary = vi.fn();
    const spellcheckMatch = new Map<number, { suggestions: string[] }>();
    spellcheckMatch.set(1, { suggestions: ["World", "Welt", "Word", "Worlt"] });

    render(
      <TranscriptSegment
        tags={[]}
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        spellcheckMatches={spellcheckMatch}
        showSpellcheckMatches={true}
        onSelect={vi.fn()}
        onTextChange={onTextChange}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onIgnoreSpellcheckMatch={onIgnoreSpellcheckMatch}
        onAddSpellcheckToGlossary={onAddSpellcheckToGlossary}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const matchWord = screen.getByTestId("word-seg-1-1");
    await userEvent.hover(matchWord);

    const applyButtons = await screen.findAllByTestId("button-apply-spellcheck-seg-1-1");
    const worldButton = applyButtons.find((button) => button.textContent === "World");
    expect(worldButton).toBeTruthy();
    if (worldButton) {
      await userEvent.click(worldButton);
    }

    expect(onTextChange).toHaveBeenCalledWith("Hallo World");

    const ignoreButton = await screen.findAllByTestId("button-ignore-spellcheck-seg-1-1");
    await userEvent.click(ignoreButton[0]);

    expect(onIgnoreSpellcheckMatch).toHaveBeenCalledWith("Welt");

    const addToGlossaryButton = await screen.findAllByTestId(
      "button-add-glossary-spellcheck-seg-1-1",
    );
    await userEvent.click(addToGlossaryButton[0]);

    expect(onAddSpellcheckToGlossary).toHaveBeenCalledWith("Welt");
  });

  it("normalizes punctuation before adding to the glossary", async () => {
    const onAddSpellcheckToGlossary = vi.fn();
    const spellcheckMatch = new Map<number, { suggestions: string[] }>();
    spellcheckMatch.set(1, { suggestions: ["World"] });
    const segmentWithPunctuation: Segment = {
      ...segment,
      text: "Hallo Welt,",
      words: [
        { word: "Hallo", start: 0, end: 1 },
        { word: "Welt,", start: 1, end: 2 },
      ],
    };

    render(
      <TranscriptSegment
        tags={[]}
        segment={segmentWithPunctuation}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        spellcheckMatches={spellcheckMatch}
        showSpellcheckMatches={true}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onIgnoreSpellcheckMatch={vi.fn()}
        onAddSpellcheckToGlossary={onAddSpellcheckToGlossary}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const matchWord = screen.getByTestId("word-seg-1-1");
    await userEvent.hover(matchWord);

    const addToGlossaryButton = await screen.findAllByTestId(
      "button-add-glossary-spellcheck-seg-1-1",
    );
    await userEvent.click(addToGlossaryButton[0]);

    expect(onAddSpellcheckToGlossary).toHaveBeenCalledWith("Welt");
  });

  it("uses the hyphenated part for glossary and ignore actions", async () => {
    const onAddSpellcheckToGlossary = vi.fn();
    const onIgnoreSpellcheckMatch = vi.fn();
    const spellcheckMatch = new Map<number, { suggestions: string[]; partIndex?: number }>();
    spellcheckMatch.set(0, { suggestions: ["Probe"], partIndex: 1 });
    const segmentWithHyphen: Segment = {
      ...segment,
      text: "Fährtenlesen-Probe",
      words: [{ word: "Fährtenlesen-Probe", start: 0, end: 2 }],
    };

    render(
      <TranscriptSegment
        tags={[]}
        segment={segmentWithHyphen}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        spellcheckMatches={spellcheckMatch}
        showSpellcheckMatches={true}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onIgnoreSpellcheckMatch={onIgnoreSpellcheckMatch}
        onAddSpellcheckToGlossary={onAddSpellcheckToGlossary}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const matchWord = screen.getByTestId("word-seg-1-0");
    await userEvent.hover(matchWord);

    const addToGlossaryButton = await screen.findAllByTestId(
      "button-add-glossary-spellcheck-seg-1-0",
    );
    await userEvent.click(addToGlossaryButton[0]);
    expect(onAddSpellcheckToGlossary).toHaveBeenCalledWith("Probe");

    const ignoreButton = await screen.findAllByTestId("button-ignore-spellcheck-seg-1-0");
    await userEvent.click(ignoreButton[0]);
    expect(onIgnoreSpellcheckMatch).toHaveBeenCalledWith("Probe");
  });

  it("underlines only the misspelled hyphenated part", () => {
    const spellcheckMatch = new Map<number, { suggestions: string[]; partIndex?: number }>();
    spellcheckMatch.set(0, { suggestions: ["Probe"], partIndex: 1 });
    const segmentWithHyphen: Segment = {
      ...segment,
      text: "Fährtenlesen-Probe",
      words: [{ word: "Fährtenlesen-Probe", start: 0, end: 2 }],
    };

    render(
      <TranscriptSegment
        tags={[]}
        segment={segmentWithHyphen}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        spellcheckMatches={spellcheckMatch}
        showSpellcheckMatches={true}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onIgnoreSpellcheckMatch={vi.fn()}
        onAddSpellcheckToGlossary={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const wordElement = screen.getByTestId("word-seg-1-0");
    const underlined = wordElement.querySelectorAll(".spellcheck-underline");
    expect(underlined.length).toBe(1);
    expect(underlined[0]?.textContent).toBe("Probe");
  });
});
