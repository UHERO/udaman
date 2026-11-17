/**
 * One-time bulk fill of measurement metadata, without the ops agent
 * (docs/2026-11-13-ops-agent-design.md, "One-time bulk pass").
 *
 * Finds measurements in a data list whose own source, unit or portal name
 * is empty while every series in them that has a value agrees on it, and
 * at least one series has none. Setting that value on the measurement
 * fills the gap for the series without one (the portal falls back from
 * the series to the measurement). Nothing already set is changed.
 *
 * Two steps, with a person in between:
 *
 *   1. Report (read-only):
 *        bun run scripts/ops-measurement-fill.ts --report fill.csv
 *   2. Review fill.csv; delete the rows you don't want. Then:
 *        bun run scripts/ops-measurement-fill.ts --apply fill.csv \
 *          --user you@hawaii.edu            (dry run: says what it would do)
 *        bun run scripts/ops-measurement-fill.ts --apply fill.csv \
 *          --user you@hawaii.edu --execute
 *
 * Each row is re-checked when applied: skipped if the measurement got a
 * value in the meantime or its series no longer agree on the CSV's value.
 * Writes go through the ops change path, so they are logged in app_logs
 * under your user and the matching ops issues resolve.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { mysql, rawQuery } from "@database/mysql";

import { userActor } from "@/core/ops/actors";
import { applyMeasurementMetadata } from "@/core/ops/changes";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const UNIVERSE = opt("--universe") ?? "UHERO";

const FIELDS = {
  source_id: {
    series: "source_id",
    measurement: "source_id",
    text: false,
    label: "(SELECT description FROM sources WHERE id = v.value)",
  },
  unit_id: {
    series: "unit_id",
    measurement: "unit_id",
    text: false,
    label:
      "(SELECT CONCAT_WS(' / ', short_label, long_label) FROM units WHERE id = v.value)",
  },
  dataPortalName: {
    series: "dataPortalName",
    measurement: "data_portal_name",
    text: true,
    label: "v.value",
  },
} as const;
type Field = keyof typeof FIELDS;

interface Candidate {
  measurement_id: number;
  field: Field;
  value: string;
  value_label: string | null;
  prefix: string;
  measurement_label: string | null;
  series_with_value: number;
  series_missing: number;
  example_missing: string | null;
}

const empty = (expr: string, text: boolean) =>
  text ? `(${expr} IS NULL OR ${expr} = '')` : `${expr} IS NULL`;

async function candidates(
  field: Field,
  measurementId?: number,
): Promise<Candidate[]> {
  const f = FIELDS[field];
  const sCol = `s.\`${f.series}\``;
  const mCol = `m.\`${f.measurement}\``;
  const rows = await rawQuery<Omit<Candidate, "field">>(
    `SELECT v.measurement_id, v.value, ${f.label} AS value_label, v.prefix,
            v.measurement_label, v.series_with_value, v.series_missing,
            v.example_missing
     FROM (
       SELECT m.id AS measurement_id, m.prefix,
              m.data_portal_name AS measurement_label,
              MIN(CASE WHEN NOT ${empty(sCol, f.text)} THEN ${sCol} END) AS value,
              COUNT(DISTINCT CASE WHEN NOT ${empty(sCol, f.text)} THEN ${sCol} END) AS distinct_values,
              SUM(NOT ${empty(sCol, f.text)}) AS series_with_value,
              SUM(${empty(sCol, f.text)}) AS series_missing,
              MIN(CASE WHEN ${empty(sCol, f.text)} THEN s.name END) AS example_missing
       FROM measurements m
       JOIN measurement_series ms ON ms.measurement_id = m.id
       JOIN series s ON s.id = ms.series_id AND s.universe = m.universe
       WHERE m.universe = ? AND ${empty(mCol, f.text)}
         ${measurementId != null ? "AND m.id = ?" : ""}
         AND EXISTS (SELECT 1 FROM data_list_measurements dlm
                     WHERE dlm.measurement_id = m.id)
       GROUP BY m.id, m.prefix, m.data_portal_name
       HAVING distinct_values = 1 AND series_missing > 0
     ) v
     ORDER BY v.prefix`,
    measurementId != null ? [UNIVERSE, measurementId] : [UNIVERSE],
  );
  return rows.map((r) => ({ ...r, field, value: String(r.value) }));
}

const COLUMNS = [
  "measurement_id",
  "field",
  "value",
  "value_label",
  "prefix",
  "measurement_label",
  "series_with_value",
  "series_missing",
  "example_missing",
] as const;

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Minimal CSV reader (quoted fields, doubled quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

async function report(path: string | undefined): Promise<void> {
  const all: Candidate[] = [];
  for (const field of Object.keys(FIELDS) as Field[]) {
    const rows = await candidates(field);
    const series = rows.reduce((n, r) => n + Number(r.series_missing), 0);
    console.log(
      `${field}: ${rows.length} measurements, filling ${series} series`,
    );
    all.push(...rows);
  }
  if (!path) {
    console.log("No --report path given; nothing written.");
    return;
  }
  const lines = [
    COLUMNS.join(","),
    ...all.map((r) => COLUMNS.map((c) => cell(r[c])).join(",")),
  ];
  writeFileSync(path, `${lines.join("\n")}\n`);
  console.log(
    `Wrote ${all.length} rows to ${path}. Delete rows you don't want, then --apply.`,
  );
}

async function apply(path: string): Promise<void> {
  const email = opt("--user");
  if (!email) throw new Error("--apply needs --user <your email>");
  const users = await mysql<{ id: number; role: string }>`
    SELECT id, role FROM users WHERE email = ${email} LIMIT 1
  `;
  if (!users[0] || !["dev", "admin"].includes(users[0].role))
    throw new Error(`${email} is not a dev or admin user`);
  const actor = await userActor(Number(users[0].id), "ui");
  const execute = flag("--execute");

  const [header, ...rows] = parseCsv(readFileSync(path, "utf8"));
  const col = (name: string) => header.indexOf(name);
  for (const need of ["measurement_id", "field", "value"])
    if (col(need) < 0) throw new Error(`CSV has no ${need} column`);

  let applied = 0;
  let skipped = 0;
  for (const r of rows) {
    const id = Number(r[col("measurement_id")]);
    const field = r[col("field")] as Field;
    const value = r[col("value")];
    if (!Number.isInteger(id) || !(field in FIELDS) || !value) {
      console.log(`skip (bad row): ${r.join(",")}`);
      skipped++;
      continue;
    }
    // Re-check: still empty on the measurement, series still agree on this.
    const [now] = await candidates(field, id);
    if (!now || now.value !== value) {
      console.log(
        `skip measurement ${id} ${field}: ${now ? `series now agree on ${now.value}, not ${value}` : "no longer applies"}`,
      );
      skipped++;
      continue;
    }
    console.log(
      `${execute ? "set" : "would set"} ${now.prefix} (${id}) ${field} = ${value}${now.value_label && now.value_label !== value ? ` [${now.value_label}]` : ""} → fills ${now.series_missing} series`,
    );
    if (execute) {
      await applyMeasurementMetadata(
        id,
        { [field]: FIELDS[field].text ? value : Number(value) },
        actor,
        null,
      );
    }
    applied++;
  }
  console.log(
    `${execute ? "Applied" : "Dry run:"} ${applied} row(s), skipped ${skipped}.${execute ? "" : " Re-run with --execute to write."}`,
  );
  // Let the issue bookkeeping the writes kicked off finish.
  if (execute) await new Promise((res) => setTimeout(res, 3000));
}

async function run(): Promise<void> {
  const applyPath = opt("--apply");
  if (applyPath) await apply(applyPath);
  else await report(opt("--report"));
}

await run();
process.exit(0);
