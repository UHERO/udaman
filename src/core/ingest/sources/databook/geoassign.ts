/**
 * Geography assignment for Data Book cells (plan §2.2): find the geography
 * anywhere in a cell's labels and take it out of the measurement identity,
 * so one measurement = one metric across every county, island, the state
 * and the U.S.
 *
 * Geographies are read per "axis" — the panel labels, the row labels or the
 * column labels of one table panel — because bare names are ambiguous and
 * only their siblings disambiguate them:
 *  - "Hawaii" is HAW next to Honolulu/Maui/Kauai counties, HAWI next to
 *    Oahu/Molokai/Lanai islands, and HI next to "United States".
 *  - "U.S. total" is the U.S. only when Hawaii or a county/island is a
 *    sibling; next to "U.S. West", "Japan", "Canada" it is a visitor market.
 *
 * A label can be a geography outright ("Oahu", "Hawaii County [a]",
 * "Hawaii total") or carry one at its start or end ("All exemptions,
 * Statewide", "Oahu: male", "CPI-U Honolulu"); the latter only counts when
 * the remainder is shared with at least one other geography in the axis.
 */
import type { IRCell } from "./ir";
import { labelKey } from "./labels";

type Kind = "state" | "us" | "county" | "island" | "ambiguous";

interface Vocab {
  kind: Kind;
  /** Handle for unambiguous names; for ambiguous ones see AMBIGUOUS. */
  handle: string;
}

const V = (kind: Kind, handle: string): Vocab => ({ kind, handle });

/** Label key → geography. Keys are `labelKey` forms. */
const VOCAB: Record<string, Vocab> = {
  // State
  "state total": V("state", "HI"),
  state: V("state", "HI"),
  "state of hawaii": V("state", "HI"),
  "state of hawaii total": V("state", "HI"),
  statewide: V("state", "HI"),
  "hawaii state": V("state", "HI"),
  "hawaii state total": V("state", "HI"),
  "total state": V("state", "HI"),
  "entire state": V("state", "HI"),
  "all counties": V("state", "HI"),
  "hawaii total": V("state", "HI"),
  "hawaii statewide": V("state", "HI"),
  "total hawaii": V("state", "HI"),
  "state average": V("state", "HI"),
  "state median": V("state", "HI"),
  "statewide average": V("state", "HI"),
  // United States
  "united states": V("us", "US"),
  "united states total": V("us", "US"),
  "u s": V("us", "US"),
  us: V("us", "US"),
  "u s total": V("us", "US"),
  "us total": V("us", "US"),
  "u s average": V("us", "US"),
  "us average": V("us", "US"),
  "united states average": V("us", "US"),
  "u s city average": V("us", "US"),
  "us city average": V("us", "US"),
  nation: V("us", "US"),
  "national total": V("us", "US"),
  // Counties
  "city and county of honolulu": V("county", "HON"),
  "city county of honolulu": V("county", "HON"),
  "c and c of honolulu": V("county", "HON"),
  "honolulu county": V("county", "HON"),
  "county of honolulu": V("county", "HON"),
  "honolulu city and county": V("county", "HON"),
  "urban honolulu": V("county", "HON"),
  "hawaii county": V("county", "HAW"),
  "county of hawaii": V("county", "HAW"),
  "kauai county": V("county", "KAU"),
  "county of kauai": V("county", "KAU"),
  "maui county": V("county", "MAU"),
  "county of maui": V("county", "MAU"),
  "maui county including kalawao": V("county", "MAU"),
  "maui and kalawao counties": V("county", "MAU"),
  "maui and kalawao": V("county", "MAU"),
  // Islands
  oahu: V("island", "OAHU"),
  "oahu island": V("island", "OAHU"),
  "island of oahu": V("island", "OAHU"),
  "hawaii island": V("island", "HAWI"),
  "island of hawaii": V("island", "HAWI"),
  "big island": V("island", "HAWI"),
  "maui island": V("island", "MAUI"),
  "island of maui": V("island", "MAUI"),
  molokai: V("island", "MOL"),
  "molokai island": V("island", "MOL"),
  lanai: V("island", "LAN"),
  "lanai island": V("island", "LAN"),
  "kauai island": V("island", "KAUI"),
  "island of kauai": V("island", "KAUI"),
  niihau: V("island", "NII"),
  "niihau island": V("island", "NII"),
  kahoolawe: V("island", "KAHO"),
  // Ambiguous bare names, resolved by siblings
  hawaii: V("ambiguous", "hawaii"),
  maui: V("ambiguous", "maui"),
  kauai: V("ambiguous", "kauai"),
  // A bare "Honolulu" is also a harbor, an airport, a weather station: it
  // is the county only next to other counties/islands.
  honolulu: V("ambiguous", "honolulu"),
};

