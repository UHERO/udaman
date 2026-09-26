/**
 * Per-universe portal configuration.
 *
 * Merges what the Angular apps spread across three places:
 *   - projects/<app>/src/main.ts          (rootCategory, portal, logo, defaultRange, GA id)
 *   - projects/<app>/src/assets/app_colors.scss (color scheme)
 *   - shared/services/data-portal-settings.service.ts (behavior per universe)
 *
 * Pure data — safe to import from server and client code, and serializable
 * so the layout can hand it to <PortalConfigProvider>.
 *
 * The registry key is the lowercase universe name used in the URL
 * (`/data/nta`, `/data/fc`; `uhero` is served at `/data`). Unknown-but-valid DB universes get
 * `getPortalConfig(universe)`'s generic default.
 */
import type { DefaultRange, FreqCode } from "./types";

export type PortalSelector = "geography" | "frequency" | "forecast";

/** Category-page data model: geo/freq selectors vs. NTA measurement lists. */
export type CategoryMode = "geoFreq" | "measurement";

export interface PortalConfig {
  /** Lowercase universe slug used in URLs and API `u=` params. */
  universe: string;
  /** Uppercase DB universe name (universes.name). */
  dbUniverse: string;
  title: string;
  /** Short name for the <title> suffix / breadcrumbs. */
  shortTitle: string;
  logo: {
    src: string;
    alt: string;
    /** Intrinsic size (SVG viewBox / bitmap pixels) — next/image aspect ratio. */
    width: number;
    height: number;
    /** Small analytics mark drawn on exported charts (optional). */
    analyticsSrc?: string;
    /**
     * Render an HTML wordmark instead of the `src` image in the header and
     * mobile sidebar (`src` is still used for metadata/Open Graph).
     */
    wordmark?: "uhero-data";
  };
  colors: {
    /** Brand primary — header accents, active nav, links. */
    primary: string;
    /** Secondary accent — badges, highlights. */
    accent: string;
    /** Body text color used by the Angular app. */
    text: string;
    /**
     * Categorical chart palettes, fixed order (a series keeps its slot).
     * Read ONLY through getChartPalette(config, mode) so a user-facing
     * palette setting can switch every chart at once.
     *
     * - `brand`: the Angular portal's Highcharts colors (app_colors.scss
     *   $analyzer-series0..4; slot 0 = $highstock-series0 = brand primary).
     *   Default. Not colorblind-tuned (slot 1 is the series gray).
     * - `accessible`: the earlier dataviz-validated palette (validate_palette.js
     *   vs #fff; slot 5 amber <3:1 contrast → keep a legend/table view).
     *   Kept for a future "colorblind-safe" settings toggle.
     */
    palettes: { brand: string[]; accessible?: string[] };
    /** De-emphasised companion series (YOY/YTD bars behind the level line). */
    chartMuted: string;
  };
  /**
   * Root category id override. Normally derived from the category list (see
   * deriveRootCategoryId); the Angular hardcoded values are kept here as a
   * fallback / tie-breaker.
   */
  rootCategory?: number;
  defaultRange: DefaultRange[];
  /** Show the feedback link/form in the header. */
  feedback: boolean;
  /** Show subcategory (data list) tabs on the category page. */
  categoryTabs: boolean;
  categoryMode: CategoryMode;
  /** Which selectors appear on the category + series pages. */
  selectors: PortalSelector[];
  /** Transformations the portal exposes (toggles, table rows, chart options). */
  transformations: { yoy: boolean; ytd: boolean; mom: boolean; c5ma: boolean };
  /** Single-series table columns (settings.seriesTable). */
  seriesTable: {
    key: "formattedValue" | "formattedYoy" | "formattedYtd" | "formattedC5ma";
    /** Label when series.percent is false. */
    label: string;
    /** Label when series.percent is true (changes are not % changes). */
    percentLabel?: string;
  }[];
  /** Category grid mini charts (settings.highcharts). */
  miniChart: {
    /** The line series (always level). */
    primary: "level";
    /** The companion bar series, or null for level-only. */
    secondary: "ytd" | "yoy" | "c5ma" | null;
    /** Whether the companion series is drawn at all. */
    showSecondary: boolean;
    /** NTA: all charts in a list share one y-range (min/max across series). */
    sharedYAxis: boolean;
  };
  /** Single-series / analyzer big chart (settings.highstock). */
  seriesChart: {
    /** Companion series shown with the level line, in order. */
    companions: ("yoy" | "ytd" | "c5ma")[];
    /** Range buttons in years; "all" = full range. Empty = no buttons. */
    rangeButtons: (number | "all")[];
    /** Credit line on exports. */
    credits: string;
  };
  /** Text used in CSV exports / chart metadata. */
  exportLabels: {
    /** Prepended to analyzer CSVs (catTable.portalSource). */
    portalSource: string;
    /** "Portal name" line in series CSV metadata (highstock.labels.portal). */
    portal: string;
    /** "Data Portal: https://…" line (highstock.labels.portalLink). */
    portalLink: string;
    /** Absolute origin + path of the portal, used to build share/cite links. */
    publicUrl: string;
  };
  /**
   * Allow the date slider to drive charts (settings.sliderInteraction).
   * NTA disables it.
   */
  sliderInteraction: boolean;
  otherDashboardLinks: { name: string; url: string }[];
  googleAnalyticsId?: string;
}

