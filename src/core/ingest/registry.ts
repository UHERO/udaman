/**
 * source_key → source module. A module is code; data_downloaders and
 * data_extractors rows name it by key and hold its config. Add a source
 * by writing a module under ./sources and listing it here.
 */

import { beaSource } from "./sources/bea";
import { blsSource } from "./sources/bls";
import { databookSource } from "./sources/databook";
import { dotaxSource } from "./sources/dotax";
import { dotaxSheetSource } from "./sources/dotax_sheet";
import { eiaSource } from "./sources/eia";
import { estatjpSource } from "./sources/estatjp";
import { fredSource } from "./sources/fred";
import type { SourceModule } from "./types";

const MODULES: readonly SourceModule[] = [
  beaSource,
  blsSource,
  databookSource,
  dotaxSource,
  dotaxSheetSource,
  eiaSource,
  estatjpSource,
  fredSource,
];

export const SOURCES: Readonly<Record<string, SourceModule>> =
  buildRegistry(MODULES);

/** Index modules by key; a duplicate key is a programming error. */
export function buildRegistry(
  modules: readonly SourceModule[],
): Record<string, SourceModule> {
  const out: Record<string, SourceModule> = {};
  for (const m of modules) {
    if (out[m.key]) throw new Error(`Duplicate source module key "${m.key}"`);
    out[m.key] = m;
  }
  return out;
}

export function sourceKeys(): string[] {
  return Object.keys(SOURCES).sort();
}

export function getSource(key: string): SourceModule {
  const m = SOURCES[key];
  if (!m) {
    const known = sourceKeys();
    throw new Error(
      `No source module "${key}" (known: ${known.length ? known.join(", ") : "none"})`,
    );
  }
  return m;
}

/**
 * Check a row's source key before saving it. A downloader needs a module
 * with fetch() when its strategy is custom; an extractor needs one with
 * parse() (every module has one).
 */
export function assertSourceKey(
  key: string | null | undefined,
  use: "custom-fetch" | "extract",
): SourceModule {
  if (!key) {
    throw new Error(
      use === "extract"
        ? "An extractor needs a source key"
        : 'Strategy "custom" needs a source key',
    );
  }
  const m = getSource(key);
  if (use === "custom-fetch" && !m.fetch) {
    throw new Error(
      `Source module "${key}" has no fetch(); pick another strategy`,
    );
  }
  return m;
}
