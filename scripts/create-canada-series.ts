/**
 * Creates the Canadian history series for extsol (notes/EXTSOL_CANADA.qmd
 * §2, the researcher's plan of 2026-11-04) in the UHERO universe, loaded
 * from Statistics Canada through the `statcan` ingest source:
 *
 *   Series.load_from_extract("statcan", { series_id: "v2062810" })
 *
 * Same layout as the US/JP series: the monthly series are seasonally
 * adjusted; .Q averages the monthly series; .A averages the NS monthly
 * series where there is one (CPI, as CPI@US.A from CPINS@US.M), the SA
 * one otherwise (as the JP LFS series). Population (v1, persons) is
 * stored in thousands like N@US / N@JP. Location code CAN (not CA,
 * California). Every monthly series gets .M, .Q and .A; the quarterly
 * ones (population, GDP) get .Q and .A. CXR@CAN.M also loads FRED EXCAUS
 * at priority 90 for the history before 2017.
 *
 * Creates, when missing: geography CAN, source "Statistics Canada", the
 * Canadian units. Existing series are kept; a missing loader is added.
 *
 * Usage:
 *   bun run scripts/create-canada-series.ts --dry-run
 *   bun run scripts/create-canada-series.ts          # create
 *   bun run scripts/create-canada-series.ts --load   # create, fetch, reload
 *
 * Needs the statcan seed migration (20261105000000_seed_statcan_ingest).
 */
import DataPointCollection from "@catalog/collections/data-point-collection";
import LoaderCollection from "@catalog/collections/loader-collection";
import SeriesCollection from "@catalog/collections/series-collection";
import type { SeasonalAdjustment } from "@catalog/types/shared";
import { mysql } from "@database/mysql";

import { runFetch } from "@/core/ingest/run";

const DRY_RUN = process.argv.includes("--dry-run");
const LOAD = process.argv.includes("--load");
const UNIVERSE = "UHERO";
const GEO = {
  handle: "CAN",
  displayName: "Canada",
  displayNameShort: "Canada",
};
const SOURCE = {
  description: "Statistics Canada",
  link: "https://www.statcan.gc.ca/",
};

/** short label, long label (short labels repeat across units) */
const UNITS = {
  thous: ["Thous", "Thousands"],
  pct: ["%", "Percent"],
  index2002: ["Index", "Index value (2002=100)"],
  gdpReal: ["2017C$Milc", "Millions of 2017 Canadian dollars (chained prices)"],
  gdpNom: ["C$Mil", "Millions of current Canadian dollars"],
  fx: ["C$/$", "Canadian Dollars per US Dollar"],
} as const;
type UnitKey = keyof typeof UNITS;

const table = (pid: string) =>
  `https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=${pid}`;

type Def = {
  name: string;
  eval: string;
  unit: UnitKey;
  dataPortalName: string;
  description?: string;
  sa: SeasonalAdjustment;
  real?: boolean;
  decimals?: number;
  scale?: number;
  sourceLink?: string;
};

const extract = (vector: string) =>
  `Series.load_from_extract("statcan", { series_id: "${vector}" })`;
const agg = (from: string, to: "quarter" | "year") =>
  `"${from}".ts.aggregate(:${to}, :average)`;

/** A monthly SA LFS-style series with its .Q and .A averages. */
function monthly(
  prefix: string,
  vector: string,
  o: Omit<Def, "name" | "eval" | "sa"> & { annualFrom?: string },
): Def[] {
  const { annualFrom, ...meta } = o;
  return [
    {
      ...meta,
      name: `${prefix}@CAN.M`,
      eval: extract(vector),
      sa: "seasonally_adjusted",
    },
    {
      ...meta,
      description: undefined,
      scale: undefined,
      name: `${prefix}@CAN.Q`,
      eval: agg(`${prefix}@CAN.M`, "quarter"),
      sa: "seasonally_adjusted",
    },
    {
      ...meta,
      description: undefined,
      scale: undefined,
      name: `${prefix}@CAN.A`,
      eval: agg(annualFrom ?? `${prefix}@CAN.M`, "year"),
      sa: "not_applicable",
    },
  ];
}

