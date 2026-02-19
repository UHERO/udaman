import "server-only";
import GeographyCollection from "@catalog/collections/geography-collection";
import MeasurementCollection from "@catalog/collections/measurement-collection";
import SeriesCollection from "@catalog/collections/series-collection";
import Series from "@catalog/models/series";

import { createLogger } from "@/core/observability/logger";

import type { Universe } from "../types/shared";

const log = createLogger("catalog.compare-filters");

const MAX_SERIES = 50;

export type Adjustment = "sa" | "ns" | "na";

export type FilterRow = {
  id: string;
  prefix: string;
  mode: "measurement" | "search";
  measurementId: number | null;
  geos: string[];
  frequency: string;
  adjustment: Adjustment;
  universe: string;
};

export type FilterOptions = {
  measurements: { id: number; prefix: string; dataPortalName: string | null }[];
  geos: { handle: string; displayName: string | null }[];
};

export async function getFilterOptions({
  universe,
}: {
  universe: Universe;
}): Promise<FilterOptions> {
  log.info({ universe }, "fetching compare filter options");

  const [measurements, geos] = await Promise.all([
    MeasurementCollection.list({ universe }),
    GeographyCollection.list({ universe }),
  ]);

  return {
    measurements: measurements.map((m) => ({
      id: m.id,
      prefix: m.prefix,
      dataPortalName: m.dataPortalName,
    })),
    geos: geos
      .filter((g) => g.handle)
      .map((g) => ({
        handle: g.handle!,
        displayName: g.displayName,
      })),
  };
}

/** Get distinct frequency codes for a measurement's series. */
export async function getMeasurementFrequencies({
  measurementId,
}: {
  measurementId: number;
}): Promise<string[]> {
  const names = await MeasurementCollection.getSeriesNames(measurementId);
  const freqs = new Set<string>();
  for (const name of names) {
    try {
      const parsed = Series.parseName(name);
      if (parsed.freq) freqs.add(parsed.freq);
    } catch {
      /* skip invalid names */
    }
  }
  return [...freqs].sort();
}

export type MeasurementOptions = {
  geos: string[];
  frequencies: string[];
  combinations: { geo: string; freq: string }[];
};

/** Get available geos, frequencies, and their combinations for a measurement. */
export async function getMeasurementOptions({
  measurementId,
}: {
  measurementId: number;
}): Promise<MeasurementOptions> {
  const names = await MeasurementCollection.getSeriesNames(measurementId);

  const geos = new Set<string>();
  const freqs = new Set<string>();
  const comboKeys = new Set<string>();
  const combinations: { geo: string; freq: string }[] = [];

  for (const name of names) {
    try {
      const parsed = Series.parseName(name);
      if (parsed.geo) geos.add(parsed.geo);
      if (parsed.freq) freqs.add(parsed.freq);

      if (parsed.geo && parsed.freq) {
        const key = `${parsed.geo}|${parsed.freq}`;
        if (!comboKeys.has(key)) {
          comboKeys.add(key);
          combinations.push({ geo: parsed.geo, freq: parsed.freq });
        }
      }
    } catch {
      /* skip invalid names */
    }
  }

  return {
    geos: [...geos].sort(),
    frequencies: [...freqs].sort(),
    combinations,
  };
}

export async function resolveCompareFilters({
  rows,
}: {
  rows: FilterRow[];
}): Promise<{ names: string[]; truncated: boolean }> {
  log.info({ rowCount: rows.length }, "resolving compare filters");

  const allNames: string[] = [];

  for (const row of rows) {
    if (!row.prefix.trim()) continue;

    let names: string[];

    if (row.mode === "measurement" && row.measurementId) {
      names = await resolveMeasurementRow(row);
    } else {
      names = await resolveSearchRow(row);
    }

    allNames.push(...names);
  }

  // Deduplicate preserving order
  const seen = new Set<string>();
  const unique = allNames.filter((n) => {
    if (seen.has(n)) return false;
    seen.add(n);
    return true;
  });

  const truncated = unique.length > MAX_SERIES;
  const result = unique.slice(0, MAX_SERIES);

  log.info(
    { resolved: result.length, truncated },
    "compare filters resolved",
  );

  return { names: result, truncated };
}

