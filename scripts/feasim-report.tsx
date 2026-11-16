/**
 * A visual report of the feasim API checked against the Housing Policy
 * Simulator, every difference highlighted:
 * - Calculator: each calculator-fixture case, the page's model inputs and
 *   result next to what the calculator endpoint built from a user's settings.
 * - Gauge: each sample parcel (TOD at every tier), the gauge's own result
 *   (calcParcel) next to the gauge endpoint's.
 * - Snapshots: each saved API response (snapshot-cases.ts) next to what the
 *   API returns now, so you can see what your changes did.
 *
 *   bun run report:feasim            # writes and opens it
 *   bun run report:feasim out.html   # writes it there
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { calcSingle, overallLevel, parcelInputs } from "@uhero/feasim";
import type { ProgramId } from "@uhero/feasim";

import { GET as calculatorRoute } from "@/app/api/feasim/calculator/[pathway]/route";
import { GET as gaugeRoute } from "@/app/api/feasim/gauge/[pathway]/route";
import { setApiKeyLookup } from "@/lib/feasim/auth";
import { calculatorCases } from "@/lib/feasim/calculator-cases";
import { KEY_RESULT_FIELDS, PATHWAY_INFO } from "@/lib/feasim/docs-content";
import { gaugeCases } from "@/lib/feasim/gauge-cases";
import {
  FEASIM_VERSION,
  parseFeasimQuery,
  PROGRAMS,
} from "@/lib/feasim/params";
import { setRateLimit } from "@/lib/feasim/rate-limit";
import {
  diffJson,
  loadSnapshots,
  SNAPSHOT_CASES,
  takeSnapshot,
} from "@/lib/feasim/snapshot-cases";

type Obj = Record<string, unknown>;

/** Compare as a caller sees it: through JSON (NaN and Infinity → null). */
const viaJson = (v: unknown) =>
  v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const same = (a: unknown, b: unknown) =>
  JSON.stringify(viaJson(a)) === JSON.stringify(viaJson(b));

/** Field-by-field rows; `order` first, then the rest alphabetically. */
function compare(expected: object, actual: object, order: string[] = []) {
  const [e, a] = [viaJson(expected) as Obj, viaJson(actual) as Obj];
  const rest = [...new Set([...Object.keys(e), ...Object.keys(a)])]
    .filter((k) => !order.includes(k))
    .sort();
  return [...order, ...rest].map((key) => ({
    key,
    expected: e[key],
    actual: a[key],
    same: same(e[key], a[key]),
  }));
}
type Row = ReturnType<typeof compare>[number];

// ── run every case through the real routes ─────────────────────────────

setApiKeyLookup(async () => [
  { id: 0, name: "report", hostname: null, universe: "UHERO" },
]);
setRateLimit(0); // ~750 requests on one key, on purpose

async function call(
  route: typeof gaugeRoute,
  mode: string,
  program: ProgramId,
  query: URLSearchParams,
) {
  const res = await route(
    new NextRequest(
      `${process.env.AUTH_URL}/api/feasim/${mode}/${program}?${query}`,
      {
        headers: { authorization: "Bearer report" },
      },
    ),
    { params: Promise.resolve({ pathway: program }) },
  );
  return { status: res.status, body: await res.json() };
}

const calculator = await Promise.all(
  calculatorCases().map(async ({ name, inputs, query }) => {
    const program = inputs.program as ProgramId;
    const { status, body } = await call(
      calculatorRoute,
      "calculator",
      program,
      query,
    );
    // what the API handed the model: its parsed parcel and options, plus the
    // levers it reports applying
    const req = parseFeasimQuery(query, "calculator", [program]);
    const apiInputs = parcelInputs(
      program,
      req.parcel,
      body.levers ?? {},
      req.opts,
    );
    const results = compare(
      calcSingle(inputs),
      body.result ?? {},
      Object.keys(KEY_RESULT_FIELDS),
    );
    return {
      name,
      request: `/api/feasim/calculator/${program}?${query}`,
      status,
      results,
      inputs: compare(inputs, apiInputs),
      ok: status === 200 && results.every((r) => r.same),
    };
  }),
);

const gauge = await Promise.all(
  gaugeCases().map(async (c) => {
    const { status, body } = await call(
      gaugeRoute,
      "gauge",
      c.program,
      c.query,
    );
    const { envelope, result } = c.expected();
    const level = overallLevel(result);
    const resultOk = same(result, body.result);
    const envelopeOk = same(envelope, body.envelope);
    return {
      ...c,
      status,
      envelope: [envelope.status, body.envelope?.status],
      expected: viaJson(result) as Obj,
      actual: (body.result ?? {}) as Obj,
      level: [level, body.verdict?.overall],
      resultOk,
      envelopeOk,
      ok:
        status === 200 &&
        resultOk &&
        envelopeOk &&
        level === body.verdict?.overall,
    };
  }),
);

