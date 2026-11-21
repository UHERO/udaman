import {
  TableOfContents,
  type TocItem,
} from "@/components/docs/table-of-contents";
import { CodeBlock, P } from "@/components/typography";
import {
  EXAMPLES,
  KEY_RESULT_FIELDS,
  PATHWAY_INFO,
} from "@/lib/feasim/docs-content";
import {
  FEASIM_VERSION,
  LEVERS,
  ParamError,
  PARCEL_FIELDS,
  parseFeasimQuery,
  PROGRAMS,
  TIER,
  type ParamSpec,
} from "@/lib/feasim/params";
import { runPathway } from "@/lib/feasim/run";

const tocItems: TocItem[] = [
  { id: "overview", label: "Overview", level: 2 },
  { id: "gauge-vs-calculator", label: "Gauge vs. Calculator", level: 2 },
  { id: "endpoints", label: "Endpoints", level: 2 },
  { id: "parameters", label: "Kinds of Parameters", level: 2 },
  { id: "lot", label: "Lot Parameters", level: 2 },
  { id: "options", label: "Options", level: 2 },
  { id: "levers", label: "Levers", level: 2 },
  { id: "response", label: "Response", level: 2 },
  { id: "verdict", label: "Verdict", level: 2 },
  { id: "errors", label: "Errors", level: 2 },
  { id: "versioning", label: "Versioning", level: 2 },
];

// ── live examples: computed from the model at render, so never stale ──

const RESPONSE_EXAMPLE = `/gauge/bill7?${EXAMPLES["/gauge/bill7"]}&fields=max_units,affordable_units,dev_roc,pre_construction_subsidy,rlv_sqft`;
const ERROR_EXAMPLE =
  "/gauge/bill6?lot_sqft=20000&zone_class=bmx3&grant_type=pre_construct&land_cots=200&permanent_rate=0";

function exampleResponse() {
  const params = new URLSearchParams(RESPONSE_EXAMPLE.split("?")[1]);
  const req = parseFeasimQuery(params, "gauge", ["bill7"]);
  return {
    model: { package: "@uhero/feasim", version: FEASIM_VERSION },
    mode: req.mode,
    parcel: req.parcel,
    tier: null,
    ...runPathway("bill7", req),
  };
}

function exampleError() {
  try {
    parseFeasimQuery(
      new URLSearchParams(ERROR_EXAMPLE.split("?")[1]),
      "gauge",
      ["bill6"],
    );
  } catch (e) {
    if (e instanceof ParamError)
      return { error: "Invalid parameters", issues: e.issues };
  }
  return null;
}

/** One request annotated parameter by parameter, in "Kinds of Parameters". */
const ANNOTATED_PATH = "/gauge/tod";
const ANNOTATED: [name: string, value: string, kind: string, note: string][] = [
  ["lot_sqft", "40000", "Lot", "a 40,000 sqft lot…"],
  ["zone_class", "AMX-2", "Lot", "…zoned AMX-2…"],
  ["height", "90", "Lot", "…with a 90 ft zoned height…"],
  ["tod_regime", "pdt", "Lot", "…in an adopted TOD special district…"],
  ["slu_urban", "true", "Lot", "…entirely in the urban district"],
  ["tier", "with_benefits", "Option", "model it under PD-T approval"],
  [
    "land_cost",
    "200",
    "Lever",
    "assume land at $200/sqft, not the $130 default",
  ],
  [
    "fields",
    "max_units,dev_roc",
    "Option",
    "return only units and return on cost",
  ],
];
const ANNOTATED_QUERY = ANNOTATED.map(([n, v]) => `${n}=${v}`).join("&");

// ── small components ─────────────────────────────────────────────────

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2
        id={id}
        className="scroll-mt-20 text-2xl font-semibold text-stone-800 dark:text-stone-100"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function C({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-stone-100 px-1 py-0.5 text-[0.85em] text-stone-800 dark:bg-stone-800 dark:text-stone-200">
      {children}
    </code>
  );
}

function typeLabel(spec: ParamSpec) {
  switch (spec.type) {
    case "number": {
      const lo =
        spec.min === undefined
          ? ""
          : `${spec.exclusiveMin ? ">" : "≥"} ${spec.min}`;
      const hi = spec.max === undefined ? "" : `≤ ${spec.max}`;
      const range = [lo, hi].filter(Boolean).join(", ");
      return range ? `number (${range})` : "number";
    }
    case "enum":
      return spec.values.join(" | ");
    default:
      return spec.type;
  }
}

