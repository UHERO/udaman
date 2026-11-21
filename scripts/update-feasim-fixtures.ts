/**
 * Refresh the feasim test fixtures in src/lib/feasim/fixtures from
 * UHERO/feasim at the installed @uhero/feasim version, after a version bump:
 *
 *   bun scripts/update-feasim-fixtures.ts
 *
 * The files are copied, not generated: they record what the Housing Policy
 * Simulator's pages use, independently of the model code the API runs, which
 * is what makes the tests against them meaningful. The npm package ships only
 * dist/, so they come from the GitHub release tag. Keeps each file's _about
 * note and stamps _feasim_version, which the tests check against the
 * installed package.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const DIR = "src/lib/feasim/fixtures";

/** Each fixture, and its _about note when the file doesn't exist yet. */
const FIXTURES: Record<string, string> = {
  "calculator-defaults.json":
    "Test data only; nothing in the app reads this file. Each case is the complete set of model (calcSingle) inputs the Housing Policy Simulator's calculator page builds at its default settings. See calculator-cases.ts.",
  "gauge-parcels.json":
    "Test data only; nothing in the app reads this file. A sample of the real Oahu parcels the Housing Policy Simulator's gauge maps, per pathway. The gauge runs each through calcParcel; the gauge endpoints must give the same result from the parcel sent as query parameters. See gauge-cases.ts.",
};

const version = JSON.parse(
  readFileSync("node_modules/@uhero/feasim/package.json", "utf8"),
).version as string;

/**
 * A fixture's entries by name: a calculator case ("bill6 with retail"), or a
 * gauge parcel as "<pathway> <tmk>". Notes (keys starting with "_") skipped.
 */
function entries(data: Record<string, unknown>) {
  const out = new Map<string, Record<string, unknown>>();
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("_")) continue;
    if (Array.isArray(value))
      value.forEach((item: Record<string, unknown>, i) =>
        out.set(`${key} ${item.tmk ?? `#${i}`}`, item),
      );
    else if (value && typeof value === "object")
      out.set(key, value as Record<string, unknown>);
  }
  return out;
}

/** "a, b, c and 4 more", or "all 17" when every entry has it. */
function which(names: string[], total: number) {
  if (names.length === total && total > 1) return `all ${total}`;
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${shown} and ${names.length - 3} more` : shown;
}

/**
 * What changed, one line per distinct change, with identical changes across
 * entries grouped: "land_cost: 130 → 140   in all 17".
 */
function summarize(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  const a = entries(before);
  const b = entries(after);
  const changes = new Map<string, string[]>();
  for (const [name, next] of b) {
    const prev = a.get(name);
    if (!prev) continue;
    for (const field of new Set([...Object.keys(prev), ...Object.keys(next)])) {
      const o = JSON.stringify(prev[field]) ?? "(none)";
      const n = JSON.stringify(next[field]) ?? "(none)";
      if (o === n) continue;
      const change = `${field}: ${o} → ${n}`;
      changes.set(change, [...(changes.get(change) ?? []), name]);
    }
  }
  const added = [...b.keys()].filter((k) => !a.has(k));
  const removed = [...a.keys()].filter((k) => !b.has(k));

  const lines = [...changes]
    .sort((x, y) => y[1].length - x[1].length)
    .map(
      ([change, names]) => `  ${change.padEnd(44)} in ${which(names, b.size)}`,
    );
  if (added.length)
    lines.push(`  + ${added.length} new: ${which(added, added.length)}`);
  if (removed.length)
    lines.push(
      `  - ${removed.length} removed: ${which(removed, removed.length)}`,
    );
  return lines.length ? lines : ["  no changes"];
}

for (const [file, about] of Object.entries(FIXTURES)) {
  const url = `https://raw.githubusercontent.com/UHERO/feasim/v${version}/test/data/${file}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`${res.status} fetching ${url}`);
    process.exit(1);
  }
  const { _source, ...cases } = (await res.json()) as Record<string, unknown>;
  const path = `${DIR}/${file}`;
  const current = existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>)
    : {};

  const out = {
    _about: current._about ?? about,
    _feasim_version: version,
    _source:
      `Copied from UHERO/feasim@v${version} test/data/${file}. ${String(_source ?? "")}`.trim(),
    ...cases,
  };
  writeFileSync(path, `${JSON.stringify(out, null, 1)}\n`);
  const from = (current._feasim_version as string | undefined) ?? "new file";
  console.log(
    `\n${file} (${from} → ${version}, ${entries(out).size} entries)\n${summarize(current, out).join("\n")}`,
  );
}