const AMBIGUOUS: Record<
  string,
  { county: string; island: string; state?: string }
> = {
  hawaii: { county: "HAW", island: "HAWI", state: "HI" },
  maui: { county: "MAU", island: "MAUI" },
  kauai: { county: "KAU", island: "KAUI" },
  honolulu: { county: "HON", island: "HON" },
};

/** Kalawao is folded into Maui County (plan decision); its own rows are dropped. */
const KALAWAO = new Set(["kalawao", "kalawao county"]);

/** Panel labels that only name the kind of geography shown ("County", "Island"). */
const GEO_TYPE =
  /^(by )?(county|counties|island|islands|county and island|island and county|counties and islands|islands and counties|geography|geographic area|area|location|state and county|state and counties|county or island)$/;

const STATE_NAMES = new Set([
  "alabama",
  "alaska",
  "arizona",
  "arkansas",
  "california",
  "colorado",
  "connecticut",
  "delaware",
  "district of columbia",
  "florida",
  "georgia",
  "idaho",
  "illinois",
  "indiana",
  "iowa",
  "kansas",
  "kentucky",
  "louisiana",
  "maine",
  "maryland",
  "massachusetts",
  "michigan",
  "minnesota",
  "mississippi",
  "missouri",
  "montana",
  "nebraska",
  "nevada",
  "new hampshire",
  "new jersey",
  "new mexico",
  "new york",
  "north carolina",
  "north dakota",
  "ohio",
  "oklahoma",
  "oregon",
  "pennsylvania",
  "rhode island",
  "south carolina",
  "south dakota",
  "tennessee",
  "texas",
  "utah",
  "vermont",
  "virginia",
  "washington",
  "west virginia",
  "wisconsin",
  "wyoming",
]);

const INSTITUTION =
  /\b(college|university|school|academy|hospital|medical center|association|museum|airport|harbor|company|corporation|bank|church|foundation|club|theatre|theater|zoo|library)\b/i;

/** Residues that just restate the geography ("Hawaii total", "Honolulu County"). */
const TRIVIAL_RESIDUE =
  /^(total|totals|all|county|island|total county|county total|island total)$/;

export interface GeoHit {
  handle: string;
  /** What remains of the label without the geography ("" when the label is only a geography). */
  residue: string;
}

interface Candidate {
  vocab: Vocab;
  key: string;
  residue: string;
  /** Where the geography phrase sits in the label. */
  at: "exact" | "start" | "end";
  /** Separated from the rest by ":", ",", "-", "(" … rather than just a space. */
  delimited: boolean;
  /**
   * A bare "state" run into other words ("Industry state", "State by
   * year"): only a geography when another geography shares the rest.
   */
  weak?: boolean;
}

/**
 * Label → key for geography lookup: drops the "(2)" the adapters add to
 * repeated labels ("Honolulu (2)") and Kalawao notes ("Maui County (incl.
 * Kalawao)").
 */
function geoKey(label: string): string {
  return labelKey(
    label
      .replace(/\s*\(\d{1,2}\)\s*$/, "")
      // "Hawaii - HI", "District of Columbia - D.C."
      .replace(/\s+-\s+[A-Z]\.?\s?[A-Z]\.?$/, ""),
  ).replace(/\s+(incl|including|includes)\s+kalawao$/, "");
}

