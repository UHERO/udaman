import { pathwayHandler } from "@/lib/feasim/run";

/**
 * GET /api/feasim/gauge/{bill6|standard|bill7|tod|h201} — a real parcel
 * under one pathway, as the policy gauge (Citywide View) runs it. Each
 * pathway accepts only the inputs its model reads; see /docs/feasim-api.
 *
 *   /api/feasim/gauge/bill6?lot_sqft=20000&zone_class=BMX-3&height=150
 *   /api/feasim/gauge/bill7?lot_sqft=20000&zone_class=BMX-3&grant_type=pre_construct
 *   /api/feasim/gauge/tod?lot_sqft=40000&zone_class=AMX-2&tod_regime=pdt&slu_urban=true&tier=with_benefits
 */
export const GET = pathwayHandler("gauge");

/** CORS preflight for the Authorization header. */
export { preflight as OPTIONS } from "@/lib/feasim/auth";
