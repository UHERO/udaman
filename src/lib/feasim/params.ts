/**
 * Query-string parsing for the feasim API (src/app/api/feasim/*).
 *
 * @uhero/feasim does not validate its inputs: an unknown program runs
 * "bill6", a lowercase zone builds nothing, a misspelled lever is ignored,
 * and a zero interest rate yields NaN — all without an error. Everything a
 * caller can send is therefore whitelisted and checked here, and anything
 * unrecognized is a 400 rather than a silently wrong answer.
 */
import {
  baseFar,
  TOD_ELIGIBLE_DISTRICTS,
  TOD_PLAN_STANDARDS,
  type Parcel,
  type ProgramId,
  type SliderInputs,
  type TodEnvelopeOpts,
  type TodTier,
} from "@uhero/feasim";

import pkg from "../../../package.json";
import leverPathways from "./generated/lever-pathways.json";

/**
 * The model version, read from the @uhero/feasim dependency in package.json,
 * so upgrading is just `bun add @uhero/feasim@<version> --exact`. It must be
 * pinned to an exact version: results change between model versions, and
 * responses report this one.
 */
export const FEASIM_VERSION: string = (() => {
  const v = (pkg.dependencies as Record<string, string>)["@uhero/feasim"];
  if (!/^\d+\.\d+\.\d+$/.test(v ?? ""))
    throw new Error(
      `package.json must pin @uhero/feasim to an exact version (got "${v}")`,
    );
  return v;
})();

export const PROGRAMS = [
  "bill6",
  "standard",
  "bill7",
  "tod",
  "h201",
] as const satisfies readonly ProgramId[];

export const TOD_TIERS = [
  "base",
  "minor_sd",
  "major_sd",
  "with_benefits",
] as const satisfies readonly TodTier[];

const UNIT_TYPES = [
  "studio_100",
  "studio75_1br25",
  "studio50_1br50",
  "studio25_1br75",
  "one_bb_100",
  "one_br50_2br50",
  "two_bb_100",
  "third_each",
] as const;

/**
 * AMI brackets ami_10 … ami_180 in steps of 10, the calculator's range.
 * HHFDC publishes limits to 140%; the model scales brackets above that
 * from its tables, as the calculator's Market AMI slider (to 180) relies on.
 * Off-step values (ami_85) are rejected: they'd be scaled too, silently.
 */
const AMI_BRACKETS = Array.from(
  { length: 18 },
  (_, i) => `ami_${(i + 1) * 10}`,
);

// ── Lever catalog ─────────────────────────────────────────────────────

/** Pathways an input applies to; absent = all five. */
type Applies = { pathways?: readonly ProgramId[] };

export type LeverSpec = Applies &
  (
    | {
        type: "number";
        min?: number;
        max?: number;
        exclusiveMin?: boolean;
        description: string;
      }
    | { type: "boolean"; description: string }
    | { type: "enum"; values: readonly string[]; description: string }
  );

/** Type every entry as a LeverSpec while keeping the key names. */
const defineLevers = <K extends keyof SliderInputs>(
  levers: Record<K, LeverSpec>,
) => levers;

/** Does this input apply to the pathway? */
function appliesTo(spec: Applies, program: ProgramId): boolean {
  return !spec.pathways || spec.pathways.includes(program);
}

const frac = (description: string): LeverSpec => ({
  type: "number",
  min: 0,
  max: 1,
  description,
});
const nonneg = (description: string): LeverSpec => ({
  type: "number",
  min: 0,
  description,
});
const positive = (description: string): LeverSpec => ({
  type: "number",
  min: 0,
  exclusiveMin: true,
  description,
});

/**
 * Every SliderInputs field a caller may override. Which pathways each one
 * applies to isn't written here: `bun scripts/update-feasim-levers.ts` (run
 * by `bun run upgrade:feasim`) works it out from the installed model and
 * saves it to generated/lever-pathways.json, which LEVERS reads. The other
 * model inputs are in NOT_LEVERS, with why.
 */
