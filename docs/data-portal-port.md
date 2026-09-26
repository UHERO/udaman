# Data portal port — contract

Port of the Angular data portal (`tmp/data-portal/projects/`) to
`src/app/data/[universe]/`. This doc is the contract between the foundation
and the four UI workstreams (A–D). If you need to change a contract, change it
here too.

## File map

```
src/actions/data-portal/portal.ts          "use server" REST API functions (all endpoints)
src/app/data/(uhero)/                      UHERO at the portal root (/data, /data/series, …) — thin
  layout.tsx, (portal)/layout.tsx,         wrappers around [universe]/views/* with universe = "uhero"
  (portal)/{page,category,series,analyzer,search}, graph/
src/app/data/[universe]/
  layout.tsx                               validate universe (+ uhero/alias redirects) → views/universe-layout
  (portal)/layout.tsx                      → views/portal-chrome
  (portal)/page.tsx, category/, series/,   thin wrappers: await params → views/*-page.tsx
  analyzer/ (+loading), search/, graph/
  views/universe-layout.tsx                UniverseLayout (config, categories, providers, GA, wrapper), lookupUniverse, universeLayoutMetadata
  views/portal-chrome.tsx                  PortalChrome: header + sidebar + <main>
  views/landing-page.tsx                   landing / category          → A
  views/series-page.tsx                    single series               → B
  views/analyzer-page.tsx (+ analyzer-loading.tsx)  analyzer           → C
  views/search-page.tsx                    search results              → D
  views/graph-page.tsx                     embed (no chrome)           → D
  lib/metadata.ts                          universeMetadata, pageMetadata (Next Metadata)
  components/ui/screenshot-placeholder.tsx help-dialog figure (placeholder box or real image)
  components/hash-redirect.tsx             old #/route?… links → path links
  components/ui/portal-card.tsx            PortalCard, PortalCardHeader, PortalCardBody, PortalSectionLabel
  components/ui/stat-table.tsx             StatTable (TanStack) — classic statistical table
  components/ui/chart-theme.ts             chart constants, seriesColor, portalCssVars, timeTicks
  components/ui/mini-line-chart.tsx        MiniLineChart — reference chart
  components/ui/use-chart-zoom.tsx         useChartZoom (wheel/dblclick zoom on index window) + ChartZoomBar
  lib/types.ts                             all API + derived types
  lib/config.ts                            PortalConfig registry, getPortalConfig, canonicalUniverse
  lib/links.ts                             portalHref, publicPortalUrl, serializeParams, translateHashUrl
  lib/url-params.ts                        param spec + parse*/serialize (server + client)
  lib/use-portal-params.ts                 client hook usePortalParams, usePreviousFreq
  lib/portal-context.tsx                   PortalConfigProvider / usePortalConfig
  lib/analyzer-context.tsx                 AnalyzerProvider / useAnalyzer
  lib/dates.ts                             date grids, labels, ranges, date input parsing
  lib/format.ts                            formatNum, toNumber, formatAxisNumber
  lib/series.ts                            transformations, chart/table rows, stats, siblings, SA rules
  lib/category.ts                          tree, root derivation, selection, geo/freq/fc/measurement resolution
  lib/analyzer.ts                          analyzer shaping (names, index base, freqs, table dates, URL-driven options)
  lib/csv.ts                               CSV builders + downloadCsv
public/data-portal/{uhero,nta,ccom,fc}/    logos copied from the Angular assets (+ <u>/icons/*_x{96,192,512}.png PWA icons: favicon/apple/OG image)
```

Put workstream components in `src/app/data/[universe]/components/<area>/`
(e.g. `components/series/`, `components/analyzer/`). Page/layout bodies live
in `views/` and take `universe: string`; the route files under `[universe]/`
and `(uhero)/` only resolve params and render them — **never put logic in a
route file**, or UHERO and the other universes drift apart. Pages under
`(portal)/` share the chrome; `graph/` does not.

Repo change outside the portal: `tsconfig.json` now excludes `tmp` (the
Angular source under `tmp/data-portal` broke `bun run check-types`).

## Routing

UHERO is served at the portal root; every other universe keeps its segment.