/** Loose regex for a geography key inside original text ("u s" ~ "U.S.", "U. S."). */
function geoPattern(geoKey: string): string {
  // Short words may be written with dots ("us" ~ "U.S.", "u s" ~ "U. S.").
  return geoKey
    .split(" ")
    .map((w) =>
      w.length <= 3 ? w.split("").map(esc).join("[^A-Za-z0-9]*") : esc(w),
    )
    .join("[^A-Za-z0-9]*");
}

const DELIM = "[:,;(/\\u2013-]";

/** Exact or start/end geography phrase in a label. */
function candidatesFor(label: string): Candidate[] {
  const key = geoKey(label);
  const out: Candidate[] = [];
  if (VOCAB[key])
    out.push({
      vocab: VOCAB[key],
      key,
      residue: "",
      at: "exact",
      delimited: true,
    });
  const words = key.split(" ");
  // Longest geography phrase at the start or the end (max 6 words). A bare
  // "state" is too generic to split off ("State government").
  for (let n = Math.min(6, words.length - 1); n >= 1; n--) {
    const head = words.slice(0, n).join(" ");
    const tail = words.slice(words.length - n).join(" ");
    if (VOCAB[head]) {
      const g = geoPattern(head);
      const delimited = new RegExp(`^\\s*${g}\\.?\\s*${DELIM}`, "i").test(
        label,
      );
      // A leading bare "State" counts when delimited ("State: male");
      // otherwise ("State government", "State by year") only if shared.
      out.push({
        vocab: VOCAB[head],
        key: head,
        residue: words.slice(n).join(" "),
        at: "start",
        delimited,
        weak: head === "state" && !delimited,
      });
    }
    const rest0 = words.slice(0, words.length - n);
    // "… for State" / "… in State" is a geography; "Private state" isn't.
    const weak =
      tail === "state" &&
      !["for", "in", "of"].includes(rest0[rest0.length - 1] ?? "");
    if (VOCAB[tail]) {
      const rest = words.slice(0, words.length - n);
      while (
        rest.length &&
        ["in", "for", "of", "from", "at"].includes(rest[rest.length - 1])
      )
        rest.pop();
      const g = geoPattern(tail);
      out.push({
        vocab: VOCAB[tail],
        key: tail,
        residue: rest.join(" "),
        at: "end",
        delimited: new RegExp(
          `${DELIM}\\s*(?:(?:in|for|of|from|at)\\s+)?${g}\\.?\\s*\\)?\\s*$`,
          "i",
        ).test(label),
        weak,
      });
    }
  }
  return out
    .map((c) => (TRIVIAL_RESIDUE.test(c.residue) ? { ...c, residue: "" } : c))
    .filter((c) => {
      // "Hawaii, Kauai, Oahu" names several places: not one geography.
      if (!c.residue) return true;
      // "Hawaii Community College", "Honolulu Museum of Art": names of
      // institutions, not a metric for a place.
      if (INSTITUTION.test(c.residue)) return false;
      return !c.residue
        .split(" ")
        .some((w, i, ws) =>
          [1, 2, 3].some(
            (len) =>
              VOCAB[ws.slice(i, i + len).join(" ")]?.kind &&
              ws.slice(i, i + len).join(" ") !== "state",
          ),
        );
    });
}

/**
 * Resolve every label of one axis. Returns label → hit for the labels that
 * are geographies in this context.
 */