const LEVER_SPECS = defineLevers({
  // envelope overrides
  height_limit: positive(
    "Height limit override, ft (default: pathway envelope)",
  ),
  max_far: positive("FAR override (default: pathway envelope)"),
  floor_height: positive("Floor-to-floor height, ft"),
  setback: nonneg("Yard setback on every side, ft"),
  coverage: frac("Maximum lot coverage (default 0.8)"),
  stepback_trigger_ft: nonneg(
    "Override the zone's step-back: height that triggers it, ft",
  ),
  stepback_above_ft: nonneg(
    "Step-back: storeys above this height step back, ft (default 40)",
  ),
  stepback_ft_per_10ft: nonneg("Step-back: ft per 10 ft of height (default 1)"),
  building_area_per_unit: positive(
    "Sqft per unit in the legal unit cap (default 800)",
  ),

  // program
  unit_type: { type: "enum", values: UNIT_TYPES, description: "Unit mix" },
  affordable_ami: {
    type: "enum",
    values: AMI_BRACKETS,
    description: "AMI bracket of affordable units",
  },
  market_ami: {
    type: "enum",
    values: AMI_BRACKETS,
    description:
      "AMI bracket of market units. HHFDC publishes limits to ami_140; the model scales higher brackets.",
  },
  affordability: {
    type: "number",
    min: 0.51,
    max: 1,
    description: "Affordable share of units (at least 0.51)",
  },
  include_retail: {
    type: "boolean",
    description: "Ground-floor retail, where the zone permits it",
  },
  retail_rent: nonneg("Retail rent, $/sqft/month"),
  retail_share: frac("Retail share of ground floor"),

  // parking
  parking_ratio: nonneg("Housing stalls per unit"),

  // costs
  land_cost: nonneg("Market price of land, $ per sqft of lot"),
  hard_cost_per_sqft: nonneg("Construction cost, $ per sqft of building"),
  park: {
    type: "enum",
    values: ["exempt", "in_lieu"],
    description:
      "Park dedication: application fee only, or fee + park land value",
  },
  impact_fee: nonneg("Impact fee, $ per unit (Bill 7 waives it)"),
  waivable_fee_basis: {
    type: "enum",
    values: ["all_units", "market_units", "none"],
    description: "Units the waivable fees are charged on",
  },
  opex_ratio: frac(
    "Operating expenses as a share of EGI, excluding property tax",
  ),

  // timing
  permitting_months: nonneg("Permitting period, months"),
  const_months: nonneg("Construction period, months"),
  leaseup_months: nonneg("Lease-up period, months"),
  hold_years: nonneg("Hold period, years (the calculator allows 0)"),

  // financing
  equity: frac("Equity share of construction financing"),
  construction_rate: nonneg("Construction loan interest rate (default 0.08)"),
  permanent_rate: positive("Permanent loan interest rate (must be > 0)"),
  amort_years: positive("Permanent loan amortization, years (must be > 0)"),
  min_dscr: positive("Minimum debt service coverage ratio"),
  cap_rate: positive("Market cap rate (default 0.051)"),

  // returns
  target_return: nonneg(
    "Land carry rate: annual cost of capital on the land, discounts the residual",
  ),
  target_spread: nonneg(
    "Required return-on-cost spread over the cap rate (default 0.015)",
  ),
  profit_margin: nonneg(
    "Developer profit margin on total project cost, in the residual (default 0.15)",
  ),

  // Bill 7 grants
  grant_type: {
    type: "enum",
    values: ["post_construct", "pre_construct", "none"],
    description: "Grant structure (default post_construct)",
  },
  grant_amount: nonneg(
    "Grant $ per unit. Default: the ordinance amount — $50,000 pre-construction; $12,000 post-construction, or $40/sqft for units under 300 sqft",
  ),
  grant_units: {
    type: "enum",
    values: ["all", "affordable"],
    description:
      "Units the pre-construction subsidy pays on (post-construction always pays on affordable units)",
  },
  prevailing_wage_premium: nonneg(
    "Extra cost of on-site labor at prevailing wages (default 0.45); pre-construction grants",
  ),
  onsite_labor_share: frac(
    "On-site labor as a share of hard cost (default 0.25); also caps the pre-construction subsidy",
  ),
});

/**
 * Model inputs that are deliberately not levers. The lever update reports
 * any model input in neither list, so new ones in a feasim release show up.
 */