// ─── Shared pieces ──────────────────────────────────────────────────

const STANDARD_RANGES: DefaultRange[] = [
  { freq: "A", range: 10 },
  { freq: "Q", range: 10 },
  { freq: "S", range: 10 },
  { freq: "M", range: 10 },
  { freq: "W", range: 2 },
  { freq: "D", range: 1 },
];

const UHERO_SERIES_TABLE: PortalConfig["seriesTable"] = [
  { key: "formattedValue", label: "Level" },
  {
    key: "formattedYoy",
    label: "Year/Year % Chg",
    percentLabel: "Year/Year Chg",
  },
  {
    key: "formattedYtd",
    label: "Year-to-Date % Chg",
    percentLabel: "Year-to-Date Chg",
  },
];

const MUTED = "#9E9E9E"; // $highstock-series1 (growth bars)
const TEXT = "#505050";

// Brand palettes — the Angular apps' Highcharts colors, in their order:
// app_colors.scss $analyzer-series0..4 (series0 is also $highstock-series0 /
// $highcharts-series0, the single-series + mini-chart line color).
const SERIES_GRAY = "#9E9E9E"; // $series-gray / $highstock-series1
const BRAND_UHERO = ["#1D667F", SERIES_GRAY, "#F6A01B", "#9BBB59", "#8064A2"];
const BRAND_NTA = ["#0068B3", SERIES_GRAY, "#F6A01B", "#008b78", "#8064A2"];
const BRAND_CCOM = ["#2d6c43", SERIES_GRAY, "#F6A01B", "#0279c0", "#8064A2"];

// Accessible palettes (validate_palette.js --mode light --surface #ffffff).
const ACCESSIBLE_UHERO = [
  "#08729e",
  "#eb6834",
  "#008b78",
  "#4a3aa7",
  "#eda100",
];
const ACCESSIBLE_NTA = ["#0068B3", "#eb6834", "#008b78", "#4a3aa7", "#eda100"];
const ACCESSIBLE_CCOM = ["#1e7a3e", "#2a78d6", "#eb6834", "#4a3aa7", "#eda100"];

const PORTAL_ORIGIN = "https://data.uhero.hawaii.edu";

// ─── Registry ───────────────────────────────────────────────────────

