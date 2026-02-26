export interface HhdbAccessoryStructureAttrs {
  id?: number | null;
  tmk?: string | null;
  scraped_at?: Date | string | null;
  building_number?: string | null;
  description?: string | null;
  dimensions_units?: string | null;
  percent_complete?: string | null;
  value?: number | null;
  year_built?: number | null;
}

export class HhdbAccessoryStructure {
  id: number | null;
  tmk: string | null;
  scrapedAt: Date | null;
  buildingNumber: string | null;
  description: string | null;
  dimensionsUnits: string | null;
  percentComplete: string | null;
  value: number | null;
  yearBuilt: number | null;

  constructor(attrs: HhdbAccessoryStructureAttrs) {
    this.id = attrs.id != null ? Number(attrs.id) : null;
    this.tmk = attrs.tmk ?? null;
    this.scrapedAt = attrs.scraped_at ? new Date(attrs.scraped_at) : null;
    this.buildingNumber = attrs.building_number ?? null;
    this.description = attrs.description ?? null;
    this.dimensionsUnits = attrs.dimensions_units ?? null;
    this.percentComplete = attrs.percent_complete ?? null;
    this.value = attrs.value != null ? Number(attrs.value) : null;
    this.yearBuilt = attrs.year_built != null ? Number(attrs.year_built) : null;
  }

  toJSON() {
    return {
      id: this.id,
      tmk: this.tmk,
      scrapedAt: this.scrapedAt?.toISOString() ?? null,
      buildingNumber: this.buildingNumber,
      description: this.description,
      dimensionsUnits: this.dimensionsUnits,
      percentComplete: this.percentComplete,
      value: this.value,
      yearBuilt: this.yearBuilt,
    };
  }
}

export type HhdbAccessoryStructureJSON = ReturnType<HhdbAccessoryStructure["toJSON"]>;