export const NOT_LEVERS: Record<string, string> = {
  program: "set by the endpoint",
  lot_sqft: "a lot parameter",
  zone_class: "a lot parameter",
  parking_exempt: "a lot parameter (gauge only)",
  max_units: "worked out from the lot's envelope",
  open_space_bonus: "worked out from the lot's envelope",
  far_without_bonus: "worked out from the lot's envelope",
  front_no_parking_ft: "worked out from the lot's envelope",
  mortgage: "for-sale units, which no pathway builds",
  market_price: "for-sale units, which no pathway builds",
  rental_split: "for-sale units, which no pathway builds",
  sale_split: "for-sale units, which no pathway builds",
};

/** The levers, each with the pathways it applies to (absent = all five). */
export const LEVERS = Object.fromEntries(
  Object.entries(LEVER_SPECS).map(([name, spec]) => {
    const pathways = (leverPathways.levers as Record<string, ProgramId[]>)[
      name
    ];
    return [
      name,
      pathways && pathways.length < PROGRAMS.length
        ? { ...spec, pathways }
        : spec,
    ];
  }),
) as typeof LEVER_SPECS;

/** The subset of parsed levers a pathway reads. */
export function leversFor(program: ProgramId, levers: Levers): Levers {
  return Object.fromEntries(
    Object.entries(levers).filter(([n]) =>
      appliesTo(LEVERS[n as LeverName], program),
    ),
  ) as Levers;
}

export type LeverName = keyof typeof LEVERS;
export type Levers = Partial<Pick<SliderInputs, LeverName>>;

// ── Modes ─────────────────────────────────────────────────────────────

/**
 * feasim has two front ends, and the API mirrors both:
 *
 * - "gauge" (Citywide View): a real parcel, as the policy gauge runs it.
 *   The caller describes the lot: TMK, parking exemption, TOD regime,
 *   station area, precinct, urban-district status, map bonus height.
 *
 * - "calculator" (Project View): a hypothetical project, as the calculator
 *   page (uhero_analytics app/housing/policy/calculator) builds it. The
 *   caller gives lot size, zone, height and, for TOD, the regime, tier,
 *   station area and precinct (defaults ipdt, base, none, core, as the
 *   calculator's toggles). The site is wholly urban and takes the generous
 *   PD-T height; no § 21-6.20(a) parking exemption applies. Outside TOD,
 *   the height is the project's height limit as given (Bill 7 included,
 *   uncapped); under TOD it is the zoned height the tier raises.
 *
 * Both modes were cross-checked against that app: every gauge parcel at
 * the gauge's defaults, and the calculator across its slider ranges, give
 * identical results.
 */
export type FeasimMode = "gauge" | "calculator";

export type ParamSpec =
  LeverSpec | (Applies & { type: "string"; description: string });

/** A lot field: its spec, whether required, and the modes accepting it. */
type ParcelField = ParamSpec & {
  required?: boolean;
  modes: readonly FeasimMode[];
};

/**
 * Station areas with a plan, as the model names them. It looks the name up
 * exactly, so any other spelling would silently get no plan.
 */
const STATION_AREAS = Object.keys(TOD_PLAN_STANDARDS);

const BOTH = ["gauge", "calculator"] as const;
const GAUGE = ["gauge"] as const;

