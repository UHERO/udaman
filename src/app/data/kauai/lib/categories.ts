/**
 * Kauaʻi Economic Dashboard — category definitions.
 *
 * Ported from the 2014 dashboard's data/<slug>_meta.json (tmp/kauai). Series
 * names follow docs/2026-10-16-kauai-dashboard-analysis.md: `_RCY` income
 * series → `_R`, county budget `…NS` → no-suffix twins (RNS stays). Labels
 * are the old dashboard's display names; units come from the API.
 */
import type { FreqCode } from "@/app/data/[universe]/lib/types";

export type SliceChart = "growth" | "pie" | "treemap" | null;

export interface SeriesNode {
  /** udaman name without frequency, e.g. "E_NF@KAU". */
  name: string;
  label: string;
  /** Shorter label for chart axes / legends. */
  short?: string;
  children?: SeriesNode[];
}

export interface SeriesGroup {
  title: string;
  series: SeriesNode[];
}

export interface Category {
  slug: string;
  title: string;
  defaultFreq: FreqCode;
  freqs: FreqCode[];
  /** Time-slice panel next to the main chart. */
  slice: SliceChart;
  /** Series shown in the slice panel (growth: the three compared; pie/treemap: the parent whose children are sliced). */
  sliceSeries?: string[];
  groups: SeriesGroup[];
  /** Page-specific footnotes (rendered in the footer). */
  footnotes: ("affordability" | "budget")[];
  sources: { label: string; href: string }[];
}

const SRC = {
  dlir: { label: "DLIR", href: "https://www.hiwi.org/" },
  bea: { label: "BEA", href: "https://www.bea.gov/" },
  bls: { label: "BLS", href: "https://www.bls.gov/data/" },
  census: { label: "Census", href: "https://www.census.gov/data.html" },
  hta: {
    label: "HTA",
    href: "https://www.hawaiitourismauthority.org/research/",
  },
  dbedt: { label: "DBEDT", href: "https://dbedt.hawaii.gov/" },
  hospitality: {
    label: "Hospitality Advisors",
    href: "https://www.hospitalityadvisors.com/",
  },
  hbr: { label: "Honolulu Board of Realtors", href: "https://hbrhawaii.com/" },
  locations: { label: "Locations LLC", href: "https://www.locationsllc.com/" },
  uhero: { label: "UHERO", href: "https://uhero.hawaii.edu/" },
  county: {
    label: "County of Kauaʻi ACFR",
    href: "https://www.kauai.gov/Government/Departments-Agencies/Finance",
  },
};

const n = (
  name: string,
  label: string,
  opts: { short?: string; children?: SeriesNode[] } = {},
): SeriesNode => ({ name: `${name}@KAU`, label, ...opts });

