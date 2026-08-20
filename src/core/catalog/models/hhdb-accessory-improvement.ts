export interface HhdbAccessoryImprovementAttrs {
  id?: number | null;
  tmk?: string | null;
  scraped_at?: Date | string | null;
  description?: string | null;
  quantity?: number | null;
  year_built?: number | null;
  area?: string | null;
}

export class HhdbAccessoryImprovement {
  id: number | null;
  tmk: string | null;
  scrapedAt: Date | null;
  description: string | null;
  quantity: number | null;
  yearBuilt: number | null;
  area: string | null;

  constructor(attrs: HhdbAccessoryImprovementAttrs) {
    this.id = attrs.id != null ? Number(attrs.id) : null;
    this.tmk = attrs.tmk ?? null;
    this.scrapedAt = attrs.scraped_at ? new Date(attrs.scraped_at) : null;
    this.description = attrs.description ?? null;
    this.quantity = attrs.quantity != null ? Number(attrs.quantity) : null;
    this.yearBuilt = attrs.year_built != null ? Number(attrs.year_built) : null;
    this.area = attrs.area ?? null;
  }

  toJSON() {
    return {
      id: this.id,
      tmk: this.tmk,
      scrapedAt: this.scrapedAt?.toISOString() ?? null,
      description: this.description,
      quantity: this.quantity,
      yearBuilt: this.yearBuilt,
      area: this.area,
    };
  }
}

export type HhdbAccessoryImprovementJSON = ReturnType<HhdbAccessoryImprovement["toJSON"]>;

export function hhdbAccessoryImprovementRowToJSON(
  attrs: HhdbAccessoryImprovementAttrs,
): HhdbAccessoryImprovementJSON {
  return {
    id: attrs.id != null ? Number(attrs.id) : null,
    tmk: attrs.tmk ?? null,
    scrapedAt: attrs.scraped_at
      ? new Date(attrs.scraped_at).toISOString()
      : null,
    description: attrs.description ?? null,
    quantity: attrs.quantity != null ? Number(attrs.quantity) : null,
    yearBuilt: attrs.year_built != null ? Number(attrs.year_built) : null,
    area: attrs.area ?? null,
  };
}
