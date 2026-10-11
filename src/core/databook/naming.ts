/**
 * Human-readable names for DATABOOK measurements.
 *
 * `dataPortalName` is what users see on the /data/databook dashboard, so it
 * must read as a label and be unique within its table (data list):
 * the row label and column label ("Construction: Employment full-time"),
 * with parent labels added only where needed to tell two measurements
 * apart. `description` carries the full context: the table title (without
 * its year ranges) and the whole label path.
 */
import { titleCase } from "./meta";

export interface NameInput {
  panelLabel: string;
  /** Header of the row-label column ("Age", "ZIP code"), if any. */
  rowHeader?: string;
  rowDims: string[];
  colDims: string[];
}

const PERIOD_WORD =
  /^(date|dates|year|years|period|fiscal years?|school years?|calendar years?|as of)$/i;
const GENERIC =
  /^(total|totals|all|all groups|all persons|number|percent|amount|value|rate|count|both sexes|male|female|males|females|men|women|other|others|state total)$/i;
const MAX_PORTAL = 120;
/** Industry/commodity codes ("62", "6231", "7000025000") — description only. */
const CODE = /^[\d.-]+$/;

/**
 * A panel label taken from the period column's header ("Date", "Year",
 * "Year for annual growth rate", "Live births by year") names the period,
 * not the measure. Keep only the measure part.
 */
export function cleanPanelLabel(label: string): string {
  let s = label.trim();
  if (PERIOD_WORD.test(s)) return "";
  s = s
    .replace(/^(date|year|years|period)\s+(for|of|and)\s+/i, "")
    .replace(
      /\s+(by|for|per)\s+(date|year|years|fiscal year|school year)$/i,
      "",
    )
    .replace(/^(date|year)\s*[:,-]\s*/i, "")
    .trim();
  if (PERIOD_WORD.test(s)) return "";
  return s ? s[0].toUpperCase() + s.slice(1) : "";
}