| Angular (hash)        | UHERO path                    | Other universes (`/data/{u}`) | Notes |
|-----------------------|-------------------------------|-------------------------------|-------|
| `#/` `#/category`     | `/data` `/data/category`      | `/data/{u}` `/data/{u}/category` | same page |
| `#/search?id=term`    | `/data/search?id=term`        | `/data/{u}/search?id=term`    | `q=` also accepted. `/category?id=<non-numeric>` redirects to search |
| `#/series?id=`        | `/data/series?id=`            | `/data/{u}/series?id=`        | |
| `#/analyzer?…`        | `/data/analyzer?…`            | `/data/{u}/analyzer?…`        | |
| `#/graph?…`           | `/data/graph?…`               | `/data/{u}/graph?…`           | embed, no header/sidebar |

On `data.uhero.hawaii.edu` drop the `/data` prefix (the proxy rewrites
`/foo` → `/data/foo`): `/`, `/series?id=1`, `/nta/series?id=1`.

- Route files: `src/app/data/(uhero)/…` (universe fixed) and
  `src/app/data/[universe]/…`, both thin wrappers over `[universe]/views/*`.
  The static UHERO segments (`category`, `series`, `analyzer`, `search`,
  `graph`) shadow `[universe]` values of the same name (fine — no universe
  uses those names). `/data/dvw` and `/data/dbedt` are untouched.
- Universe slug = lowercase DB `universe.name` (`nta`, `ccom`, `fc`, …).
  Validated against the DB (`lookupUniverse` → `UniverseCollection.list()`;
  falls back to the config registry if the DB is unreachable) → `notFound()`.
- Redirects (src/proxy.ts, 308, path + query preserved, fragment kept by the
  browser): `/data/uhero/*` → `/data/*` and `/data/forecast/*` → `/data/fc/*`
  on direct/localhost access; `/uhero/*` → `/*` and `/forecast/*` → `/fc/*`
  on the subdomain (`/data/uhero/*` there collapses to `/*` in one hop). The
  `[universe]` layout keeps a fallback redirect (to the portal home only).
- **Always build links with `portalHref(universe, route, params)`** (or the
  hook's `href`/`navigate`). `portalHref("uhero", "series")` →
  `/data/series`; `portalHref("nta", "series")` → `/data/nta/series`
  (`ROOT_UNIVERSE`, `portalPath` in lib/links.ts). On the subdomain the proxy
  redirects `/data/...` to the clean path, so these links work on both hosts.
  Share/embed links use `publicPortalUrl(config.exportLabels.publicUrl, route,
  params)`; UHERO's `publicUrl` is `https://data.uhero.hawaii.edu` (no
  segment), others `https://data.uhero.hawaii.edu/<u>`.
- Current route from a pathname: `routeFromPathname(pathname)` (last segment;
  works for `/data/series`, `/data/nta/series`, subdomain `/series`). Used by
  the sidebar active state and the analyzer provider — don't parse the
  universe out of the path.
- Hash compatibility: `HashRedirect` (in the universe layout) translates an
  old fragment via `translateHashUrl`: `data.uhero.hawaii.edu/#/series?id=1`
  lands on the UHERO landing page and is replaced with `/data/series?id=1`
  (→ `/series?id=1` on the subdomain); `/nta/#/category?id=…` →
  `/data/nta/category?id=…`.
- All pages: `export const dynamic = "force-dynamic"`. Pages receive
  `searchParams` as a Promise (Next 16).

## Data functions (`src/actions/data-portal/portal.ts`)

All are server actions, callable from server components and client
components. They return the API's `data` payload and **throw**
`ExternalServiceError` on network/HTTP/JSON failure. List endpoints normalize
`data: null` to `[]`. `noCache` adds the API's `nocache` flag. Responses are
cached by Next for 60 s (`fetchFromRestApi`).

