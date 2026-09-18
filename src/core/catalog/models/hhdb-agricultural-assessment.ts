export interface HhdbAgriculturalAssessmentAttrs {
  id?: number | null;
  tmk?: string | null;
  scraped_at?: Date | string | null;
  last_year_observed?: number | null;
  acres_in_production?: number | null;
  agricultural_type?: string | null;
  agricultural_value?: number | null;
  use_description?: string | null;
}

export class HhdbAgriculturalAssessment {
  id: number | null;
  tmk: string | null;
  scrapedAt: Date | null;
  lastYearObserved: number | null;
  acresInProduction: number | null;
  agriculturalType: string | null;
  agriculturalValue: number | null;
  useDescription: string | null;

  constructor(attrs: HhdbAgriculturalAssessmentAttrs) {
    this.id = attrs.id != null ? Number(attrs.id) : null;
    this.tmk = attrs.tmk ?? null;
    this.scrapedAt = attrs.scraped_at ? new Date(attrs.scraped_at) : null;
    this.lastYearObserved =
      attrs.last_year_observed != null ? Number(attrs.last_year_observed) : null;
    this.acresInProduction =
      attrs.acres_in_production != null
        ? Number(attrs.acres_in_production)
        : null;
    this.agriculturalType = attrs.agricultural_type ?? null;
    this.agriculturalValue =
      attrs.agricultural_value != null
        ? Number(attrs.agricultural_value)
        : null;
    this.useDescription = attrs.use_description ?? null;
  }

  toJSON() {
    return {
      id: this.id,
      tmk: this.tmk,
      scrapedAt: this.scrapedAt?.toISOString() ?? null,
      lastYearObserved: this.lastYearObserved,
      acresInProduction: this.acresInProduction,
      agriculturalType: this.agriculturalType,
      agriculturalValue: this.agriculturalValue,
      useDescription: this.useDescription,
    };
  }
}

export type HhdbAgriculturalAssessmentJSON = ReturnType<
  HhdbAgriculturalAssessment["toJSON"]
>;

export function hhdbAgriculturalAssessmentRowToJSON(
  attrs: HhdbAgriculturalAssessmentAttrs,
): HhdbAgriculturalAssessmentJSON {
  return {
    id: attrs.id != null ? Number(attrs.id) : null,
    tmk: attrs.tmk ?? null,
    scrapedAt: attrs.scraped_at
      ? new Date(attrs.scraped_at).toISOString()
      : null,
    lastYearObserved:
      attrs.last_year_observed != null ? Number(attrs.last_year_observed) : null,
    acresInProduction:
      attrs.acres_in_production != null
        ? Number(attrs.acres_in_production)
        : null,
    agriculturalType: attrs.agricultural_type ?? null,
    agriculturalValue:
      attrs.agricultural_value != null
        ? Number(attrs.agricultural_value)
        : null,
    useDescription: attrs.use_description ?? null,
  };
}
