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
  "diff",
  "annualSum",
  "annualAverage",
  "percentageChange",
  "yoyDiff",
  "scaledData",
  // Aggregation
  "aggregate",
  // Interpolation
  "addMissingDp",
  "fillMissingMonthsLinear",
  "interpolate",
  "linearInterpolate",
  "fillInterpolateTo",
  // Moving averages & sharing
  "movingAverage",
  "movingAverageOffsetEarly",
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
  "aaStateBasedCountyShareFor",
  "movingAverageAnnavgPadded",
  "getLastCompleteDecember",
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
  string | number | boolean | Series | Record<string, string | number | boolean>
> {
  switch (arg.type) {
    case "string":
      return arg.value;
    case "number":
      return arg.value;
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
      // Coerce all values to strings — API methods expect Record<string, string>
      return Object.fromEntries(
        Object.entries(arg.value).map(([k, v]) => [k, String(v)]),
      );
    case "expression":
      return EvalExecutor.execute(arg.node);
  }
}

async function resolveArgs(args: EvalArg[]): Promise<unknown[]> {
  return Promise.all(args.map(resolveArg));
}

// ─── Executor ───────────────────────────────────────────────────────

class EvalExecutor {
  /** Execute a parsed eval node, returning a Series with data. */
  static async execute(node: EvalNode): Promise<Series> {
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
        const target = await this.execute(node.target);
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
        if (
          methodName === "convertToReal" ||
          methodName === "convertToRealB"
        ) {
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
              throw new EvalExecuteError(
                "Do not include _B in index name",
              );
            }
            indexPrefix = indexPrefix + "_B";
          }

          // Determine geography for index lookup
          const HAWAII_GEOS = new Set([
            "HI", "HAW", "HON", "KAU", "MAU", "NBI",
            "MAUI", "LAN", "MOL", "HAWH", "HAWK", "HIONLY",
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
        const methodName = snakeToCamel(node.method);

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
          this.execute(node.left),
          this.execute(node.right),
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
  static async run(evalStr: string): Promise<Series> {
    const node = EvalParser.parse(evalStr);
    return this.execute(node);
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