const savedSnapshots = loadSnapshots();
const snapshots = await Promise.all(
  SNAPSHOT_CASES.map(async (c) => {
    const saved = savedSnapshots[c.name];
    const current = await takeSnapshot(c);
    const changes = saved ? diffJson(saved, current) : [];
    return { ...c, saved, current, changes, ok: !!saved && !changes.length };
  }),
);

// ── components ─────────────────────────────────────────────────────────

/** The figures the gauge maps and totals, as in feasim's gauge test. */
const GAUGE_COLUMNS = {
  max_units: "Units",
  affordable_units: "Affordable",
  parking_stalls: "Stalls",
  rlv_sqft: "RLV $/sqft",
  dev_roc: "Return on cost",
};

const Badge = ({
  ok,
  yes = "✓ match",
  no = "✗ differs",
}: {
  ok: boolean;
  yes?: string;
  no?: string;
}) => <span className={ok ? "ok" : "bad"}>{ok ? yes : no}</span>;

/** Grouped digits, exact on hover. */
function Value({ v }: { v: unknown }) {
  if (v === undefined) return <span className="none">—</span>;
  if (typeof v === "number")
    return (
      <span title={String(v)}>
        {v.toLocaleString("en-US", { maximumFractionDigits: 6 })}
      </span>
    );
  return typeof v === "object" && v ? (
    <code>{JSON.stringify(v)}</code>
  ) : (
    <>{String(v)}</>
  );
}

/** One value, or "expected → actual" highlighted when they differ. */
const Pair = ({ v: [e, a] }: { v: unknown[] }) =>
  same(e, a) ? (
    <td>
      <Value v={e} />
    </td>
  ) : (
    <td className="cell-diff">
      <Value v={e} /> <span className="arrow">→</span> <Value v={a} />
    </td>
  );

