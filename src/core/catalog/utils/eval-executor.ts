import SeriesCollection from "../collections/series-collection";
import Series from "../models/series";
import DataFileReader from "./data-file-reader";
import EvalParser, { EvalParseError } from "./eval-parser";
import type { EvalArg, EvalNode } from "./eval-parser";
import { addMonthsStr } from "./time";

// ─── Ruby → TypeScript method name mapping ──────────────────────────

/** Explicit aliases for Ruby method names that don't follow snake_case conventions. */
const METHOD_ALIASES: Record<string, string> = {
  load_api_bls_NEW: "loadApiBlsV2",
  // Rails defines `yoy` as an alias for `annualized_percentage_change`
  // (series_arithmetic.rb:179-181). Route the longer name to the same impl.
  annualized_percentage_change: "yoy",
  // Rails `absolute_change` is just `diff` (series_arithmetic.rb:147-149).
  absolute_change: "diff",
};

function snakeToCamel(s: string): string {
  if (METHOD_ALIASES[s]) return METHOD_ALIASES[s];
  return s.replace(/_([a-zA-Z])/g, (_, c: string) => c.toUpperCase());
}

/** Instance methods callable from eval expressions (whitelist). */
const ALLOWED_INSTANCE_METHODS = new Set([
  // Arithmetic
  "add",
  "subtract",
  "multiply",
  "divide",
  "power",
  "zeroAdd",
  "round",
  "rebase",
  "convertToReal",
  "perCap",
  "yoy",
  "ytd",
  "ytdSum",
  "mtd",
  "mtdSum",
  "mtdAvg",
  "diff",
  "annualSum",
  "annualAverage",
  "percentageChange",
  "yoyDiff",
  "scaledData",
  // Aggregation
  "average",
  "aggregate",
  // Interpolation
  "addMissingDp",
  "fillMissingMonthsLinear",
  "fillAlternateMissingMonths",
  "interpolate",
  "linearInterpolate",
  "fillInterpolateTo",
  "censusInterpolate",
  "trmsInterpolateToQuarterly",
  "pseudoCenteredSplineInterpolation",
  "distributeDaysInterpolation",
  "fillDaysInterpolation",
  // Moving averages & sharing
  "movingAverage",
  "movingAverageOffsetEarly",
  "offsetForwardLookingMovingAverage",
  "backwardLookingMovingAverage",
  "forwardLookingMovingAverage",
  "shareUsing",
  // Data adjustment
  "trim",
  "noTrimPast",
  "noTrimFuture",
  "shiftBy",
  "getLastIncompleteYear",
  // File loading
  "loadFrom",
  "loadSaFrom",
  "loadMeanCorrectedSaFrom",
  // County share allocation
  "mcMaCountyShareFor",
  "mcPriceShareFor",
  "aaStateBasedCountyShareFor",
  "movingAverageAnnavgPadded",
  "getLastCompleteDecember",
  "getLastComplete4thQuarter",
  // Seasonal adjustment
  "applyNsGrowthRateSa",
  // Daily census
  "dailyCensus",
  "daysInPeriod",
  // Real conversion (deflation)
  "convertToReal",
  "convertToRealB",
]);

/** Static methods callable from eval expressions (whitelist). */
const ALLOWED_STATIC_METHODS = new Set([
  "loadFromDownload",
  "loadFromFile",
  "loadApiBls",
  "loadApiBlsV2",
  "loadApiFred",
  "loadApiBea",
  "loadApiEstatjp",
  "loadApiEiaAeo",
  "loadApiEiaSteo",
  "loadApiDvw",
]);

/** Arithmetic operator → Series method name */
const OP_TO_METHOD: Record<string, string> = {
  "+": "add",
  "-": "subtract",
  "*": "multiply",
  "/": "divide",
  "**": "power",
};

// ─── Argument Resolution ────────────────────────────────────────────

async function resolveArg(
  arg: EvalArg,
): Promise<
  | string
  | number
  | boolean
  | null
  | Series
  | Record<string, string | number | boolean>
