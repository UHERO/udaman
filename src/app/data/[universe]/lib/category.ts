/**
 * Category tree + category-page selection logic, ported from
 * api.service.mapCategories, helper.service (findSelectedDataList,
 * getCategoryDataLists, getIdParam) and category-helper.service.
 */
import { getDateWrapper, NO_DATA_DATE } from "./dates";
import { hasObservations } from "./series";
import type {
  ApiCategory,
  CategoryNode,
  ExpandedSeries,
  FreqCode,
  Frequency,
  Geography,
  Measurement,
  MeasurementGroup,
  PortalCategories,
} from "./types";

// ─── Tree building / root derivation ───────────────────────────────

/**
 * Build the nav tree from GET /category's flat list.
 *
 * The API does NOT return the root category itself (e.g. UHERO's 59), so the
 * top-level nodes are those whose parentId is not in the list. That is the
 * generic root derivation: it works for any universe with no config.
 *
 * `rootOverride` reproduces Angular's `rootCategory` injection: if a
 * top-level node has that id, its children become the tree instead.
 *
 * API order is preserved (the API already applies list_order).
 */
export function buildCategoryTree(
  flat: ApiCategory[],
  rootOverride?: number,
): PortalCategories {
  const byId = new Map<number, CategoryNode>();
  for (const c of flat) byId.set(c.id, { ...c });
  const top: CategoryNode[] = [];
  for (const c of flat) {
    const node = byId.get(c.id)!;
    const parent = c.parentId != null ? byId.get(c.parentId) : undefined;
    if (parent) (parent.children ??= []).push(node);
    else top.push(node);
  }
  if (rootOverride !== undefined) {
    const rootNode = top.find((n) => n.id === rootOverride);
    if (rootNode) {
      return { tree: rootNode.children ?? [], rootId: rootNode.id, flat };
    }
  }
  return { tree: top, rootId: deriveRootCategoryId(top, rootOverride), flat };
}

/** Shared parentId of all top-level nodes (the hidden root), if unique. */
export function deriveRootCategoryId(
  top: ApiCategory[],
  fallback?: number,
): number | null {
  const parents = new Set(top.map((n) => n.parentId ?? null));
  if (parents.size === 1) {
    const [only] = parents;
    if (only !== null) return only;
  }
  return fallback ?? null;
}

/** Depth-first search for a node by id. */
export function findCategoryNode(
  nodes: CategoryNode[],
  id: number,
): CategoryNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const hit = findCategoryNode(n.children, id);
      if (hit) return hit;
    }
  }
  return undefined;
}

/** Path of nodes from a top-level node down to `id` (inclusive). */
export function findCategoryPath(
  nodes: CategoryNode[],
  id: number,
): CategoryNode[] {
  for (const n of nodes) {
    if (n.id === id) return [n];
    if (n.children) {
      const sub = findCategoryPath(n.children, id);
      if (sub.length) return [n, ...sub];
    }
  }
  return [];
}

/**
 * First leaf ("data list") under a node (helper.getCategoryDataLists /
 * navToFirstDataList). Clicking a category with children navigates here.
 */
export function firstDataList(node: CategoryNode): CategoryNode {
  let cur = node;
  while (cur.children?.length) cur = cur.children[0];
  return cur;
}

// ─── URL id param ───────────────────────────────────────────────────

/**
 * helper.getIdParam: `id` is a category id when numeric, otherwise a search
 * term (old /search?id=<term> links). Returns null when absent.
 */
export function parseIdParam(
  id: string | null | undefined,
): number | string | null {
  if (id === null || id === undefined || id === "") return null;
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : id;
}

// ─── Landing page selection ────────────────────────────────────────

export interface CategorySelection {
  /** Top-level category (sidebar item). */
  category: CategoryNode;
  /** Selected leaf data list. */
  dataList: CategoryNode;
  /** Top-level category's children (for the subcategory tabs). */
  subcategories: CategoryNode[];
  /** "Parent > Child > Leaf" style breadcrumb (dataListName in Angular). */
  dataListPath: string;
}

/**
 * category-helper.findCategoryAndStoreDataLists: resolve `id` (top-level
 * category, defaults to the first) and `data_list_id` (defaults to the first
 * leaf). Returns null when the category doesn't exist ("Category does not
 * exist.").
 */
export function resolveCategorySelection(
  tree: CategoryNode[],
  id: number | null,
  dataListId: number | null,
): CategorySelection | null {
  if (!tree.length) return null;
  const category = id ? tree.find((c) => c.id === id) : tree[0];
  if (!category) return null;
  const subcategories = category.children ?? [];
  let dataList: CategoryNode | undefined;
  let path: CategoryNode[] = [];
  if (dataListId) {
    path = findCategoryPath(subcategories, dataListId);
    dataList = path[path.length - 1];
  }
  if (!dataList) {
    dataList = subcategories.length
      ? firstDataList(subcategories[0])
      : category;
    path = findCategoryPath(subcategories, dataList.id);
  }
  return {
    category,
    dataList,
    subcategories,
    dataListPath: path.map((n) => n.name).join(" > ") || dataList.name,
  };
}