| Function | Endpoint | Returns |
|---|---|---|
| `fetchCategoriesFlat(universe)` | `GET /category?u=` | `ApiCategory[]` |
| `fetchPortalCategories(universe, rootOverride?)` | same, + `buildCategoryTree` | `PortalCategories {tree, rootId, flat}` |
| `fetchCategoryGeos(id)` | `/category/geo?id=` | `Geography[]` |
| `fetchCategoryFreqs(id)` | `/category/freq?id=` | `Frequency[]` |
| `fetchCategoryForecasts(id)` | `/category/fc?id=` | `string[]` (e.g. `"26Q1FF"`) |
| `fetchCategorySeries({universe,id,geo,freq,fc?,noCache?})` | `/category/series?…&expand=true` | `ExpandedSeries[]` |
| `fetchCategoryMeasurements(id, noCache?)` | `/category/measurements?id=` | `Measurement[]` (NTA) |
| `fetchMeasurementSeries(id, noCache?)` | `/measurement/series?id=&expand=true` | `ExpandedSeries[]` (NTA) |
| `fetchSeriesPackage({universe,id,categoryId?,noCache?})` | `/package/series?id=&u=&cat=` | `SeriesPackage` |
| `fetchSeriesSiblings({universe,id,geo})` | `/series/siblings?id=&geo=&u=` | `PortalSeries[]` |
| `fetchSeriesObservations(id, noCache?)` | `/series/observations?id=` | `SeriesObservations` |
| `fetchSearchSummary({universe,q})` | `/search?q=&u=` | `SearchSummary \| null` |
| `fetchSearchSeries({universe,q})` | `/search/series?q=&u=` | `PortalSeries[]` (≤50, no obs) |
| `fetchPackageSearch({universe,q,geo,freq})` | `/package/search?…` | `PackageSearch \| null` |
| `fetchAnalyzerPackage({universe,ids})` | `/package/analyzer?ids=1,2&u=` | `AnalyzerPackage` |
| `fetchAnalyzerMom({universe,ids})` | `/package/analyzermom?ids=&u=` | `AnalyzerPackage` (mom only) |

### Real API shapes (verified 2026-09-25) — surprises

- **Observation values are strings** (`"368.50"`). Use `toNumber`/`+v`.
- `fips` is a string and missing for islands/aggregates (`LAN`, `MAUI`, NTA regions).
- `/category` does **not** include the root category. Top-level nodes are
  those whose `parentId` isn't in the list → generic root derivation works for
  every universe. FC's live root is **11824** (Angular hardcoded the stale 11494).
- Category `defaults` = `{geo, freq, observationStart, observationEnd}` (Geography/Frequency objects); ~⅓ of rows have none. Dates carry odd HST offsets (`-10:30`).
- `package/series` has no `forecasts` key outside FC. FC forecasts:
  `[{forecast:"26Q1FF", freq:"Q", label:"Quarterly"}, …]`. FC series omit
  `seasonalAdjustment`, `percent`, `real`, `source*`.
- `package/series` for a nonexistent id → HTTP 500 (throws).
- `/search` for no hits still returns an object (`geos: []`, `observationStart: null`); `/search/series` returns `null` → `[]`.
- `package/analyzermom` series contain only the `mom` transformation → `mergeMomSeries`.
- No-data series: `observationStart === "1-01-01"` and/or level `dates` absent → `hasObservations()`.
- `src/types/rest-api.ts` was not reused: its `Series` is narrower (e.g. `"Annually"`, missing ytd/c5ma/mom). Portal types live in `lib/types.ts`.

## Types (`lib/types.ts`)

API: `FreqCode`, `Geography`, `Frequency`, `ForecastOption`, `ApiCategory`,
`CategoryNode`, `PortalCategories`, `TransformationCode` (`lvl|pc1|ytd|c5ma|mom`),
`TransformationResult`, `SeriesObservations`, `PortalSeries`, `ExpandedSeries`,
`SeriesPackage`, `AnalyzerPackage`, `SearchSummary`, `PackageSearch`, `Measurement`.

Derived: `DateEntry {date, tableDate}`, `DateRange {startDate, endDate,
useDefaultRange, endOfSample}`, `DateWrapper`, `DefaultRange`,
`TransformationKey` (`level|yoy|ytd|c5ma|mom`), `TransformationSet`,
`SeriesChartRow {date, ts, level, yoy, ytd, c5ma, mom}` (numbers|null — the
recharts row shape), `PseudoZone`, `SeriesTableRow`, `SummaryStats`,
`MeasurementGroup`.

## Config (`lib/config.ts`)

`getPortalConfig(universe): PortalConfig` — registry entries for `uhero`,
`nta`, `ccom`, `fc`; any other DB universe gets UHERO behavior with a generic
title. Fields:

