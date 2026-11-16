import type { NextRequest } from "next/server";
import {
  calcParcel,
  equityMultipleLevel,
  irrLevel,
  overallLevel,
  pathwayEnvelope,
  rlvLevel,
  rlvRatio,
  rocLevel,
  type ParcelOutput,
  type ProgramId,
} from "@uhero/feasim";

import { authenticate } from "./auth";
import {
  FEASIM_VERSION,
  leversFor,
  ParamError,
  parseFeasimQuery,
  parsePathway,
  parsePrograms,
  PROGRAMS,
  type FeasimMode,
  type Levers,
  type ParsedRequest,
} from "./params";

export const MODEL = {
  package: "@uhero/feasim",
  version: FEASIM_VERSION,
} as const;

/**
 * One pathway's result: envelope, verdict and pro forma. Both modes run
 * calcParcel — the calculator's inputs are calcParcel's for a hypothetical
 * lot under the calculator's assumptions (see FeasimMode), which the tests
 * check against feasim's own calculator fixtures.
 */
export function runPathway(program: ProgramId, req: ParsedRequest) {
  const levers = calculatorHeight(program, req, leversFor(program, req.levers));
  const result = calcParcel(program, req.parcel, levers, req.opts);
  // the envelope the model ran: the pathway's, with any height_limit or
  // max_far lever on top, as parcelInputs applies them
  const envelope = pathwayEnvelope(program, req.parcel, req.opts);
  if (levers.height_limit !== undefined)
    envelope.height_limit = levers.height_limit;
  if (levers.max_far !== undefined) envelope.max_far = levers.max_far;
  return {
    program,
    levers,
    envelope,
    verdict: {
      overall: overallLevel(result),
      return_on_cost: rocLevel(result),
      residual_land_value: rlvLevel(result),
      rlv_ratio: rlvRatio(result),
      equity_multiple: equityMultipleLevel(result),
      levered_irr: irrLevel(result),
    },
    result: selectFields(result, req.fields),
  };
}

/**
 * The calculator's height slider is the project's height limit, used as
 * given — Bill 7's included, past its 60 ft statutory cap, which the gauge
 * applies to real parcels. Only TOD reads it as the zoned base height that
 * the permit tier raises. So in calculator mode, outside TOD, `height`
 * becomes the height_limit lever unless one is given.
 */
function calculatorHeight(
  program: ProgramId,
  req: ParsedRequest,
  levers: Levers,
): Levers {
  if (req.mode !== "calculator" || program === "tod") return levers;
  if (req.parcel.height <= 0 || levers.height_limit !== undefined)
    return levers;
  return { ...levers, height_limit: req.parcel.height };
}

function selectFields(result: ParcelOutput, fields?: string[]) {
  if (!fields) return result;
  const unknown = fields.filter((f) => !(f in result));
  if (unknown.length) {
    throw new ParamError(
      unknown.map((f) => `fields: "${f}" is not a result field`),
    );
  }
  const all = result as unknown as Record<string, unknown>;
  return Object.fromEntries(fields.map((f) => [f, all[f]]));
}

/**
 * Public reference responses (/defaults) are the
 * same for everyone: cacheable anywhere and readable from any origin.
 */
const PUBLIC_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=3600",
};

/**
 * Model results are deterministic for a model version and query, but are
 * served per API key: the client may cache them, a shared cache may not.
 * CORS comes from the key's application (see auth.ts).
 */
const KEYED_HEADERS = { "Cache-Control": "private, max-age=3600" };

/**
 * JSON response; non-finite numbers (e.g. an undefined IRR) become null.
 * `keyed` responses carry the auth headers instead of public ones.
 */
function json(body: unknown, status = 200, keyed?: Record<string, string>) {
  const headers: Record<string, string> = keyed
    ? status === 200
      ? { ...KEYED_HEADERS, ...keyed }
      : keyed
    : status === 200
      ? PUBLIC_HEADERS
      : { "Access-Control-Allow-Origin": "*" };
  return Response.json(body, { status, headers });
}

/** Run a handler, mapping ParamError to a 400 with every issue listed. */
export function handle(fn: () => unknown, keyed?: Record<string, string>) {
  try {
    return json(fn(), 200, keyed);
  } catch (err) {
    if (err instanceof ParamError) {
      return json(
        { error: "Invalid parameters", issues: err.issues },
        400,
        keyed,
      );
    }
    throw err;
  }
}

function echo(req: ParsedRequest) {
  return {
    model: MODEL,
    mode: req.mode,
    parcel: req.parcel,
    tier: req.tier ?? null,
  };
}

type PathwayContext = { params: Promise<{ pathway: string }> };

/**
 * GET handler for /api/feasim/{mode}/{pathway}: one lot under one pathway,
 * accepting only the inputs that pathway's model reads. Needs an API key.
 */
export function pathwayHandler(mode: FeasimMode) {
  return async (request: NextRequest, { params }: PathwayContext) => {
    const auth = await authenticate(request);
    if (!auth.ok) return auth.response;
    const { pathway } = await params;
    const program = parsePathway(pathway);
    if (!program) {
      return json(
        {
          error: "Not found",
          issues: [
            `"${pathway}" is not a pathway; use one of ${PROGRAMS.join(", ")}, or compare`,
          ],
        },
        404,
        auth.headers,
      );
    }
    return handle(() => {
      const req = parseFeasimQuery(request.nextUrl.searchParams, mode, [
        program,
      ]);
      return { ...echo(req), ...runPathway(program, req) };
    }, auth.headers);
  };
}

/**
 * GET handler for /api/feasim/{mode}/compare: one lot under several
 * pathways (`programs`, default all). A lever is accepted if any selected
 * pathway reads it, and each result reports the levers it applied. Needs
 * an API key.
 */
export function compareHandler(mode: FeasimMode) {
  return async (request: NextRequest) => {
    const auth = await authenticate(request);
    if (!auth.ok) return auth.response;
    return handle(() => {
      const params = request.nextUrl.searchParams;
      // a bad `programs` still checks the rest, against every pathway, so
      // one 400 lists every problem
      let programs: ProgramId[] = [...PROGRAMS];
      const issues: string[] = [];
      try {
        programs = parsePrograms(params);
      } catch (err) {
        if (!(err instanceof ParamError)) throw err;
        issues.push(...err.issues);
      }
      let req: ParsedRequest | undefined;
      try {
        req = parseFeasimQuery(params, mode, programs, ["programs"]);
      } catch (err) {
        if (!(err instanceof ParamError)) throw err;
        issues.push(...err.issues);
      }
      if (issues.length || !req) throw new ParamError(issues);
      return {
        ...echo(req),
        programs,
        results: programs.map((program) => runPathway(program, req)),
      };
    }, auth.headers);
  };
}