/**
 * category-helper.setCategorySelectorData: pick current geo/freq. The route
 * values are used only if BOTH exist in the lists; otherwise the data list's
 * defaults; otherwise the first available.
 */
export function resolveGeoFreq(opts: {
  geos: Geography[] | null | undefined;
  freqs: Frequency[] | null | undefined;
  defaults?: ApiCategory["defaults"];
  routeGeo?: string | null;
  routeFreq?: string | null;
}): {
  geo: Geography | null;
  freq: Frequency | null;
  geos: Geography[];
  freqs: Frequency[];
} {
  const { defaults, routeGeo, routeFreq } = opts;
  const geos = opts.geos?.length
    ? opts.geos
    : defaults?.geo
      ? [defaults.geo]
      : [];
  const freqs = opts.freqs?.length
    ? opts.freqs
    : defaults?.freq
      ? [defaults.freq]
      : [];
  const useRoute =
    !!routeGeo &&
    !!routeFreq &&
    geos.some((g) => g.handle === routeGeo) &&
    freqs.some((f) => f.freq === routeFreq);
  const geoHandle = useRoute ? routeGeo : (defaults?.geo ?? geos[0])?.handle;
  const freqCode = useRoute ? routeFreq : (defaults?.freq ?? freqs[0])?.freq;
  return {
    geo: geos.find((g) => g.handle === geoHandle) ?? geos[0] ?? null,
    freq: freqs.find((f) => f.freq === freqCode) ?? freqs[0] ?? null,
    geos,
    freqs,
  };
}

/** FC universe: route fc if valid, else data list default, else first. */
export function resolveForecast(
  forecasts: string[] | null | undefined,
  defaultFc?: string | null,
  routeFc?: string | null,
): string | null {
  const list = forecasts ?? [];
  if (routeFc && list.includes(routeFc)) return routeFc;
  if (defaultFc && list.includes(defaultFc)) return defaultFc;
  return list[0] ?? null;
}

/**
 * NTA: selected measurement by `m` param name, defaulting to "Region"
 * (category-helper.findSelectedMeasurement), then the first.
 */
export function resolveMeasurement(
  measurements: Measurement[],
  m?: string | null,
): Measurement | null {
  return (
    measurements.find((x) => x.name === (m || "Region")) ??
    measurements[0] ??
    null
  );
}

// ─── Series grouping for the category page ─────────────────────────

/** Drop series without level data (category-helper.filterSeriesResults). */
export const seriesWithData = (series: ExpandedSeries[]) =>
  series.filter((s) => hasObservations(s.seriesObservations));

/**
 * Group series by measurementName, preserving first-seen order
 * (displayedMeasurements + measurementOrder).
 */
export function groupByMeasurement<S extends ExpandedSeries>(
  series: S[],
): MeasurementGroup<S>[] {
  const groups = new Map<string, S[]>();
  for (const s of series) {
    const key = s.measurementName ?? "";
    const g = groups.get(key);
    if (g) g.push(s);
    else groups.set(key, [s]);
  }
  return [...groups].map(([measurementName, list]) => ({
    measurementName,
    series: list,
  }));
}

/**
 * Category-level date span + whether the date slider is shown
 * (category-helper.setCategorySeriesAndDates).
 */
export function categoryDateSpan(series: ExpandedSeries[]): {
  firstDate: string;
  endDate: string;
  displayDateSlider: boolean;
} {
  const { firstDate, endDate } = getDateWrapper(series);
  return {
    firstDate,
    endDate,
    displayDateSlider:
      !!firstDate &&
      !!endDate &&
      firstDate !== NO_DATA_DATE &&
      endDate !== NO_DATA_DATE,
  };
}

/**
 * NTA shared y-axis: min/max of level values across all series within the
 * selected range (category-charts.findMin/findMax).
 */
export function sharedLevelExtent(
  series: ExpandedSeries[],
  startDate: string,
  endDate: string,
): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const s of series) {
    const lvl = s.seriesObservations.transformationResults[0];
    lvl?.dates?.forEach((d, i) => {
      if (d < startDate || d > endDate) return;
      const v = +(lvl.values?.[i] ?? NaN);
      if (!Number.isFinite(v)) return;
      if (v < min) min = v;
      if (v > max) max = v;
    });
  }
  return Number.isFinite(min) ? { min, max } : null;
}

/** Freq label lookup with a sane fallback. */
export const FREQ_LABELS: Record<FreqCode, string> = {
  A: "Annual",
  S: "Semiannual",
  Q: "Quarterly",
  M: "Monthly",
  W: "Weekly",
  D: "Daily",
};
