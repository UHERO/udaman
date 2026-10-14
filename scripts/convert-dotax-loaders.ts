/**
 * Switches the DOTAX universe from the rprocess file loaders
 *
 *   "TGRRTNS@MAU.M".tsn.load_from("dotax/dotax.csv")
 *
 * to the downloaders' load methods, e.g.
 *
 *   Series.load_from_dotax_archive("ge", "Collections", "Retailing", "Maui")   priority 90
 *   Series.load_from_dotax_current("ge", "Collections", "Retailing", "Maui")   priority 100
 *
 * (see src/core/downloaders/dotax/loaders.ts for how a series name is traced
 * back to its DOTAX rows). The arguments are read from the downloaders'
 * outputs, so run dotax_archive, dotax_current and dotax_sheet first; a
 * series whose rows are missing from every output is reported and left
 * alone.
 *
 * Old file loaders are disabled and dropped to priority 10, not deleted:
 * their data points stay until the next reload overwrites them, and can be
 * deleted once the new loaders check out. Idempotent: re-running (e.g.
 * after dotax_sheet first runs) adds only the loaders that are missing and
 * disables generated loaders the plan no longer has. Loaders are not run.
 *
 * Usage: bun run scripts/convert-dotax-loaders.ts [--apply] [--verbose] [--only NAME,...]
 */
import { existsSync } from "node:fs";

import DownloadCollection from "@catalog/collections/download-collection";
import LoaderCollection from "@catalog/collections/loader-collection";

import { DOTAX_LAYOUT } from "@/core/downloaders/dotax/args";
import {
  planDotaxLoaders,
  sheetLabelKey,
} from "@/core/downloaders/dotax/loaders";
import type { DotaxLabels } from "@/core/downloaders/dotax/loaders";
import { getImpl } from "@/core/downloaders/registry";
import { KEY_SEP, readTidyRows } from "@/core/downloaders/tidy";
import { mysql } from "@/lib/mysql/helpers";

const APPLY = process.argv.includes("--apply");
const VERBOSE = process.argv.includes("--verbose");
const onlyArg = process.argv[process.argv.indexOf("--only") + 1];
const ONLY = process.argv.includes("--only")
  ? new Set(onlyArg.split(",").map((s) => s.trim()))
  : null;