const LFS = table("1410028701");
const DEFS: Def[] = [
  {
    name: "N@CAN.Q",
    eval: extract("v1"),
    scale: 0.001,
    unit: "thous",
    dataPortalName: "Total Population",
    description:
      "Canada population estimate at the start of the quarter (StatCan 17-10-0009-01, v1; persons / 1000)",
    sa: "not_applicable",
    sourceLink: table("1710000901"),
  },
  {
    name: "N@CAN.A",
    eval: agg("N@CAN.Q", "year"),
    unit: "thous",
    dataPortalName: "Total Population",
    sa: "not_applicable",
    sourceLink: table("1710000901"),
  },
  ...monthly("N15", "v2062809", {
    unit: "thous",
    dataPortalName: "Population 15 Years and Over (LFS)",
    description:
      "Canada Labour Force Survey population, 15 years and over, seasonally adjusted (StatCan 14-10-0287-01, v2062809)",
    sourceLink: LFS,
  }),
  ...monthly("LF", "v2062810", {
    unit: "thous",
    dataPortalName: "Labor Force",
    description:
      "Canada labour force, 15 years and over, seasonally adjusted (StatCan 14-10-0287-01, v2062810)",
    sourceLink: LFS,
  }),
  ...monthly("EMPL", "v2062811", {
    unit: "thous",
    dataPortalName: "Employment",
    description:
      "Canada employment, 15 years and over, seasonally adjusted (StatCan 14-10-0287-01, v2062811)",
    sourceLink: LFS,
  }),
  ...monthly("UR", "v2062815", {
    unit: "pct",
    dataPortalName: "Unemployment Rate",
    description:
      "Canada unemployment rate, 15 years and over, seasonally adjusted (StatCan 14-10-0287-01, v2062815)",
    sourceLink: LFS,
  }),
  ...monthly("LFP", "v2062816", {
    unit: "pct",
    dataPortalName: "Labor Force Participation Rate",
    description:
      "Canada participation rate, 15 years and over, seasonally adjusted (StatCan 14-10-0287-01, v2062816)",
    sourceLink: LFS,
  }),
  {
    name: "GDP_R@CAN.Q",
    eval: extract("v62305752"),
    unit: "gdpReal",
    dataPortalName: "Real Gross Domestic Product",
    description:
      "Canada GDP at market prices, chained (2017) dollars, seasonally adjusted at annual rates (StatCan 36-10-0104-01, v62305752)",
    sa: "seasonally_adjusted",
    real: true,
    sourceLink: table("3610010401"),
  },
  {
    name: "GDP_R@CAN.A",
    eval: agg("GDP_R@CAN.Q", "year"),
    unit: "gdpReal",
    dataPortalName: "Real Gross Domestic Product",
    sa: "not_applicable",
    real: true,
    sourceLink: table("3610010401"),
  },
  {
    name: "GDP@CAN.Q",
    eval: extract("v62305783"),
    unit: "gdpNom",
    dataPortalName: "Gross Domestic Product",
    description:
      "Canada GDP at market prices, current prices, seasonally adjusted at annual rates (StatCan 36-10-0104-01, v62305783)",
    sa: "seasonally_adjusted",
    sourceLink: table("3610010401"),
  },
  {
    name: "GDP@CAN.A",
    eval: agg("GDP@CAN.Q", "year"),
    unit: "gdpNom",
    dataPortalName: "Gross Domestic Product",
    sa: "not_applicable",
    sourceLink: table("3610010401"),
  },
  {
    name: "CPINS@CAN.M",
    eval: extract("v41690973"),
    unit: "index2002",
    dataPortalName: "Consumer Price Index",
    description:
      "Canada CPI, all-items, not seasonally adjusted, 2002=100 (StatCan 18-10-0004-01, v41690973)",
    sa: "not_seasonally_adjusted",
    sourceLink: table("1810000401"),
  },
  ...monthly("CPI", "v41690914", {
    unit: "index2002",
    dataPortalName: "Consumer Price Index",
    description:
      "Canada CPI, all-items, seasonally adjusted, 2002=100 (StatCan 18-10-0006-01, v41690914)",
    sourceLink: table("1810000601"),
    annualFrom: "CPINS@CAN.M",
  }),
  ...monthly("CXR", "v111666275", {
    unit: "fx",
    dataPortalName: "Canada/US Foreign Exchange Rate",
    description:
      "Canadian dollars per US dollar, monthly average; Bank of Canada, republished by StatCan (33-10-0163-01, v111666275)",
    decimals: 4,
    sourceLink: table("3310016301"),
  }).map((d) => ({ ...d, sa: "not_applicable" as const })),
];

