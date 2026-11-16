import { compareHandler } from "@/lib/feasim/run";

/**
 * GET /api/feasim/gauge/compare — a real parcel under several pathways
 * (`programs=bill6,tod`, default all). Accepts any input at least one
 * selected pathway reads; each result applies, and reports, only its own.
 */
export const GET = compareHandler("gauge");

/** CORS preflight for the Authorization header. */
export { preflight as OPTIONS } from "@/lib/feasim/auth";
