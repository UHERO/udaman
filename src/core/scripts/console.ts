/**
 * Interactive REPL for working directly with backend code.
 *
 *   bun console
 *
 * All collections, models, and utilities are available as globals:
 *
 *   udaman> const s = await SeriesCollection.getByName("E_NF@HI.M")
 *   udaman> s.name
 *   udaman> await LoaderCollection.getBySeriesId(s.id)
 */
import * as readline from "node:readline/promises";
import { inspect } from "node:util";

// ─── Database ────────────────────────────────────────────────────────
import { mysql, rawQuery } from "@database/mysql";

// ─── Collections ─────────────────────────────────────────────────────
import CategoryCollection from "@catalog/collections/category-collection";
import DataListCollection from "@catalog/collections/data-list-collection";
import GeographyCollection from "@catalog/collections/geography-collection";
import LoaderCollection from "@catalog/collections/loader-collection";
import MeasurementCollection from "@catalog/collections/measurement-collection";
import SeriesCollection from "@catalog/collections/series-collection";
import SourceCollection from "@catalog/collections/source-collection";
import SourceDetailCollection from "@catalog/collections/source-detail-collection";
import UnitCollection from "@catalog/collections/unit-collection";
import UniverseCollection from "@catalog/collections/universe-collection";
import TimeSeriesCollection from "@catalog/collections/time-series-collection";

// ─── Models ──────────────────────────────────────────────────────────
import Category from "@catalog/models/category";
import DataList from "@catalog/models/data-list";
import Geography from "@catalog/models/geography";
import Loader from "@catalog/models/loader";
import Measurement from "@catalog/models/measurement";
import Series from "@catalog/models/series";
import Source from "@catalog/models/source";
import SourceDetail from "@catalog/models/source-detail";
import TimeSeries from "@catalog/models/time-series";
import Unit from "@catalog/models/unit";

// ─── Utilities ───────────────────────────────────────────────────────
import EvalExecutor from "@catalog/utils/eval-executor";
import EvalParser from "@catalog/utils/eval-parser";
import { hash as hashPassword, compare as comparePassword } from "bcryptjs";

// ─── Helpers ─────────────────────────────────────────────────────────

async function resetAllPasswords(newPassword: string = "change me") {
  const hashed = await hashPassword(newPassword, 10);
  await mysql`UPDATE users SET encrypted_password = ${hashed}`;
  const rows = await mysql`SELECT COUNT(*) as count FROM users`;
  const count = (rows[0] as Record<string, unknown>).count;
  console.log(`Reset ${count} user passwords to "${newPassword}"`);
}

// ─── Expose as globals ──────────────────────────────────────────────

const ctx: Record<string, unknown> = {
  mysql,
  rawQuery,
  CategoryCollection,
  DataListCollection,
  GeographyCollection,
  LoaderCollection,
  MeasurementCollection,
  SeriesCollection,
  SourceCollection,
  SourceDetailCollection,
  UnitCollection,
  UniverseCollection,
  TimeSeriesCollection,
  Category,
  DataList,
  Geography,
  Loader,
  Measurement,
  Series,
  Source,
  SourceDetail,
  TimeSeries,
  Unit,
  EvalExecutor,
  EvalParser,
  hashPassword,
  comparePassword,
  resetAllPasswords,
};

Object.assign(globalThis, ctx);

// ─── Tab completion ─────────────────────────────────────────────────

const completionNames = Object.keys(ctx);

function completer(line: string): [string[], string] {
  // Find the last word being typed (after space, paren, dot, etc.)
  const match = line.match(/([\w.]+)$/);
  const partial = match ? match[1] : "";

  if (partial.includes(".")) {
    // Dot completion: e.g. "SeriesCollection.get" → look up methods
    const parts = partial.split(".");
    const objName = parts.slice(0, -1).join(".");
    const methodPrefix = parts[parts.length - 1];
    try {
      const obj = (0, eval)(objName);
      if (obj != null) {
        const keys = new Set<string>();
        // Walk prototype chain
        let proto = obj;
        while (proto && proto !== Object.prototype) {
          for (const k of Object.getOwnPropertyNames(proto)) keys.add(k);
          proto = Object.getPrototypeOf(proto);
        }
        // Also own keys for static classes
        if (typeof obj === "function") {
          for (const k of Object.getOwnPropertyNames(obj)) keys.add(k);
        }
        const hits = [...keys]
          .filter((k) => k.startsWith(methodPrefix) && !k.startsWith("_"))
          .map((k) => `${objName}.${k}`);
        return [hits.length ? hits : [], partial];
      }
    } catch {
      // ignore eval errors during completion
    }
    return [[], partial];
  }

  // Top-level name completion
  const hits = completionNames.filter((n) => n.startsWith(partial));
  return [hits.length ? hits : completionNames, partial];
}

// ─── REPL ───────────────────────────────────────────────────────────

console.log("Udaman console ready.");
console.log("Collections: SeriesCollection, LoaderCollection, MeasurementCollection, ...");
console.log("Models:      Series, Loader, Measurement, ...");
console.log("Utils:       EvalParser, EvalExecutor, mysql, rawQuery");
console.log("Auth:        hashPassword, comparePassword, resetAllPasswords");
console.log("Type .help for available globals, .exit to quit");
console.log("");
console.log("Try: const s = await SeriesCollection.getByName('E_NF@HI.M')");
console.log("");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "udaman> ",
  completer,
});

rl.prompt();

rl.on("line", async (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) {
    rl.prompt();
    return;
  }
  if (trimmed === ".exit" || trimmed === "exit") {
    process.exit(0);
  }
  if (trimmed === ".help") {
    console.log("\nAvailable globals:\n");
    console.log("  DB:          mysql, rawQuery");
    console.log("  Collections: CategoryCollection, DataListCollection, GeographyCollection,");
    console.log("               LoaderCollection, MeasurementCollection, SeriesCollection,");
    console.log("               SourceCollection, SourceDetailCollection, UnitCollection,");
    console.log("               UniverseCollection");
    console.log("  Models:      Category, DataList, Geography, Loader, Measurement,");
    console.log("               Series, Source, SourceDetail, Unit");
    console.log("  Utils:       EvalExecutor, EvalParser");
    console.log("  Auth:        hashPassword, comparePassword, resetAllPasswords");
    console.log("\n  .exit  quit\n");
    rl.prompt();
    return;
  }

  try {
    // Try as expression first (so `s.name` returns the value)
    let result: unknown;
    try {
      // indirect eval runs in global scope so globalThis assignments are visible
      const indirectEval = eval;
      result = await indirectEval(`(async()=>(${trimmed}))()`);
    } catch {
      // Fall back to statement (e.g. `const s = ...`)
      const indirectEval = eval;
      result = await indirectEval(`(async()=>{${trimmed}})()`);
    }
    if (result !== undefined) {
      console.log(inspect(result, { colors: true, depth: 4 }));
    }
  } catch (err: unknown) {
    console.error(err instanceof Error ? err.message : err);
  }

  rl.prompt();
});

rl.on("close", () => process.exit(0));