/**
 * Lower-priority loaders for history the StatCan vector lacks. v111666275
 * starts in 2017; FRED EXCAUS (the Fed's H.10 monthly average, CAD per
 * USD) goes back to 1971. Priority 100 (StatCan) wins where both have data.
 */
const EXTRA_LOADERS: Record<
  string,
  Array<{ code: string; priority: number }>
> = {
  "CXR@CAN.M": [
    {
      code: 'Series.load_from_extract("fred", { series_id: "EXCAUS" })',
      priority: 90,
    },
  ],
};

// ─── Reference rows ─────────────────────────────────────────────────

async function ensureGeography(): Promise<number> {
  const rows = await mysql<{ id: number }>`
    SELECT id FROM geographies WHERE universe = ${UNIVERSE} AND handle = ${GEO.handle} LIMIT 1
  `;
  if (rows[0]) return rows[0].id;
  if (DRY_RUN) return -1;
  await mysql`
    INSERT INTO geographies (universe, handle, display_name, display_name_short, created_at, updated_at)
    VALUES (${UNIVERSE}, ${GEO.handle}, ${GEO.displayName}, ${GEO.displayNameShort}, NOW(), NOW())
  `;
  console.log(`created geography ${GEO.handle}`);
  return ensureGeography();
}

async function ensureSource(): Promise<number> {
  const rows = await mysql<{ id: number }>`
    SELECT id FROM sources WHERE universe = ${UNIVERSE} AND description = ${SOURCE.description} LIMIT 1
  `;
  if (rows[0]) return rows[0].id;
  if (DRY_RUN) return -1;
  await mysql`
    INSERT INTO sources (universe, description, link, created_at, updated_at)
    VALUES (${UNIVERSE}, ${SOURCE.description}, ${SOURCE.link}, NOW(), NOW())
  `;
  console.log(`created source ${SOURCE.description}`);
  return ensureSource();
}