> {
  switch (arg.type) {
    case "string":
      return arg.value;
    case "number":
      return arg.value;
    case "nil":
      return null as unknown as string;
    case "symbol":
      return arg.value;
    case "series_ref": {
      try {
        const series = await SeriesCollection.getByName(arg.name);
        await SeriesCollection.loadCurrentData(series);
        return series;
      } catch (e) {
        if (arg.nullable) return null as unknown as Series;
        throw e;
      }
    }
    case "options":
      // Preserve underlying JS types — API methods and kwarg-style
      // dispatchers (e.g. moving averages) want real numbers/booleans,
      // not stringified ones. Downstream code that only wanted strings
      // can still call String(v) on the extracted value.
      return arg.value as Record<string, string | number | boolean>;
    case "expression":
      return EvalExecutor.execute(arg.node);
  }
}

async function resolveArgs(args: EvalArg[]): Promise<unknown[]> {
  return Promise.all(args.map(resolveArg));
}

// ─── Executor ───────────────────────────────────────────────────────

class EvalExecutor {
  /**
   * Execute a parsed eval node, returning a Series with data.
   *
   * `universe` is threaded through so a few static helpers (notably
   * `Series.search`) can scope their DB queries to the caller's universe.
   * Defaults to "UHERO" to match Rails' historical behavior when a loader
   * doesn't carry a universe.
   */
  static async execute(
    node: EvalNode,
    universe: string = "UHERO",
  ): Promise<Series> {
    switch (node.type) {
      case "series_ref": {
        try {
          const series = await SeriesCollection.getByName(node.name);
          await SeriesCollection.loadCurrentData(series);
          return series;
        } catch (e) {
          if (node.nullable) {
            // .tsn returns a blank Series placeholder when not found
            return new Series({ name: node.name });
          }
          throw e;
        }
      }

      case "scalar": {
        // Wrap a scalar value in a Series shell — typically used as
        // the right-hand side of arithmetic and resolved by the
        // instance method itself.
        const s = new Series({ name: `__scalar_${node.value}` });
        s.data = new Map([["scalar", node.value]]);
        return s;
      }

      case "instance_method": {
        // Special case: `Series.search(text).sum` / `.first` / `.last`.
        // The static `search` call resolves to a Series[] rather than a
        // single Series, so we handle the reduction here instead of
        // recursing into `execute(node.target)` (which would need to
        // return a non-Series value).
        if (
          node.target.type === "static_method" &&
          node.target.method === "search"
        ) {
          const searchArgs = await resolveArgs(node.target.args);
          const text = String(searchArgs[0] ?? "");
          const results = await SeriesCollection.search({ text, universe });

          const reducer = snakeToCamel(node.method);
          if (results.length === 0) {
            throw new EvalExecuteError(
              `Series.search("${text}") returned no results; cannot apply .${node.method}`,
            );
          }

          // Load data for every matching series so arithmetic has
          // something to work with.
          for (const s of results) {
            await SeriesCollection.loadCurrentData(s);
          }

          if (reducer === "first") return results[0];
          if (reducer === "last") return results[results.length - 1];
          if (reducer === "sum") {
            // Element-wise sum via repeated Series#add. Start with the
            // first series and fold in the rest.
            let acc = results[0];
            for (let i = 1; i < results.length; i++) {
              acc = acc.add(results[i]);
            }
            return acc;
          }
          throw new EvalExecuteError(
            `Unsupported reduction on Series.search result: .${node.method} (allowed: sum, first, last)`,
          );
        }

        const target = await this.execute(node.target, universe);
        const methodName = snakeToCamel(node.method);

        if (!ALLOWED_INSTANCE_METHODS.has(methodName)) {
          throw new EvalExecuteError(
            `Instance method not allowed: ${node.method} (mapped to ${methodName})`,
          );
        }

        // File loading methods: read file server-side, extract series data
        if (methodName === "loadFrom" || methodName === "loadSaFrom") {
          const args = await resolveArgs(node.args);
          const path = String(args[0]);
          const reader = DataFileReader.fromFile(path);

          const lookupName =
            methodName === "loadSaFrom" && !target.isNS
              ? target.nsSeriesName
              : target.name;

          const dataMap = reader.series(lookupName);
          const result = new Series({
            name:
              methodName === "loadFrom"
                ? `loaded from static file <${path}>`
                : `loaded SA from static file <${path}>`,
          });
          result.data = dataMap;
          result.frequency = reader.frequency;
          return result;
        }

        // Mean-corrected SA file loading: read file + DB lookup for NS series
        if (methodName === "loadMeanCorrectedSaFrom") {
          const args = await resolveArgs(node.args);
          const path = String(args[0]);
          const sheet =
            args[1] && typeof args[1] === "object"
              ? (args[1] as Record<string, string>).sheet
              : undefined;
          const reader = DataFileReader.fromFile(path, sheet ?? "sadata");

          // Load demetra series from file using the NS series name
          const nsName = target.nsSeriesName;
          const demetraData = reader.series(nsName);
          const demetra = new Series({ name: "demetra series" });
          demetra.data = demetraData;
          demetra.frequency = reader.frequency;

          // Load the actual NS series from DB
          const nsSeries = await SeriesCollection.getByName(nsName);
          await SeriesCollection.loadCurrentData(nsSeries);

          // Mean correct: demetra / demetra.annualSum * nsSeries.annualSum
          const meanCorrected = demetra
            .divide(demetra.annualSum())
            .multiply(nsSeries.annualSum());

          const result = new Series({
            name: `mean corrected against ${nsSeries} and loaded from <${path}>`,
          });
          result.data = meanCorrected.data;
          result.frequency = reader.frequency;
          return result;
        }

        // County share allocation: needs DB access to look up state/county series
        if (methodName === "mcMaCountyShareFor") {
          const args = await resolveArgs(node.args);
          const countyCode = String(args[0]);
          const parsedName = target.parseName();
          const prefix = args[1] ? String(args[1]) : parsedName.prefix;
          const freq = parsedName.freq;

          // Load state series (NS variant at HI geography)
          const stateName = Series.buildName(prefix + "NS", "HI", freq);
          const state = await SeriesCollection.getByName(stateName);
          await SeriesCollection.loadCurrentData(state);

          // Load county series (sibling of state for the given geo code)
          const countyName = state.buildName({
            geo: countyCode.toUpperCase(),
          });
          const county = await SeriesCollection.getByName(countyName);
          await SeriesCollection.loadCurrentData(county);

          // Date range from county data
          const startDate = county.firstValueDate;
          const endDate = county.getLastCompleteDecember();
          if (!startDate || !endDate) {
            throw new EvalExecuteError(
              `County series ${countyName} has no valid date range`,
            );
          }

          // Compute: county_share / state_share * target
          const countyMA = county.movingAverageAnnavgPadded(startDate, endDate);
          const stateMA = state.movingAverageAnnavgPadded(startDate, endDate);
          const historical = countyMA.divide(stateMA).multiply(target);

          // Mean correct: historical / historical.annualSum * county.annualSum
          const meanCorrected = historical
            .divide(historical.annualSum())
            .multiply(county.annualSum());

          const result = new Series({
            name: `Share of ${target} using ratio of ${county} over ${state} using a mean corrected moving average, only for full years`,
          });
          result.data = meanCorrected.data;
          result.frequency = target.frequency;
          return result;
        }

        // Mean-corrected price share: compute a share ratio using the
        // moving average of an NS sibling at `countyCode` over the moving
        // average of target's own NS counterpart, mean-correct against
        // the county annual average, then overwrite the tail with an
        // "incomplete year" correction computed from backward-looking MAs.
        //
        // Ports Series#mc_price_share_for (tmp/lib/series_sharing.rb).
        if (methodName === "mcPriceShareFor") {
          const args = await resolveArgs(node.args);
          const countyCode = String(args[0]);
          const parsedName = target.parseName();

          // "County" series: target prefix + "NS", at county_code geo,
          // at target's frequency. (In practice `countyCode` may be a
          // state-level geo like "HI" — Rails keeps the arg name.)
          const countyName = Series.buildName(
            parsedName.prefix + "NS",
            countyCode.toUpperCase(),
            parsedName.freq,
          );
          const county = await SeriesCollection.getByName(countyName);
          await SeriesCollection.loadCurrentData(county);

          // target's own NS counterpart — raise if it doesn't exist.
          const myNsName = target.nsSeriesName;
          let myNs: Series;
          try {
            myNs = await SeriesCollection.getByName(myNsName);
            await SeriesCollection.loadCurrentData(myNs);
          } catch {
            throw new EvalExecuteError(`No NS series corresponds to ${target}`);
          }

          const startDate = county.firstValueDate;
          const endDate = target.getLastComplete4thQuarter();
          if (!startDate || !endDate) {
            throw new EvalExecuteError(
              `mcPriceShareFor: no valid date range (county=${countyName}, target=${target})`,
            );
          }

          // shared = (county.trim(s,e).movingAverage / myNs.trim(s,e).movingAverage) * target
          const countyMA = county.trim(startDate, endDate).movingAverage();
          const myNsMA = myNs.trim(startDate, endDate).movingAverage();
          const sharedSeries = countyMA.divide(myNsMA).multiply(target);

          // mean_corrected = (county.annualAverage / shared.annualAverage) * shared
          const meanCorrected = county
            .annualAverage()
            .divide(sharedSeries.annualAverage())
            .multiply(sharedSeries);

          // incomplete_year =
          //   (county.backwardLookingMovingAverage.getLastIncompleteYear
          //    / myNs.backwardLookingMovingAverage.getLastIncompleteYear)
          //    * target
          const incompleteYear = county
            .backwardLookingMovingAverage()
            .getLastIncompleteYear()
            .divide(myNs.backwardLookingMovingAverage().getLastIncompleteYear())
            .multiply(target);

          // Merge: start with mean-corrected data, overwrite with the
          // incomplete-year correction (Rails `series_merge` semantics).
          const merged = new Map<string, number>(meanCorrected.data);
          for (const [date, value] of incompleteYear.data) {
            merged.set(date, value);
          }

          const result = new Series({
            name: `Share of ${target} using ratio of the moving average ${county} over the moving average of ${myNs}, mean corrected for the year`,
          });
          result.data = merged;
          result.frequency = target.frequency;
          return result;
        }

        // Annual-average county share allocation: needs DB access
        if (methodName === "aaStateBasedCountyShareFor") {
          const args = await resolveArgs(node.args);
          const countyCode = String(args[0]);
          const parsedName = target.parseName();
          const prefix = args[1] ? String(args[1]) : parsedName.prefix;

          // Load state series (NS variant, monthly, HI geography)
          const stateName = Series.buildName(prefix + "NS", "HI", "M");
          const state = await SeriesCollection.getByName(stateName);
          await SeriesCollection.loadCurrentData(state);

          // Load county series (sibling of state for the given geo code)
          const countyName = state.buildName({
            geo: countyCode.toUpperCase(),
          });
          const county = await SeriesCollection.getByName(countyName);
          await SeriesCollection.loadCurrentData(county);

          // Compute: county.annualAverage / state.annualAverage * target
          const historical = county
            .annualAverage()
            .divide(state.annualAverage())
            .multiply(target);

          const result = new Series({
            name: `Share of ${target} using ratio of ${county} over ${state} using annual averages, only for full years`,
          });
          result.data = historical.data;
          result.frequency = target.frequency;
          return result;
        }

        // Interpolate alternate missing months: for a monthly series that
        // only has data every other month, fill the gaps by averaging the
        // adjacent months. When a semi-annual sibling exists, use its
        // value to "mean-correct" each 6-month block so the interpolated
        // values sum to match the semi-annual total.
        //
        // Ports Series#fill_alternate_missing_months (tmp/lib/series_interpolation.rb).
        // Returns a new series containing ONLY the interpolated points.
        if (methodName === "fillAlternateMissingMonths") {
          if (target.frequencyCode !== "M") {
            throw new EvalExecuteError(
              `Cannot fillAlternateMissingMonths on a series of frequency ${target.frequency}`,
            );
          }

          // Parse args: positional (rangeStart, rangeEnd) and/or kwargs (from:, to:)
          const args = await resolveArgs(node.args);
          let rangeStart: string | undefined;
          let rangeEnd: string | undefined;
          let kwargs: Record<string, string> = {};
          for (const a of args) {
            if (typeof a === "string") {
              if (rangeStart === undefined) rangeStart = a;
              else if (rangeEnd === undefined) rangeEnd = a;
            } else if (a && typeof a === "object" && !(a instanceof Series)) {
              kwargs = { ...kwargs, ...(a as Record<string, string>) };
            }
          }

          // Find the semi-annual sibling (nil-safe — Rails `find_sibling_for_freq`).
          let semi: Series | null = null;
          try {
            const semiName = target.buildName({ freq: "S" });
            semi = await SeriesCollection.getByName(semiName);
            await SeriesCollection.loadCurrentData(semi);
          } catch {
            semi = null;
          }

          const startDate =
            kwargs.from ?? rangeStart ?? target.firstObservation ?? undefined;
          const endDate =
            kwargs.to ?? rangeEnd ?? target.lastObservation ?? undefined;
          if (!startDate || !endDate) {
            throw new EvalExecuteError(
              `fillAlternateMissingMonths: no valid date range for ${target}`,
            );
          }

          // Rails `redistribute_semi`: pulls 6 consecutive months of data
          // (from newDp if already interpolated, else from the source),
          // computes the diff between the semi-annual observation and the
          // 6-month average, then adds 2× that diff to the three
          // interpolated months in the block (offsets +1, +3, +5).
          const redistributeSemi = (
            semiVal: number,
            startMonth: string,
            newDp: Map<string, number>,
          ): void => {
            const sixMonth: number[] = [];
            for (let offset = 0; offset <= 5; offset++) {
              const d = addMonthsStr(startMonth, offset);
              const v = newDp.get(d) ?? target.data.get(d);
              if (v === undefined) return; // cannot redistribute — bail quietly
              sixMonth.push(v);
            }
            const avg = sixMonth.reduce((s, x) => s + x, 0) / sixMonth.length;
            const diff = (semiVal - avg) * 2;
            for (const off of [1, 3, 5]) {
              const d = addMonthsStr(startMonth, off);
              const cur = newDp.get(d);
              if (cur === undefined) {
                throw new EvalExecuteError(
                  `redistributeSemi: cannot redistribute because data missing at ${d}`,
                );
              }
              newDp.set(d, cur + diff);
            }
          };

          // Main loop: for each "missing" month between adjacent data,
          // average the neighbors. Step by 2 months so we only touch
          // the gaps.
          const newDp = new Map<string, number>();
          let date = addMonthsStr(startDate, 1);
          while (date < endDate) {
            const prevm = addMonthsStr(date, -1);
            const nextm = addMonthsStr(date, 1);
            const prevv = target.data.get(prevm);
            const nextv = target.data.get(nextm);
            if (prevv !== undefined && nextv !== undefined) {
              newDp.set(date, (prevv + nextv) / 2);

              // When we land on June or December and a semi sibling
              // exists, pull that period's semi-annual value and
              // mean-correct the block of 6 months ending at `date`.
              const month = Number(date.slice(5, 7));
              if (semi && month % 6 === 0) {
                const semiDate = addMonthsStr(date, -5);
                const semiVal = semi.data.get(semiDate);
                if (semiVal !== undefined) {
                  redistributeSemi(semiVal, semiDate, newDp);
                }
              }
            }
            date = addMonthsStr(date, 2);
          }

          const result = new Series({
            name: `Interpolation of alternate missing months from ${target}`,
          });
          result.data = newDp;
          result.frequency = target.frequency;
          return result;
        }

        // Growth-rate-based seasonal adjustment: needs DB access to load NS series
        if (methodName === "applyNsGrowthRateSa") {
          // Find the NS (non-seasonally-adjusted) counterpart
          const nsName = target.nsSeriesName;
          const nsSeries = await SeriesCollection.getByName(nsName);
          await SeriesCollection.loadCurrentData(nsSeries);

          // Shift target forward by 1 year (so shifted.at(date) = target.at(date - 1yr))
          const shiftedSelf = target.shiftBy(12);

          const adjustedData = new Map<string, number>();
          const sorted = [...nsSeries.data.entries()].sort(([a], [b]) =>
            a.localeCompare(b),
          );

          for (const [dateStr, nsValue] of sorted) {
            // Previous year's NS value
            const prevDateStr = addMonthsStr(dateStr, -12);
            const prev = nsSeries.data.get(prevDateStr);
            if (prev === undefined) continue;

            // Shifted self value at this date
            const sval = shiftedSelf.data.get(dateStr);
            if (sval === undefined) continue;

            // Compute percentage change
            let apc: number | null;
            if (prev === 0 && nsValue !== 0) apc = null;
            else if (prev === 0 && nsValue === 0) apc = 0;
            else apc = ((nsValue - prev) / prev) * 100;

            if (prev === 0 || (apc !== null && apc > 1000000)) {
              // Additive adjustment for extreme cases
              adjustedData.set(dateStr, nsValue - prev + sval);
            } else if (apc !== null) {
              adjustedData.set(dateStr, (1 + apc / 100) * sval);
            }
          }

          const result = new Series({
            name: `Applied Growth Rate Based Seasonal Adjustment against ${nsSeries}`,
          });
          result.data = adjustedData;
          result.frequency = target.frequency;
          return result;
        }

        // Real conversion (deflation): needs DB access to look up price index series
        if (methodName === "convertToReal" || methodName === "convertToRealB") {
          const args = await resolveArgs(node.args);

          // Resolve index prefix
          let indexPrefix = "CPI";
          if (args[0] && typeof args[0] === "string") {
            // Positional arg: explicit series name — load directly
            const idxSeries = await SeriesCollection.getByName(args[0]);
            await SeriesCollection.loadCurrentData(idxSeries);
            return target.divide(idxSeries).multiply(100);
          }
          if (args[0] && typeof args[0] === "object") {
            const opts = args[0] as Record<string, string>;
            if (opts.index) indexPrefix = opts.index;
          }
          if (methodName === "convertToRealB") {
            if (indexPrefix.toUpperCase().endsWith("_B")) {
              throw new EvalExecuteError("Do not include _B in index name");
            }
            indexPrefix = indexPrefix + "_B";
          }

          // Determine geography for index lookup
          const HAWAII_GEOS = new Set([
            "HI",
            "HAW",
            "HON",
            "KAU",
            "MAU",
            "NBI",
            "MAUI",
            "LAN",
            "MOL",
            "HAWH",
            "HAWK",
            "HIONLY",
          ]);
          const parsed = target.parseName();
          const geo = parsed.geo;
          const freq = parsed.freq;

          let idxSeries: Series | null = null;
          if (HAWAII_GEOS.has(geo.toUpperCase())) {
            // Try HON first, fall back to HI
            const honName = Series.buildName(indexPrefix, "HON", freq);
            try {
              idxSeries = await SeriesCollection.getByName(honName);
            } catch {
              const hiName = Series.buildName(indexPrefix, "HI", freq);
              idxSeries = await SeriesCollection.getByName(hiName);
            }
          } else {
            const idxName = Series.buildName(indexPrefix, geo, freq);
            idxSeries = await SeriesCollection.getByName(idxName);
          }

          await SeriesCollection.loadCurrentData(idxSeries);
          return target.divide(idxSeries).multiply(100);
        }

        // Moving average methods: Rails defines these with a `window:`
        // keyword argument, e.g.
        //   backward_looking_moving_average(window: 14)
        // which our parser turns into an `options` arg. The TS
        // implementations take `window` as a simple positional number,
        // so extract it here before dispatching. Silently ignore any
        // positional start/end date args since the TS versions don't
        // support them yet.
        if (
          methodName === "backwardLookingMovingAverage" ||
          methodName === "forwardLookingMovingAverage"
        ) {
          const args = await resolveArgs(node.args);
          let window: number | undefined;
          for (const a of args) {
            if (a && typeof a === "object" && !(a instanceof Series)) {
              const w = (a as Record<string, unknown>).window;
              if (w !== undefined) window = Number(w);
            }
          }
          const fn = (target as unknown as Record<string, unknown>)[methodName];
          if (typeof fn !== "function") {
            throw new EvalExecuteError(
              `Series does not implement method: ${methodName}`,
            );
          }
          const result = (fn as (w?: number) => Series).call(target, window);
          return result instanceof Series ? result : target;
        }

        const fn = (target as unknown as Record<string, unknown>)[methodName];
        if (typeof fn !== "function") {
          throw new EvalExecuteError(
            `Series does not implement method: ${methodName}`,
          );
        }

        const args = await resolveArgs(node.args);
        const result = await fn.call(target, ...args);
        return result instanceof Series ? result : target;
      }

      case "static_method": {
        // Bare `Series.search(...)` with no reduction chained after it
        // can't produce a single Series. The `instance_method` branch
        // handles the `.sum`/`.first`/`.last` variants; if we land here,
        // the eval is incomplete.
        if (node.method === "search") {
          throw new EvalExecuteError(
            `Series.search(...) must be followed by a reduction: .sum, .first, or .last`,
          );
        }

        const methodName = snakeToCamel(node.method);

        // Multi-series demetra load + mean correction. Rails source
        // (tmp/lib/series_sharing.rb:97-102):
        //   Series.add_demetra_series_and_mean_correct(s1, s2, mc, file)
        // Loads SA data for s1 and s2 from the demetra file, sums them,
        // then mean-corrects against the annual sum of the `mc` series.
        // Lives inline here (not in SeriesCollection) alongside the other
        // file + DB hybrid handlers like loadMeanCorrectedSaFrom, since
        // SeriesCollection only owns the pure API loaders.
        if (methodName === "addDemetraSeriesAndMeanCorrect") {
          const args = await resolveArgs(node.args);
          if (args.length !== 4) {
            throw new EvalExecuteError(
              `Series.add_demetra_series_and_mean_correct expects 4 args (series1, series2, mcSeries, file), got ${args.length}`,
            );
          }
          const name1 = String(args[0]);
          const name2 = String(args[1]);
          const mcName = String(args[2]);
          const file = String(args[3]);

          const reader = DataFileReader.fromFile(file, "sadata");

          // For each add-series, look up the series in the DB to get its
          // NS variant name, then read that series's demetra output from
          // the file. Mirrors `load_sa_from` semantics at line 266 above:
          // when the target isn't already NS, look up by `nsSeriesName`.
          const loadOne = async (name: string): Promise<Series> => {
            const dbSeries = await SeriesCollection.getByName(name);
            const lookupName = dbSeries.isNS
              ? dbSeries.name
              : dbSeries.nsSeriesName;
            const dataMap = reader.series(lookupName);
            const s = new Series({ name: `${name} SA from <${file}>` });
            s.data = dataMap;
            s.frequency = reader.frequency;
            return s;
          };

          const [as1, as2] = await Promise.all([
            loadOne(name1),
            loadOne(name2),
          ]);
          const asSum = as1.add(as2);

          // Mean correct against the annual sum of mcSeries
          const mcSeries = await SeriesCollection.getByName(mcName);
          await SeriesCollection.loadCurrentData(mcSeries);

          const meanCorrected = asSum
            .divide(asSum.annualSum())
            .multiply(mcSeries.annualSum());

          const result = new Series({
            name: `${name1} + ${name2} from demetra output of <${file}> mean corrected against ${mcName}`,
          });
          result.data = meanCorrected.data;
          result.frequency = reader.frequency;
          return result;
        }

        if (!ALLOWED_STATIC_METHODS.has(methodName)) {
          throw new EvalExecuteError(
            `Static method not allowed: ${node.method} (mapped to ${methodName})`,
          );
        }

        const fn = (SeriesCollection as unknown as Record<string, unknown>)[
          methodName
        ];
        if (typeof fn !== "function") {
          throw new EvalExecuteError(
            `SeriesCollection does not implement method: ${methodName}`,
          );
        }

        const args = await resolveArgs(node.args);
        return fn.call(SeriesCollection, ...args) as Promise<Series>;
      }

      case "arithmetic": {
        const [left, right] = await Promise.all([
          this.execute(node.left, universe),
          this.execute(node.right, universe),
        ]);

        const methodName = OP_TO_METHOD[node.op];
        if (!methodName) {
          throw new EvalExecuteError(`Unknown arithmetic operator: ${node.op}`);
        }

        const fn = (left as unknown as Record<string, unknown>)[methodName];
        if (typeof fn !== "function") {
          throw new EvalExecuteError(
            `Series does not implement arithmetic method: ${methodName}`,
          );
        }

        // If the right side is a scalar wrapper, pass the number directly
        if (right.name.startsWith("__scalar_")) {
          const scalarVal = right.data.get("scalar");
          const result = await fn.call(left, scalarVal);
          return result instanceof Series ? result : left;
        }

        const result = await fn.call(left, right);
        return result instanceof Series ? result : left;
      }
    }
  }

  /** Top-level convenience: parse + execute. */
  static async run(
    evalStr: string,
    universe: string = "UHERO",
  ): Promise<Series> {
    const node = EvalParser.parse(evalStr);
    return this.execute(node, universe);
  }
}

// ─── Errors ─────────────────────────────────────────────────────────

export class EvalExecuteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvalExecuteError";
  }
}

export { EvalParser, EvalParseError };
export default EvalExecutor;