async function resolveMeasurementRow(row: FilterRow): Promise<string[]> {
  const universe = row.universe.toUpperCase();
  let prefix = row.prefix;
  const adj = row.adjustment;

  // Adjust prefix for SA/NS (NA = no adjustment)
  if (adj === "ns") {
    if (!/NS$/i.test(prefix)) {
      prefix = prefix + "NS";
    }
  } else if (adj === "sa") {
    if (/NS$/i.test(prefix)) {
      prefix = prefix.replace(/NS$/i, "");
    }
  }

  // Try to find measurement with adjusted prefix
  let measurementId = row.measurementId;
  if (prefix !== row.prefix) {
    try {
      const m = await MeasurementCollection.getByPrefix(
        prefix,
        universe as Universe,
      );
      measurementId = m.id;
    } catch {
      // Counterpart measurement not found, fall back to original
      measurementId = row.measurementId;
    }
  }

  if (!measurementId) return [];

  const seriesNames = await MeasurementCollection.getSeriesNames(measurementId);

  return seriesNames.filter((name) => {
    try {
      const parsed = Series.parseName(name);

      // Filter by frequency
      if (row.frequency && parsed.freq && parsed.freq !== row.frequency) {
        return false;
      }

      // Filter by selected geos (empty = all)
      if (row.geos.length > 0) {
        if (!row.geos.some((g) => g.toUpperCase() === parsed.geo)) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  });
}

export type PrefixOptions = {
  geos: string[];
  frequencies: string[];
  /** Every geo+freq pair that exists for this prefix, for cross-filtering. */
  combinations: { geo: string; freq: string }[];
};

/** Given an exact prefix, return which geos & frequencies exist for it. */
export async function getPrefixOptions({
  prefix,
  universe,
}: {
  prefix: string;
  universe: string;
}): Promise<PrefixOptions> {
  log.info({ prefix, universe }, "fetching prefix options");

  const results = await SeriesCollection.search({
    text: `^${prefix}`,
    universe,
    limit: 500,
  });

  const geos = new Set<string>();
  const freqs = new Set<string>();
  const comboKeys = new Set<string>();
  const combinations: { geo: string; freq: string }[] = [];

  for (const s of results) {
    try {
      const parsed = Series.parseName(s.name);
      // Only include exact prefix matches (^E_NF also matches E_NFNS, etc.)
      if (parsed.prefixFull !== prefix) continue;

      if (parsed.geo) geos.add(parsed.geo);
      if (parsed.freq) freqs.add(parsed.freq);

      if (parsed.geo && parsed.freq) {
        const key = `${parsed.geo}|${parsed.freq}`;
        if (!comboKeys.has(key)) {
          comboKeys.add(key);
          combinations.push({ geo: parsed.geo, freq: parsed.freq });
        }
      }
    } catch {
      /* skip unparseable names */
    }
  }

  return {
    geos: [...geos].sort(),
    frequencies: [...freqs].sort(),
    combinations,
  };
}

export async function searchPrefixes({
  text,
  universe,
}: {
  text: string;
  universe: string;
}): Promise<string[]> {
  if (text.length < 1) return [];

  log.info({ text, universe }, "searching prefixes");

  const results = await SeriesCollection.search({
    text: `^${text}`,
    universe,
    limit: 500,
  });

  const prefixes = new Set<string>();
  for (const s of results) {
    try {
      const parsed = Series.parseName(s.name);
      prefixes.add(parsed.prefixFull);
    } catch {
      /* skip unparseable names */
    }
  }

  return [...prefixes].sort();
}

async function resolveSearchRow(row: FilterRow): Promise<string[]> {
  const universe = row.universe.toUpperCase();

  // Build search query using existing operator syntax
  let query = `^${row.prefix}`;

  if (row.geos.length > 0) {
    query += ` @${row.geos.join(",")}`;
  }

  if (row.frequency) {
    query += ` .${row.frequency}`;
  }

  // Only add SA/NS filter when not NA
  if (row.adjustment !== "na") {
    query += ` &${row.adjustment}`;
  }

  const results = await SeriesCollection.search({
    text: query,
    universe,
  });

  return results.map((s) => s.name);
}