export function resolveAxis(labels: string[]): Map<string, GeoHit> {
  const distinct = [...new Set(labels.filter(Boolean))];
  const keys = distinct.map(geoKey);
  const out = new Map<string, GeoHit>();

  // "By state" axis: only Hawaii and the U.S. are kept as geographies.
  if (keys.filter((k) => STATE_NAMES.has(k)).length >= 20) {
    distinct.forEach((l, i) => {
      if (keys[i] === "hawaii") out.set(l, { handle: "HI", residue: "" });
      else if (VOCAB[keys[i]]?.kind === "us")
        out.set(l, { handle: "US", residue: "" });
    });
    return out;
  }

  const cands = distinct.map((l) => candidatesFor(l));
  const kinds = new Set(cands.flat().map((c) => c.vocab.kind));
  const islandMode = kinds.has("island");
  const countyMode = kinds.has("county");
  // "Oahu" listed with Maui/Hawaii/Kauai counties (and no other island,
  // no Honolulu County) stands for Honolulu County.
  const all = cands.flat();
  const oahuIsCounty =
    countyMode &&
    !all.some((c) => c.vocab.kind === "county" && c.vocab.handle === "HON") &&
    !all.some((c) => c.vocab.kind === "island" && c.vocab.handle !== "OAHU");
  const explicitCounties = new Set(
    all
      .filter((c) => c.vocab.kind === "county" && !c.residue)
      .map((c) => c.vocab.handle),
  );
  const resolve = (c: Candidate): string => {
    if (c.vocab.handle === "OAHU" && oahuIsCounty) return "HON";
    if (c.vocab.kind !== "ambiguous") return c.vocab.handle;
    const a = AMBIGUOUS[c.vocab.handle];
    if (islandMode && !countyMode) return a.island;
    // "Maui County total" followed by "Lanai", "Maui", "Molokai": with the
    // county already named, the bare name is its island.
    if (countyMode)
      return explicitCounties.has(a.county) && !c.weak ? a.island : a.county;
    if (kinds.has("us") && a.state) return a.state;
    return a.county;
  };

  // Pick each label's best candidate: an exact geography first, then a
  // start/end phrase that is either shared by another geography ("All
  // exemptions, Statewide" / "…, Oahu") or part of a consistent pattern —
  // two or more labels with different geographies at the same end of the
  // label ("Oahu: male", "Oahu: female", "Maui: male").
  const residueGeos = new Map<string, Set<string>>();
  const positionGeos = { start: new Set<string>(), end: new Set<string>() };
  const positionCount = { start: 0, end: 0 };
  distinct.forEach((_, i) => {
    const seen = new Set<string>();
    for (const c of cands[i]) {
      if (!c.residue || c.at === "exact") continue;
      const s = residueGeos.get(c.residue) ?? new Set<string>();
      s.add(resolve(c));
      residueGeos.set(c.residue, s);
      positionGeos[c.at].add(resolve(c));
      if (!seen.has(c.at)) positionCount[c.at]++;
      seen.add(c.at);
    }
  });
  const patterned = (c: Candidate) =>
    !c.weak &&
    c.at !== "exact" &&
    c.delimited &&
    positionCount[c.at] >= 2 &&
    positionGeos[c.at].size >= 2;
  distinct.forEach((l, i) => {
    const exact = cands[i].find((c) => !c.residue);
    if (exact) {
      out.set(l, { handle: resolve(exact), residue: "" });
      return;
    }
    const shared =
      cands[i].find((c) => (residueGeos.get(c.residue)?.size ?? 0) >= 2) ??
      cands[i].find((c) => c.residue && patterned(c));
    if (shared)
      out.set(l, {
        handle: resolve(shared),
        residue: originalResidue(l, shared.key),
      });
  });

  // An axis needs at least two distinct geographies. The U.S. only counts
  // next to Hawaii or one of its counties/islands (otherwise it is a
  // visitor market: "U.S. total" beside "U.S. West", "Japan").
  const handles = new Set([...out.values()].map((h) => h.handle));
  const local = [...handles].some((h) => h !== "US");
  if (!local) for (const [l, h] of out) if (h.handle === "US") out.delete(l);
  // A bare "Total" next to county/island geographies is the state total
  // ("Total" | "City & County of Honolulu" | "Other counties").
  const hasLocal = [...out.values()].some(
    (h) => !["HI", "US"].includes(h.handle),
  );
  const hasState = [...out.values()].some((h) => h.handle === "HI");
  if (hasLocal && !hasState) {
    const total = distinct.find((l) =>
      /^(total|all|all areas|all counties)$/.test(labelKey(l)),
    );
    if (total) out.set(total, { handle: "HI", residue: "" });
  }

  // With fewer than two geographies, only exact, unambiguous state /
  // county / island labels survive ("City & County of Honolulu" beside
  // "Total", "Other counties"; "Oahu total" over neighborhoods). Composite
  // phrases, bare "Hawaii"/"Maui"/"Kauai" and a lone U.S. need siblings.
  if (new Set([...out.values()].map((h) => h.handle)).size < 2) {
    distinct.forEach((l, i) => {
      if (!out.has(l)) return;
      const exact =
        cands[i].find((c) => !c.residue && c.at === "exact") ??
        cands[i].find((c) => !c.residue);
      const k = exact?.vocab.kind;
      if (!(k === "state" || k === "county" || k === "island")) out.delete(l);
    });
  }
  return out;
}

