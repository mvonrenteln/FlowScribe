import type { Segment } from "../types";

const buildDefaultWords = (segment: Segment, nextWordTexts: string[]) => {
  const segDuration = segment.end - segment.start;
  const wordDuration = nextWordTexts.length > 0 ? segDuration / nextWordTexts.length : 0;
  return nextWordTexts.map((word, index) => ({
    word,
    start: segment.start + index * wordDuration,
    end: segment.start + (index + 1) * wordDuration,
    speaker: segment.speaker,
    score: 1,
  }));
};

export const applyTextUpdateToSegment = (segment: Segment, text: string): Segment | null => {
  const normalizedText = text.trim();
  if (segment.text === normalizedText) return null;

  const nextWordTexts = normalizedText.split(/\s+/).filter((word) => word.length > 0);
  const prevWords = segment.words;

  const calculateWords = () => {
    const findMatches = (prevT: string[], nextT: string[]) => {
      const rows = prevT.length + 1;
      const cols = nextT.length + 1;
      const table = Array.from({ length: rows }, () => Array(cols).fill(0));
      for (let i = prevT.length - 1; i >= 0; i -= 1) {
        for (let j = nextT.length - 1; j >= 0; j -= 1) {
          if (prevT[i] === nextT[j]) {
            table[i][j] = table[i + 1][j + 1] + 1;
          } else {
            table[i][j] = Math.max(table[i + 1][j], table[i][j + 1]);
          }
        }
      }

      const matches: Array<{ oldIndex: number; newIndex: number }> = [];
      let i = 0;
      let j = 0;
      while (i < prevT.length && j < nextT.length) {
        if (prevT[i] === nextT[j]) {
          matches.push({ oldIndex: i, newIndex: j });
          i += 1;
          j += 1;
        } else if (table[i + 1][j] >= table[i][j + 1]) {
          i += 1;
        } else {
          j += 1;
        }
      }
      return matches;
    };

    if (prevWords.length === 0 || nextWordTexts.length === 0) {
      return buildDefaultWords(segment, nextWordTexts);
    }

    const prevText = prevWords.map((word) => word.word);
    const matches = findMatches(prevText, nextWordTexts);
    const updated: Array<(typeof prevWords)[0]> = [];

    const addRegion = (oldStart: number, oldEnd: number, newStart: number, newEnd: number) => {
      const regionWords = nextWordTexts.slice(newStart, newEnd);
      if (regionWords.length === 0) return;

      let regionStart = segment.start;
      let regionEnd = segment.end;

      if (oldEnd > oldStart) {
        regionStart = prevWords[oldStart].start;
        regionEnd = prevWords[oldEnd - 1].end;
      } else {
        const prevWord = oldStart > 0 ? prevWords[oldStart - 1] : null;
        const nextWord = oldEnd < prevWords.length ? prevWords[oldEnd] : null;
        if (prevWord && nextWord) {
          regionStart = prevWord.end;
          regionEnd = nextWord.start;
        } else if (prevWord) {
          regionStart = prevWord.end;
          regionEnd = segment.end;
        } else if (nextWord) {
          regionStart = segment.start;
          regionEnd = nextWord.start;
        }
      }

      if (regionEnd < regionStart) {
        regionEnd = regionStart;
      }

      const duration = regionEnd - regionStart;
      const step = regionWords.length > 0 ? duration / regionWords.length : 0;
      regionWords.forEach((word, index) => {
        const start = regionStart + index * step;
        const end = regionStart + (index + 1) * step;
        updated.push({
          word,
          start,
          end: end < start ? start : end,
          speaker: segment.speaker,
          score: 1,
        });
      });
    };

    let prevIdx = 0;
    let nextIdx = 0;
    matches.forEach((match) => {
      addRegion(prevIdx, match.oldIndex, nextIdx, match.newIndex);
      const matchedPrev = prevWords[match.oldIndex];
      updated.push({
        ...matchedPrev,
        word: nextWordTexts[match.newIndex],
      });
      prevIdx = match.oldIndex + 1;
      nextIdx = match.newIndex + 1;
    });
    addRegion(prevIdx, prevWords.length, nextIdx, nextWordTexts.length);

    return updated;
  };

  return {
    ...segment,
    text: normalizedText,
    words: calculateWords(),
  };
};