/** Lot fields, in documentation order. Also documents the API. */
export const PARCEL_FIELDS: Record<string, ParcelField> = {
  lot_sqft: {
    ...positive("Lot area, sqft"),
    required: true,
    modes: BOTH,
  },
  zone_class: {
    type: "string",
    description:
      "Zoning district as the Land Use Ordinance writes it: A-2, AMX-3, BMX-4, B-2, I-2, Apart, ApartMix. Case-insensitive.",
    required: true,
    modes: BOTH,
  },
  height: {
    ...nonneg(
      "Zoning height limit, ft. 0 or omitted = the pathway's default. Under TOD, the base height the permit tier raises; there 0 or omitted is not modeled (envelope status not_modeled).",
    ),
    modes: BOTH,
  },
  tod_regime: {
    type: "enum",
    values: ["pdt", "ipdt"],
    description:
      "The TOD permit: pdt (Planned Development–Transit, in an adopted TOD special district) or ipdt (Interim PD-T, near a station without an adopted district). Omit if the lot can't get a TOD permit.",
    modes: BOTH,
    pathways: ["tod"],
  },
  tmk: {
    type: "string",
    description: "Tax map key or other ID, copied onto the result",
    modes: GAUGE,
  },
  parking_exempt: {
    type: "boolean",
    description: "No off-street parking required (ROH § 21-6.20(a))",
    modes: GAUGE,
    pathways: ["bill6", "standard", "h201"],
  },
  slu_urban: {
    type: "boolean",
    description: "The lot is entirely in the State Land Use urban district",
    modes: GAUGE,
    pathways: ["tod"],
  },
  station_area: {
    type: "enum",
    values: STATION_AREAS,
    description:
      "Rail station area, for its plan's FAR and height ceilings (IPD-T with benefits). Case-insensitive.",
    modes: BOTH,
    pathways: ["tod"],
  },
  tod_precinct: {
    type: "enum",
    values: ["core", "tiz"],
    description:
      "core (within ¼ mile of the station) or tiz (¼ to ½ mile). Calculator default: core.",
    modes: BOTH,
    pathways: ["tod"],
  },
  tod_map_bonus_height: {
    ...nonneg(
      "PD-T: the bonus height in parentheses on the TOD zoning map, ft",
    ),
    modes: GAUGE,
    pathways: ["tod"],
  },
};

/** The TOD permit tier, an envelope option rather than a lot field. */
export const TIER: LeverSpec = {
  type: "enum",
  values: TOD_TIERS,
  description:
    "Permit tier, least to most. minor_sd and major_sd are PD-T only; IPD-T treats them as base. Default base.",
  pathways: ["tod"],
};

// ── Errors ────────────────────────────────────────────────────────────

export class ParamError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join("; "));
    this.name = "ParamError";
  }
}

// ── Primitive parsers ─────────────────────────────────────────────────

function parseNumber(
  name: string,
  raw: string,
  issues: string[],
): number | undefined {
  const trimmed = raw.trim();
  const n = trimmed === "" ? NaN : Number(trimmed);
  if (!Number.isFinite(n)) {
    issues.push(`${name}: expected a number, got "${raw}"`);
    return undefined;
  }
  return n;
}

function parseBoolean(
  name: string,
  raw: string,
  issues: string[],
): boolean | undefined {
  const v = raw.trim().toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  issues.push(`${name}: expected true or false, got "${raw}"`);
  return undefined;
}

function parseEnum<T extends string>(
  name: string,
  raw: string,
  values: readonly T[],
  issues: string[],
): T | undefined {
  if ((values as readonly string[]).includes(raw)) return raw as T;
  issues.push(`${name}: expected one of ${values.join(", ")}, got "${raw}"`);
  return undefined;
}

function parseLever(name: LeverName, raw: string, issues: string[]) {
  const spec: LeverSpec = LEVERS[name];
  switch (spec.type) {
    case "boolean":
      return parseBoolean(name, raw, issues);
    case "enum":
      return parseEnum(name, raw, spec.values, issues);
    case "number": {
      const n = parseNumber(name, raw, issues);
      if (n === undefined) return undefined;
      if (
        spec.min !== undefined &&
        (spec.exclusiveMin ? n <= spec.min : n < spec.min)
      ) {
        issues.push(
          `${name}: must be ${spec.exclusiveMin ? "greater than" : "at least"} ${spec.min}`,
        );
        return undefined;
      }
      if (spec.max !== undefined && n > spec.max) {
        issues.push(`${name}: must be at most ${spec.max}`);
        return undefined;
      }
      return n;
    }
  }
}

/**
 * The model reads zone codes exactly as the Land Use Ordinance writes them
 * ("BMX-3", "Apart", "Resort"); anything else has no FAR and builds
 * nothing. Accept case-insensitive input and map it to the canonical
 * spelling: the mixed-case codes by name (Waikiki's Apart/ApartMix and the
 * TOD-eligible resort districts), everything else uppercased.
 */
const MIXED_CASE_ZONES = [
  "Apart",
  "ApartMix",
  ...TOD_ELIGIBLE_DISTRICTS.filter((z) => z !== z.toUpperCase()),
];