/** The label text without the geography phrase, keeping the original casing. */
function originalResidue(label: string, geoKey: string): string {
  const g = geoPattern(geoKey);
  const tries = [
    new RegExp(`\\s*\\(\\s*${g}\\.?\\s*\\)\\s*$`, "i"), // "First (Oahu)"
    new RegExp(
      `[\\s:,;\\u2013-]*(?:\\b(?:in|for|of|from|at)\\s+)?\\b${g}\\.?\\s*$`,
      "i",
    ),
    new RegExp(`^\\s*${g}\\.?[\\s:,;\\u2013-]*`, "i"),
  ];
  for (const re of tries) {
    const kept = label.replace(re, "");
    if (kept !== label) return kept.trim();
  }
  return label.trim();
}

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** ≥20 U.S. state names: a "by state" comparison axis. */
export function isByStateAxis(labels: string[]): boolean {
  return (
    new Set(labels.map(geoKey).filter((k) => STATE_NAMES.has(k))).size >= 20
  );
}

export function isGeoTypePanel(label: string): boolean {
  return GEO_TYPE.test(labelKey(label));
}

export function isKalawao(label: string): boolean {
  return KALAWAO.has(labelKey(label));
}

export interface AssignedCell {
  cell: IRCell;
  geo: string;
  /** Panel label with any geography removed ("" for geo-type labels). */
  panelDim: string;
  rowDims: string[];
  colDims: string[];
}

/**
 * Percent-change columns ("Population (percent change)", "Hawaii percent
 * change"): udaman derives these from the level series, so they are not
 * loaded.
 */
const CHANGE = /\b(percent|percentage|pct|%)\s*change\b/i;

export function isChangeLabel(label: string): boolean {
  return CHANGE.test(label);
}

/**
 * Panel labels that only say how the panel is cut by period or geography
 * ("Year", "Date", "State by year", "County: 2024", "Honolulu County by
 * year" once the geography is out) carry no metric.
 */
const STRUCTURAL_WORD =
  /^(by|year|years|date|dates|period|annual|calendar|fiscal|county|counties|island|islands|state|and|or|of|for|as|end|\d{4}|\d{4} \d{2,4})$/;

function structuralPanel(label: string): boolean {
  const k = labelKey(label);
  return !!k && k.split(" ").every((w) => STRUCTURAL_WORD.test(w));
}

/**
 * A table whose title names one county or island ("…, for Oahu", "…Oahu
 * Neighborhoods", "Honolulu Construction Cost Indexes") is about that
 * place: cells without a geography of their own get it instead of HI.
 * Titles comparing places ("for the State and Oahu", "Honolulu and the
 * United States", "between Honolulu and …") don't.
 */
