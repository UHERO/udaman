export interface HhdbAccessoryImprovementAttrs {
  id?: number | null;
  tmk?: string | null;
  scraped_at?: Date | string | null;
  last_year_observed?: number | null;
  building_number?: number | null;
  description?: string | null;
  dimensions?: string | null;
  quantity?: number | null;
  year_built?: number | null;
  area?: string | null;
  percent_complete?: number | null;
  value?: number | null;
}

export class HhdbAccessoryImprovement {
  id: number | null;
  tmk: string | null;
  scrapedAt: Date | null;
  lastYearObserved: number | null;
  buildingNumber: number | null;
  description: string | null;
  dimensions: string | null;
  quantity: number | null;
  yearBuilt: number | null;
  area: string | null;
  percentComplete: number | null;
  value: number | null;

  constructor(attrs: HhdbAccessoryImprovementAttrs) {
    this.id = attrs.id != null ? Number(attrs.id) : null;
    this.tmk = attrs.tmk ?? null;
    this.scrapedAt = attrs.scraped_at ? new Date(attrs.scraped_at) : null;
    this.lastYearObserved =
      attrs.last_year_observed != null ? Number(attrs.last_year_observed) : null;
    this.buildingNumber =
      attrs.building_number != null ? Number(attrs.building_number) : null;
    this.description = attrs.description ?? null;
    this.dimensions = attrs.dimensions ?? null;
    this.quantity = attrs.quantity != null ? Number(attrs.quantity) : null;
    this.yearBuilt = attrs.year_built != null ? Number(attrs.year_built) : null;
    this.area = attrs.area ?? null;
    this.percentComplete =
      attrs.percent_complete != null ? Number(attrs.percent_complete) : null;
    this.value = attrs.value != null ? Number(attrs.value) : null;
  }

  toJSON() {
    return {
      id: this.id,
      tmk: this.tmk,
      scrapedAt: this.scrapedAt?.toISOString() ?? null,
      lastYearObserved: this.lastYearObserved,
      buildingNumber: this.buildingNumber,
      description: this.description,
      dimensions: this.dimensions,
      quantity: this.quantity,
      yearBuilt: this.yearBuilt,
      area: this.area,
      percentComplete: this.percentComplete,
      value: this.value,
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
    lastYearObserved:
      attrs.last_year_observed != null ? Number(attrs.last_year_observed) : null,
    buildingNumber:
      attrs.building_number != null ? Number(attrs.building_number) : null,
    description: attrs.description ?? null,
    dimensions: attrs.dimensions ?? null,
    quantity: attrs.quantity != null ? Number(attrs.quantity) : null,
    yearBuilt: attrs.year_built != null ? Number(attrs.year_built) : null,
    area: attrs.area ?? null,
    percentComplete:
      attrs.percent_complete != null ? Number(attrs.percent_complete) : null,
    value: attrs.value != null ? Number(attrs.value) : null,
  };
}
