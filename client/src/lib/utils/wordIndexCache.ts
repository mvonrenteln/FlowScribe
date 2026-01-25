import type { Word } from "@/lib/store/types";

let _wordsIndexCache = new WeakMap<Word[], { starts: number[]; ends: number[] }>();

export function clearWordsIndexCache() {
  // WeakMap has no clear(); replace with a fresh WeakMap to drop references
  _wordsIndexCache = new WeakMap<Word[], { starts: number[]; ends: number[] }>();
}

export function deleteWordsIndexCacheFor(words: Word[] | null | undefined) {
  if (!words) return;
  _wordsIndexCache.delete(words);
}

export function getWordIndexForTime(words: Word[], time: number) {
  const n = words.length;
  if (n === 0) return -1;

  let cached = _wordsIndexCache.get(words);
  if (!cached) {
    const starts = new Array<number>(n);
    const ends = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      starts[i] = words[i].start;
      ends[i] = words[i].end;
    }
    cached = { starts, ends };
    _wordsIndexCache.set(words, cached);
  }

  const { starts, ends } = cached;

  // Binary search for the last index with starts[idx] <= time
  let lo = 0;
  let hi = n - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= time) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (ans !== -1) {
    if (time <= ends[ans]) return ans;
    if (lo < n) return lo;
    return n - 1;
  }

  if (lo < n) return lo;
  return n - 1;
}

export default {
  getWordIndexForTime,
  clearWordsIndexCache,
  deleteWordsIndexCacheFor,
};