function CompareTable({
  title,
  rows,
  labels = {},
}: {
  title: string;
  rows: Row[];
  labels?: Record<string, string>;
}) {
  const diffs = rows.filter((r) => !r.same).length;
  return (
    <>
      <h3>
        {title} <Badge ok={!diffs} yes="all match" no={`${diffs} differ`} />
      </h3>
      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>Calculator page</th>
            <th>API</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={r.same ? undefined : "diff"}>
              <td>
                <code>{r.key}</code>
                {labels[r.key] && <div className="label">{labels[r.key]}</div>}
              </td>
              <td>
                <Value v={r.expected} />
              </td>
              <td>
                <Value v={r.actual} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function CalculatorCase({ c }: { c: (typeof calculator)[number] }) {
  const isKey = (r: Row) => r.key in KEY_RESULT_FIELDS;
  const other = c.results.filter((r) => !isKey(r));
  return (
    <details className="case" open={!c.ok}>
      <summary>
        <Badge ok={c.ok} /> <strong>{c.name}</strong>
      </summary>
      <p className="req">
        GET {c.request}{" "}
        <Badge ok={c.status === 200} yes={`${c.status}`} no={`${c.status}`} />
      </p>
      <div className="grid">
        <div>
          <CompareTable
            title="Key results"
            rows={c.results.filter(isKey)}
            labels={KEY_RESULT_FIELDS}
          />
          <details>
            <summary>All other result fields ({other.length})</summary>
            <CompareTable title="Other results" rows={other} />
          </details>
        </div>
        <div>
          <CompareTable title="Model inputs" rows={c.inputs} />
          <p className="note">
            Inputs may differ where the model ignores the field or the default
            is the same (e.g. <code>cap_rate</code> 0.051 is the model&apos;s
            own default); the results are what must match.
          </p>
        </div>
      </div>
    </details>
  );
}

function GaugeRow({ r }: { r: (typeof gauge)[number] }) {
  const p = r.parcel;
  const problem =
    r.status !== 200
      ? `HTTP ${r.status}`
      : !r.resultOk
        ? "other result fields differ"
        : !r.envelopeOk
          ? "envelope differs"
          : null;
  return (
    <tr className={r.ok ? undefined : "diff"}>
      <td>
        <Badge ok={r.ok} yes="✓" no="✗" />
      </td>
      <td>
        <code>{p.tmk}</code>
      </td>
      <td>{p.zone_class}</td>
      <td>
        <Value v={p.lot_sqft} />
      </td>
      <td>
        <Value v={p.height} />
      </td>
      {r.program === "tod" ? (
        <>
          <td>{p.tod_regime ?? "—"}</td>
          <td>{p.station_area ?? "—"}</td>
          <td>{r.tier}</td>
          <Pair v={r.envelope} />
        </>
      ) : (
        <td>{p.parking_exempt ? "yes" : "no"}</td>
      )}
      {Object.keys(GAUGE_COLUMNS).map((f) => (
        <Pair key={f} v={[r.expected[f], r.actual[f]]} />
      ))}
      <Pair v={r.level} />
      <td>
        {problem ? (
          <Badge ok={false} no={problem} />
        ) : (
          <span className="none">all fields</span>
        )}
      </td>
    </tr>
  );
}

function GaugePathway({ program }: { program: ProgramId }) {
  const rows = gauge.filter((g) => g.program === program);
  const failing = rows.filter((r) => !r.ok).length;
  const tod = program === "tod";
  const columns = [
    "",
    "TMK",
    "Zone",
    "Lot sqft",
    "Height",
    ...(tod ? ["Regime", "Station", "Tier", "Status"] : ["Parking exempt"]),
    ...Object.values(GAUGE_COLUMNS),
    "Verdict",
    "Full result",
  ];
  return (
    <details className="case" open={failing > 0}>
      <summary>
        <Badge ok={!failing} no={`✗ ${failing} differ`} />{" "}
        <strong>{program}</strong> · {PATHWAY_INFO[program].name}{" "}
        <span className="none">
          {rows.length} {tod ? "runs (each parcel at 4 tiers)" : "parcels"}
        </span>
      </summary>
      <div className="scroll">
        <table className="gauge">
          <thead>
            <tr>
              {columns.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <GaugeRow key={`${r.parcel.tmk}-${r.tier ?? ""}`} r={r} />
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function SnapshotCase({ s }: { s: (typeof snapshots)[number] }) {
  const status = !s.saved
    ? "not saved yet"
    : s.changes.length
      ? `✗ ${s.changes.length} changed`
      : "✓ unchanged";
  return (
    <details className="case" open={!s.ok}>
      <summary>
        <Badge ok={s.ok} yes={status} no={status} /> <strong>{s.name}</strong>
        <span className="none">HTTP {s.current.status}</span>
      </summary>
      <p className="req">GET /api/feasim{s.current.request}</p>
      {s.changes.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Field</th>
              <th>Saved</th>
              <th>Now</th>
            </tr>
          </thead>
          <tbody>
            {s.changes.map((ch) => (
              <tr key={ch.path} className="diff">
                <td>
                  <code>{ch.path}</code>
                </td>
                <td>
                  <Value v={ch.saved} />
                </td>
                <td>
                  <Value v={ch.current} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <details>
        <summary>Full response now</summary>
        <pre className="json">{JSON.stringify(s.current, null, 2)}</pre>
      </details>
    </details>
  );
}

const count = (n: number, bad: number, noun: string) => (
  <>
    {n} {noun} · <Badge ok={!bad} yes="all match" no={`${bad} differ`} />
  </>
);

function Report({
  calcFailing,
  gaugeFailing,
  snapFailing,
}: {
  calcFailing: number;
  gaugeFailing: number;
  snapFailing: number;
}) {
  const failing = calcFailing + gaugeFailing + snapFailing;
  return (
    <html lang="en">
      {/* a standalone file, not a Next.js page: next/head doesn't apply */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>feasim API check</title>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <main>
          <h1>feasim API check</h1>
          <p className="lede">
            @uhero/feasim v{FEASIM_VERSION} ·{" "}
            <Badge
              ok={!failing}
              yes="everything matches"
              no={`${failing} differ`}
            />{" "}
            · generated {new Date().toLocaleString("en-US")}
          </p>
          <nav>
            <a href="#calculator">Calculator ({calculator.length})</a>
            <a href="#gauge">Gauge ({gauge.length})</a>
            <a href="#snapshots">Snapshots ({snapshots.length})</a>
          </nav>

          <h2 id="calculator">Calculator</h2>
          <p className="lede">
            {count(calculator.length, calcFailing, "cases")}
            <br />
            Each case: the calculator page&apos;s full model inputs (the
            fixture) and its result, next to what the calculator endpoint built
            and returned from only the settings in the request.
          </p>
          {calculator.map((c) => (
            <CalculatorCase key={c.name} c={c} />
          ))}

          <h2 id="gauge">Gauge</h2>
          <p className="lede">
            {count(gauge.length, gaugeFailing, "parcel runs")}
            <br />
            Real Oʻahu parcels from the gauge&apos;s data (feasim&apos;s sample:
            the smallest, median and largest lot per zone). Each row: the
            gauge&apos;s own result (<code>calcParcel</code> on the parcel) next
            to the gauge endpoint&apos;s, given the parcel as query parameters.
            A differing value shows <span className="bad">gauge → API</span>;
            &quot;Full result&quot; compares all ~100 result fields and the
            envelope.
          </p>
          {PROGRAMS.map((p) => (
            <GaugePathway key={p} program={p} />
          ))}

          <h2 id="snapshots">Snapshots</h2>
          <p className="lede">
            {count(snapshots.length, snapFailing, "saved responses")}
            <br />A few API responses saved in{" "}
            <code>src/lib/feasim/__snapshots__/api-responses.json</code>, next
            to what the API returns now. A change means your code or a feasim
            upgrade changed a response; if it&apos;s intended, save it with{" "}
            <code>bun run snapshot:feasim</code> and commit the file.
          </p>
          {snapshots.map((s) => (
            <SnapshotCase key={s.name} s={s} />
          ))}
        </main>
      </body>
    </html>
  );
}

const CSS = `
:root{--bg:#fff;--fg:#1c1917;--muted:#78716c;--line:#e7e5e4;--soft:#f5f5f4;--ok:#15803d;--bad:#b91c1c;--diff:#fef2f2;--accent:#1d667f}
@media (prefers-color-scheme:dark){:root{--bg:#1c1917;--fg:#f5f5f4;--muted:#a8a29e;--line:#44403c;--soft:#292524;--ok:#4ade80;--bad:#f87171;--diff:#3f1d1d;--accent:#7cc4dc}}
body{margin:0;padding:24px 16px;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif}
main{max-width:1280px;margin:0 auto}
h1{margin:0 0 4px;color:var(--accent)} h2{margin:32px 0 4px;padding-top:8px;border-top:1px solid var(--line)} h3{margin:16px 0 6px;font-size:15px}
nav{display:flex;gap:16px;margin:12px 0 0} nav a{color:var(--accent);font-weight:600}
.lede{color:var(--muted);margin:0 0 12px}
.case{border:1px solid var(--line);border-radius:8px;margin:10px 0;padding:0 14px}
.case>summary{cursor:pointer;padding:10px 0;display:flex;gap:12px;flex-wrap:wrap}
.ok{color:var(--ok);font-weight:600} .bad{color:var(--bad);font-weight:600}
.req{font:12px ui-monospace,monospace;background:var(--soft);padding:8px 10px;border-radius:6px;overflow-x:auto;white-space:nowrap}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px} @media (max-width:900px){.grid{grid-template-columns:1fr}}
.scroll{overflow-x:auto;margin-bottom:14px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:4px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{background:var(--soft);font-weight:600;position:sticky;top:0} td{font-variant-numeric:tabular-nums}
table.gauge td,table.gauge th{white-space:nowrap}
tr.diff td{background:var(--diff)} tr.diff td:first-child{box-shadow:inset 3px 0 var(--bad)}
td.cell-diff{background:var(--diff);color:var(--bad);font-weight:600} .arrow{color:var(--muted)}
.label,.note,.none{color:var(--muted);font-size:12px} code{font:12px ui-monospace,monospace}
details details>summary{cursor:pointer;color:var(--accent);margin:10px 0}
pre.json{font:12px ui-monospace,monospace;background:var(--soft);padding:10px;border-radius:6px;overflow:auto;max-height:400px}
`;

// ── write it ───────────────────────────────────────────────────────────

const calcFailing = calculator.filter((c) => !c.ok).length;
const gaugeFailing = gauge.filter((g) => !g.ok).length;
const snapFailing = snapshots.filter((s) => !s.ok).length;
const out = process.argv[2] ?? join(tmpdir(), "feasim-report.html");
writeFileSync(
  out,
  `<!doctype html>${renderToStaticMarkup(
    <Report
      calcFailing={calcFailing}
      gaugeFailing={gaugeFailing}
      snapFailing={snapFailing}
    />,
  )}`,
);
console.log(
  `${out}\ncalculator: ${calculator.length} cases, ${calcFailing} differ · gauge: ${gauge.length} runs, ${gaugeFailing} differ · snapshots: ${snapshots.length}, ${snapFailing} changed`,
);
if (!process.argv[2] && process.platform === "darwin") spawnSync("open", [out]);
process.exit(calcFailing + gaugeFailing + snapFailing ? 1 : 0);
