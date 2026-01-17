#!/usr/bin/env node
// Perf analysis script for perfMonitor JSON export
// Usage: node analyze-perf.js perf.json [--csv out.csv] [--histogram] [--event name] [--top N] [--buckets N]

import fs from "node:fs";
import path from "node:path";

function usage() {
  console.log(
    "Usage: node analyze-perf.js <perf.json> [--csv out.csv] [--histogram] [--event name] [--top N] [--buckets N]",
  );
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { file: null, csv: null, histogram: false, event: null, top: 20, buckets: 10 };
  if (args.length === 0) return out;
  out.file = args[0];
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === "--csv" && args[i + 1]) {
      out.csv = args[++i];
      continue;
    }
    if (a === "--histogram") {
      out.histogram = true;
      continue;
    }
    if (a === "--event" && args[i + 1]) {
      out.event = args[++i];
      continue;
    }
    if (a === "--top" && args[i + 1]) {
      out.top = parseInt(args[++i], 10) || out.top;
      continue;
    }
    if (a === "--buckets" && args[i + 1]) {
      out.buckets = parseInt(args[++i], 10) || out.buckets;
    }
  }
  return out;
}

function toCSV(rows) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const header = keys.join(",");
  const lines = rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","));
  return [header, ...lines].join("\n");
}

function asciiHistogram(values, buckets = 10, width = 40) {
  if (!values.length) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return `All values equal: ${min.toFixed(2)}ms`;
  const bucketSize = (max - min) / buckets;
  const counts = new Array(buckets).fill(0);
  for (const v of values) {
    const idx = Math.min(buckets - 1, Math.floor((v - min) / bucketSize));
    counts[idx]++;
  }
  const maxCount = Math.max(...counts);
  const lines = [];
  for (let i = 0; i < buckets; i++) {
    const lo = min + i * bucketSize;
    const hi = lo + bucketSize;
    const bar = "#".repeat(Math.round((counts[i] / maxCount) * width));
    lines.push(`${lo.toFixed(2)} - ${hi.toFixed(2)} ms | ${bar} (${counts[i]})`);
  }
  return lines.join("\n");
}

async function main() {
  const opts = parseArgs(process.argv);
  if (!opts.file) {
    usage();
    process.exit(2);
  }

  const file = path.resolve(process.cwd(), opts.file);
  if (!fs.existsSync(file)) {
    console.error("File not found:", file);
    process.exit(2);
  }

  const raw = await fs.promises.readFile(file, "utf8");
  let events;
  try {
    events = JSON.parse(raw);
  } catch (e) {
    console.error("Invalid JSON in", file, e.message);
    process.exit(2);
  }

  if (!Array.isArray(events)) {
    console.error("Perf file must contain a JSON array of events");
    process.exit(2);
  }

  const filtered = opts.event
    ? events.filter((e) => e.name === opts.event || (e.meta && e.meta.name === opts.event))
    : events;

  const byName = new Map();
  for (const ev of filtered) {
    const name = ev.name || ev.meta?.name || "unknown";
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(ev);
  }

  console.log("\nPerf Summary");
  console.log("============");
  console.log("Total events (after filter):", filtered.length);
  console.log("Unique event types:", byName.size);

  const summary = [];
  for (const [name, list] of byName.entries()) {
    const durations = list
      .map((e) => (typeof e.duration === "number" ? e.duration : NaN))
      .filter(Number.isFinite);
    const count = list.length;
    const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : NaN;
    const max = durations.length ? Math.max(...durations) : NaN;
    summary.push({ name, count, avg, max });
  }

  summary.sort((a, b) => b.count - a.count);

  console.log("\nTop event types by count:");
  for (const s of summary.slice(0, opts.top)) {
    console.log(
      `- ${s.name}: count=${s.count}${Number.isFinite(s.avg) ? ` avg=${s.avg.toFixed(2)}ms max=${s.max.toFixed(2)}ms` : ""}`,
    );
  }

  // Top slow events overall
  const slowEvents = filtered
    .filter((e) => typeof e.duration === "number")
    .sort((a, b) => b.duration - a.duration)
    .slice(0, opts.top);
  if (slowEvents.length) {
    console.log("\nTop slow events overall:");
    for (const e of slowEvents) {
      console.log(`${e.name} ${e.duration.toFixed(2)}ms ${e.meta ? JSON.stringify(e.meta) : ""}`);
    }
  }

  // Count marks vs measures vs time
  const kindCounts = filtered.reduce((acc, ev) => {
    acc[ev.kind] = (acc[ev.kind] || 0) + 1;
    return acc;
  }, {});
  console.log("\nEvent kinds:", kindCounts);

  // Optional CSV export
  if (opts.csv) {
    const rows = [];
    for (const s of summary) {
      rows.push({
        name: s.name,
        count: s.count,
        avg: Number.isFinite(s.avg) ? s.avg.toFixed(2) : "",
        max: Number.isFinite(s.max) ? s.max.toFixed(2) : "",
      });
    }
    const csv = toCSV(rows);
    await fs.promises.writeFile(path.resolve(process.cwd(), opts.csv), csv, "utf8");
    console.log("\nWrote CSV to", opts.csv);
  }

  // Optional histogram for durations across filtered events
  if (opts.histogram) {
    const durations = filtered.map((e) => e.duration).filter((d) => typeof d === "number");
    console.log("\nDuration histogram:");
    console.log(asciiHistogram(durations, opts.buckets));
  }

  process.exit(0);
}

main();
