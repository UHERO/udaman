import { compareHandler } from "@/lib/feasim/run";

/**
 * GET /api/feasim/calculator/compare — a hypothetical project under several
 * pathways (`programs=bill6,tod`, default all). Accepts any input at least
 * one selected pathway reads; each result applies, and reports, only its own.
 */
export const GET = compareHandler("calculator");

/** CORS preflight for the Authorization header. */
export { preflight as OPTIONS } from "@/lib/feasim/auth";