function normalizeZone(raw: string, issues: string[]): string | undefined {
  const z = raw.trim();
  const mixed = MIXED_CASE_ZONES.find(
    (m) => m.toLowerCase() === z.toLowerCase(),
  );
  const canonical = mixed ?? z.toUpperCase();
  if (baseFar(canonical, 0) > 0) return canonical;
  issues.push(
    `zone_class: "${raw}" is not a zoning district the model can build in ` +
      `(use the Land Use Ordinance code, e.g. A-2, BMX-3, I-2, Apart, Resort)`,
  );
  return undefined;
}

// ── Request parsing ───────────────────────────────────────────────────

export interface ParsedRequest {
  mode: FeasimMode;
  /** the pathways being run; inputs were checked against these */
  programs: ProgramId[];
  parcel: Parcel;
  /** every lever given; runPathway applies each pathway's own subset */
  levers: Levers;
  tier?: TodTier;
  /** envelope options passed to calcParcel / pathwayEnvelope */
  opts: TodEnvelopeOpts;
  /** ParcelOutput fields to return; undefined = all */
  fields?: string[];
}

const ALL_INPUTS: Record<
  string,
  ParamSpec & { modes?: readonly FeasimMode[] }
> = { ...PARCEL_FIELDS, ...LEVERS, tier: TIER };

/**
 * Why `key` isn't accepted by `mode` for `programs`, or null if it is.
 * An input applies when it fits the mode and at least one of the pathways.
 */
function rejection(
  key: string,
  mode: FeasimMode,
  programs: readonly ProgramId[],
): string | null {
  const spec = ALL_INPUTS[key];
  if (!spec) return "unknown parameter";
  if (spec.modes && !spec.modes.includes(mode))
    return `${spec.modes.join("/")} endpoints only, not ${mode}`;
  if (!programs.some((p) => appliesTo(spec, p)))
    return `applies only to ${spec.pathways!.join(", ")}; the ${programs.join(", ")} model ignores it`;
  return null;
}

/**
 * Parse the parcel, levers, TOD tier and field selection shared by every
 * feasim endpoint, accepting only inputs that apply to `mode` and at least
 * one of `programs`. `extraKeys` are endpoint-specific params the caller
 * handles itself (e.g. "programs"); any other key is an error.
 */