export const PORTAL_CONFIGS: Record<string, PortalConfig> = {
  uhero: {
    universe: "uhero",
    dbUniverse: "UHERO",
    title: "UHERO Data Portal",
    shortTitle: "UHERO",
    logo: {
      src: "/data-portal/uhero/UHEROdata-Logo-color.svg",
      wordmark: "uhero-data",
      width: 760,
      height: 126,
      alt: "UHERO Data Portal Logo",
      analyticsSrc: "/data-portal/uhero/Analytics_Logo.svg",
    },
    colors: {
      primary: "#1D667F",
      accent: "#F6A01B",
      text: TEXT,
      palettes: { brand: BRAND_UHERO, accessible: ACCESSIBLE_UHERO },
      chartMuted: MUTED,
    },
    rootCategory: 59,
    defaultRange: STANDARD_RANGES,
    feedback: true,
    categoryTabs: true,
    categoryMode: "geoFreq",
    selectors: ["geography", "frequency"],
    transformations: { yoy: true, ytd: true, mom: true, c5ma: false },
    seriesTable: UHERO_SERIES_TABLE,
    miniChart: {
      primary: "level",
      secondary: "ytd",
      showSecondary: true,
      sharedYAxis: false,
    },
    seriesChart: {
      companions: ["yoy", "ytd"],
      rangeButtons: [1, 5, 10, "all"],
      credits: "data.uhero.hawaii.edu",
    },
    exportLabels: {
      portalSource:
        "The University of Hawaii Economic Research Organization (UHERO) Dataportal: https://data.uhero.hawaii.edu/",
      portal: "The University of Hawaii Economic Research Organization (UHERO)",
      portalLink: "Data Portal: https://data.uhero.hawaii.edu/",
      // UHERO is served at the portal root (see lib/links.ts ROOT_UNIVERSE).
      publicUrl: PORTAL_ORIGIN,
    },
    sliderInteraction: true,
    otherDashboardLinks: [
      {
        name: "UHERO Dashboard Project",
        url: "https://uhero.hawaii.edu/analytics-dashboards/",
      },
    ],
    googleAnalyticsId: "G-RLVNRLYMP5",
  },

  nta: {
    universe: "nta",
    dbUniverse: "NTA",
    title: "National Transfer Accounts Data Portal",
    shortTitle: "NTA",
    logo: {
      src: "/data-portal/nta/nta-logo.svg",
      alt: "NTA Data Portal Logo",
      width: 176,
      height: 126,
    },
    colors: {
      primary: "#0068B3",
      accent: "#008b78",
      text: TEXT,
      palettes: { brand: BRAND_NTA, accessible: ACCESSIBLE_NTA },
      chartMuted: MUTED,
    },
    rootCategory: 2487,
    defaultRange: [{ freq: "A", range: 40, start: "2000", end: "2040" }],
    feedback: false,
    categoryTabs: false,
    categoryMode: "measurement",
    selectors: [],
    transformations: { yoy: false, ytd: false, mom: false, c5ma: true },
    seriesTable: [
      { key: "formattedValue", label: "Level" },
      {
        key: "formattedC5ma",
        label: "Annual % Chg",
        percentLabel: "Annual Chg",
      },
    ],
    miniChart: {
      primary: "level",
      secondary: "c5ma",
      showSecondary: false,
      sharedYAxis: true,
    },
    seriesChart: {
      companions: ["c5ma"],
      rangeButtons: [],
      credits: "data.uhero.hawaii.edu/nta",
    },
    exportLabels: {
      portalSource:
        "National Transfer Accounts (NTA) Dataportal: https://data.uhero.hawaii.edu/nta",
      portal: "National Transfer Accounts (NTA)",
      portalLink: "NTA Dataportal: https://data.uhero.hawaii.edu/nta",
      publicUrl: `${PORTAL_ORIGIN}/nta`,
    },
    sliderInteraction: false,
    otherDashboardLinks: [],
    googleAnalyticsId: "G-7QVQLFEEDE",
  },

  ccom: {
    universe: "ccom",
    dbUniverse: "CCOM",
    title: "Chamber of Commerce Hawaii Data Portal",
    shortTitle: "CCOM",
    logo: {
      // 700KB JPEG from the Angular assets; next/image serves it resized.
      src: "/data-portal/ccom/cochawaii_logo.jpg",
      width: 2399,
      height: 512,
      alt: "Chamber of Commerce Hawaii Logo",
      analyticsSrc: "/data-portal/ccom/Analytics_Logo.svg",
    },
    colors: {
      primary: "#2d6c43",
      accent: "#0279c0",
      text: TEXT,
      palettes: { brand: BRAND_CCOM, accessible: ACCESSIBLE_CCOM },
      chartMuted: MUTED,
    },
    rootCategory: 9911,
    defaultRange: STANDARD_RANGES,
    feedback: true,
    categoryTabs: true,
    categoryMode: "geoFreq",
    selectors: ["geography", "frequency"],
    transformations: { yoy: true, ytd: true, mom: true, c5ma: false },
    seriesTable: UHERO_SERIES_TABLE,
    miniChart: {
      primary: "level",
      secondary: "ytd",
      showSecondary: true,
      sharedYAxis: false,
    },
    seriesChart: {
      companions: ["yoy", "ytd"],
      rangeButtons: [1, 5, 10, "all"],
      credits: "data.uhero.hawaii.edu/ccom",
    },
    exportLabels: {
      portalSource:
        "Chamber of Commerce Hawaii Dataportal: https://data.uhero.hawaii.edu/ccom",
      portal: "Chamber of Commerce Hawaii Dataportal",
      portalLink: "Data Portal: https://data.uhero.hawaii.edu/ccom",
      publicUrl: `${PORTAL_ORIGIN}/ccom`,
    },
    sliderInteraction: true,
    otherDashboardLinks: [],
    googleAnalyticsId: "G-B2RGGWN98L",
  },

  fc: {
    universe: "fc",
    dbUniverse: "FC",
    title: "UHERO Forecast Data Portal",
    shortTitle: "Forecast",
    logo: {
      src: "/data-portal/fc/UHEROdata-Logo-color.svg",
      wordmark: "uhero-data",
      width: 760,
      height: 126,
      alt: "UHERO Data Portal Logo",
      analyticsSrc: "/data-portal/fc/Analytics_Logo.svg",
    },
    colors: {
      primary: "#1D667F",
      accent: "#F6A01B",
      text: TEXT,
      palettes: { brand: BRAND_UHERO, accessible: ACCESSIBLE_UHERO },
      chartMuted: MUTED,
    },
    // Angular hardcoded 11494, but the live API's top-level FC categories
    // hang off 11824. Derivation handles it; no override needed.
    defaultRange: STANDARD_RANGES,
    feedback: false,
    categoryTabs: false,
    categoryMode: "geoFreq",
    selectors: ["geography", "frequency", "forecast"],
    transformations: { yoy: true, ytd: true, mom: true, c5ma: false },
    seriesTable: UHERO_SERIES_TABLE,
    miniChart: {
      primary: "level",
      secondary: "ytd",
      showSecondary: true,
      sharedYAxis: false,
    },
    seriesChart: {
      companions: ["yoy", "ytd"],
      rangeButtons: [1, 5, 10, "all"],
      credits: "data.uhero.hawaii.edu/fc",
    },
    exportLabels: {
      portalSource:
        "The University of Hawaii Economic Research Organization (UHERO) Forecast Data Portal: https://data.uhero.hawaii.edu/fc/",
      portal:
        "The University of Hawaii Economic Research Organization (UHERO) Forecast",
      portalLink:
        "UHERO Forecast Data Portal: https://data.uhero.hawaii.edu/fc",
      publicUrl: `${PORTAL_ORIGIN}/fc`,
    },
    sliderInteraction: true,
    otherDashboardLinks: [
      {
        name: "Hawai'i High Frequency Economic Data",
        url: "https://data.uhero.hawaii.edu/high-frequency-dashboard/#/",
      },
    ],
  },
};