async function ensureUnit([short, long]: readonly [
  string,
  string,
]): Promise<number> {
  const rows = await mysql<{ id: number }>`
    SELECT id FROM units
    WHERE universe = ${UNIVERSE} AND short_label = ${short} AND long_label = ${long}
    ORDER BY id LIMIT 1
  `;
  if (rows[0]) return rows[0].id;
  if (DRY_RUN) return -1;
  await mysql`
    INSERT INTO units (universe, short_label, long_label, created_at, updated_at)
    VALUES (${UNIVERSE}, ${short}, ${long}, NOW(), NOW())
  `;
  console.log(`created unit ${short} (${long})`);
  return ensureUnit([short, long]);
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  const geoId = await ensureGeography();
  const sourceId = await ensureSource();
  const unitIds = {} as Record<UnitKey, number>;
  for (const k of Object.keys(UNITS) as UnitKey[]) {
    unitIds[k] = await ensureUnit(UNITS[k]);
  }

  // A load statement is checked against the latest extract when it is
  // saved, so fetch these vectors before adding their loaders.
  if (!DRY_RUN) {
    const only = [
      ...new Set(
        DEFS.map((d) => /series_id: "(v\d+)"/.exec(d.eval)?.[1]).filter(
          (v): v is string => !!v,
        ),
      ),
    ].map((series_id) => ({ series_id }));
    console.log(`fetching ${only.length} StatCan vectors …`);
    const f = await runFetch("statcan", { only, triggeredBy: "cli" });
    console.log(`fetch: ${f.status}`);
    for (const w of (f.stats.warnings as string[] | undefined) ?? [])
      console.log(`  warn: ${w}`);
    if (f.status === "failed") process.exit(1);

    const fred = await runFetch("fred", {
      only: [{ series_id: "EXCAUS", frequency: "M", aggregation: "avg" }],
      triggeredBy: "cli",
    });
    console.log(`fred EXCAUS fetch: ${fred.status}`);
    if (fred.status === "failed") process.exit(1);
  }

  let created = 0;
  let loadersAdded = 0;
  let errors = 0;
  for (const d of DEFS) {
    try {
      const existing = await SeriesCollection.findByNameAndUniverse(
        d.name,
        UNIVERSE,
      );
      if (DRY_RUN) {
        console.log(
          `${existing ? "exists " : "create "} ${d.name.padEnd(14)} ${d.eval}${d.scale ? `  × ${d.scale}` : ""}`,
        );
        continue;
      }
      let seriesId = existing?.id ?? null;
      if (!seriesId) {
        const s = await SeriesCollection.create({
          universe: UNIVERSE,
          name: d.name,
          geographyId: geoId,
          unitId: unitIds[d.unit],
          sourceId,
          sourceLink: d.sourceLink ?? null,
          dataPortalName: d.dataPortalName,
          description: d.description ?? null,
          decimals: d.decimals ?? 1,
          seasonalAdjustment: d.sa,
          real: d.real ?? null,
        });
        seriesId = s.id!;
        created++;
      }
      const loaders = await LoaderCollection.getBySeriesId(seriesId);
      const wanted = [
        { code: d.eval, priority: 100, scale: d.scale ?? 1 },
        ...(EXTRA_LOADERS[d.name] ?? []).map((e) => ({ ...e, scale: 1 })),
      ];
      for (const w of wanted) {
        if (loaders.some((l) => l.eval === w.code)) continue;
        await LoaderCollection.create({
          seriesId,
          code: w.code,
          priority: w.priority,
          scale: w.scale,
          presaveHook: "",
          clearBeforeLoad: false,
          pseudoHistory: false,
          universe: UNIVERSE,
        });
        loadersAdded++;
      }
    } catch (err) {
      console.error(
        `ERR  ${d.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
      errors++;
    }
  }
  if (DRY_RUN) {
    console.log(`\n${DEFS.length} series. Run without --dry-run to create.`);
    process.exit(0);
  }
  console.log(
    `\nseries created: ${created}, loaders added: ${loadersAdded}, errors: ${errors}`,
  );

  if (LOAD && errors === 0) {
    console.log("\nfetching statcan …");
    const f = await runFetch("statcan", { triggeredBy: "cli" });
    console.log(`fetch: ${f.status}`);
    for (const w of (f.stats.warnings as string[] | undefined) ?? [])
      console.log(`  warn: ${w}`);
    // base series first: DEFS lists every series before the aggregates of it
    for (const d of DEFS) {
      const s = await SeriesCollection.findByNameAndUniverse(d.name, UNIVERSE);
      if (!s) continue;
      for (const loader of await LoaderCollection.getEnabledBySeriesId(s.id!)) {
        const res = await LoaderCollection.reload({
          loader,
          clearFirst: false,
        });
        console.log(
          `${res.status.padEnd(7)} ${d.name.padEnd(14)} ${res.message ?? ""}`,
        );
        if (res.status === "error") errors++;
      }
      await DataPointCollection.updatePublicDataPointsForSeries(
        s.id!,
        UNIVERSE,
      );
    }
  }
  process.exit(errors ? 1 : 0);
}

await main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