const OLD_LOADER = /^"[^"]+"\.tsn\.load_from\("dotax\/dotax\.csv"\)$/;
const GENERATED = /^Series\.load_from_dotax_(archive|current|sheet)\(/;
const OLD_PRIORITY = 10;

async function outputRows(handle: string) {
  const impl = getImpl(handle);
  try {
    const path = (
      await DownloadCollection.getByHandle(impl.outputHandle)
    ).savePath();
    if (existsSync(path))
      return { impl, rows: readTidyRows(path, DOTAX_LAYOUT) };
  } catch {
    // never run
  }
  console.log(`note: ${handle} has no output yet`);
  return { impl, rows: [] };
}

async function loadLabels(): Promise<DotaxLabels> {
  const labels: DotaxLabels = {
    archive: new Map(),
    current: new Map(),
    sheet: new Map(),
  };
  for (const tier of ["archive", "current", "sheet"] as const) {
    const { impl, rows } = await outputRows(`dotax_${tier}`);
    for (const r of rows) {
      const parts = r.key.split(KEY_SEP);
      const key =
        tier === "sheet"
          ? sheetLabelKey(parts[0], parts[2])
          : impl.indexKey?.(r.key);
      if (!key) continue;
      const info = labels[tier].get(key);
      if (!info) {
        labels[tier].set(key, {
          args: tier === "sheet" ? parts.slice(0, 3) : parts,
          first: r.date,
          last: r.date,
        });
      } else {
        if (r.date < info.first) info.first = r.date;
        if (r.date > info.last) info.last = r.date;
      }
    }
  }
  return labels;
}

async function main() {
  const labels = await loadLabels();
  console.log(
    `outputs: archive ${labels.archive.size}, current ${labels.current.size}, sheet ${labels.sheet.size} rows`,
  );

  const series = await mysql<{ id: number; name: string }>`
    SELECT id, name FROM series WHERE universe = 'DOTAX' ORDER BY name
  `;
  let converted = 0;
  let created = 0;
  let disabledOld = 0;
  let disabledStale = 0;
  let reprioritized = 0;
  const skipped: string[] = [];
  const partial: string[] = [];

  for (const s of series) {
    if (ONLY && !ONLY.has(s.name)) continue;
    const existing = await LoaderCollection.getBySeriesId(Number(s.id));
    const old = existing.filter((l) => OLD_LOADER.test(l.eval ?? ""));
    const generated = existing.filter((l) => GENERATED.test(l.eval ?? ""));
    if (old.length === 0 && generated.length === 0) continue;

    const plan = planDotaxLoaders(s.name, labels);
    if (plan.loaders.length === 0) {
      skipped.push(`${s.name}: ${plan.missing.join("; ")}`);
      continue;
    }
    if (plan.missing.length)
      partial.push(`${s.name}: ${plan.missing.join("; ")}`);
    const scale = (old[0] ?? generated[0]).scale;

    if (VERBOSE) {
      console.log(`\n${s.name} (scale ${scale})`);
      for (const l of plan.loaders) console.log(`  ${l.priority}  ${l.code}`);
      for (const m of plan.missing) console.log(`  missing: ${m}`);
    }

    const want = new Set(plan.loaders.map((l) => l.code));
    for (const l of plan.loaders) {
      const found = generated.find((g) => g.eval === l.code);
      if (found) {
        if (found.disabled || found.priority !== l.priority) {
          reprioritized++;
          if (APPLY)
            await LoaderCollection.update(found.id, {
              disabled: false,
              priority: l.priority,
            });
        }
        continue;
      }
      created++;
      if (APPLY)
        await LoaderCollection.create({
          seriesId: Number(s.id),
          code: l.code,
          priority: l.priority,
          scale: Number(scale),
          presaveHook: "",
          clearBeforeLoad: false,
          pseudoHistory: false,
          universe: "DOTAX",
        });
    }
    for (const g of generated) {
      if (want.has(g.eval ?? "") || g.disabled) continue;
      disabledStale++;
      if (APPLY) await LoaderCollection.update(g.id, { disabled: true });
    }
    for (const o of old) {
      if (o.disabled && o.priority === OLD_PRIORITY) continue;
      disabledOld++;
      if (APPLY)
        await LoaderCollection.update(o.id, {
          disabled: true,
          priority: OLD_PRIORITY,
        });
    }
    converted++;
  }

  console.log(
    `\n${APPLY ? "" : "[dry run] "}${converted} series converted: ${created} loaders ${APPLY ? "created" : "to create"}, ` +
      `${disabledOld} dotax.csv loaders ${APPLY ? "disabled" : "to disable"} (priority ${OLD_PRIORITY}), ` +
      `${disabledStale} outdated generated loaders ${APPLY ? "disabled" : "to disable"}, ` +
      `${reprioritized} generated loaders ${APPLY ? "re-enabled or reprioritized" : "to re-enable or reprioritize"}`,
  );
  if (partial.length) {
    console.log(`\n${partial.length} series converted with gaps:`);
    for (const p of partial) console.log(`  ${p}`);
  }
  if (skipped.length) {
    console.log(`\n${skipped.length} series left on dotax.csv:`);
    for (const p of skipped) console.log(`  ${p}`);
  }
  if (!APPLY) console.log("\n--apply to write.");
}

// Awaited at top level: Bun can exit with database writes in flight
// otherwise (see qpub-cli.ts).
try {
  await main();
  process.exit(0);
} catch (err) {
  console.error(err);
  process.exit(1);
}
