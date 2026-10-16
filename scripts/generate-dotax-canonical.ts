/**
 * Fill src/core/ingest/sources/dotax/config/canonical.ts: the fixed `source`
 * label of each DOTAX row (type, section, sub, item).
 *
 *   bun run scripts/generate-dotax-canonical.ts [--dry-run]
 *
 * Reads the `dotax` extractor's stored inputs (run the dotax_current and
 * dotax_archive fetches first), parses them, and for every item missing
 * from the table adds its latest printed spelling. Existing entries are
 * never changed: they are the names load statements use. Edit the table
 * by hand to rename one.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { catalogDb } from "@/core/ingest/db";
import { fileRawStore } from "@/core/ingest/raw-store";
import { getSource } from "@/core/ingest/registry";
import { resolveInputs } from "@/core/ingest/run";
import { CANONICAL_CSV } from "@/core/ingest/sources/dotax/config/canonical";
import { reportKey } from "@/core/ingest/sources/dotax/labels";
import {
  inventory,
  pickPerMonth,
} from "@/core/ingest/sources/dotax/parse-files";
import { parseFile, Problems } from "@/core/ingest/sources/dotax/parse-reports";
import type { ParsedRow } from "@/core/ingest/sources/dotax/parse-reports";

const dryRun = process.argv.includes("--dry-run");
const FILE = join(
  import.meta.dir,
  "..",
  "src/core/ingest/sources/dotax/config/canonical.ts",
);

const csvField = (s: string) =>
  /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;

async function main() {
  const source = getSource("dotax");
  const extractor = await catalogDb.getExtractor("dotax");
  const { inputs } = await resolveInputs(
    extractor,
    source,
    source.dimensions(extractor),
    { db: catalogDb, store: fileRawStore() },
  );
  if (inputs.length === 0) {
    throw new Error(
      "no stored DOTAX files: run `bun run ingest fetch dotax_current` / dotax_archive first",
    );
  }
  const picked = pickPerMonth(inventory(inputs).files);
  console.log(`parsing ${picked.length} report files`);
  const latest = new Map<string, ParsedRow>();
  const problems = new Problems();
  for (const f of picked) {
    for (const r of parseFile(f.type, f.path, f.month, problems)) {
      if (r.value === null) continue;
      const k = `${r.type}|${r.section}|${r.sub}|${r.item}`;
      const prev = latest.get(k);
      if (!prev || r.month > prev.month) latest.set(k, r);
    }
  }

  const lines: string[] = CANONICAL_CSV.split("\n").filter((l: string) =>
    l.trim(),
  );
  const header = lines.shift()!;
  const have = new Set(lines.map((l) => l.split(",").slice(0, 4).join("|")));
  const added: string[] = [];
  for (const [k, r] of [...latest].sort(([a], [b]) => a.localeCompare(b))) {
    if (have.has(k)) continue;
    if (/[`]|\$\{/.test(r.label)) {
      throw new Error(`label for ${k} contains a backtick or \${: ${r.label}`);
    }
    lines.push(
      [r.type, r.section, r.sub, r.item, r.label].map(csvField).join(","),
    );
    added.push(
      `${k} → ${r.label} (${r.month}, ${reportKey(r.type, r.section, r.sub, r.item, r.geo)})`,
    );
  }
  for (const a of added) console.log(`+ ${a}`);
  console.log(`${added.length} added, ${have.size} kept`);
  if (dryRun || added.length === 0) return;

  const body = [header, ...lines.sort()].join("\n") + "\n";
  const text = readFileSync(FILE, "utf8");
  const start = text.indexOf("String.raw`") + "String.raw`".length;
  const end = text.indexOf("`;", start);
  writeFileSync(FILE, text.slice(0, start) + body + text.slice(end));
  console.log(`wrote ${FILE}`);
}

try {
  await main();
  process.exit(0);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
