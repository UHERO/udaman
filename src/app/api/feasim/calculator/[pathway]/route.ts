import { pathwayHandler } from "@/lib/feasim/run";

/**
 * GET /api/feasim/calculator/{bill6|standard|bill7|tod|h201} — a
 * hypothetical project under one pathway, as the calculator (Project View)
 * runs it. Each pathway accepts only the inputs its model reads; see
 * /docs/feasim-api.
 *
 *   /api/feasim/calculator/tod?lot_sqft=20000&zone_class=AMX-1&height=30&tod_regime=pdt&tier=major_sd
 *
 * Mirrors the calculator page: outside TOD the height is used as given;
 * under TOD it is wholly urban with the generous PD-T height and the
 * calculator's toggle defaults (see FeasimMode).
 */
export const GET = pathwayHandler("calculator");

/** CORS preflight for the Authorization header. */
export { preflight as OPTIONS } from "@/lib/feasim/auth";