export const CATEGORIES: Category[] = [
  {
    slug: "major-indicators",
    title: "Major Indicators",
    defaultFreq: "A",
    freqs: ["A"],
    slice: "growth",
    sliceSeries: ["Y_R@KAU", "VDAY@KAU", "E_NF@KAU"],
    groups: [
      {
        title: "Jobs",
        series: [
          n("E_NF", "Total Non-farm Payrolls", { short: "Non-farm Payrolls" }),
          n("UR", "Unemployment Rate"),
        ],
      },
      {
        title: "Income",
        series: [
          n("Y_R", "Real Personal Income"),
          n("NR", "Population"),
          n("YPC_R", "Real Per-Capita Personal Income", {
            short: "Per-Capita Income",
          }),
        ],
      },
      {
        title: "Visitors",
        series: [
          n("VIS", "Total Visitor Arrivals"),
          n("VDAY", "Total Visitor Days"),
        ],
      },
      {
        title: "Construction and Housing",
        series: [
          n("PMKRSGF", "Median Resale Price, Single-Family Home", {
            short: "Median Resale Price",
          }),
          n("KPPRVRSD_R", "Real Residential Building Permits", {
            short: "Residential Permits",
          }),
          n("ECT", "Construction Jobs"),
        ],
      },
    ],
    footnotes: [],
    sources: [
      SRC.dlir,
      SRC.bea,
      SRC.bls,
      SRC.census,
      SRC.hta,
      { ...SRC.dbedt, label: "State of Hawaiʻi DBEDT" },
    ],
  },
  {
    slug: "visitor-industry",
    title: "Visitor Industry",
    defaultFreq: "Q",
    freqs: ["A", "Q", "M"],
    slice: "pie",
    sliceSeries: ["VIS@KAU"],
    groups: [
      {
        title: "Visitor Arrivals",
        series: [
          n("VIS", "Total Visitor Arrivals", {
            children: [
              n("VISUSW", "US West Visitor Arrivals", { short: "US West" }),
              n("VISUSE", "US East Visitor Arrivals", { short: "US East" }),
              n("VISJP", "Japan Visitor Arrivals", { short: "Japan" }),
              n("VISRES", "Other Visitor Arrivals", { short: "Other" }),
            ],
          }),
        ],
      },
      {
        title: "Visitor Census",
        series: [
          n("VLOS", "Length of Stay"),
          n("VDAY", "Visitor Days"),
          n("PRM", "Average Daily Room Rate", { short: "Avg Daily Room Rate" }),
          n("OCUP%", "Hotel Occupancy Rate"),
        ],
      },
      {
        title: "Visitor Expenditures",
        series: [
          n("VEXP", "Total Visitor Expenditures", {
            short: "Visitor Expenditures",
          }),
        ],
      },
    ],
    footnotes: [],
    sources: [SRC.hta, SRC.hospitality],
  },
  {
    slug: "labor-market",
    title: "Labor Market",
    defaultFreq: "Q",
    freqs: ["A", "Q", "M"],
    slice: "treemap",
    sliceSeries: ["E_NF@KAU"],
    groups: [
      {
        title: "Labor Overview",
        series: [n("EMPL", "Employment"), n("UR", "Unemployment Rate")],
      },
      {
        title: "Total Nonfarm Jobs",
        series: [
          n("E_NF", "Total Nonfarm Jobs", {
            children: [
              n("ECT", "Construction & Mining"),
              n("EMN", "Manufacturing"),
              n("E_TTU", "Trade, Transportation & Utilities", {
                short: "Trade, Trans. & Util.",
                children: [
                  n("E_TU", "Transportation & Utilities"),
                  n("E_TRADE", "Total Trade", {
                    children: [
                      n("ERT", "Retail Trade"),
                      n("EWT", "Wholesale Trade"),
                    ],
                  }),
                ],
              }),
              n("EIF", "Information"),
              n("E_FIR", "Financial Activities", {
                children: [
                  n("EFI", "Finance & Insurance"),
                  n("ERE", "Real Estate & Rental"),
                ],
              }),
              n("E_PBS", "Professional & Business Services", {
                short: "Prof. & Bus. Services",
                children: [
                  n("EPS", "Prof., Scientific & Technical Svcs", {
                    short: "Prof., Sci. & Tech.",
                  }),
                  n("EMA", "Management of Companies"),
                  n("EAD", "Admin. & Waste Management"),
                ],
              }),
              n("E_EDHC", "Educational & Health Services", {
                short: "Ed. & Health Svcs",
                children: [
                  n("EED", "Educational Services"),
                  n("EHC", "Health Care & Social Assistance"),
                ],
              }),
              n("E_LH", "Leisure & Hospitality", {
                children: [
                  n("EAE", "Arts, Entertainment & Recreation"),
                  n("EAF", "Accommodation & Food Services", {
                    children: [
                      n("EAFAC", "Accommodation"),
                      n("EAFFD", "Food Services & Drinking Places"),
                    ],
                  }),
                ],
              }),
              n("EOS", "Other Services"),
              n("EGV", "Government", {
                children: [
                  n("EGVFD", "Federal Government"),
                  n("E_GVSL", "State & Local Government"),
                ],
              }),
            ],
          }),
        ],
      },
    ],
    footnotes: [],
    sources: [SRC.dlir],
  },
  {
    slug: "personal-income",
    title: "Personal Income",
    defaultFreq: "A",
    freqs: ["A"],
    slice: null,
    groups: [
      {
        title: "Personal Income",
        series: [
          n("Y_R", "Real Personal Income", {
            children: [
              n("YLAGFA_R", "Real Farm Earnings"),
              n("YL_NF_R", "Real Nonfarm Earnings"),
              n("YSOCSEC_R", "Real Social Security Contributions"),
              n("YDIV_R", "Real Dividends, Interest & Rent"),
              n("YTRNSF_R", "Real Transfer Payments"),
            ],
          }),
          n("NR", "Resident Population"),
          n("YPC_R", "Real Per-Capita Personal Income", {
            short: "Per-Capita Income",
          }),
        ],
      },
    ],
    footnotes: [],
    sources: [SRC.bea, SRC.bls, SRC.census],
  },
  {
    slug: "construction",
    title: "Construction",
    defaultFreq: "A",
    freqs: ["A", "Q"],
    slice: null,
    groups: [
      {
        title: "Construction Activity",
        series: [
          n("ECT", "Construction Jobs"),
          n("KPPRVRSD_R", "Real Residential Building Permits", {
            short: "Residential Permits",
          }),
        ],
      },
      {
        title: "Home Resales",
        series: [
          n("PMKRSGF", "Median Resale Price, Single-Family Home", {
            short: "Median Price, SF",
          }),
          n("PMKRCON", "Median Resale Price, Condominium", {
            short: "Median Price, Condo",
          }),
          n("KRSGF", "Number of Resales, Single-Family Home", {
            short: "Resales, SF",
          }),
          n("KRCON", "Number of Resales, Condominium", {
            short: "Resales, Condo",
          }),
        ],
      },
      {
        title: "Construction Costs and Affordability",
        series: [
          {
            name: "PICTSGF@HON",
            label: "Honolulu Construction Cost Index",
            short: "Construction Cost Index",
          },
          n("HAI", "Housing Affordability, Single-Family Home", {
            short: "Affordability, SF",
          }),
          n("HAICON", "Housing Affordability, Condominium", {
            short: "Affordability, Condo",
          }),
        ],
      },
    ],
    footnotes: ["affordability"],
    sources: [SRC.dlir, SRC.hbr, SRC.locations, SRC.dbedt, SRC.uhero],
  },
  {
    slug: "county-budget",
    title: "County Budget",
    defaultFreq: "A",
    freqs: ["A"],
    slice: null,
    groups: [
      {
        title: "County Government Revenues",
        series: [
          n("RNS", "Total Revenues", {
            children: [
              n("RT", "Taxes (excluding TAT)"),
              n("ROLCN", "Licenses and Permits"),
              n("ROREN", "Rents and Concessions"),
              n("ROINT", "Interest"),
              n("ROITG", "Intergovernmental (including TAT)"),
              n("ROCHG", "Charges for Current Services"),
              n("ROMIS", "Miscellaneous"),
            ],
          }),
        ],
      },
      {
        title: "County Government Expenditures",
        series: [
          n("G", "Total Expenditures", {
            children: [
              n("GGNG", "General Government"),
              n("GPSF", "Public Safety"),
              n("GPWK", "Public Works"),
              n("GHWY", "Highways and Streets"),
              n("GSAN", "Sanitation"),
              n("GCUL", "Culture and Recreation"),
              n("GPWF", "Public Welfare"),
              n("GCAP", "Capital Outlay"),
              n("GDEB", "Debt Service"),
            ],
          }),
        ],
      },
    ],
    footnotes: ["budget"],
    sources: [SRC.county],
  },
];

