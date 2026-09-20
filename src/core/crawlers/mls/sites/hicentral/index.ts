import type { SiteAdapter } from "../../types";
import { parseDetail } from "./parse-detail";
import { parseList } from "./parse-list";
import { detailUrl, HICENTRAL_MAX_PAGE, listUrl } from "./urls";

/**
 * HiCentral — Honolulu Board of REALTORS public property search.
 * Server-rendered ASP.NET WebForms; plain GETs, no session. Every listing it
 * carries (neighbor islands included) has a 9-digit HBR MLS number.
 */
export const hicentralAdapter: SiteAdapter = {
  site: "hicentral",
  priority: 100,
  boards: ["HBR"],
  islands: ["oahu", "maui", "hawaii", "kauai", "molokai", "lanai"],
  maxPage: HICENTRAL_MAX_PAGE,
  // The site tolerated 8 concurrent requests in testing; we take one at a
  // time with 1.5–2.5s between them anyway.
  minDelayMs: 1500,
  listUrl,
  detailUrl,
  parseList,
  parseDetail,
};