| Field | Meaning (Angular source) |
|---|---|
| `universe`, `dbUniverse`, `title`, `shortTitle` | |
| `logo {src, alt, analyticsSrc?}` | main.ts `logo` (files in `public/data-portal/<u>/`; ccom's is a 700 KB JPEG) |
| `colors {primary, accent, text, palettes {brand, accessible?}, chartMuted}` | app_colors.scss. `palettes.brand` = Angular `$analyzer-series0..4` (default); `accessible` = the old dataviz-validated palette, kept for a future settings toggle. **Read only via `getChartPalette(config, mode = "brand")`** (or chart-theme `seriesColor`). `chartMuted` = `$highstock-series1` `#9E9E9E` |
| `rootCategory?` | main.ts `rootCategory` (override only; derivation is the default) |
| `defaultRange[]` | main.ts `defaultRange` (NTA: 40 years ending 2040) |
| `feedback`, `categoryTabs` | main.ts `portal` |
| `categoryMode` | `"measurement"` for NTA (measurement lists instead of geo/freq) |
| `selectors` | which selectors show (`forecast` = FC) |
| `transformations {yoy,ytd,mom,c5ma}` | settings.transformations |
| `seriesTable[] {key,label,percentLabel}` | settings.seriesTable |
| `miniChart {secondary, showSecondary, sharedYAxis}` | settings.highcharts (NTA: level only, shared y-range) |
| `seriesChart {companions, rangeButtons, credits}` | settings.highstock |
| `exportLabels {portalSource, portal, portalLink, publicUrl}` | catTable/highstock.labels |
| `sliderInteraction`, `otherDashboardLinks`, `googleAnalyticsId` | settings / main.ts |

`sliderInteraction` was defined but unused in Angular. `feedback` was not
used by shared components either (app shell only); the header's feedback link
is `mailto:uhero@hawaii.edu` (confirmed). `logo.width/height` are the
intrinsic size (SVG viewBox / JPEG pixels) for `next/image`.

## Metadata, analytics, logos

- **Google Analytics (GA4)**: `UniverseLayout` renders
  `<GoogleAnalytics gaId={config.googleAnalyticsId}>` (`@next/third-parties`)
  for the universe being viewed only, and only when `NODE_ENV ===
  "production"`. Ids from the Angular apps: uhero `G-RLVNRLYMP5`, nta
  `G-7QVQLFEEDE`, ccom `G-B2RGGWN98L`; **fc has none** (Angular's was
  commented out) — add `googleAnalyticsId` to the fc config if wanted. The
  `/graph` embed reports too (Angular's gtag loaded for every route). SPA
  navigations: GA4 enhanced measurement's "page changes based on browser
  history events" (on by default in the GA property) counts client-side
  route changes — Angular instead called `gtag('config', …, {page_path})`
  per NavigationEnd. That setting also fires on `history.replaceState`, so
  shallow URL updates (date slider, analyzer options) may register as page
  views; turn it off in the GA stream settings and send manual page_views if
  that inflates counts.
- **Metadata** (`lib/metadata.ts`): `universeMetadata` (layouts) sets
  `metadataBase` (public origin), title template `%s | <config.title>` with
  the portal title as default, a per-universe description (unknown
  universes: DB `universe.description`, then a generic line), favicon /
  apple icon, and Open Graph (siteName, title, url, 512px icon as image).
  Pages call `pageMetadata(universe, {title, description?, route, params,
  noindex?})`, which adds the canonical URL (public, absolute) and a full
  Open Graph block (OG isn't merged across segments). Layouts set no
  canonical (it would be inherited by every page). Titles: category = data
  list – category (none without `id`), series = `series.title` (+
  description with region/frequency), `Analyzer`, `Search: <term>`, graph =
  `Graph` with `robots: noindex`. Root app metadata is untouched.
- **Logos** use `next/image` (header with `preload`, mobile sidebar sheet,
  "Built by" analytics logo). SVGs are served unoptimized automatically
  (`dangerouslyAllowSVG` stays off); the 700 KB CCOM JPEG is resized by the
  optimizer. Chart-export logo drawing is separate (chart-export.ts).
- **Help screenshots**: `ScreenshotPlaceholder({caption, src?, aspect?})`
  marks where the Angular help dialogs had screenshots (category: selectors /
  chart view / table view; analyzer: tables / gallery / compare; series:
  series view). Drop real images in `public/data-portal/help/` and pass
  `src` (and the image's `aspect`).

## URL params (`lib/url-params.ts`) — names match Angular exactly

Booleans are only true for the literal `"true"`. Id lists are `-`-joined.

**Landing/category** `parseCategoryParams` → `id` (number = category; string =
search term), `data_list_id`, `geo`, `freq`, `fc` (FC), `m` (NTA measurement
name), `sa` (**default true**), `yoy`, `ytd`, `c5ma` (table-view rows,
multi-select), `transform` (chart-view line: `yoy`|`ytd`|`c5ma`, absent =
level; single-select — new, not in Angular), `view` (`chart`|`table`,
default chart), `start`, `end`, `nocache`. Both toggles are
`components/selectors/transform-toggle.tsx`.

**Search** `parseSearchTerm` → `id` or `q`.

**Series** `parseSeriesParams` → `id`, `sa` (default true), `data_list_id`
(passed to package/series as `cat`), `geo`, `freq`, `fc`, `start`, `end`, `nocache`.

**Analyzer** `parseAnalyzerParams` / `analyzerParamsToQuery` →
`analyzerSeries`, `chartSeries`, `start`, `end`, `index`, `leftMin`,
`leftMax`, `rightMin`, `rightMax`, `compare`, `yoy`, `ytd`, `c5ma`, `mom`,
`yright`, `yleft`, `column`, `area`, `chartYoy`, `chartYtd`, `chartMom`,
`chartC5ma`, `nocache`.

**Graph** `parseGraphParams` → analyzer params + `id`.

`start`/`end` rules: omit `start` when showing the default range, omit `end`
when the range ends at the last observation (`rangeToParams`).

Nav param resets: sidebar links merge current params and null
`NAV_RESET_PARAMS` (analyzerSeries, chartSeries, name, units) — geo/freq/
view/sa/start/end carry over. Search submit uses `SEARCH_RESET_PARAMS` (also
clears start/end/geography).

### Client hook (`lib/use-portal-params.ts`)

```ts
const { universe, category, series, analyzer, graph, searchParams,
        setParams, href, navigate } = usePortalParams();
setParams({ view: "table" });                        // merge + router.replace
setParams({ geo, freq }, { mode: "push" });          // new history entry (Angular router.navigate)
setParams(rangeToParams(range), { mode: "shallow" }); // history.replaceState: no server re-render (Angular location.go)
href("series", { id }, /*merge*/ true); navigate("analyzer", {...});
const previousFreq = usePreviousFreq(currentFreq);   // for resolveDateRange on freq switch
```

`null`/`undefined`/`""` delete a param. Note: `"shallow"` does not re-run the
server page — only use it for state the client derives itself (date range).

## Analyzer selection (`lib/analyzer-context.tsx`)

`AnalyzerProvider` wraps every portal page (layout).
`useAnalyzer()` → `{ ids, count, has(id), add(id), remove(id), toggle(id),
set(ids), clear(), analyzerHref }`.

- URL `analyzerSeries` is authoritative when present (not on `/graph`); else
  the selection persists in sessionStorage per universe (Angular: memory only).
- Mutations on `/analyzer` rewrite the URL via `router.replace` (server page
  re-renders); removed ids are stripped from chartSeries/yleft/yright/column/
  area/chart*. `clear()` there navigates to bare `/analyzer` (Angular removeAll).
- Header badge: `count`; link: `analyzerHref` (carries `analyzerSeries`).
- Everything else about the analyzer (chart types, axes, index, transformations)
  is URL state via `parseAnalyzerParams`; helpers in `lib/analyzer.ts`.

## Pure helpers (highlights)

- dates: `createDateArray(start,end,freq)`, `formatTableDate` (`2020`, `2020 Q1`, `2020-01`),
  `formatTooltipDate` (`Jan 2020`, `Jan 05, 2020`), `resolveDateRange({dates,freq,defaultRange,start,end,previousFreq})`,
  `rangeToParams`, `adjustEndForFreqChange`, `parseDateInput`, `DATE_INPUT_PLACEHOLDER`, `binarySearch/lowerBound/upperBound`, `getDateWrapper`.
- format: `formatNum(n, decimals, universe)` (NTA rule: 2dp → 1dp for ≥1), `toNumber`, `GROWTH_DECIMALS = 1`.
- series: `getTransformations`, `hasObservations`, `seriesChartData(series)` → `{dates, rows, pseudoZones}`,
  `buildSeriesChartRows`, `buildSeriesTable`, `transformationRowLabel` (`YOY (%)`/`YOY (ch.)`),
  `changeLabels(percent)`, `categoryRowLabel`, `seriesInfoTitle/Lines` (popover), `shouldDisplaySeries`,
  `applySeasonalDisplay`, `hasSeasonalSeries`, `findGeoFreqSiblings`, `hasSaPair`, `selectSibling`,
  `calculateSummaryStats(series, points, start, end)`, `calculateCAGR`, `indexValues`.
- category: `buildCategoryTree`, `findCategoryNode/Path`, `firstDataList`, `parseIdParam`,
  `resolveCategorySelection(tree, id, dataListId)`, `resolveGeoFreq`, `resolveForecast`,
  `resolveMeasurement` (default "Region"), `seriesWithData`, `groupByMeasurement`,
  `categoryDateSpan`, `sharedLevelExtent` (NTA), `FREQ_LABELS`.
- analyzer: `analyzerDisplayName`, `analyzerYAxisLabel`, `indexBaseDate`, `commonFrequencies`,
  `isSingleFrequency`, `highestFrequency`, `allowMoM`, `mergeMomSeries`,
  `availableChartTransformations`, `analyzerTableDates`, `analyzerSliderDates`,
  `transformationByTableDate`, `initialChartSeries`, `defaultAxisSide`, `chartTypeFor`, `chartTransformationFor`.
- csv: `buildCategoryCsv`, `buildAnalyzerCsv`, `buildSeriesCsv`, `seriesCsvMetadata`, `buildWideTableCsv`, `downloadCsv`.

Intentional deviations from Angular: quarter labels computed correctly for any
month; summary total/avg ignore null gaps; semiannual end re-mapping on
frequency change fixed; Infinity sentinels replaced by `null`.

## Style

- Wrapper (layout): `.data-portal`, `bg-neutral-100` main area, CSS vars from
  `portalCssVars(config)`: `--radius: 0px` (shadcn `rounded-*` collapse to square
  inside the portal only), `--theme`, `--portal-primary`, `--portal-accent`,
  `--portal-series-1..5`, `--sidebar: #fff`. Don't edit global shadcn components.
- Header + sidebar: solid white. Content: `PortalCard` (white, soft shadow, square).
  Section labels: `PortalSectionLabel` (11px uppercase muted).
- Tables: `StatTable` — heavy top/bottom rules, hairline row rules, uppercase
  muted 11px headers, numbers right-aligned `tabular-nums`, no zebra,
  `stickyFirstColumn` for date tables, `rowClassName` to indent/mute
  transformation rows. Date columns newest-first (Angular scrolled right→left);
  CSV exports chronological.
- Charts: build on shadcn `ChartContainer` + recharts 2.15 with
  `chart-theme.ts` (`LINE_PROPS` 1.5px no dots, `AXIS_PROPS` no tick marks,
  optional faint horizontal `GRID_PROPS`, `timeTicks` ≈4 x-ticks,
  `formatAxisNumber`, `seriesColor(config, slot)`). No legend for one series;
  ≥2 series need a legend (or direct labels) — identity never by color alone.
  Colors follow the entity (fixed slot), not rank. Companion growth bars use
  `config.colors.chartMuted`.
- Brand palettes (user decision, overrides dataviz): Angular Highcharts
  colors per portal — UHERO/FC `#1D667F #9E9E9E #F6A01B #9BBB59 #8064A2`,
  NTA `#0068B3 #9E9E9E #F6A01B #008b78 #8064A2`, CCOM `#2d6c43 #9E9E9E
  #F6A01B #0279c0 #8064A2`. They FAIL validate_palette.js (gray slot 1,
  low-contrast amber/green, weak CVD pairs) → keep legends + table views;
  `accessible` palettes are stored for a future toggle.
- Series chart (`SeriesChart`, user decision: dual axis like Angular
  Highstock): ONE plot, first companion as muted bars on the LEFT axis
  (ticks muted, `%` suffix, always includes 0, zero line), level line on the
  RIGHT axis (tick labels in the line color), independent scales, no grid.
  Header row doubles as legend (bar swatch + label left, units + line
  swatch right). Other companions: tooltip only (Angular color "none").
- Mini charts (`MiniLineChart`, category grid + analyzer gallery): level
  line only; the companion (YTD) is tooltip/header only because Angular's
  `highcharts-series-1` columns were styled `fill: none` in every portal.
  `companionBars` opt-in draws them.
- Zoom (`useChartZoom(ref, {count,start,end,freq,onChange})`, series chart
  incl. embed, analyzer compare): ⌘/Ctrl+wheel or pinch zooms at the cursor;
  plain wheel zooms only after the pointer rests ~400 ms on the plot (page
  scroll-through is never captured; zooming out at full extent scrolls the
  page); horizontal wheel pans; double-click 2× in, shift+double-click 2×
  out; `ChartZoomBar` shows a hint + "Reset zoom" (back to the pre-zoom
  window). Min window per freq (`MIN_ZOOM_POINTS`). Drives the same range
  state as presets/brush (series: `changeRange` debounce; analyzer compare:
  local pending window + 250 ms debounced `onRange`).
- Export (`components/analyzer/chart-export.ts`): PNG/JPEG/SVG/PDF from the
  cloned recharts SVG (legend, axis titles, credits); PDF = that PNG on a
  landscape letter page with title/subtitle/source (jspdf, lazy-imported,
  dvw strategy). `exportTablePdf` = jspdf-autotable in the dvw style (gray
  8pt header, column blocks). Series page + analyzer compare have
  Download menus (image, chart PDF, CSV, table PDF).
- The portal is light-only (Angular had no dark mode).

## Workstream inventory

### A — shell, header, sidebar, landing/category
Angular: primeng-menu-nav, header, geo-selector, freq-selector,
forecast-selector, measurement-selector, date-slider, landing-page,
category-charts, highchart (mini), category-table-view, category-table-render.
Slots (now): `views/portal-chrome.tsx`, `views/landing-page.tsx`.

Must not miss:
- Flow (non-NTA): categories → `resolveCategorySelection` (no id → first category;
  no data_list_id → first leaf) → `fetchCategoryGeos/Freqs` (+`fetchCategoryForecasts` on FC)
  → `resolveGeoFreq` (route geo/freq used only if **both** exist) → `resolveForecast`
  → `fetchCategorySeries`. Invalid id → "Category does not exist."
- NTA: `fetchCategoryMeasurements(dataList.id)` → `resolveMeasurement(m)` →
  `fetchMeasurementSeries`; freq fixed Annual; row/chart name = `geography.name`;
  mini charts level-only with `sharedLevelExtent` y-domain; measurement list uses `indent`.
- SA toggle only when `hasSeasonalSeries`; `applySeasonalDisplay` per measurement
  group — show "only available as (non-)seasonally adjusted" when nothing survives.
- Table view: level row + optional YOY/YTD/C5MA rows (`transformationRowLabel`);
  **YTD rows hidden at annual freq**; columns outside the date range hidden;
  CSV via `buildCategoryCsv`. Series label links to `series?id=` merged with
  current params (keeps data_list_id etc.), star toggles `useAnalyzer()`.
- Category tabs when `config.categoryTabs && subcategories.length > 1`;
  otherwise show the data list path.
- Date slider: `resolveDateRange` + `usePreviousFreq` (end re-mapped on freq
  change); write with `rangeToParams` + `mode: "shallow"`; hidden when
  `categoryDateSpan().displayDateSlider` is false. Inputs: `parseDateInput`,
  `DATE_INPUT_PLACEHOLDER`.
- Sidebar: clicking a node with children goes to its `firstDataList`; items
  expanded for the current `id`; "Analyzer (n)" link; `otherDashboardLinks`
  below it. Search bar → `/search?id=term` with `SEARCH_RESET_PARAMS`.
- Help dialogs: copy lives in the Angular `*.component.html` templates.

Built (A) — reusable exports:
- `components/selectors/selectors.tsx`: `GeoSelector`, `FreqSelector` (`placeholder` for the analyzer mixed-freq case), `ForecastSelector`, `MeasurementSelector`, `CheckToggle`, `geoLabel`; `portal-select.tsx` (`PortalSelect`).
- `components/selectors/date-range-slider.tsx`: `DateRangeSlider({dates, freq, startIndex, endIndex, onChange})` — feed it `resolveDateRange(...)`; `onChange` gets a `DateRange` → `setParams(rangeToParams(r), {mode: "shallow"})`.
- `components/selectors/freq-switch.ts`: `endForFreqSwitch(end, previousFreq)` — call when switching freq and write the result as `end`; replaces carrying `previousFreq` across the server re-render (the category page uses this instead of `usePreviousFreq`).
- `components/category/category-chart-card.tsx`: `CategoryChartCard({series, href, startDate, endDate, yDomain?, actions?, seasonalMessage?})`, `secondaryLabel`.
- `components/category/category-table.tsx`: `buildCategoryTableRows`, `categoryCsvRows`, `CategoryTable({rows, dates, seriesHref, universe})`.
- `components/category/series-info-popover.tsx`: `SeriesInfoPopover({series})`.
- Header search submits `search?q=<term>` (merged params, `id` cleared, `SEARCH_RESET_PARAMS`).

### B — single series
Angular: single-series, highstock, single-series-table, summary-statistics.

- `fetchSeriesPackage({id, categoryId: data_list_id})`; no data when
  `!hasObservations(pkg.observations)` → "Data not available". decimals default 1.
- Geo/freq selectors from `series.geos` / `series.freqs` (fallback to own geo/freq).
  Switching: `findGeoFreqSiblings(pkg.siblings, geo, freq, fc)` → `selectSibling(…, sa, freq)`
  → navigate (`push`) to `series?id=…&sa&geo&freq[&fc]&start&end`; none → "Selection Not Available".
- FC: forecast selector from `pkg.forecasts`; current fc = the forecast whose
  freq matches and whose tag is in `series.name`; picking a forecast also switches freq.
- SA toggle only if `hasSaPair(findGeoFreqSiblings(siblings, geo, freq))`.
- Labels via `changeLabels(series.percent)`; table columns from `config.seriesTable`
  (use `percentLabel` when `series.percent`).
- Chart: level (right axis) + first `config.seriesChart.companions` as muted
  bars (left axis) in one plot, pseudo-history dashed, range buttons
  `rangeButtons` (hide 1Y for annual), wheel/dblclick zoom. Range changes →
  `mode: "shallow"`. Download: PNG/SVG/PDF chart, CSV (`buildSeriesCsv`), PDF table.
- Summary stats: `calculateSummaryStats` over the selected range;
  `percChange === null` for percent series; `missing` → footnote.
- Share link + embed (D's component) and the analyzer star.

### C — analyzer
Angular: analyzer, analyzer-highstock, analyzer-table, analyzer-table-renderer,
analyzer-stats-renderer.

- Ids from `parseAnalyzerParams().analyzerSeries` (mirrored by `useAnalyzer`).
  `fetchAnalyzerPackage`; analyzer freq = common freq if `isSingleFrequency`
  else `highestFrequency`; if `allowMoM(freq)` also `fetchAnalyzerMom` →
  `mergeMomSeries` and add "MOM" to chart options.
- Comparison chart membership: `initialChartSeries(ids, chartSeries)` (first two
  by default); per-series type/axis/transformation from `chartTypeFor`,
  `defaultAxisSide`, `chartTransformationFor`; y min/max from params. Every
  change is written back to the URL (Angular `analyzerParams`).
- Index toggle: `indexBaseDate(visible series, range start)`, `indexValues`;
  y label `analyzerYAxisLabel`, names `analyzerDisplayName`.
- Freq selector only when single-frequency; switching fetches
  `fetchSeriesSiblings` per series, keeps those with the new freq, keeps
  compare membership by title, then `useAnalyzer().set(newIds)`; none → "Selection not available".
- Table: `analyzerTableDates(series, start, end)` columns (newest first),
  level row + yoy/ytd/c5ma/mom rows per params, index-aware; stats table via
  `calculateSummaryStats` per series; CSV `buildAnalyzerCsv`.
- `compare` param toggles comparison chart vs. mini-chart grid.
- Left/right y-axes (`yleft`/`yright`, min/max per side): user accepted
  dual axes (Angular parity) — `AnalyzerChart` draws a right axis when a
  visible series is assigned to it.

### D — search, share, embed
Angular: search-bar, search-results, share-link, embed-graph.

- Search: `fetchSearchSeries({q})`; table columns Series / Region (`geography.shortName`)
  / Frequency / Seasonally Adjusted (`seasonalAdjustment` with `_`→space, default
  "Not Applicable"); series link `series?id=&sa=<seasonally adjusted>`; empty →
  "No results found for {term}". `fetchSearchSummary`/`fetchPackageSearch` exist if
  a geo/freq-filtered search view is wanted.
- Share link: series → `publicPortalUrl(publicUrl, "series", {id, sa, start, end})`;
  analyzer → `analyzerParamsToQuery(...)` + start/end/yoy/ytd/c5ma/compare.
  Embed snippet: responsive iframe (56.25% padding, 475px) to `/graph` with
  series `{id,start,end}` or the analyzer params. Copy via `navigator.clipboard`.
- Graph (`views/graph-page.tsx`, no chrome, gray wrapper — render a white card or
  override): `id` → single-series chart (noCache); `analyzerSeries` → analyzer
  comparison chart honoring chartSeries/yleft/yright/min/max/index. Reuse B/C
  chart components; must not touch the analyzer selection (provider ignores /graph).
