/**
 * DBEDT State of Hawaii Data Book, every edition from 2002.
 *
 *   Series.load_from_extract("databook", { table: "20.04", name: "Pounds landed of commercial fish", geo: "HI" })
 *
 * Downloader `databook` (strategy custom, fetch.ts) stores the 24 section
 * workbooks of each edition; extractor `databook` (parse.ts) parses them
 * all, matches every edition to the base edition's series and prints the
 * latest-edition value per date. Dimensions: section, table, name, geo,
 * unit (parse.ts). Annual series.
 *
 * Extractor config: { baseEdition?: 2025 } — the edition whose tables and
 * labels define the series.
 */

import type { SourceModule } from "../../types";
import { fetchDatabook } from "./fetch";
import { DATABOOK_DIMS, parseDatabook } from "./parse";

/** Bump when the adapters, matcher or unit inference change. */
const PARSER_VERSION = 2;

export const databookSource: SourceModule = {
  key: "databook",
  description: "DBEDT State of Hawaii Data Book, 2002 to the current edition",
  version: PARSER_VERSION,
  frequency: "A",
  fetch: fetchDatabook,
  dimensions: () => DATABOOK_DIMS,
  parse: (inputs, ctx) =>
    parseDatabook(inputs, ctx.extractor.config, (m) => ctx.log(m)),
};