export function parseFeasimQuery(
  params: URLSearchParams,
  mode: FeasimMode,
  programs: readonly ProgramId[],
  extraKeys: readonly string[] = [],
): ParsedRequest {
  const issues: string[] = [];
  const accepted = new Set<string>(["fields", ...extraKeys]);

  for (const key of new Set(params.keys())) {
    const why = accepted.has(key) ? null : rejection(key, mode, programs);
    if (why) issues.push(`${key}: ${why}`);
    else if (params.getAll(key).length > 1)
      issues.push(`${key}: given more than once`);
  }
  // only parse what was accepted; rejected keys are already reported
  const ok = (k: string) =>
    params.has(k) && (accepted.has(k) || !rejection(k, mode, programs));

  const get = (k: string) => (ok(k) ? (params.get(k) ?? undefined) : undefined);

  // parcel — lot_sqft and zone_class required; height 0 = pathway default
  const lotRaw = get("lot_sqft");
  let lot_sqft: number | undefined;
  if (lotRaw === undefined) issues.push("lot_sqft: required");
  else {
    lot_sqft = parseNumber("lot_sqft", lotRaw, issues);
    if (lot_sqft !== undefined && lot_sqft <= 0) {
      issues.push("lot_sqft: must be greater than 0");
      lot_sqft = undefined;
    }
  }

  const zoneRaw = get("zone_class");
  const zone_class =
    zoneRaw === undefined
      ? (issues.push("zone_class: required"), undefined)
      : normalizeZone(zoneRaw, issues);

  const heightRaw = get("height");
  let height = 0;
  if (heightRaw !== undefined) {
    const h = parseNumber("height", heightRaw, issues);
    if (h !== undefined && h < 0) issues.push("height: must be at least 0");
    else if (h !== undefined) height = h;
  }

  const parcel: Parcel = {
    lot_sqft: lot_sqft ?? 0,
    zone_class: zone_class ?? "",
    height,
  };

  const tmk = get("tmk");
  if (tmk !== undefined) parcel.tmk = tmk;
  const stationRaw = get("station_area");
  if (stationRaw !== undefined) {
    const station = STATION_AREAS.find(
      (s) => s.toLowerCase() === stationRaw.trim().toLowerCase(),
    );
    if (station) parcel.station_area = station;
    else
      issues.push(
        `station_area: expected one of ${STATION_AREAS.join(", ")}, got "${stationRaw}"`,
      );
  }

  const bool = (k: "parking_exempt" | "slu_urban") => {
    const raw = get(k);
    if (raw === undefined) return;
    const v = parseBoolean(k, raw, issues);
    if (v !== undefined) parcel[k] = v;
  };
  bool("parking_exempt");
  bool("slu_urban");

  const regime = get("tod_regime");
  if (regime !== undefined) {
    const v = parseEnum("tod_regime", regime, ["pdt", "ipdt"] as const, issues);
    if (v) parcel.tod_regime = v;
  }
  const precinct = get("tod_precinct");
  if (precinct !== undefined) {
    const v = parseEnum(
      "tod_precinct",
      precinct,
      ["core", "tiz"] as const,
      issues,
    );
    if (v) parcel.tod_precinct = v;
  }
  const mapBonus = get("tod_map_bonus_height");
  if (mapBonus !== undefined) {
    const v = parseNumber("tod_map_bonus_height", mapBonus, issues);
    if (v !== undefined && v < 0)
      issues.push("tod_map_bonus_height: must be at least 0");
    else if (v !== undefined) parcel.tod_map_bonus_height = v;
  }

  // levers
  const levers: Record<string, unknown> = {};
  for (const name of Object.keys(LEVERS) as LeverName[]) {
    const raw = get(name);
    if (raw === undefined) continue;
    const v = parseLever(name, raw, issues);
    if (v !== undefined) levers[name] = v;
  }

  // TOD tier
  const tierRaw = get("tier");
  const tier =
    tierRaw === undefined
      ? undefined
      : parseEnum("tier", tierRaw, TOD_TIERS, issues);

  // field selection
  const fieldsRaw = get("fields");
  const fields = fieldsRaw
    ?.split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  if (issues.length) throw new ParamError(issues);

  const opts: TodEnvelopeOpts = tier ? { tier } : {};
  if (mode === "calculator" && programs.includes("tod")) {
    // the calculator's TOD assumptions (see FeasimMode); regime, precinct
    // and station area are its toggles, so they only get its defaults
    parcel.slu_urban = true;
    parcel.tod_regime ??= "ipdt";
    parcel.tod_precinct ??= "core";
    opts.generous_height = true;
  }

  return {
    mode,
    programs: [...programs],
    parcel,
    levers: levers as Levers,
    tier,
    opts,
    fields: fields?.length ? fields : undefined,
  };
}

/** Parse a single `program`, required. */
export function parseProgram(params: URLSearchParams): ProgramId {
  const raw = params.get("program");
  if (raw === null) throw new ParamError(["program: required"]);
  const issues: string[] = [];
  const p = parseEnum("program", raw.trim().toLowerCase(), PROGRAMS, issues);
  if (!p) throw new ParamError(issues);
  return p;
}

/** Parse `programs` as a comma list; omitted = every pathway. */
export function parsePrograms(params: URLSearchParams): ProgramId[] {
  const raw = params.get("programs");
  if (raw === null || raw.trim() === "") return [...PROGRAMS];
  const issues: string[] = [];
  const out: ProgramId[] = [];
  for (const part of raw.split(",")) {
    const p = parseEnum(
      "programs",
      part.trim().toLowerCase(),
      PROGRAMS,
      issues,
    );
    if (p && !out.includes(p)) out.push(p);
  }
  if (issues.length) throw new ParamError(issues);
  return out;
}

/** A pathway from a URL segment (case-insensitive), or null. */
export function parsePathway(segment: string): ProgramId | null {
  const p = segment.toLowerCase();
  return (PROGRAMS as readonly string[]).includes(p) ? (p as ProgramId) : null;
}