/** Strip year ranges from an ALL CAPS title: "…, BY COUNTY, 2010 TO 2025, AND …" → "…, BY COUNTY, AND …". */
export function stripTitlePeriods(title: string): string {
  return title
    .replace(
      /,?\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},\s*)?\d{4}(?:\s*[-/]\s*\d{2,4})?(?:\s*(?:to|and|through|,)\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},\s*)?\d{4}(?:\s*[-/]\s*\d{2,4})?)*/gi,
      "",
    )
    .replace(/,\s*,/g, ",")
    .replace(/,\s*(and|to)\s*,/gi, ",")
    .replace(/[,:\s]+(and|to)?\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** The table's subject: "PERCENTAGE CHANGE IN RESIDENT POPULATION, BY COUNTY, …" → "Percentage Change in Resident Population". */
export function tableSubject(title: string): string {
  const head = stripTitlePeriods(title).split(
    /,\s*(?:by|for)\s+|\s+by\s+|,\s+and\s+/i,
  )[0];
  return titleCase(head.replace(/[,:\s]+$/, ""));
}

interface Path {
  /** Components most-general → most-specific, tagged by axis. */
  comps: Array<{ axis: "panel" | "row" | "col"; text: string }>;
}

function pathOf(n: NameInput, withCodes = false): Path {
  // Codes are dropped only when the axis also has a text label ("62 >
  // Health care…"); a row labelled just "96816" (ZIP) or "1-4" (ages) keeps it.
  const keepIn = (dims: string[]) => {
    const hasText = dims.some((d) => d && !CODE.test(d.trim()));
    return (text: string) =>
      !!text && (withCodes || !hasText || !CODE.test(text.trim()));
  };
  return {
    comps: [
      ...(cleanPanelLabel(n.panelLabel)
        ? [{ axis: "panel" as const, text: cleanPanelLabel(n.panelLabel) }]
        : []),
      ...n.rowDims.filter(keepIn(n.rowDims)).map((text) => ({
        axis: "row" as const,
        text: withRowHeader(text, n.rowHeader),
      })),
      ...n.colDims
        .filter(keepIn(n.colDims))
        .map((text) => ({ axis: "col" as const, text })),
    ],
  };
}

/** "0" under an "Age" column → "Age 0"; "96816" under "ZIP code" → "ZIP code 96816". */
function withRowHeader(text: string, header?: string): string {
  const h = (header ?? "").replace(/\s+hierarchy$/i, "").trim();
  if (!h || !CODE.test(text.trim()) || PERIOD_WORD.test(h) || h.length > 40)
    return text;
  return `${h} ${text}`;
}

/**
 * Indices into `comps` to show, in the order ancestors get added when two
 * names collide: row leaf + col leaf first, then row parents (nearest
 * first), column parents, then the panel.
 */
function expansionOrder(p: Path): number[] {
  const idx = (axis: string) =>
    p.comps.map((c, i) => (c.axis === axis ? i : -1)).filter((i) => i >= 0);
  const rows = idx("row");
  const cols = idx("col");
  const panel = idx("panel");
  const order: number[] = [];
  if (rows.length) order.push(rows[rows.length - 1]);
  if (cols.length) order.push(cols[cols.length - 1]);
  order.push(
    ...rows.slice(0, -1).reverse(),
    ...cols.slice(0, -1).reverse(),
    ...panel,
  );
  return order;
}

function render(p: Path, shown: Set<number>, subject: string): string {
  const parts = p.comps.filter((_, i) => shown.has(i)).map((c) => c.text);
  if (parts.length === 0) return subject;
  if (parts.length === 1 && GENERIC.test(parts[0])) parts.unshift(subject);
  // Too long: shorten the longest component, never drop one (each shown
  // component is there to tell this measurement apart).
  let name = parts.join(": ");
  while (name.length > MAX_PORTAL) {
    const longest = parts.reduce(
      (m, x, i) => (x.length > parts[m].length ? i : m),
      0,
    );
    const excess = name.length - MAX_PORTAL;
    const keep = Math.max(24, parts[longest].length - excess - 1);
    if (keep >= parts[longest].length - 1) break;
    parts[longest] = parts[longest].slice(0, keep).trimEnd() + "…";
    name = parts.join(": ");
  }
  return name;
}

/**
 * Portal names for every measurement of one table, unique within the
 * table wherever the labels allow it. Each name starts as the row leaf +
 * column leaf; when names collide, each colliding measurement adds only
 * the nearest ancestor that its rivals don't share.
 */
export function portalNames(inputs: NameInput[], title: string): string[] {
  const subject = tableSubject(title);
  const paths = inputs.map((n) => pathOf(n));
  const orders = paths.map(expansionOrder);
  const shown = paths.map((p, i) => {
    const hasRow = p.comps.some((c) => c.axis === "row");
    const hasCol = p.comps.some((c) => c.axis === "col");
    const start = orders[i].slice(0, hasRow && hasCol ? 2 : 1);
    // A lone generic leaf ("Male") brings its nearest ancestor.
    const rest = orders[i].slice(start.length);
    if (rest.length && start.every((j) => GENERIC.test(p.comps[j].text)))
      start.push(rest[0]);
    return new Set(start);
  });
  const nameAt = (i: number) => render(paths[i], shown[i], subject);

  for (let round = 0; round < 10; round++) {
    const byName = new Map<string, number[]>();
    inputs.forEach((_, i) => {
      const n = nameAt(i).toLowerCase();
      byName.set(n, [...(byName.get(n) ?? []), i]);
    });
    let widened = false;
    for (const group of byName.values()) {
      if (group.length < 2) continue;
      for (const i of group) {
        const rivals = group.filter((k) => k !== i);
        const distinct = orders[i].find((j) => {
          if (shown[i].has(j)) return false;
          const t = paths[i].comps[j].text.toLowerCase();
          return rivals.some(
            (k) => !paths[k].comps.some((c) => c.text.toLowerCase() === t),
          );
        });
        if (distinct !== undefined) {
          shown[i].add(distinct);
          widened = true;
        }
      }
    }
    if (!widened) break;
  }

  // Identical label paths: number them so the dashboard can tell them apart.
  const seen = new Map<string, number>();
  return inputs.map((_, i) => {
    const n = nameAt(i);
    const k = n.toLowerCase();
    const c = (seen.get(k) ?? 0) + 1;
    seen.set(k, c);
    return c > 1 ? `${n} (${c})` : n;
  });
}

/** Full-context description: cleaned title + label path + period-basis note. */
export function describe(
  title: string,
  n: NameInput,
  basis: string | null,
): string {
  const path = pathOf(n, true).comps.map((c) => c.text);
  const s = `${titleCase(stripTitlePeriods(title))}${path.length ? " — " + path.join(" > ") : ""}${basis ? ` (${basis})` : ""}`;
  return s.length <= 500 ? s : s.slice(0, 499) + "…";
}
