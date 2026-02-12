import EvalParser, { EvalParseError } from "./eval-parser";
import type { EvalNode, EvalArg } from "./eval-parser";
import DataFileReader from "./data-file-reader";
import Series from "../models/series";
import SeriesCollection from "../collections/series-collection";

// ─── Ruby → TypeScript method name mapping ──────────────────────────

/** Explicit aliases for Ruby method names that don't follow snake_case conventions. */
const METHOD_ALIASES: Record<string, string> = {
  "load_api_bls_NEW": "loadApiBlsV2",
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
  "diff",
  "annualSum",
  "annualAverage",
  "percentageChange",
  "yoyDiff",
  "scaledData",
  // Aggregation
  "aggregate",
  // Interpolation
  "fillMissingMonthsLinear",
  "interpolate",
  "linearInterpolate",
  "fillInterpolateTo",
  // Data adjustment
  "trim",
  "shiftBy",
  // File loading
  "loadFrom",
  "loadSaFrom",
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
  arg: EvalArg
): Promise<string | number | boolean | Series | Record<string, string | number | boolean>> {
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
      return arg.value;
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
            `Instance method not allowed: ${node.method} (mapped to ${methodName})`
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

        const fn = (target as unknown as Record<string, unknown>)[methodName];
        if (typeof fn !== "function") {
          throw new EvalExecuteError(
            `Series does not implement method: ${methodName}`
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
            `Static method not allowed: ${node.method} (mapped to ${methodName})`
          );
        }

        const fn = (SeriesCollection as unknown as Record<string, unknown>)[methodName];
        if (typeof fn !== "function") {
          throw new EvalExecuteError(
            `SeriesCollection does not implement method: ${methodName}`
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
            `Series does not implement arithmetic method: ${methodName}`
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