export const DEFAULT_CATEGORY = CATEGORIES[0];

export function getCategory(slug: string | undefined): Category | null {
  if (!slug) return DEFAULT_CATEGORY;
  return CATEGORIES.find((c) => c.slug === slug) ?? null;
}

/** Every series name in the category (depth-first, deduped). */
export function categorySeriesNames(cat: Category): string[] {
  const out = new Set<string>();
  const walk = (s: SeriesNode) => {
    out.add(s.name);
    s.children?.forEach(walk);
  };
  cat.groups.forEach((g) => g.series.forEach(walk));
  return [...out];
}

/** Find a node by name anywhere in the category. */
export function findNode(cat: Category, name: string): SeriesNode | null {
  const walk = (list: SeriesNode[]): SeriesNode | null => {
    for (const s of list) {
      if (s.name === name) return s;
      const hit = s.children && walk(s.children);
      if (hit) return hit;
    }
    return null;
  };
  for (const g of cat.groups) {
    const hit = walk(g.series);
    if (hit) return hit;
  }
  return null;
}

/** Parse ?freq= (case-insensitive) against the category's frequencies. */
export function resolveFreq(cat: Category, raw: string | undefined): FreqCode {
  const f = raw?.toUpperCase() as FreqCode | undefined;
  return f && cat.freqs.includes(f) ? f : cat.defaultFreq;
}

export const FREQ_LABEL: Partial<Record<FreqCode, string>> = {
  A: "Annual",
  Q: "Quarterly",
  M: "Monthly",
};
