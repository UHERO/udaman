export interface HhdbAgriculturalAssessmentAttrs {
  id?: number | null;
  tmk?: string | null;
  scraped_at?: Date | string | null;
  acres?: string | null;
  acres_in_production?: string | null;
  agricultural_type?: string | null;
  agricultural_value?: number | null;
  assessed_value?: number | null;
  description?: string | null;
  use_description?: string | null;
}

export class HhdbAgriculturalAssessment {
  id: number | null;
  tmk: string | null;
  scrapedAt: Date | null;
  acres: string | null;
  acresInProduction: string | null;
  agriculturalType: string | null;
  agriculturalValue: number | null;
  assessedValue: number | null;
  description: string | null;
  useDescription: string | null;

  constructor(attrs: HhdbAgriculturalAssessmentAttrs) {
    this.id = attrs.id != null ? Number(attrs.id) : null;
    this.tmk = attrs.tmk ?? null;
    this.scrapedAt = attrs.scraped_at ? new Date(attrs.scraped_at) : null;
    this.acres = attrs.acres ?? null;
    this.acresInProduction = attrs.acres_in_production ?? null;
    this.agriculturalType = attrs.agricultural_type ?? null;
    this.agriculturalValue =
      attrs.agricultural_value != null
        ? Number(attrs.agricultural_value)
        : null;
    this.assessedValue =
      attrs.assessed_value != null ? Number(attrs.assessed_value) : null;
    this.description = attrs.description ?? null;
    this.useDescription = attrs.use_description ?? null;
  }

  toJSON() {
    return {
      id: this.id,
      tmk: this.tmk,
      scrapedAt: this.scrapedAt?.toISOString() ?? null,
      acres: this.acres,
      acresInProduction: this.acresInProduction,
      agriculturalType: this.agriculturalType,
      agriculturalValue: this.agriculturalValue,
      assessedValue: this.assessedValue,
      description: this.description,
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
    acres: attrs.acres ?? null,
    acresInProduction: attrs.acres_in_production ?? null,
    agriculturalType: attrs.agricultural_type ?? null,
    agriculturalValue:
      attrs.agricultural_value != null
        ? Number(attrs.agricultural_value)
        : null,
    assessedValue:
      attrs.assessed_value != null ? Number(attrs.assessed_value) : null,
    description: attrs.description ?? null,
    useDescription: attrs.use_description ?? null,
  };
}