const TITLE_GEO: Array<[RegExp, string]> = [
  [
    /\b(city and county of honolulu|urban honolulu|metropolitan honolulu|honolulu metropolitan|downtown honolulu|honolulu area|honolulu police department|honolulu construction|(for|in) honolulu)\b/i,
    "HON",
  ],
  [/\b(oahu neighborhoods|(for|on|in) oahu)\b/i, "OAHU"],
  [/\bfor maui county\b/i, "MAU"],
  [/\bfor hawaii county\b/i, "HAW"],
  [/\bfor kauai county\b/i, "KAU"],
];
const TITLE_COMPARE =
  /\b(state and|and the (united states|u\.?\s?s\.?|median|average|nation)|between|airports|selected destinations)\b/i;

export function titleGeo(title: string): string | null {
  if (TITLE_COMPARE.test(title)) return null;
  const hits = TITLE_GEO.filter(([re]) => re.test(title)).map(([, h]) => h);
  return hits.length === 1 ? hits[0] : null;
}

/** Sheet position of a cell: 0-based column and 1-based row. */
function cellPos(addr: string): { col: number; row: number } {
  const m = addr.match(/!\$?([A-Z]+)\$?(\d+)$/);
  if (!m) return { col: 0, row: 0 };
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col: col - 1, row: Number(m[2]) };
}

const TOTALISH = /\b(total|all|state|statewide|average|median)\b/i;

/**
 * State columns/rows labelled with the metric instead of "State":
 *
 *   Census date | Population (number) | Honolulu County | Hawaii County | …
 *   Index Offenses, total / Honolulu / Hawaii / Kauai / Maui
 *   Total county debt | County debt Honolulu | County debt Maui | …
 *
 * A run of ≥2 sibling county/island labels (same parent, adjacent in the
 * sheet, same remainder, no state among them) preceded by a non-geography
 * label: that label is the state figure of the same metric. It qualifies
 * when it reads as a total ("…total", "All …", "State average") or is the
 * first label of its siblings. Percent-change labels in between are
 * skipped. Returns overrides keyed by `parent \u0001 label`.
 */
function headerRuns(
  paths: Array<{ path: string[]; pos: number }>,
  lookup: (label: string, depth: number) => GeoHit | undefined,
): Map<string, GeoHit> {
  const out = new Map<string, GeoHit>();
  const byParent = new Map<string, Map<string, number>>();
  for (const { path, pos } of paths) {
    if (path.length === 0) continue;
    const parent = path.slice(0, -1).join("\u0001");
    const leaf = path[path.length - 1];
    const sibs = byParent.get(parent) ?? new Map<string, number>();
    sibs.set(leaf, Math.min(sibs.get(leaf) ?? Infinity, pos));
    byParent.set(parent, sibs);
  }
  for (const [parent, sibs] of byParent) {
    const depth = parent ? parent.split("\u0001").length : 0;
    const items = [...sibs.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([label]) => ({ label, hit: lookup(label, depth) }));
    const firstData = items.findIndex((x) => !isChangeLabel(x.label));
    let i = 0;
    while (i < items.length) {
      const h = items[i].hit;
      if (!h || h.handle === "HI" || h.handle === "US") {
        i++;
        continue;
      }
      const residue = labelKey(h.residue);
      let j = i;
      while (
        j < items.length &&
        items[j].hit &&
        !["HI", "US"].includes(items[j].hit!.handle) &&
        labelKey(items[j].hit!.residue) === residue
      )
        j++;
      const run = items.slice(i, j);
      if (new Set(run.map((x) => x.hit!.handle)).size >= 2) {
        let k = i - 1;
        while (k >= 0 && isChangeLabel(items[k].label)) k--;
        const head = k >= 0 ? items[k] : null;
        if (
          head &&
          !head.hit &&
          (TOTALISH.test(head.label) || k === firstData)
        ) {
          const metric = run[0].hit!.residue || head.label;
          out.set(`${parent}\u0001${head.label}`, {
            handle: "HI",
            residue: metric,
          });
          for (const x of run)
            out.set(`${parent}\u0001${x.label}`, {
              handle: x.hit!.handle,
              residue: metric,
            });
        }
      }
      i = j;
    }
  }
  return out;
}

const COUNTIES = new Set(["HON", "HAW", "KAU", "MAU"]);