function ParamTable({
  rows,
  extra,
}: {
  rows: [string, ParamSpec, React.ReactNode?][];
  extra?: string;
}) {
  return (
    <div className="my-4 overflow-x-auto rounded-lg border border-stone-200 dark:border-stone-700">
      <table className="w-full text-left text-sm">
        <thead className="bg-stone-50 text-stone-600 dark:bg-stone-800/50 dark:text-stone-300">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Pathways</th>
            {extra && <th className="px-3 py-2 font-medium">{extra}</th>}
            <th className="px-3 py-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-200 dark:divide-stone-700">
          {rows.map(([name, spec, extraCell]) => (
            <tr key={name} className="align-top">
              <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-stone-900 dark:text-stone-100">
                {name}
              </td>
              <td className="max-w-48 px-3 py-2 font-mono text-xs break-words text-stone-600 dark:text-stone-300">
                {typeLabel(spec)}
              </td>
              <td
                className={
                  spec.pathways
                    ? "px-3 py-2 font-mono text-xs font-semibold text-stone-800 dark:text-stone-100"
                    : "px-3 py-2 text-xs text-stone-400 dark:text-stone-500"
                }
              >
                {spec.pathways?.join(", ") ?? "all"}
              </td>
              {extra && (
                <td className="px-3 py-2 text-xs whitespace-nowrap text-stone-600 dark:text-stone-300">
                  {extraCell}
                </td>
              )}
              <td className="px-3 py-2 text-stone-600 dark:text-stone-300">
                {spec.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const OTHER_ENDPOINTS: { path: string; summary: string }[] = [
  { path: "/gauge/compare", summary: "A real parcel under several pathways" },
  {
    path: "/calculator/compare",
    summary: "A hypothetical project under several pathways",
  },
  { path: "/defaults", summary: "Default assumptions and the lever catalog" },
];

/**
 * Inputs specific to a pathway (lot fields, tier, levers), for the table:
 * those both endpoints take, and the gauge-only lot fields the calculator
 * endpoint rejects.
 */
function ownInputs(program: (typeof PROGRAMS)[number]) {
  const specs: [string, ParamSpec & { modes?: readonly string[] }][] = [
    ...Object.entries(PARCEL_FIELDS),
    ["tier", TIER],
    ...(Object.entries(LEVERS) as [string, ParamSpec][]),
  ];
  const own = specs.filter(([, s]) => s.pathways?.includes(program));
  const gaugeOnly = (s: { modes?: readonly string[] }) =>
    !!s.modes && !s.modes.includes("calculator");
  return {
    both: own.filter(([, s]) => !gaugeOnly(s)).map(([n]) => n),
    gauge: own.filter(([, s]) => gaugeOnly(s)).map(([n]) => n),
  };
}

const GAUGE_TONE =
  "bg-ublue/10 text-ublue ring-1 ring-ublue/30 ring-inset dark:bg-ublue/30 dark:text-sky-100 dark:ring-ublue/70";

/** The badge marking an input only the gauge endpoints accept. */
function GaugeOnlyBadge() {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${GAUGE_TONE}`}
    >
      Gauge only
    </span>
  );
}

/** A labelled group of input names as chips. */
function InputChips({
  label,
  names,
  gauge,
}: {
  label: string;
  names: string[];
  gauge?: boolean;
}) {
  return (
    <div>
      <div
        className={`mb-1 text-[11px] font-medium tracking-wide uppercase ${
          gauge
            ? "text-ublue dark:text-sky-200"
            : "text-stone-500 dark:text-stone-400"
        }`}
      >
        {label}
      </div>
      <div className="flex flex-wrap gap-1">
        {names.map((n) => (
          <code
            key={n}
            className={`rounded px-1.5 py-0.5 font-mono text-xs ${
              gauge
                ? GAUGE_TONE
                : "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200"
            }`}
          >
            {n}
          </code>
        ))}
      </div>
    </div>
  );
}

/** An endpoint path; its example request is listed under the table. */
function ExampleLink({ path }: { path: string }) {
  return <code className="font-mono text-xs">/api/feasim{path}</code>;
}

// ── page ─────────────────────────────────────────────────────────────

export const metadata = {
  title: "feasim API",
  description:
    "REST API for UHERO's housing development feasibility model (@uhero/feasim).",
};

export default function FeasimApiPage() {
  const response = exampleResponse();
  const error = exampleError();
  const leverRows = Object.entries(LEVERS) as [string, ParamSpec][];

  return (
    <div className="flex flex-1 gap-8 p-4 pt-0">
      <article className="max-w-3xl min-w-0 flex-1">
        <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100">
          feasim API
        </h1>
        <P>
          GET endpoints for UHERO&apos;s development feasibility model,{" "}
          <a
            className="underline"
            href="https://github.com/UHERO/feasim"
            target="_blank"
            rel="noreferrer"
          >
            @uhero/feasim
          </a>{" "}
          v{FEASIM_VERSION}. Enter a lot on Oʻahu and a policy pathway and the
          model works out what a developer could build and runs the pro forma —
          units, costs, rents, financing, returns, residual land value, ending
          with a strong / marginal / poor verdict.
        </P>

        <Section id="overview" title="Overview">
          <P>
            Every endpoint is a <strong>read-only GET</strong> with parameters
            in the query string. Endpoints that run the model require a{" "}
            <strong>UHERO API key</strong>, issued by UHERO. To request one,
            email{" "}
            <a className="underline" href="mailto:wood2@hawaii.edu">
              wood2@hawaii.edu
            </a>
            .
          </P>
          <P>
            Each key may make <strong>600 requests a minute</strong>. Every
            response says where you stand in its <C>X-RateLimit-Remaining</C>{" "}
            and <C>X-RateLimit-Reset</C> (seconds) headers; over the limit you
            get <C>429</C>, with <C>Retry-After</C> saying how many seconds to
            wait. Responses can be cached for an hour, so repeat requests
            needn&apos;t count.
          </P>

          <CodeBlock>{`curl -H "Authorization: Bearer $UHERO_API_KEY" \\\n  "${process.env.AUTH_URL}/api/feasim/gauge/bill6?${EXAMPLES["/gauge/bill6"]}"`}</CodeBlock>
        </Section>

        <Section id="gauge-vs-calculator" title="Gauge vs. Calculator">
          <P>
            <strong>Gauge</strong> answers{" "}
            <em>what could this real lot build?</em>, as the Simulator&apos;s
            Citywide View does. Describe the lot as it is, including the{" "}
            <GaugeOnlyBadge /> fields. The pathway&apos;s rules apply as
            written, so Bill 7 is capped at 60 ft and a lot that doesn&apos;t
            qualify for TOD comes back <C>ineligible</C>.
          </P>
          <P>
            <strong>Calculator</strong> answers{" "}
            <em>how would this project perform?</em>, as the Simulator&apos;s
            Project View does. Give the lot size, zone and height; the height is
            used as given. (Bill 7 can go past 60 ft. For TOD it assumes what
            the calculator does: a fully urban site and, unless you say
            otherwise, IPD-T (the interim TOD permit, used near stations without
            an adopted TOD district), the base tier and the core precinct. No
            parking exemption applies.)
          </P>
        </Section>

        <Section id="endpoints" title="Endpoints">
          <div className="my-4 overflow-x-auto rounded-lg border border-stone-200 dark:border-stone-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-stone-600 dark:bg-stone-800/50 dark:text-stone-300">
                <tr>
                  <th className="px-3 py-2 font-medium">Pathway</th>
                  <th className="px-3 py-2 font-medium">Gauge / Calculator</th>
                  <th className="px-3 py-2 font-medium">
                    Pathway-specific inputs
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 align-top dark:divide-stone-700">
                {PROGRAMS.map((p) => (
                  <tr key={p}>
                    <td className="px-3 py-2">
                      <div className="font-mono text-xs font-semibold">{p}</div>
                      <div className="text-stone-600 dark:text-stone-300">
                        {PATHWAY_INFO[p].name}
                      </div>
                      <div className="text-xs text-stone-500">
                        {PATHWAY_INFO[p].about}
                      </div>
                    </td>
                    <td className="space-y-1 px-3 py-2 whitespace-nowrap">
                      <div>
                        <ExampleLink path={`/gauge/${p}`} />
                      </div>
                      <div>
                        <ExampleLink path={`/calculator/${p}`} />
                      </div>
                    </td>
                    <td className="space-y-3 px-3 py-2">
                      {(() => {
                        const { both, gauge } = ownInputs(p);
                        if (!both.length && !gauge.length)
                          return <span className="text-stone-400">—</span>;
                        return (
                          <>
                            {both.length > 0 && (
                              <InputChips label="Both" names={both} />
                            )}
                            {gauge.length > 0 && (
                              <InputChips
                                label="Gauge only"
                                names={gauge}
                                gauge
                              />
                            )}
                          </>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="group my-4 rounded-lg border border-stone-200 dark:border-stone-700">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-stone-700 select-none hover:bg-stone-50 dark:text-stone-200 dark:hover:bg-stone-800/50">
              Example request for each endpoint
            </summary>
            <div className="space-y-4 border-t border-stone-200 px-3 py-3 dark:border-stone-700">
              {PROGRAMS.map((p) => (
                <div key={p}>
                  <div className="mb-1 font-mono text-xs font-semibold text-stone-800 dark:text-stone-100">
                    {p}
                  </div>
                  <pre className="overflow-x-auto rounded bg-stone-100 px-3 py-2 text-xs text-stone-800 dark:bg-stone-800 dark:text-stone-200">
                    <code>
                      {["gauge", "calculator"]
                        .map((m) => `/${m}/${p}`)
                        .map((path) => `/api/feasim${path}?${EXAMPLES[path]}`)
                        .join("\n")}
                    </code>
                  </pre>
                </div>
              ))}
            </div>
          </details>
          <P>
            Pathway ids are case-insensitive and historical: <C>bill6</C> is
            current zoning, <C>standard</C> the rules before Ord. 26-7.
          </P>
          {OTHER_ENDPOINTS.map(({ path, summary }) => (
            <div
              key={path}
              className="bg-background mt-6 rounded-lg border border-stone-200 p-4 dark:border-stone-700"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                  GET
                </span>
                <code className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  /api/feasim{path}
                </code>
              </div>
              <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
                {summary}
              </p>
              <pre className="mt-2 overflow-x-auto rounded bg-stone-100 px-3 py-2 text-xs text-stone-800 dark:bg-stone-800 dark:text-stone-200">
                <code>
                  {/* only /defaults opens without a key */}
                  {path === "/defaults" ? (
                    <a
                      className="hover:underline"
                      href={`/api/feasim${path}?${EXAMPLES[path]}`}
                    >
                      {`/api/feasim${path}?${EXAMPLES[path]}`}
                    </a>
                  ) : (
                    `/api/feasim${path}?${EXAMPLES[path]}`
                  )}
                </code>
              </pre>
            </div>
          ))}
          <P>
            <C>compare</C> takes <C>programs</C> (comma-separated, default all
            five) and returns a <C>results</C> array. It accepts any input that
            at least one selected pathway reads; each result applies only its
            own pathway&apos;s levers and lists them in its <C>levers</C>.
          </P>
        </Section>

        <Section id="parameters" title="Kinds of Parameters">
          <P>
            Every input is a query parameter; the API treats them alike. The
            sections below group them by the question each one answers:
          </P>
          <div className="my-4 overflow-x-auto rounded-lg border border-stone-200 dark:border-stone-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-stone-600 dark:bg-stone-800/50 dark:text-stone-300">
                <tr>
                  <th className="px-3 py-2 font-medium">Kind</th>
                  <th className="px-3 py-2 font-medium">Answers</th>
                  <th className="px-3 py-2 font-medium">Affects</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 align-top text-stone-600 dark:divide-stone-700 dark:text-stone-300">
                <tr>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <a className="font-medium underline" href="#lot">
                      Lot parameters
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    <em>What is the property?</em> Facts about the land: size,
                    zone, zoned height, TOD district, parking exemption.
                  </td>
                  <td className="px-3 py-2">
                    The <strong>envelope</strong>: the largest building the
                    rules allow
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <a className="font-medium underline" href="#options">
                      Options
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    <em>How should it run, and what comes back?</em> <C>tier</C>{" "}
                    is the TOD permit the developer pursues; <C>fields</C> trims
                    the response.
                  </td>
                  <td className="px-3 py-2">
                    The TOD envelope (<C>tier</C>); the response&apos;s size (
                    <C>fields</C>, which changes no numbers)
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <a className="font-medium underline" href="#levers">
                      Levers
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    <em>What are the assumptions?</em> Costs, rents, financing,
                    unit mix, grants: the calculator&apos;s sliders. Each
                    replaces one of the pathway&apos;s defaults.
                  </td>
                  <td className="px-3 py-2">
                    The <strong>pro forma</strong>: costs, income, returns and
                    the verdict. <C>height_limit</C> and <C>max_far</C> also
                    override the envelope.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <P>
            Only <C>lot_sqft</C> and <C>zone_class</C> are required; everything
            else has a default. One request, read parameter by parameter:
          </P>
          <CodeBlock>{`GET /api/feasim${ANNOTATED_PATH}?${ANNOTATED_QUERY}`}</CodeBlock>
          <div className="my-4 overflow-x-auto rounded-lg border border-stone-200 dark:border-stone-700">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-stone-200 align-top dark:divide-stone-700">
                {ANNOTATED.map(([name, value, kind, note]) => (
                  <tr key={name}>
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-stone-900 dark:text-stone-100">
                      {name}={value}
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-stone-500 dark:text-stone-400">
                      {kind}
                    </td>
                    <td className="px-3 py-2 text-stone-600 dark:text-stone-300">
                      {note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="lot" title="Lot Parameters">
          <P>
            <C>lot_sqft</C> and <C>zone_class</C> are required.
          </P>
          <ParamTable
            extra="Endpoints"
            rows={Object.entries(PARCEL_FIELDS).map(([name, f]) => [
              name,
              f,
              <span key={name} className="flex flex-wrap items-center gap-1">
                {f.modes.includes("calculator") ? (
                  <span className="text-stone-500 dark:text-stone-400">
                    Both
                  </span>
                ) : (
                  <GaugeOnlyBadge />
                )}
                {f.required && (
                  <span className="font-medium text-stone-800 dark:text-stone-100">
                    · required
                  </span>
                )}
              </span>,
            ])}
          />
        </Section>

        <Section id="options" title="Options">
          <ParamTable
            rows={[
              ["tier", TIER],
              [
                "fields",
                {
                  type: "string",
                  description:
                    "Comma-separated result fields to return instead of all ~100, e.g. max_units,dev_roc,rlv_sqft.",
                },
              ],
            ]}
          />
        </Section>

        <Section id="levers" title="Levers">
          <P>
            Levers override a pathway&apos;s default assumptions; anything you
            leave out uses the default. Rates are decimals (<C>0.065</C> = 6.5%)
            and money is in dollars. Each pathway&apos;s defaults are at{" "}
            <a className="underline" href="/api/feasim/defaults">
              <C>/api/feasim/defaults</C>
            </a>
            .
          </P>
          <P>
            The Pathways column is what the model actually reads, checked by the
            test suite against the model itself: a lever listed for a pathway
            changes its result, and one not listed doesn&apos;t.
          </P>
          <ParamTable rows={leverRows} />
        </Section>

        <Section id="response" title="Response">
          <P>Every response has two parts.</P>
          <P>
            <strong>What you asked for</strong>, so you can check it was read
            correctly:
          </P>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-stone-600 dark:text-stone-300">
            <li>
              <C>model</C>: the version of the model that ran
            </li>
            <li>
              <C>mode</C>: gauge or calculator
            </li>
            <li>
              <C>parcel</C>: your lot, tidied up (e.g. the zone in its standard
              spelling)
            </li>
            <li>
              <C>tier</C>: the TOD permit tier, if any
            </li>
          </ul>
          <P>
            <strong>What the model found</strong>, for each pathway:
          </P>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-stone-600 dark:text-stone-300">
            <li>
              <C>levers</C>: the assumptions you changed
            </li>
            <li>
              <C>envelope</C>: the size limits it used (height and FAR), and for
              TOD whether the lot qualifies
            </li>
            <li>
              <C>verdict</C>: strong, marginal or poor
            </li>
            <li>
              <C>result</C>: the full numbers
            </li>
          </ul>
          <P>
            Here is a real Bill 7 response, shortened with <C>fields</C>:
          </P>
          <CodeBlock>{`GET /api/feasim${RESPONSE_EXAMPLE}\n\n${JSON.stringify(response, null, 2)}`}</CodeBlock>
          <P>Commonly used result fields:</P>
          <div className="my-4 overflow-x-auto rounded-lg border border-stone-200 dark:border-stone-700">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-stone-200 dark:divide-stone-700">
                {Object.entries(KEY_RESULT_FIELDS).map(([k, d]) => (
                  <tr key={k}>
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                      {k}
                    </td>
                    <td className="px-3 py-2 text-stone-600 dark:text-stone-300">
                      {d}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <P>
            Values the model can&apos;t compute (an undefined IRR, say) are{" "}
            <C>null</C>. Under TOD, leave results whose envelope status is{" "}
            <C>not_modeled</C> or <C>not_applicable</C> out of totals.
          </P>
        </Section>

        <Section id="verdict" title="Verdict">
          <P>Four metrics are scored:</P>
          <div className="my-4 overflow-x-auto rounded-lg border border-stone-200 dark:border-stone-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-stone-600 dark:bg-stone-800/50 dark:text-stone-300">
                <tr>
                  <th className="px-3 py-2 font-medium">Metric</th>
                  <th className="px-3 py-2 font-medium">Poor</th>
                  <th className="px-3 py-2 font-medium">Marginal</th>
                  <th className="px-3 py-2 font-medium">Strong</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 text-stone-600 dark:divide-stone-700 dark:text-stone-300">
                <tr>
                  <td className="px-3 py-2 font-mono text-xs">
                    return_on_cost
                  </td>
                  <td className="px-3 py-2">&gt; 1 pt below target</td>
                  <td className="px-3 py-2">within 1 pt</td>
                  <td className="px-3 py-2">at or above target</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-xs">
                    residual_land_value
                  </td>
                  <td className="px-3 py-2">&lt; 90% of land price</td>
                  <td className="px-3 py-2">90–110%</td>
                  <td className="px-3 py-2">≥ 110%</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-xs">
                    equity_multiple
                  </td>
                  <td className="px-3 py-2">&lt; 2.0×</td>
                  <td className="px-3 py-2">2.0–2.5×</td>
                  <td className="px-3 py-2">≥ 2.5×</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-xs">levered_irr</td>
                  <td className="px-3 py-2">&lt; 8%</td>
                  <td className="px-3 py-2">8–12%</td>
                  <td className="px-3 py-2">≥ 12%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <P>
            <C>overall</C> is <strong>poor</strong> if half or more of the
            scored metrics are poor, <strong>strong</strong> if none are poor
            and at least three of four are strong, and <strong>marginal</strong>{" "}
            otherwise.
          </P>
        </Section>

        <Section id="errors" title="Errors">
          <P>
            Unknown, repeated, mistyped or out-of-range parameters, and inputs
            another pathway reads, return <C>400</C> listing every problem. An
            unknown pathway is a <C>404</C>, a missing or unknown key a{" "}
            <C>401</C>, and too many requests a <C>429</C>.
          </P>
          <CodeBlock>{`GET /api/feasim${ERROR_EXAMPLE}\n\n${JSON.stringify(error, null, 2)}`}</CodeBlock>
          <P>
            Zone codes are case-insensitive (<C>bmx-3</C> works), but must be a
            district the model can build in.
          </P>
        </Section>

        <Section id="versioning" title="Versioning">
          <P>
            Model updates change results even when the API doesn&apos;t: a new
            fee or rule moves the numbers. Every response reports{" "}
            <C>model.version</C>; the API is pinned to v{FEASIM_VERSION}. See
            the{" "}
            <a
              className="underline"
              href="https://github.com/UHERO/feasim/blob/main/CHANGELOG.md"
              target="_blank"
              rel="noreferrer"
            >
              changelog
            </a>{" "}
            and the{" "}
            <a
              className="underline"
              href="https://github.com/UHERO/feasim/blob/main/docs/README.md"
              target="_blank"
              rel="noreferrer"
            >
              model documentation
            </a>{" "}
            for how each pathway is modeled.
          </P>
        </Section>
      </article>

      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-20">
          <TableOfContents items={tocItems} />
        </div>
      </aside>
    </div>
  );
}