/** URL aliases → canonical slug (old Angular app was deployed as /forecast). */
export const UNIVERSE_ALIASES: Record<string, string> = {
  forecast: "fc",
};

/** Normalize a URL segment to a canonical lowercase universe slug. */
export function canonicalUniverse(slug: string): string {
  const lower = slug.toLowerCase();
  return UNIVERSE_ALIASES[lower] ?? lower;
}

/**
 * Config for a universe. Unknown universes (valid in the DB but not in the
 * registry) get the UHERO behavior with a generic title/logo.
 */
export function getPortalConfig(universe: string): PortalConfig {
  const slug = canonicalUniverse(universe);
  const known = PORTAL_CONFIGS[slug];
  if (known) return known;
  const base = PORTAL_CONFIGS.uhero;
  const upper = slug.toUpperCase();
  return {
    ...base,
    universe: slug,
    dbUniverse: upper,
    title: `${upper} Data Portal`,
    shortTitle: upper,
    logo: { ...base.logo, alt: `${upper} Data Portal` },
    rootCategory: undefined,
    feedback: false,
    exportLabels: {
      portalSource: `${upper} Data Portal: ${PORTAL_ORIGIN}/${slug}`,
      portal: `${upper} Data Portal`,
      portalLink: `Data Portal: ${PORTAL_ORIGIN}/${slug}`,
      publicUrl: `${PORTAL_ORIGIN}/${slug}`,
    },
    otherDashboardLinks: [],
    googleAnalyticsId: undefined,
  };
}

/** Default range entry for a frequency (falls back to 10 years). */
export function getDefaultRange(
  config: PortalConfig,
  freq: FreqCode,
): DefaultRange {
  return (
    config.defaultRange.find((r) => r.freq === freq) ?? { freq, range: 10 }
  );
}

export type ChartPaletteMode = "brand" | "accessible";

/**
 * The categorical chart palette for a universe. Every chart reads colors
 * through this (via chart-theme's seriesColor/chartPalette). `accessible`
 * falls back to `brand` when a universe has none.
 */
export function getChartPalette(
  config: PortalConfig,
  mode: ChartPaletteMode = "brand",
): string[] {
  const { palettes } = config.colors;
  return (
    (mode === "accessible" ? palettes.accessible : undefined) ?? palettes.brand
  );
}