/** Nesting rank: state/nation 0, county 1, island 2. */
function geoRank(handle: string): number {
  if (handle === "HI" || handle === "US") return 0;
  return COUNTIES.has(handle) ? 1 : 2;
}

export interface AssignOptions {
  /** Table title, for a single-place table's default geography. */
  title?: string;
}

/**
 * Assign a geography to every cell of one table. `panelLabel(cell)` gives the
 * (identity) label of the cell's panel. Cells that are not loaded (Kalawao,
 * other states, percent changes) are left out.
 */
export function assignGeographies(
  cells: IRCell[],
  panelLabel: (c: IRCell) => string,
  opts: AssignOptions = {},
): AssignedCell[] {
  cells = cells.filter(
    (c) => ![...c.rowPath, ...c.colPath].some(isChangeLabel),
  );
  const fallbackGeo = (opts.title && titleGeo(opts.title)) || "HI";
  // Axes are resolved per panel for rows/columns (a "County" panel and an
  // "Island" panel read "Hawaii" differently), and table-wide for panels.
  const byPanel = new Map<number, IRCell[]>();
  for (const c of cells)
    byPanel.set(c.panel, [...(byPanel.get(c.panel) ?? []), c]);
  const panelAxis = resolveAxis([...new Set(cells.map(panelLabel))]);
  // A panel's own resolution wins (context matters for bare names); a
  // label it couldn't resolve — e.g. a "State of Hawaii" row alone in its
  // panel — falls back to the table-wide resolution.
  const tableRows = resolveAxis(cells.flatMap((c) => c.rowPath));
  const tableCols = resolveAxis(cells.flatMap((c) => c.colPath));
  const withFallback = (
    own: Map<string, GeoHit>,
    table: Map<string, GeoHit>,
  ) => {
    const m = new Map(table);
    for (const [k, v] of own) m.set(k, v);
    return m;
  };
  interface Axis {
    /** Labels resolved among their siblings at the same nesting level. */
    byDepth: Map<number, Map<string, GeoHit>>;
    /** Whole-axis (then table-wide) resolution, for labels a level can't resolve alone. */
    hits: Map<string, GeoHit>;
    runs: Map<string, GeoHit>;
    /** Distinct geographies on this axis: the richer axis wins a conflict. */
    breadth: number;
  }
  const makeAxis = (
    pc: IRCell[],
    pathOf: (c: IRCell) => string[],
    posOf: (c: IRCell) => number,
    table: Map<string, GeoHit>,
  ): Axis => {
    const hits = withFallback(resolveAxis(pc.flatMap(pathOf)), table);
    // "Hawaii", "Maui", "Oahu", "Lanai" listed together are islands even
    // when a place nested under one of them is "Urban Honolulu".
    const maxDepth = Math.max(0, ...pc.map((c) => pathOf(c).length));
    const byDepth = new Map<number, Map<string, GeoHit>>();
    for (let d = 0; d < maxDepth; d++)
      byDepth.set(
        d,
        resolveAxis(pc.map((c) => pathOf(c)[d]).filter((l) => l != null)),
      );
    const lookup = (label: string, depth: number) =>
      byDepth.get(depth)?.get(label) ?? hits.get(label);
    const runs = headerRuns(
      pc.map((c) => ({ path: pathOf(c), pos: posOf(c) })),
      lookup,
    );
    const used = new Set<string>();
    for (const c of pc)
      pathOf(c).forEach((l, d) => {
        const h = lookup(l, d);
        if (h) used.add(h.handle);
      });
    return { byDepth, hits, runs, breadth: used.size };
  };
  const rowAxis = new Map<number, Axis>();
  const colAxis = new Map<number, Axis>();
  for (const [p, pc] of byPanel) {
    rowAxis.set(
      p,
      makeAxis(
        pc,
        (c) => c.rowPath,
        (c) => cellPos(c.cellAddr).row,
        tableRows,
      ),
    );
    colAxis.set(
      p,
      makeAxis(
        pc,
        (c) => c.colPath,
        (c) => cellPos(c.cellAddr).col,
        tableCols,
      ),
    );
  }
  // "By state" lists keep only Hawaii and the U.S.: other states' cells
  // are not Hawaii data and have no geography in this universe.
  const otherStates = new Set(
    [
      ...(isByStateAxis(cells.flatMap((c) => c.rowPath))
        ? cells.flatMap((c) => c.rowPath)
        : []),
      ...(isByStateAxis(cells.flatMap((c) => c.colPath))
        ? cells.flatMap((c) => c.colPath)
        : []),
    ].filter((l) => STATE_NAMES.has(geoKey(l))),
  );

  const rawHitAt = (path: string[], i: number, axis: Axis) =>
    axis.runs.get(`${path.slice(0, i).join("\u0001")}\u0001${path[i]}`) ??
    axis.byDepth.get(i)?.get(path[i]) ??
    axis.hits.get(path[i]);
  // A geography nested under another must be smaller than it: a county
  // under an island ("Oahu > Urban Honolulu" census place) or a second
  // county under a county is a place name, kept as a dimension.
  const hitsOf = (path: string[], axis: Axis) => {
    let outer = -1;
    return path.map((_, i) => {
      const hit = rawHitAt(path, i, axis);
      if (!hit) return undefined;
      const r = geoRank(hit.handle);
      if (outer >= 0 && r <= outer && outer > 0) return undefined;
      outer = Math.max(outer, r);
      return hit;
    });
  };
  const strip = (path: string[], axis: Axis) => {
    const hits = hitsOf(path, axis);
    const dims = path
      .map((l, i) => (hits[i] ? hits[i]!.residue : l))
      .filter(Boolean);
    // "Total home sales statewide > Total home sales Honolulu County"
    // leaves the same remainder twice.
    return dims.filter(
      (d, i) => i === 0 || labelKey(d) !== labelKey(dims[i - 1]),
    );
  };
  const deepest = (path: string[], axis: Axis) => {
    const hits = hitsOf(path, axis);
    for (let i = path.length - 1; i >= 0; i--)
      if (hits[i]) return hits[i]!.handle;
    return null;
  };

  const out: AssignedCell[] = [];
  for (const cell of cells) {
    if ([...cell.rowPath, ...cell.colPath].some(isKalawao)) continue;
    if ([...cell.rowPath, ...cell.colPath].some((l) => otherStates.has(l)))
      continue;
    const pl = panelLabel(cell);
    const rows = rowAxis.get(cell.panel)!;
    const cols = colAxis.get(cell.panel)!;

    // Most specific geography wins: the deepest label of the row or column
    // path — of the axis listing more geographies when both name one
    // ("Government - State total" × Oahu/Maui/… columns) — then the panel.
    const rg = deepest(cell.rowPath, rows);
    const cg = deepest(cell.colPath, cols);
    const both = !!rg && !!cg;
    const useCol = both ? cols.breadth > rows.breadth : !rg && !!cg;
    const geo = (useCol ? cg : rg) ?? panelAxis.get(pl)?.handle ?? fallbackGeo;
    // The losing axis keeps its labels as dimensions.
    const rowDims = both && useCol ? cell.rowPath : strip(cell.rowPath, rows);
    const colDims = both && !useCol ? cell.colPath : strip(cell.colPath, cols);

    const panelHit = panelAxis.get(pl);
    const panelResidue = panelHit ? panelHit.residue : pl;
    const panelDim =
      isGeoTypePanel(pl) || structuralPanel(panelResidue) ? "" : panelResidue;
    out.push({ cell, geo, panelDim, rowDims, colDims });
  }
  return out;
}

/** DATABOOK geographies the assignment can produce (for apply). */
export const GEO_HANDLES = [
  "HI",
  "HON",
  "HAW",
  "KAU",
  "MAU",
  "OAHU",
  "HAWI",
  "MAUI",
  "MOL",
  "LAN",
  "KAUI",
  "NII",
  "KAHO",
  "US",
] as const;
