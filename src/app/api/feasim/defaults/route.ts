import type { NextRequest } from "next/server";
import { DEFAULT_INPUTS } from "@uhero/feasim";

import { LEVERS, parseProgram, PROGRAMS, TOD_TIERS } from "@/lib/feasim/params";
import { handle, MODEL } from "@/lib/feasim/run";

/**
 * GET /api/feasim/defaults[?program=tod] — each pathway's default
 * assumptions and the levers the run/compare endpoints accept. An unknown
 * program is a 400, like everywhere else.
 */
export function GET(request: NextRequest) {
  return handle(() => {
    const params = request.nextUrl.searchParams;
    const defaults = params.has("program")
      ? (() => {
          const program = parseProgram(params);
          return { [program]: DEFAULT_INPUTS[program] };
        })()
      : DEFAULT_INPUTS;
    return {
      model: MODEL,
      programs: PROGRAMS,
      tod_tiers: TOD_TIERS,
      defaults,
      levers: LEVERS,
    };
  });
}
