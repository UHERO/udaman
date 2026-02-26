export interface HhdbLandClassificationAttrs {
  id?: number | null;
  tmk?: string | null;
  scraped_at?: Date | string | null;
  land_classification?: string | null;
  square_footage?: string | null;
  acreage?: string | null;
  agricultural_use_indicator?: string | null;
}

export class HhdbLandClassification {
  id: number | null;
  tmk: string | null;
  scrapedAt: Date | null;
  landClassification: string | null;
  squareFootage: string | null;
  acreage: string | null;
  agriculturalUseIndicator: string | null;

  constructor(attrs: HhdbLandClassificationAttrs) {
    this.id = attrs.id != null ? Number(attrs.id) : null;
    this.tmk = attrs.tmk ?? null;
    this.scrapedAt = attrs.scraped_at ? new Date(attrs.scraped_at) : null;
    this.landClassification = attrs.land_classification ?? null;
    this.squareFootage = attrs.square_footage ?? null;
    this.acreage = attrs.acreage ?? null;
    this.agriculturalUseIndicator = attrs.agricultural_use_indicator ?? null;
  }

  toJSON() {
    return {
      id: this.id,
      tmk: this.tmk,
      scrapedAt: this.scrapedAt?.toISOString() ?? null,
      landClassification: this.landClassification,
      squareFootage: this.squareFootage,
      acreage: this.acreage,
      agriculturalUseIndicator: this.agriculturalUseIndicator,
    };
  }
}

export type HhdbLandClassificationJSON = ReturnType<HhdbLandClassification["toJSON"]>;
