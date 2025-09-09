import type { geographies, series, units, xseries } from "@prisma/client";

export type SeasonalAdjustment =
  | "not_seasonally_adjusted"
  | "seasonally_adjusted"
  | "not_applicable";

export type Universe = "UHERO" | "DBEDT" | "NTA" | "COH" | "CCOM";

export type SeriesMetadata = series & xseries & geographies & units;
