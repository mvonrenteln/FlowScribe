const fs = require("node:fs");
const path = require("node:path");

// Usage: node convert_dialogue.cjs [inputPath] [outputPath] [minSecondsPerSyllable]
// Defaults:
const repoBase = path.resolve(__dirname, "..");
const defaultInput = path.join(repoBase, "Dialogue.txt");
const defaultOutput = path.join(repoBase, "Dialogue.json");

const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultInput;
const outputPath = process.argv[3] ? path.resolve(process.argv[3]) : defaultOutput;
// minimal seconds per syllable (configurable). Default set to 0.3 for more natural pacing.
const minSecondsPerSyllable = process.argv[4] ? parseFloat(process.argv[4]) : 0.3;

function readFileUtf8(p) {
  return fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
}

function syllableCount(word) {
  if (!word) return 1;
  // remove non-letters
  const clean = word.toLowerCase().replace(/[^a-zäöüáàâãéèêíìîóòôõúùûüyœæçñß]/gi, "");
  const matches = clean.match(/[aeiouyäöüáàâãéèêíìîóòôõúùûüyœæ]+/gi);
  if (!matches) return 1;
  return matches.length;
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

function isSectionDivider(line) {
  const t = line.trim();
  if (!t) return false;
  if (/^---+/.test(t)) return true;
  if (/^#{1,6}\s/.test(t)) return true;
  return false;
}

function parseSegmentsFromDialog(text) {
  const lines = text.split("\n");
  const segments = [];
  let section = 0;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw) continue; // ignore blank lines
    const line = raw.trim();
    if (line === "") continue;
    if (isSectionDivider(line)) {
      section++;
      continue;
    }
    if (/^\s*#/.test(line)) continue; // ignore headings lines (but sections already handled)

    // match **Speaker:** Text
    const m = line.match(/^\*\*(.+?):\*\*\s*(.*)$/);
    if (m) {
      const speaker = m[1].trim();
      let textPart = m[2].trim();
      // If the text part is empty, try to collect following non-empty non-** lines into the text
      if (!textPart) {
        let j = i + 1;
        const parts = [];
        while (j < lines.length) {
          const nx = lines[j].trim();
          if (nx === "") break;
          if (/^\*\*/.test(nx)) break;
          if (isSectionDivider(nx)) break;
          parts.push(nx);
          j++;
        }
        if (parts.length) textPart = parts.join(" ");
      }

      segments.push({ speaker, text: textPart, section });
    }
    // else ignore the line
  }
  return segments;
}

// punctuation pause map (seconds). Different punctuation implies different pause lengths.
const punctPause = {
  ",": 0.15,
  ";": 0.2,
  ":": 0.2,
  "—": 0.3,
  "...": 0.4,
  "…": 0.4,
  ".": 0.35,
  "?": 0.35,
  "!": 0.35,
};

function detectTrailingPunctuation(token) {
  const m = token.match(/([.,;:!?\u2014\u2026]+)$/); // . , ; : ! ? — …
  if (!m) return null;
  return m[1];
}

function buildSegmentsTiming(segments) {
  let currentStart = 0.0;
  const out = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segObj = {
      speaker: seg.speaker,
      start: 0,
      end: 0,
      text: seg.text,
      words: [],
    };

    segObj.start = round2(currentStart);
    let t = segObj.start;

    // tokenise by whitespace preserving punctuation attached
    const tokens = (seg.text || "").match(/\S+/g) || [];
    for (let j = 0; j < tokens.length; j++) {
      const tok = tokens[j];
      // count syllables on cleaned token
      const cleaned = tok.replace(/^['"([{]+|['")\]}.,!?:;]+$/g, "");
      const syll = syllableCount(cleaned);
      const dur = Math.max(minSecondsPerSyllable * syll, minSecondsPerSyllable);
      const rd = round2(dur);
      const ws = round2(t);
      const we = round2(ws + rd);
      segObj.words.push({ word: tok, start: ws, end: we });
      t = we;

      // add punctuation pause if token ends with punctuation
      const trailing = detectTrailingPunctuation(tok);
      if (trailing) {
        // choose pause: if '...' or '…' use that, else take last char
        let key = trailing;
        if (trailing.length > 1) {
          if (trailing.indexOf("...") >= 0) key = "...";
          else if (trailing.indexOf("…") >= 0) key = "…";
          else key = trailing[trailing.length - 1];
        } else {
          key = trailing;
        }
        const pause = punctPause[key] || 0.2;
        t = round2(t + pause);
      }
    }

    // computed end is sum of word durations + punctuation pauses
    const computedEnd = round2(t);
    segObj.end = computedEnd;

    out.push(segObj);

    // prepare next start: if next segment is in different section, add 2s silence
    const next = segments[i + 1];
    currentStart = segObj.end;
    if (next && typeof next.section === "number" && next.section !== seg.section) {
      currentStart = round2(currentStart + 2.0);
    }
  }
  return out;
}

function run() {
  if (!fs.existsSync(inputPath)) {
    console.error("Input file not found:", inputPath);
    process.exit(2);
  }

  // backup existing output if present
  if (fs.existsSync(outputPath)) {
    const bak = `${outputPath.replace(/(\.json)$/, "")}.original.json`;
    try {
      fs.copyFileSync(outputPath, bak, fs.constants.COPYFILE_EXCL);
      console.log("Backup created:", bak);
    } catch (_e) {
      /* ignore if exists */
    }
  }

  const text = readFileUtf8(inputPath);
  const segments = parseSegmentsFromDialog(text);
  const timed = buildSegmentsTiming(segments);
  const out = { segments: timed };
  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2), "utf8");
  console.log(
    "Wrote",
    outputPath,
    "with",
    timed.length,
    "segments (minSyll=",
    minSecondsPerSyllable,
    ")",
  );
}

if (require.main === module) {
  run();
}

module.exports = { parseSegmentsFromDialog, buildSegmentsTiming, syllableCount };
